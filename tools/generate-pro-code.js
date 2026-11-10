/**
 * tools/generate-pro-code.js — Generador local de Códigos Pro y AMPA para DinnerKids.
 *
 * Uso desde tu terminal:
 *   PRO_CODE_SECRET="tu_secreto_largo" node tools/generate-pro-code.js DK10 202706
 *
 * Niveles disponibles:
 *   - DK02 : Café Solidario (2 €)        -> 3 menús IA/mes, 1 OCR/mes, 10 recetas/mes
 *   - DK05 : Pase Trimestral (5 €)       -> 10 menús IA/mes, 4 OCR/mes, 35 recetas/mes
 *   - DK10 : Pase Curso Escolar (10 €)   -> 25 menús IA/mes, 12 OCR/mes, 80 recetas/mes
 *   - AMPA : Plan Colegio / AMPA (49 €)  -> 400 menús IA/mes, 20 OCR/mes, 1000 recetas/mes
 */

import { TIER_LIMITS } from "../logic.js";
import { signCodePayload as signWorker } from "../worker.js";
import crypto from "node:crypto";

async function main() {
  const tierKey = (process.argv[2] || "DK10").toUpperCase();
  const expiresYm = process.argv[3] || "202706";
  const secret = process.env.PRO_CODE_SECRET || "CAMBIA_ESTE_SECRETO_EN_CLOUDFLARE";

  if (!TIER_LIMITS[tierKey]) {
    console.error(`Nivel desconocido: ${tierKey}. Usa: ${Object.keys(TIER_LIMITS).join(", ")}`);
    process.exit(1);
  }
  if (!/^\d{6}$/.test(expiresYm)) {
    console.error("El segundo parámetro debe ser YYYYMM (por ejemplo 202706 para junio de 2027).");
    process.exit(1);
  }

  const salt = crypto.randomBytes(3).toString("hex").toUpperCase();
  const payload = `${tierKey}-${expiresYm}-${salt}`;
  const mac = await signWorker(payload, secret);
  const fullCode = `${payload}-${mac}`;

  const tier = TIER_LIMITS[tierKey];
  console.log("==================================================");
  console.log(`Código generado : ${fullCode}`);
  console.log(`Plan            : ${tier.name}`);
  console.log(`Válido hasta    : ${expiresYm.slice(4, 6)}/${expiresYm.slice(0, 4)}`);
  console.log(`Cuota mensual   : ${tier.menusPerMonth} menús IA · ${tier.ocrPerMonth} OCR · ${tier.recipesPerMonth} recetas`);
  console.log(`Coste IA máx/mes: ~${tier.estimatedAiCostEur.toFixed(2)} €`);
  console.log("==================================================");
}

main();
