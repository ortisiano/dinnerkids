# Contexto Completo de Negocio, Arquitectura y Decisiones — DinnerKids (`edge-pwa`)

Este documento resume todas las decisiones técnicas, económicas y legales tomadas para **DinnerKids** para que cualquier sesión futura en **Antigravity** tenga el contexto completo desde el primer segundo.

---

## 1. Filosofía del Proyecto ("Coste Fijo 0 € · Todo en el Navegador + Edge Worker")

Inspirado en la filosofía de aplicaciones web ultraligeras sin servidores pesados:
- **De dónde veníamos (`rama lab`):** Un stack pesado en Docker con 7 contenedores (`Reflex Python` consumiendo 1,4 GB de RAM, `PostgreSQL`, `Redis`, `Qdrant` usado solo como caché por hash, `RQ Worker`, `Nginx` y `Cloudflared`).
- **A dónde hemos ido (`rama edge-pwa`):**
  1. **Web Estática / PWA (`index.html`, `logic.js`, `sw.js`, `manifest.webmanifest`):**
     - Alojada gratis en **Cloudflare Pages** (conectada al repositorio privado `ortisiano/dinnerkids-private`, rama `edge-pwa`).
     - Sin dependencias externas (`npm`), sin pasos de compilación y con Service Worker (*"Primero Red, respaldo en Caché"*).
  2. **Modo Gratis 100 % en el navegador (`generateLocalMonthlyMenu` en `logic.js`):**
     - Cruza el almuerzo escolar del colegio con el recetario oficial de DinnerKids (`RECIPES` en `logic.js`).
     - Evita repetir por la noche el mismo grupo nutricional del mediodía (legumbres, hidratos, ave, carne, pescado, huevo).
     - Respeta alérgenos (*Sin Gluten, Sin Lactosa, Sin Huevo, Sin Pescado, Sin Sésamo*), tiempo máximo y rutinas semanales (*"viernes pizza, jueves pescado"*).
     - **Coste de servidor y de IA en Modo Gratis:** **0,00 €**.
  3. **Viralidad por WhatsApp sin Base de Datos (`#cole=...`):**
     - Un padre o madre carga el menú de su colegio y pulsa **"📲 Compartir menú de mi cole por WhatsApp"** (`encodeSchoolMenuShare` / `decodeSchoolMenuShare`).
     - El enlace lleva el menú del colegio codificado en la URL sin ningún dato personal, permitiendo que toda la clase lo cargue en un toque.
  4. **Modo IA Pro / AMPA en Cloudflare Workers (`worker.js`) + Cloudflare KV (`DK_KV`):**
     - Solo se ejecuta cuando el usuario tiene un **Código Pro firmado** (`DK02`, `DK05`, `DK10`, `AMPA`) o introduce su propia API Key (`BYOK`).
     - **Sin base de datos de usuarios:** Los códigos llevan firma criptográfica `HMAC-SHA256` verificada en tiempo constante (`constantTimeEqual`) con el secreto `PRO_CODE_SECRET`.
     - **Caché en Cloudflare KV (`DK_KV`):** Sustituye a Qdrant a coste 0 €. Cachea por hash `SHA-256` tanto el OCR de fotos de menús escolares (`cache:ocr:<hash>`) como los menús generados (`cache:menu:<hash>`). Si un padre del mismo colegio sube la misma foto del menú, el segundo padre consume **0 tokens**.

---

## 2. Tabla Económica y Cuotas de IA (Blindaje de Presupuesto)

El modelo configurado en el Worker es **Claude Haiku 4.5** (`claude-haiku-4-5`), donde cada menú mensual cuesta ~0,004 € y cada lectura OCR con Vision cuesta ~0,003 €:

| Nivel | Precio Aportación (Ko-fi / GitHub Sponsors) | Prefijo Código | Cuota Mensual en `worker.js` | Coste IA Máx. Real | Margen Neto |
|---|---|---|---|---|---|
| **Café Solidario** | **2 €** | `DK02` | 3 menús IA · 1 OCR · 10 recetas | ~0,03 € | **~98,5 %** |
| **Pase Trimestral** | **5 €** | `DK05` | 10 menús IA · 4 OCR · 35 recetas | ~0,09 € | **~98,2 %** |
| **Pase Curso Escolar** | **10 € / año** | `DK10` | 25 menús IA · 12 OCR · 80 recetas | ~0,24 € | **~97,6 %** |
| **Colegio / AMPA** | **49 € / mes** | `AMPA` | 400 menús IA · 20 OCR · 1000 recetas | ~1,80 € | **~96,3 %** |

---

## 3. Seguridad, Privacidad RGPD y Situación Laboral/Fiscal

1. **Privacidad desde el Diseño (Art. 25 RGPD):**
   - No se almacenan cuentas, correos ni datos de menores en ningún servidor. Todo reside en el `localStorage` del dispositivo de la familia, con botones de exportación JSON y borrado total en 1 clic.
   - Antes de cualquier llamada a Anthropic Claude, el texto pasa por `anonymizePII()` (elimina emails, teléfonos, DNI/NIE, IBAN, direcciones y nombres propios) y por el sanitizador anti-prompt-injection `B-02` (`sanitizePreferences` / `sanitizeField`).
2. **Exención de responsabilidad nutricional (`privacidad.html`):**
   - Incluye cláusula expresa indicando que las sugerencias son orientativas y no sustituyen el criterio médico/alergológico ni la revisión del etiquetado real de los alimentos.
3. **Compatibilidad laboral y fiscal del autor:**
   - El autor trabaja por cuenta ajena como **Especialista Nivel 2 (L2) de Storage** (almacenamiento informático). Ni **DinnerKids** ni **Lilium Glow** (tienda de joyería en VM `192.168.100.82` de Proxmox) tienen relación alguna con el sector de Storage L2, por lo que no existe concurrencia desleal.
   - Regla de higiene digital: trabajar siempre desde el PC personal, fuera del horario laboral y en repositorios privados.
   - Estrategia de cobros antes del alta de autónomo de Lilium Glow: mantener activadas las **retiradas manuales (*Manual Payouts*)** en Stripe/Ko-fi para acumular saldo sin transferirlo al banco hasta tramitar el alta de autónomo (donde una única cuota de autónomo cubre tanto el epígrafe de joyería como el de servicios digitales).
