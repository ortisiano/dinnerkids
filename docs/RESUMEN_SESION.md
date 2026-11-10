# Resumen Ejecutivo y Estado — DinnerKids Edge PWA (`edge-pwa`)

> **Nota:** Este archivo sirve para transferir todo el conocimiento, estado técnico, legal y comercial acordado en el chat de diseño al chat de desarrollo de DinnerKids.

---

## 1. Estado en GitHub y en Local
- **Repositorio Remoto:** `https://github.com/ortisiano/dinnerkids-private`
- **Rama Actual:** `edge-pwa` (Subida a GitHub y limpia en local).
- **Ruta local en Windows:** `C:\Users\carlos\Documents\dinnerkids`
- **Últimos commits aplicados:**
  - `docs: añadir CONTEXTO.md completo para sesiones futuras en Antigravity`
  - `feat: añadir servidor local en Node (tools/dev-server.js) sin depender de Python`
  - `feat: DinnerKids Edge PWA + Cloudflare Worker (arquitectura ligera coste 0)`

---

## 2. Decisiones Clave Tomadas en la Sesión

### A. Deuda Técnica Eliminada (Transición de `lab` a `edge-pwa`)
- **Antes (en `lab`):** 7 contenedores pesados (Reflex Python consumiendo 1.4 GB de RAM, Postgres, Qdrant usado solo como tabla de hash, Redis, RQ Worker, Caddy). Exigía VPS de pago.
- **Ahora (en `edge-pwa`):** 
  - **PWA nativa sin frameworks** (`index.html`, `logic.js`, `sw.js`): Carga instantánea, corre 100% en el navegador del usuario y se aloja gratis en **Cloudflare Pages** conectando el repo privado.
  - **Modo Gratis (Coste 0 € IA):** Motor local (`generateLocalMonthlyMenu` en `logic.js`) que usa el recetario de 100 platos (`RECIPES`) para cuadrar cenas complementarias al menú del cole evitando alérgenos y grupos repetidos.
  - **Viralidad por WhatsApp (`#cole=...`):** Comparte el menú del cole por URL codificada sin base de datos ni datos personales.
  - **Worker Edge (`worker.js`) + Cloudflare KV (`DK_KV`):** Reemplaza a Qdrant a coste 0 €. Hace el OCR de fotos y menús con IA solo para quienes pagan o traen su API Key (`BYOK`).

### B. Monetización, Sponsors y Precios Blindados
Claude Haiku 4.5 cuesta ~0,004 € por menú mensual y ~0,003 € por OCR:
- **☕ 2 € (Café Solidario - `DK02`):** 3 menús IA · 1 OCR · 10 recetas (Coste IA máx: ~0,03 € → Margen ~98,5 %).
- **🚀 5 € (Pase Trimestre - `DK05`):** 10 menús IA · 4 OCR · 35 recetas (Coste IA máx: ~0,09 € → Margen ~98,2 %).
- **🏆 10 € (Curso Escolar - `DK10`):** 25 menús IA · 12 OCR · 80 recetas (Coste IA máx: ~0,24 € → Margen ~97,6 %).
- **🏫 49 € (Colegio / AMPA - `AMPA`):** 400 menús IA · 20 OCR · 1000 recetas (Coste IA máx: ~1,80 € → Margen ~96,3 %).

Los códigos se firman y verifican con HMAC-SHA256 sin requerir base de datos de usuarios (`tools/generate-pro-code.js`).

### C. Legalidad, Trabajo Actual y Autónomo
- **Puesto actual:** Especialista Nivel 2 (L2) de Storage. No hay incompatibilidad ni concurrencia desleal con vender joyas o una app de cenas escolares.
- **Higiene:** Trabajar desde PC personal, fuera de horario laboral y en repositorios privados.
- **Cobros sin ser autónomo todavía:** Mantener en Stripe / Ko-fi activado **Retiradas manuales (Manual Payouts)**. Acumular saldo en la plataforma y transferirlo al banco solo cuando se tramite el alta de autónomo con Lilium Glow (un único alta de autónomo cubre joyas y servicios de software).
- **RGPD (Art. 25):** Privacidad por diseño. No se guardan datos de menores ni cuentas. Las preferencias viven en el `localStorage` del cliente. `anonymizePII()` en `logic.js` borra nombres, correos, DNIs, teléfonos e IBANs antes de enviar prompts a la IA.

---

## 3. Archivos Clave para Referencia Rápida
- [`CONTEXTO.md`](file:///C:/Users/carlos/Documents/dinnerkids/CONTEXTO.md): Toda la memoria técnica y fiscal detallada.
- [`AGENTS.md`](file:///C:/Users/carlos/Documents/dinnerkids/AGENTS.md): Directrices operativas de desarrollo.
- [`docs/PASO-A-PASO-CLOUDFLARE-Y-PAGOS.md`](file:///C:/Users/carlos/Documents/dinnerkids/docs/PASO-A-PASO-CLOUDFLARE-Y-PAGOS.md): Pasos para configurar Cloudflare Pages, Worker, KV y Ko-fi.
- [`index.html`](file:///C:/Users/carlos/Documents/dinnerkids/index.html) y [`logic.js`](file:///C:/Users/carlos/Documents/dinnerkids/logic.js): Código de la app y lógica de cálculo.
- [`worker.js`](file:///C:/Users/carlos/Documents/dinnerkids/worker.js): API serverless de cuotas y llamada segura a Claude.
