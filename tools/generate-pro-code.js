/**
 * tools/generate-pro-code.js — Generador local de Códigos Personales de Café (1 usuario) y AMPA para DinnerKids.
 *
 * Uso desde tu terminal:
 *   PRO_CODE_SECRET="tu_secreto_largo" node tools/generate-pro-code.js DK02 202706
 *   # O para generar p. ej. 10 códigos individuales distintos de golpe:
 *   PRO_CODE_SECRET="tu_secreto_largo" node tools/generate-pro-code.js DK02 202706 10
 *
 * Cada código personal (DK02, DK05) queda bloqueado al primer dispositivo que lo activa en el Cloudflare Worker,
 * impidiendo que varios usuarios se pasen el mismo código.
 */

import { TIER_LIMITS } from "../logic.js";
import { signCodePayload as signWorker } from "../worker.js";
import crypto from "node:crypto";

async function main() {
  const tierKey = (process.argv[2] || "DK02").toUpperCase();
  const expiresYm = process.argv[3] || "202706";
  const count = Math.min(Math.max(Number(process.argv[4]) || 1, 1), 100);
  const secret = process.env.PRO_CODE_SECRET || "CAMBIA_ESTE_SECRETO_EN_CLOUDFLARE";

  if (!TIER_LIMITS[tierKey]) {
    console.error(`Nivel desconocido: ${tierKey}. Usa: ${Object.keys(TIER_LIMITS).join(", ")}`);
    process.exit(1);
  }
  if (!/^\d{6}$/.test(expiresYm)) {
    console.error("El segundo parámetro debe ser YYYYMM (por ejemplo 202706 para junio de 2027).");
    process.exit(1);
  }

  const tier = TIER_LIMITS[tierKey];
  console.log("==================================================");
  console.log(`Plan            : ${tier.name}`);
  console.log(`Válido hasta    : ${expiresYm.slice(4, 6)}/${expiresYm.slice(0, 4)}`);
  console.log(`Dispositivos máx: ${tier.maxDevices || 1} usuario(s)`);
  console.log(`Cuota mensual   : ${tier.menusPerMonth} menús IA · ${tier.ocrPerMonth} OCR · ${tier.recipesPerMonth} recetas`);
  console.log(`Coste IA máx/mes: ~${tier.estimatedAiCostEur.toFixed(2)} €`);
  console.log("--------------------------------------------------");

  for (let i = 0; i < count; i++) {
    const salt = crypto.randomBytes(3).toString("hex").toUpperCase();
    const payload = `${tierKey}-${expiresYm}-${salt}`;
    const mac = await signWorker(payload, secret);
    console.log(`${payload}-${mac}`);
  }
  console.log("==================================================");
}

main();
