import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { signCodePayload, verifyProCode, checkAndBindDevice } from "../worker.js";

const TEST_SECRET = "secreto_pruebas_dinnerkids_2026_seguro";

function createMockKv() {
  const store = new Map();
  return {
    async get(key, type) {
      if (!store.has(key)) return null;
      const val = store.get(key);
      return type === "json" ? JSON.parse(val) : val;
    },
    async put(key, val) {
      store.set(key, String(val));
    }
  };
}

async function makeTestCode(tierKey = "DK02", expYm = "202806", salt = "A1B2") {
  const payload = `${tierKey}-${expYm}-${salt}`;
  const mac = await signCodePayload(payload, TEST_SECRET);
  return `${payload}-${mac}`;
}

test("verifyProCode acepta códigos firmados válidos y rechaza manipulados o caducados", async () => {
  const validCode = await makeTestCode("DK02", "202806", "CAFE");
  const now = new Date("2026-11-10T12:00:00Z");

  const okRes = await verifyProCode(validCode, TEST_SECRET, now);
  assert.equal(okRes.valid, true);
  assert.equal(okRes.tierKey, "DK02");
  assert.equal(okRes.tier.menusPerMonth, 8);
  assert.equal(okRes.tier.maxDevices, 1);

  // Manipular 1 carácter de la firma
  const tampered = validCode.slice(0, -1) + (validCode.endsWith("A") ? "B" : "A");
  const badRes = await verifyProCode(tampered, TEST_SECRET, now);
  assert.equal(badRes.valid, false);

  // Código caducado
  const expiredCode = await makeTestCode("DK02", "202501", "CAFE");
  const expRes = await verifyProCode(expiredCode, TEST_SECRET, now);
  assert.equal(expRes.valid, false);
  assert.match(expRes.reason, /caducado/i);
});

test("checkAndBindDevice bloquea un código personal DK02 al primer dispositivo y rechaza compartirlo con otro usuario", async () => {
  const kv = createMockKv();
  const code = await makeTestCode("DK02", "202812", "UNIQ");
  const info = await verifyProCode(code, TEST_SECRET, new Date("2026-11-10T12:00:00Z"));

  // Primer dispositivo activa el código -> permitido
  const firstBind = await checkAndBindDevice(kv, info, "device-uuid-usuario-1", "1.1.1.1");
  assert.equal(firstBind.allowed, true);

  // El mismo dispositivo vuelve a usarlo -> permitido
  const repeatBind = await checkAndBindDevice(kv, info, "device-uuid-usuario-1", "1.1.1.1");
  assert.equal(repeatBind.allowed, true);

  // Un segundo usuario intenta usar el mismo código en otro móvil -> bloqueado (403)
  const secondUserBind = await checkAndBindDevice(kv, info, "device-uuid-usuario-2", "2.2.2.2");
  assert.equal(secondUserBind.allowed, false);
  assert.match(secondUserBind.reason, /uso individual/i);
});

test("Worker responde /api/health y verifica /api/verify-code vinculando dispositivo", async () => {
  const kv = createMockKv();
  const env = { PRO_CODE_SECRET: TEST_SECRET, DK_KV: kv };
  const healthReq = new Request("https://api.dinnerkids.es/api/health", {
    method: "GET",
    headers: { Origin: "https://dinnerkids.es" }
  });
  const healthRes = await worker.fetch(healthReq, env);
  assert.equal(healthRes.status, 200);
  assert.equal(healthRes.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(healthRes.headers.get("X-Frame-Options"), "DENY");

  const code = await makeTestCode("DK02", "202812", "F00D");
  const verifyReq1 = new Request("https://api.dinnerkids.es/api/verify-code", {
    method: "POST",
    headers: {
      Origin: "https://dinnerkids.es",
      "X-DK-Code": code,
      "X-DK-Device": "mi-movil-personal-001"
    }
  });
  const verifyRes1 = await worker.fetch(verifyReq1, env);
  assert.equal(verifyRes1.status, 200);
  const body1 = await verifyRes1.json();
  assert.equal(body1.valid, true);
  assert.equal(body1.limits.menusPerMonth, 8);

  // Si se pasa el código a un segundo móvil distinto, el Worker responde 403
  const verifyReq2 = new Request("https://api.dinnerkids.es/api/verify-code", {
    method: "POST",
    headers: {
      Origin: "https://dinnerkids.es",
      "X-DK-Code": code,
      "X-DK-Device": "movil-de-otro-padre-999"
    }
  });
  const verifyRes2 = await worker.fetch(verifyReq2, env);
  assert.equal(verifyRes2.status, 403);
});


// ---------------------------------------------------------------------------
// Tests de las rutas IA (/api/menu, /api/recipe, /api/ocr) con fetch simulado.
// Antes de este bloque solo /api/health y /api/verify-code tenían cobertura;
// estas rutas son las que consumen tokens y presupuesto reales.
// ---------------------------------------------------------------------------

/** Sustituye globalThis.fetch por un handler controlado y devuelve un controlador con contador y restore. */
function stubClaudeFetch(handler) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, opts) => {
    calls += 1;
    return handler(url, opts);
  };
  return {
    get calls() { return calls; },
    restore() { globalThis.fetch = original; }
  };
}

/** Respuesta estilo Anthropic Messages API con un JSON de texto embebido. */
function claudeJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(payload) }] }), { status });
}

function aiEnv(kv) {
  return { PRO_CODE_SECRET: TEST_SECRET, DK_KV: kv, ANTHROPIC_API_KEY: "sk-ant-api03-clave_de_pruebas" };
}

function aiRequest(path, code, body, device = "device-test-ia") {
  return new Request(`https://api.dinnerkids.es${path}`, {
    method: "POST",
    headers: {
      Origin: "https://dinnerkids.es",
      "Content-Type": "application/json",
      "X-DK-Code": code,
      "X-DK-Device": device
    },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

async function makeAiCode(tierKey = "DK02", expYm = "202812", salt = "TEST") {
  const code = await makeTestCode(tierKey, expYm, salt);
  const info = await verifyProCode(code, TEST_SECRET, new Date("2026-11-10T12:00:00Z"));
  return { code, codeId: info.codeId };
}

test("Worker /api/menu devuelve menú JSON y sirve la segunda petición idéntica desde caché KV", async (t) => {
  const kv = createMockKv();
  const stub = stubClaudeFetch(async () =>
    claudeJsonResponse({ "2026-11-02": { cena: "Tortilla francesa", guarnicion: "Tomate", postre: "Fruta", tiempo: "8 min", nota: null } })
  );
  t.after(() => stub.restore());
  const { code } = await makeAiCode("DK02", "202812", "MENU");

  const body = { year: 2026, month: 11, schoolMenu: { "2026-11-02": { menu: "Lentejas / Pollo" } }, preferences: "" };
  const res1 = await worker.fetch(aiRequest("/api/menu", code, body), aiEnv(kv));
  assert.equal(res1.status, 200);
  assert.equal(res1.headers.get("Content-Type").includes("application/json"), true);
  const data1 = await res1.json();
  assert.equal(data1.cached, false);
  assert.equal(data1.menu["2026-11-02"].cena, "Tortilla francesa");

  const res2 = await worker.fetch(aiRequest("/api/menu", code, body), aiEnv(kv));
  const data2 = await res2.json();
  assert.equal(data2.cached, true, "La petición idéntica debe venir del caché KV");
  assert.equal(stub.calls, 1, "La IA solo debe llamarse una vez para dos peticiones idénticas");
});

test("Worker /api/menu devuelve 502 JSON y reembolsa la cuota cuando la IA falla", async (t) => {
  const kv = createMockKv();
  const stub = stubClaudeFetch(async () => claudeJsonResponse({}, 500));
  t.after(() => stub.restore());
  const { code, codeId } = await makeAiCode("DK02", "202812", "FAIL");

  const res = await worker.fetch(aiRequest("/api/menu", code, { year: 2026, month: 11 }), aiEnv(kv));
  assert.equal(res.status, 502);
  assert.equal(res.headers.get("Content-Type").includes("application/json"), true);
  const data = await res.json();
  assert.match(data.error, /IA no respondió/i);
  assert.ok(!JSON.stringify(data).includes("sk-ant"), "El error nunca debe filtrar claves ni detalles del proveedor");

  const ym = "2026-11";
  const usage = await kv.get(`quota:${codeId}:${ym}`, "json");
  assert.equal(usage.menus, 0, "La cuota consumida debe reembolsarse cuando la IA falla");
});

test("Worker rechaza un cuerpo JSON malformado con 400 JSON (no con 500 HTML)", async (t) => {
  const kv = createMockKv();
  const stub = stubClaudeFetch(async () => claudeJsonResponse({}));
  t.after(() => stub.restore());
  const { code } = await makeAiCode("DK02", "202812", "JSON");

  const res = await worker.fetch(aiRequest("/api/menu", code, "{esto_no_es_json"), aiEnv(kv));
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("Content-Type").includes("application/json"), true);
  const data = await res.json();
  assert.match(data.error, /malformado/i);
});

test("Worker /api/recipe valida la entrada, genera y cachea la receta", async (t) => {
  const kv = createMockKv();
  const stub = stubClaudeFetch(async () =>
    claudeJsonResponse({ titulo: "Merluza", tiempo: "12 min", ingredientes: ["Merluza", "Patata"], pasos: ["Cocinar"], truco_ninos: "Con salsa suave" })
  );
  t.after(() => stub.restore());
  const { code } = await makeAiCode("DK02", "202812", "RCPE");
  const env = aiEnv(kv);

  const badRes = await worker.fetch(aiRequest("/api/recipe", code, { plato: "" }), env);
  assert.equal(badRes.status, 400);

  const okRes = await worker.fetch(aiRequest("/api/recipe", code, { plato: "Merluza a la plancha", guarnicion: "Patata", allergens: "" }), env);
  assert.equal(okRes.status, 200);
  const data = await okRes.json();
  assert.equal(data.recipe.titulo, "Merluza");

  const cachedRes = await worker.fetch(aiRequest("/api/recipe", code, { plato: "Merluza a la plancha", guarnicion: "Patata", allergens: "" }), env);
  assert.equal((await cachedRes.json()).cached, true);
  assert.equal(stub.calls, 1);
});

test("Worker /api/ocr normaliza el menú extraído con alérgenos detectados y rechaza imágenes enormes", async (t) => {
  const kv = createMockKv();
  const stub = stubClaudeFetch(async () =>
    claudeJsonResponse({
      "2026-11-02": { primero: "Macarrones con queso gratinado", segundo: "Merluza al horno", postre: "Fruta" },
      "fecha_invalida": { primero: "X" }
    })
  );
  t.after(() => stub.restore());
  const { code } = await makeAiCode("DK02", "202812", "OCRX");
  const env = aiEnv(kv);

  const okRes = await worker.fetch(aiRequest("/api/ocr", code, { base64: "aGk=", mimeType: "image/jpeg", year: 2026, month: 11 }), env);
  assert.equal(okRes.status, 200);
  const data = await okRes.json();
  const day = data.schoolMenu["2026-11-02"];
  assert.ok(day, "Debe normalizar las fechas válidas");
  assert.ok(Array.isArray(day.alergenos), "Debe incluir la lista de alérgenos detectados");
  assert.ok(day.alergenos.includes("Gluten"));
  assert.ok(day.alergenos.includes("Pescado"));
  assert.equal(data.schoolMenu["fecha_invalida"], undefined, "Debe descartar claves que no sean fechas YYYY-MM-DD");

  const bigRes = await worker.fetch(aiRequest("/api/ocr", code, { base64: "A".repeat(7_000_001), mimeType: "image/jpeg", year: 2026, month: 11 }), env);
  assert.equal(bigRes.status, 400);
});

test("Worker aplica rate limit por IP: la petición 21 en un minuto recibe 429", async () => {
  const kv = createMockKv();
  const env = { PRO_CODE_SECRET: TEST_SECRET, DK_KV: kv };
  let lastStatus = 0;
  for (let i = 0; i < 21; i++) {
    const res = await worker.fetch(new Request("https://api.dinnerkids.es/api/menu", {
      method: "POST",
      headers: { Origin: "https://dinnerkids.es", "Content-Type": "application/json" },
      body: "{}"
    }), env);
    lastStatus = res.status;
  }
  assert.equal(lastStatus, 429, "Tras 20 peticiones/minuto desde la misma IP debe bloquear con 429");
});

test("Worker nunca filtra el secreto ni la clave en errores: /api/menu sin código responde 401 JSON genérico", async () => {
  const kv = createMockKv();
  const res = await worker.fetch(aiRequest("/api/menu", "CODIGO-FALSO-0000-ABCDEF1234", { year: 2026, month: 11 }), aiEnv(kv));
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Código de Café|token/i);
  const body = JSON.stringify(data);
  assert.ok(!body.includes(TEST_SECRET), "Nunca debe filtrar PRO_CODE_SECRET");
  assert.ok(!body.includes("sk-ant-api03-clave_de_pruebas"), "Nunca debe filtrar ANTHROPIC_API_KEY");
});

test("Worker gestiona CORS dinámico para cualquier puerto local y rechaza orígenes sospechosos", async () => {
  const env = { PRO_CODE_SECRET: TEST_SECRET, DK_KV: createMockKv() };

  // Puerto 5500 (Live Server)
  const res5500 = await worker.fetch(new Request("https://api.dinnerkids.es/api/health", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5500" }
  }), env);
  assert.equal(res5500.headers.get("Access-Control-Allow-Origin"), "http://localhost:5500");

  // 127.0.0.1:3000
  const res127 = await worker.fetch(new Request("https://api.dinnerkids.es/api/health", {
    method: "OPTIONS",
    headers: { Origin: "http://127.0.0.1:3000" }
  }), env);
  assert.equal(res127.headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:3000");

  // file:// (Origin: null)
  const resNull = await worker.fetch(new Request("https://api.dinnerkids.es/api/health", {
    method: "OPTIONS",
    headers: { Origin: "null" }
  }), env);
  assert.equal(resNull.headers.get("Access-Control-Allow-Origin"), "null");

  // Origen no autorizado -> cae a dinnerkids.es
  const resBad = await worker.fetch(new Request("https://api.dinnerkids.es/api/health", {
    method: "OPTIONS",
    headers: { Origin: "https://sitio-malicioso.com" }
  }), env);
  assert.equal(resBad.headers.get("Access-Control-Allow-Origin"), "https://dinnerkids.es");
});

test("Worker acepta token BYOK X-BYOK-Key para /api/menu sin necesitar código de pago", async (t) => {
  const kv = createMockKv();
  const stub = stubClaudeFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ text: JSON.stringify({ "2026-11-01": { cena: "Tortilla francesa", guarnicion: "Tomate" } }) }]
    })
  }));
  t.after(() => stub.restore());

  const req = new Request("https://api.dinnerkids.es/api/menu", {
    method: "POST",
    headers: {
      Origin: "http://localhost:5500",
      "Content-Type": "application/json",
      "X-BYOK-Key": "sk-ant-api03-usuario-token-propio-12345"
    },
    body: JSON.stringify({ year: 2026, month: 11, schoolMenu: {} })
  });

  const res = await worker.fetch(req, { PRO_CODE_SECRET: TEST_SECRET, DK_KV: kv });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "http://localhost:5500");
  const data = await res.json();
  assert.ok(data.menu["2026-11-01"], "Debe generar menú usando la clave BYOK sin requerir pago");
});
