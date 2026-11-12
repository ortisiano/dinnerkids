/**
 * worker.js — Cloudflare Worker de DinnerKids (Modo Pro / AMPA + Caché KV + Seguridad B-02 y RGPD).
 *
 * Funciones principales:
 * 1. Verificación criptográfica de Códigos Pro (DK02, DK05, DK10, AMPA) con HMAC-SHA256 en tiempo constante
 *    sin necesitar base de datos de usuarios, o soporte opcional BYOK (el padre aporta su propia API key).
 * 2. Control de cuota mensual en Cloudflare KV (DK_KV) para blindar tu presupuesto de IA al céntimo.
 * 3. Caché por hash SHA-256 en Cloudflare KV (sustituye a Qdrant a coste 0 €): si otro padre del mismo
 *    colegio sube el mismo menú escolar o pide el mismo menú, responde en milisegundos con 0 tokens.
 * 4. Anonimización RGPD (anonymizePII) y sanitización anti-prompt-injection (B-02) antes de llamar a Claude Haiku.
 */

import {
  TIER_LIMITS,
  anonymizePII,
  sanitizeField,
  sanitizePreferences,
  detectAllergensInText,
  buildClaudeMenuPrompt
} from "./logic.js";

const ALLOWED_ORIGINS = new Set([
  "https://dinnerkids.es",
  "https://www.dinnerkids.es",
  "https://dinnerkids.pages.dev"
]);

const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5";
const FALLBACK_CLAUDE_MODEL = "claude-3-5-haiku-20241022";

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === "null") return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (origin.endsWith(".dinnerkids.pages.dev") || origin.endsWith(".workers.dev")) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(origin) {
  const allowed = isAllowedOrigin(origin)
    ? origin
    : "https://dinnerkids.es";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-DK-Code, X-DK-Device, X-BYOK-Key",
    "Access-Control-Max-Age": "86400",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer"
  };
}

function jsonResponse(data, status = 200, origin = "https://dinnerkids.es") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...getCorsHeaders(origin)
    }
  });
}

/**
 * Calcula el SHA-256 en hexadecimal de un texto.
 */
export async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Calcula firma HMAC-SHA256 truncada a 10 caracteres en mayúsculas para Códigos Pro.
 */
export async function signCodePayload(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(String(payload)));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 10)
    .toUpperCase();
}

/**
 * Comparación en tiempo constante de dos cadenas para evitar ataques de timing.
 */
export function constantTimeEqual(a, b) {
  const strA = String(a || "");
  const strB = String(b || "");
  if (strA.length !== strB.length) return false;
  let diff = 0;
  for (let i = 0; i < strA.length; i++) {
    diff |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verifica un Código Pro con formato: <TIER>-<YYYYMM>-<SALT4>-<HMAC10>
 * Ejemplo: DK10-202706-A1B2-9F8E7D6C5B
 */
export async function verifyProCode(rawCode, secret, nowDate = new Date()) {
  if (!rawCode || !secret) return { valid: false, reason: "Código o secreto vacío." };
  const code = String(rawCode).trim().toUpperCase();
  const parts = code.split("-");
  if (parts.length !== 4) {
    return { valid: false, reason: "Formato de código inválido." };
  }
  const [tierKey, expYm, salt, providedMac] = parts;
  const tier = TIER_LIMITS[tierKey];
  if (!tier) {
    return { valid: false, reason: "Nivel de código desconocido." };
  }
  if (!/^\d{6}$/.test(expYm) || !/^[A-Z0-9]{4,8}$/.test(salt) || !/^[A-F0-9]{10}$/.test(providedMac)) {
    return { valid: false, reason: "Estructura de código no válida." };
  }

  const payload = `${tierKey}-${expYm}-${salt}`;
  const expectedMac = await signCodePayload(payload, secret);
  if (!constantTimeEqual(providedMac, expectedMac)) {
    return { valid: false, reason: "Firma de código inválida." };
  }

  const currentYm = `${nowDate.getUTCFullYear()}${String(nowDate.getUTCMonth() + 1).padStart(2, "0")}`;
  if (expYm < currentYm) {
    return { valid: false, reason: "El código ha caducado." };
  }

  const codeId = await sha256Hex(code);
  return {
    valid: true,
    tierKey,
    tier,
    expiresYm: expYm,
    codeId: codeId.slice(0, 24)
  };
}

/**
 * Vincula un Código Pro personal al dispositivo que lo activa por primera vez (Cloudflare KV).
 * Evita que un mismo código de donativo (DK02, DK05, DK10) se comparta entre varios usuarios,
 * sin almacenar ningún dato personal (solo un hash anónimo del token de dispositivo).
 */
export async function checkAndBindDevice(kv, codeInfo, rawDeviceId, clientIp = "127.0.0.1") {
  if (!kv) {
    return { allowed: true };
  }
  const maxDevices = codeInfo.tier.maxDevices || 1;
  // Para códigos colectivos de colegio (AMPA) permitimos hasta maxDevices familias
  const cleanDevice = String(rawDeviceId || "").trim();
  const fingerprintSource = cleanDevice.length >= 8 ? `dev:${cleanDevice}` : `ip:${clientIp}`;
  const deviceHash = (await sha256Hex(fingerprintSource)).slice(0, 20);

  const key = `bind:${codeInfo.codeId}`;
  let boundDevices = [];
  try {
    const stored = await kv.get(key, "json");
    if (Array.isArray(stored)) {
      boundDevices = stored;
    }
  } catch {
    boundDevices = [];
  }

  if (boundDevices.includes(deviceHash)) {
    return { allowed: true, deviceHash, boundCount: boundDevices.length, maxDevices };
  }

  if (boundDevices.length >= maxDevices) {
    return {
      allowed: false,
      reason: "Este código personal ya está activado en otro dispositivo y es de uso individual (1 usuario). Si quieres usar la IA en tu dispositivo, apoya el proyecto con un café (2 €) o configura tu propio token de IA."
    };
  }

  boundDevices.push(deviceHash);
  // Guardar vinculación durante 400 días
  await kv.put(key, JSON.stringify(boundDevices), { expirationTtl: 60 * 60 * 24 * 400 });
  return { allowed: true, deviceHash, boundCount: boundDevices.length, maxDevices };
}

/**
 * Comprueba y descuenta cuota mensual en Cloudflare KV (DK_KV).
 */
async function checkAndConsumeQuota(kv, codeInfo, actionType, nowDate = new Date()) {
  if (!kv) {
    return { allowed: true, remaining: 99 };
  }
  const ym = `${nowDate.getUTCFullYear()}-${String(nowDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const key = `quota:${codeInfo.codeId}:${ym}`;
  let usage = { menus: 0, ocr: 0, recipes: 0 };
  try {
    const stored = await kv.get(key, "json");
    if (stored && typeof stored === "object") usage = { ...usage, ...stored };
  } catch {
    // Continuar con contador inicial si KV aún no tiene la clave
  }

  const limits = {
    menus: codeInfo.tier.menusPerMonth,
    ocr: codeInfo.tier.ocrPerMonth,
    recipes: codeInfo.tier.recipesPerMonth
  };

  const current = usage[actionType] || 0;
  const maxAllowed = limits[actionType] || 1;
  if (current >= maxAllowed) {
    return {
      allowed: false,
      remaining: 0,
      reason: `Has alcanzado el límite mensual de tu ${codeInfo.tier.name} (${maxAllowed} ${actionType}/mes).`
    };
  }

  usage[actionType] = current + 1;
  await kv.put(key, JSON.stringify(usage), { expirationTtl: 60 * 60 * 24 * 40 });
  return {
    allowed: true,
    remaining: maxAllowed - usage[actionType],
    usage,
    limits
  };
}

/**
 * Devuelve una unidad de cuota al usuario cuando la llamada a la IA falla después
 * de haber consumido cuota (para no cobrar menús/recetas/OCR que no se entregaron).
 * Best-effort: cualquier error de KV se ignora silenciosamente.
 */
async function refundQuota(kv, codeInfo, actionType, nowDate = new Date()) {
  if (!kv || !codeInfo) return;
  const ym = `${nowDate.getUTCFullYear()}-${String(nowDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const key = `quota:${codeInfo.codeId}:${ym}`;
  try {
    const stored = await kv.get(key, "json");
    if (stored && typeof stored === "object" && Number(stored[actionType] || 0) > 0) {
      stored[actionType] = Number(stored[actionType]) - 1;
      await kv.put(key, JSON.stringify(stored), { expirationTtl: 60 * 60 * 24 * 40 });
    }
  } catch {
    // Reembolso best-effort: no bloquear la respuesta de error si KV falla.
  }
}

/**
 * Rate limit por IP real (CF-Connecting-IP) para proteger el Worker frente a abusos.
 */
async function checkIpRateLimit(kv, ip) {
  if (!kv || !ip) return true;
  const minuteBucket = Math.floor(Date.now() / 60000);
  const ipHash = (await sha256Hex(ip)).slice(0, 16);
  const key = `rl:${ipHash}:${minuteBucket}`;
  const current = Number((await kv.get(key)) || "0");
  if (current >= 20) return false;
  await kv.put(key, String(current + 1), { expirationTtl: 120 });
  return true;
}

/**
 * Llama a la API de Anthropic Claude Haiku con protección RGPD.
 */
async function callClaudeApi({ apiKey, model, system, messages, maxTokens = 4096 }) {
  const primaryModel = model || DEFAULT_CLAUDE_MODEL;

  async function postMessages(selectedModel) {
    return await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: maxTokens,
        system,
        messages
      })
    });
  }

  let res = await postMessages(primaryModel);

  // Si la cuenta de Anthropic no tiene acceso al modelo 4.5, reintentar con el fallback 3.5
  if (!res.ok && (res.status === 400 || res.status === 404) && primaryModel === DEFAULT_CLAUDE_MODEL) {
    const checkErr = await res.clone().json().catch(() => ({}));
    const msg = (checkErr?.error?.message || "").toLowerCase();
    if (msg.includes("model") || msg.includes("not found")) {
      res = await postMessages(FALLBACK_CLAUDE_MODEL);
    }
  }

  if (!res.ok) {
    let errDetail = "";
    try {
      const errJson = await res.json();
      errDetail = errJson?.error?.message || "";
    } catch {
      // ignore
    }
    const err = new Error(`Error del proveedor IA (HTTP ${res.status}): ${errDetail}`);
    err.status = res.status;
    err.detail = errDetail;
    throw err;
  }

  const data = await res.json();
  let raw = (data?.content?.[0]?.text || "").trim();
  if (raw.startsWith("```")) {
    raw = raw.split("```")[1] || raw;
    if (raw.startsWith("json")) raw = raw.slice(4);
  }
  return JSON.parse(raw.trim());
}

async function handleRequest(request, env) {
    const origin = request.headers.get("Origin") || "https://dinnerkids.es";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
    }

    const url = new URL(request.url);
    const clientIp = request.headers.get("CF-Connecting-IP") || "127.0.0.1";

    if (url.pathname === "/api/health" && request.method === "GET") {
      return jsonResponse({ ok: true, service: "dinnerkids-edge-worker" }, 200, origin);
    }

    // Rate limiting por IP en todas las rutas de API
    const withinRateLimit = await checkIpRateLimit(env.DK_KV, clientIp);
    if (!withinRateLimit) {
      return jsonResponse({ error: "Demasiadas peticiones por minuto. Espera unos segundos." }, 429, origin);
    }

    const proCode = request.headers.get("X-DK-Code") || "";
    const deviceId = request.headers.get("X-DK-Device") || "";
    const byokKey = request.headers.get("X-BYOK-Key") || "";

    // Ruta 1: Verificar y vincular estado de un Código Pro / AMPA al dispositivo actual (o validar token BYOK)
    if (url.pathname === "/api/verify-code" && request.method === "POST") {
      if (byokKey && byokKey.startsWith("sk-ant-")) {
        try {
          const testRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": byokKey.trim(),
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: DEFAULT_CLAUDE_MODEL,
              max_tokens: 10,
              messages: [{ role: "user", content: "ping" }]
            })
          });
          if (!testRes.ok) {
            const errData = await testRes.json().catch(() => ({}));
            const msg = errData?.error?.message || `HTTP ${testRes.status}`;
            return jsonResponse({ valid: false, error: `Anthropic rechazó la clave: ${msg}` }, 401, origin);
          }
          return jsonResponse({
            valid: true,
            tier: "BYOK (Tu propio Token de Claude)",
            byok: true,
            expiresYm: "Sin caducidad",
            maxDevices: 999,
            limits: { menusPerMonth: 999, ocrPerMonth: 999, recipesPerMonth: 999 }
          }, 200, origin);
        } catch {
          return jsonResponse({ valid: false, error: "No se pudo conectar con los servidores de Anthropic." }, 502, origin);
        }
      }

      const check = await verifyProCode(proCode, env.PRO_CODE_SECRET);
      if (!check.valid) {
        return jsonResponse({ valid: false, error: check.reason }, 401, origin);
      }
      const binding = await checkAndBindDevice(env.DK_KV, check, deviceId, clientIp);
      if (!binding.allowed) {
        return jsonResponse({ valid: false, error: binding.reason }, 403, origin);
      }
      return jsonResponse({
        valid: true,
        tier: check.tier.name,
        expiresYm: check.expiresYm,
        maxDevices: check.tier.maxDevices || 1,
        limits: {
          menusPerMonth: check.tier.menusPerMonth,
          ocrPerMonth: check.tier.ocrPerMonth,
          recipesPerMonth: check.tier.recipesPerMonth
        }
      }, 200, origin);
    }

    // Autenticación para endpoints IA: o bien Código Pro válido (vinculado a este dispositivo) o bien BYOK del propio usuario
    let activeApiKey = "";
    let codeInfo = null;

    if (byokKey && byokKey.startsWith("sk-ant-")) {
      activeApiKey = byokKey.trim();
    } else {
      const check = await verifyProCode(proCode, env.PRO_CODE_SECRET);
      if (!check.valid) {
        return jsonResponse({
          error: "Para usar la IA necesitas un Código de Café activo (donativo desde 2 € en Ko-fi) o configurar tu propio token de IA (sk-ant-...) en Ajustes."
        }, 401, origin);
      }
      const binding = await checkAndBindDevice(env.DK_KV, check, deviceId, clientIp);
      if (!binding.allowed) {
        return jsonResponse({ error: binding.reason }, 403, origin);
      }
      codeInfo = check;
      activeApiKey = env.ANTHROPIC_API_KEY;
      if (!activeApiKey) {
        return jsonResponse({ error: "Servicio IA pendiente de configuración en el Worker." }, 503, origin);
      }
    }

    // Ruta 2: Generación de menú mensual con IA (con caché KV por hash SHA-256)
    if (url.pathname === "/api/menu" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Cuerpo de la petición con JSON malformado." }, 400, origin);
      }
      const year = Number(body.year) || new Date().getUTCFullYear();
      const month = Number(body.month) || (new Date().getUTCMonth() + 1);
      const variante = Number(body.variante) === 2 ? 2 : 1;
      const schoolMenu = body.schoolMenu && typeof body.schoolMenu === "object" ? body.schoolMenu : {};
      const preferences = sanitizePreferences(body.preferences || "");
      const allergens = sanitizeField(body.allergens || "", 200);
      const routines = sanitizeField(body.routines || "", 300);
      const equipment = Array.isArray(body.equipment) ? body.equipment : [];

      const cachePayload = JSON.stringify({ year, month, variante, schoolMenu, preferences, allergens, routines, equipment });
      const cacheKey = `cache:menu:${await sha256Hex(cachePayload)}`;

      if (env.DK_KV) {
        const cached = await env.DK_KV.get(cacheKey, "json");
        if (cached) {
          return jsonResponse({ menu: cached, cached: true }, 200, origin);
        }
      }

      if (codeInfo) {
        const quota = await checkAndConsumeQuota(env.DK_KV, codeInfo, "menus");
        if (!quota.allowed) {
          return jsonResponse({ error: quota.reason }, 429, origin);
        }
      }

      const { systemPrompt, userContent } = buildClaudeMenuPrompt({
        year,
        month,
        schoolMenu,
        preferences,
        variante,
        allergens,
        equipment,
        routines
      });

      let menuData;
      try {
        menuData = await callClaudeApi({
          apiKey: activeApiKey,
          model: env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
          maxTokens: 4096
        });
      } catch (err) {
        await refundQuota(env.DK_KV, codeInfo, "menus");
        let errMsg = "La IA no respondió correctamente. Inténtalo de nuevo en unos segundos.";
        if (!codeInfo && byokKey) {
          if (err.status === 401) {
            errMsg = "Tu clave de Anthropic (sk-ant-...) no es válida o ha sido revocada.";
          } else if (err.status === 400 && (err.detail || "").toLowerCase().includes("credit")) {
            errMsg = "Tu cuenta de Anthropic no tiene saldo suficiente en console.anthropic.com.";
          } else if (err.detail) {
            errMsg = `Error de Anthropic: ${sanitizeField(err.detail, 150)}`;
          }
        }
        return jsonResponse({ error: errMsg }, err.status === 401 ? 401 : 502, origin);
      }

      if (env.DK_KV && menuData && typeof menuData === "object") {
        await env.DK_KV.put(cacheKey, JSON.stringify(menuData), { expirationTtl: 60 * 60 * 24 * 35 });
      }

      return jsonResponse({ menu: menuData, cached: false }, 200, origin);
    }

    // Ruta 3: Receta detallada con IA para un plato concreto
    if (url.pathname === "/api/recipe" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Cuerpo de la petición con JSON malformado." }, 400, origin);
      }
      const plato = sanitizeField(body.plato || "", 100);
      const guarnicion = sanitizeField(body.guarnicion || "", 100);
      const allergens = sanitizeField(body.allergens || "", 150);
      if (!plato) {
        return jsonResponse({ error: "Indica el nombre del plato." }, 400, origin);
      }

      const cacheKey = `cache:recipe:${await sha256Hex(`${plato}|${guarnicion}|${allergens}`)}`;
      if (env.DK_KV) {
        const cached = await env.DK_KV.get(cacheKey, "json");
        if (cached) return jsonResponse({ recipe: cached, cached: true }, 200, origin);
      }

      if (codeInfo) {
        const quota = await checkAndConsumeQuota(env.DK_KV, codeInfo, "recipes");
        if (!quota.allowed) return jsonResponse({ error: quota.reason }, 429, origin);
      }

      const system = "Eres un chef familiar infantil. Responde SOLO con un JSON válido: {\"titulo\":\"...\",\"tiempo\":\"15 min\",\"ingredientes\":[\"...\"],\"pasos\":[\"...\"],\"truco_ninos\":\"...\"}";
      const user = `<plato_solicitado>Plato: ${plato}. Guarnición: ${guarnicion}. Alérgenos a evitar: ${allergens || "ninguno"}.</plato_solicitado>`;

      let recipe;
      try {
        recipe = await callClaudeApi({
          apiKey: activeApiKey,
          model: env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL,
          system,
          messages: [{ role: "user", content: user }],
          maxTokens: 1024
        });
      } catch (err) {
        await refundQuota(env.DK_KV, codeInfo, "recipes");
        let errMsg = "La IA no respondió correctamente. Inténtalo de nuevo en unos segundos.";
        if (!codeInfo && byokKey) {
          if (err.status === 401) {
            errMsg = "Tu clave de Anthropic (sk-ant-...) no es válida o ha sido revocada.";
          } else if (err.status === 400 && (err.detail || "").toLowerCase().includes("credit")) {
            errMsg = "Tu cuenta de Anthropic no tiene saldo suficiente en console.anthropic.com.";
          } else if (err.detail) {
            errMsg = `Error de Anthropic: ${sanitizeField(err.detail, 150)}`;
          }
        }
        return jsonResponse({ error: errMsg }, err.status === 401 ? 401 : 502, origin);
      }

      if (env.DK_KV && recipe) {
        await env.DK_KV.put(cacheKey, JSON.stringify(recipe), { expirationTtl: 60 * 60 * 24 * 60 });
      }

      return jsonResponse({ recipe, cached: false }, 200, origin);
    }

    // Ruta 4: Extracción OCR del menú escolar con Claude Vision (con caché KV por hash de imagen)
    if (url.pathname === "/api/ocr" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Cuerpo de la petición con JSON malformado." }, 400, origin);
      }
      const base64Data = String(body.base64 || "").trim();
      const mimeType = String(body.mimeType || "image/jpeg").trim();
      const year = Number(body.year) || new Date().getUTCFullYear();
      const month = Number(body.month) || (new Date().getUTCMonth() + 1);

      if (!base64Data || base64Data.length > 7_000_000) {
        return jsonResponse({ error: "Imagen vacía o superior a 5 MB." }, 400, origin);
      }

      const imgHash = await sha256Hex(`${year}-${month}:${base64Data}`);
      const cacheKey = `cache:ocr:${imgHash}`;
      if (env.DK_KV) {
        const cached = await env.DK_KV.get(cacheKey, "json");
        if (cached) {
          return jsonResponse({ schoolMenu: cached, cached: true }, 200, origin);
        }
      }

      if (codeInfo) {
        const quota = await checkAndConsumeQuota(env.DK_KV, codeInfo, "ocr");
        if (!quota.allowed) return jsonResponse({ error: quota.reason }, 429, origin);
      }

      const system = "Extrae el menú escolar mensual de la imagen y devuelve ÚNICAMENTE un JSON válido con formato: {\"YYYY-MM-DD\": {\"primero\":\"...\",\"segundo\":\"...\",\"postre\":\"...\",\"menu\":\"...\"}}. No incluyas ningún nombre propio ni dato personal.";
      let rawExtracted;
      try {
        rawExtracted = await callClaudeApi({
          apiKey: activeApiKey,
          model: env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL,
          system,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeType,
                    data: base64Data
                  }
                },
                {
                  type: "text",
                  text: `Extrae los almuerzos de los días lectivos del mes ${month}/${year} en JSON.`
                }
              ]
            }
          ],
          maxTokens: 4096
        });
      } catch (err) {
        await refundQuota(env.DK_KV, codeInfo, "ocr");
        let errMsg = "La IA no pudo leer la imagen. Inténtalo de nuevo con una foto más nítida.";
        if (!codeInfo && byokKey) {
          if (err.status === 401) {
            errMsg = "Tu clave de Anthropic (sk-ant-...) no es válida o ha sido revocada.";
          } else if (err.status === 400 && (err.detail || "").toLowerCase().includes("credit")) {
            errMsg = "Tu cuenta de Anthropic no tiene saldo suficiente en console.anthropic.com.";
          } else if (err.detail) {
            errMsg = `Error de Anthropic: ${sanitizeField(err.detail, 150)}`;
          }
        }
        return jsonResponse({ error: errMsg }, err.status === 401 ? 401 : 502, origin);
      }

      const normalized = {};
      for (const [dateKey, val] of Object.entries(rawExtracted || {})) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
        const primero = sanitizeField(val?.primero || "", 120);
        const segundo = sanitizeField(val?.segundo || "", 120);
        const postre = sanitizeField(val?.postre || "", 80);
        const menuTxt = sanitizeField(val?.menu || [primero, segundo, postre].filter(Boolean).join(" / "), 220);
        const alergenos = detectAllergensInText(`${primero} ${segundo} ${postre} ${menuTxt}`);
        normalized[dateKey] = { primero, segundo, postre, menu: menuTxt, alergenos };
      }

      if (env.DK_KV && Object.keys(normalized).length > 0) {
        await env.DK_KV.put(cacheKey, JSON.stringify(normalized), { expirationTtl: 60 * 60 * 24 * 45 });
      }

      return jsonResponse({ schoolMenu: normalized, cached: false }, 200, origin);
    }

    return jsonResponse({ error: "Ruta no encontrada." }, 404, origin);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch {
      // Red de seguridad: cualquier error inesperado (KV, red, parsing interno)
      // devuelve JSON genérico en lugar de un 500 HTML con detalles internos.
      const origin = request.headers.get("Origin") || "https://dinnerkids.es";
      return jsonResponse({ error: "Error interno del servidor. Inténtalo de nuevo en unos segundos." }, 500, origin);
    }
  }
};
