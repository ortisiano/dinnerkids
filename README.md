# 🍽️ DinnerKids — Cenas infantiles que complementan el menú del cole

**Planifica en segundos las cenas de los peques según lo que comen al mediodía en el colegio.**
Gratis · Sin registro · Sin anuncios · Sin cookies · Tus datos no salen de tu móvil.

---

## ✨ Qué hace DinnerKids

1. **⚡ Modo Gratis Instantáneo (100 % en tu navegador, coste 0 € de IA):**
   - Cruza el menú escolar del mediodía con el recetario infantil de DinnerKids (`logic.js`).
   - Si en el cole comieron pasta o legumbres con pollo, por la noche propone pescado, huevo o verdura para no repetir grupo nutricional.
   - Respeta alérgenos (Sin Gluten, Sin Lactosa, Sin Huevo, Sin Pescado, Sin Sésamo), tiempo máximo de cocina y rutinas fijas (*"viernes pizza, jueves pescado"*).
2. **📲 Compartir el menú del cole por WhatsApp:**
   - Un padre o madre carga el menú de su colegio y pulsa **"Compartir menú de mi cole por WhatsApp"**.
   - Genera un enlace directo (`#cole=...`) sin datos personales para que todas las familias de la clase tengan el menú cargado en un toque.
3. **🛒 Lista de la compra semanal automática:**
   - Agrupa los ingredientes por semana o mes completo, permite ir tachándolos en el supermercado y copiarlos para WhatsApp.
4. **⭐ Modo IA Pro / Colegios (Cloudflare Worker + Claude Haiku):**
   - Quien apoya el proyecto con **2 € (Café)**, **5 € (Trimestre)** o **10 € (Curso Escolar)** en Ko-fi o GitHub Sponsors recibe un **Código Pro** (`DK02-...`, `DK05-...`, `DK10-...`).
   - Desbloquea la lectura automática de fotos del menú del cole con **Claude Vision (OCR)** y la generación de menús y recetas a medida con **Claude Haiku**, respaldado por caché inteligente en **Cloudflare KV** (si otro padre del mismo cole sube la misma foto, consume **0 tokens**).

---

## 🛠️ Comandos de desarrollo

```bash
npm run check                                                # Comprobar sintaxis JS
npm test                                                     # Ejecutar tests automatizados (node:test)
PRO_CODE_SECRET="tu_secreto" npm run gen-code -- DK10 202706 # Generar un Código Pro firmado
```
