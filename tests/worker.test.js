import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { signCodePayload, verifyProCode } from "../worker.js";

const TEST_SECRET = "secreto_pruebas_dinnerkids_2026_seguro";

async function makeTestCode(tierKey = "DK10", expYm = "202806", salt = "A1B2") {
  const payload = `${tierKey}-${expYm}-${salt}`;
  const mac = await signCodePayload(payload, TEST_SECRET);
  return `${payload}-${mac}`;
}

test("verifyProCode acepta códigos firmados válidos y rechaza manipulados o caducados", async () => {
  const validCode = await makeTestCode("DK10", "202806", "CAFE");
  const now = new Date("2026-11-10T12:00:00Z");

  const okRes = await verifyProCode(validCode, TEST_SECRET, now);
  assert.equal(okRes.valid, true);
  assert.equal(okRes.tierKey, "DK10");
  assert.equal(okRes.tier.menusPerMonth, 25);

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

test("Worker responde /api/health y verifica /api/verify-code con cabeceras de seguridad", async () => {
  const env = { PRO_CODE_SECRET: TEST_SECRET };
  const healthReq = new Request("https://api.dinnerkids.es/api/health", {
    method: "GET",
    headers: { Origin: "https://dinnerkids.es" }
  });
  const healthRes = await worker.fetch(healthReq, env);
  assert.equal(healthRes.status, 200);
  assert.equal(healthRes.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(healthRes.headers.get("X-Frame-Options"), "DENY");

  const code = await makeTestCode("DK05", "202812", "F00D");
  const verifyReq = new Request("https://api.dinnerkids.es/api/verify-code", {
    method: "POST",
    headers: {
      Origin: "https://dinnerkids.es",
      "X-DK-Code": code
    }
  });
  const verifyRes = await worker.fetch(verifyReq, env);
  assert.equal(verifyRes.status, 200);
  const body = await verifyRes.json();
  assert.equal(body.valid, true);
  assert.equal(body.limits.menusPerMonth, 10);
});
