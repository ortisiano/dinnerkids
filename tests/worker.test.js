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
