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
4. **☕ Café Solidario (IA con Claude Haiku) o tu propio Token (BYOK):**
   - DinnerKids es libre y gratuito para todo el mundo. Si además quieres usar la IA del proyecto (lectura automática de fotos del menú del cole con Claude Vision + menús y recetas a medida con Claude Haiku), puedes invitar a **un café de mínimo 2 € en Ko-fi** (`DK02-...`) para cubrir el gasto de la IA.
   - **Código individual (bloqueado a 1 usuario/dispositivo):** cada código personal se vincula en Cloudflare KV al primer dispositivo que lo activa para que no se pueda compartir entre varios usuarios.
   - **O usa tu propio Token de IA:** cualquier usuario que tenga su propia clave de Anthropic (`sk-ant-...`) puede configurarla directamente en su navegador sin coste.

---

## 🛠️ Comandos de desarrollo

```bash
npm run check                                                   # Comprobar sintaxis JS
npm test                                                        # Ejecutar tests automatizados (node:test)
PRO_CODE_SECRET="tu_secreto" npm run gen-code -- DK02 202706    # Generar 1 código individual de Café (1 usuario)
PRO_CODE_SECRET="tu_secreto" npm run gen-code -- DK02 202706 10 # Generar 10 códigos individuales distintos
```
