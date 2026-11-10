# Directrices para Asistentes de IA — DinnerKids (Arquitectura Edge PWA)

Este documento define la arquitectura, reglas de seguridad y flujo de trabajo de **DinnerKids** en su edición ligera sin servidores (`edge-pwa`).

## 1. Qué es y cómo funciona

Aplicación web progresiva (PWA) en HTML + JavaScript puro (`index.html`, `logic.js`, `sw.js`) alojada gratis en **Cloudflare Pages / GitHub Pages**, con un **Cloudflare Worker** (`worker.js`) que gestiona de forma segura el Modo IA Pro y el caché en **Cloudflare KV**.

| Archivo | Función |
|---|---|
| `index.html` | Aplicación web completa (calendario mensual, menú escolar, lista de la compra, Modo Pro y controles RGPD) |
| `privacidad.html` | Política de Privacidad RGPD ("Privacidad por Diseño · Cero Datos en Servidor") y exención de responsabilidad nutricional |
| `logic.js` | Lógica pura compartida: recetario `RECIPES`, motor local sin IA (`generateLocalMonthlyMenu`), anonimizador RGPD (`anonymizePII`), sanitizador `B-02` y lista de la compra |
| `worker.js` | Cloudflare Worker: verificación criptográfica HMAC-SHA256 de Códigos Pro (`DK02`, `DK05`, `DK10`, `AMPA`), cuotas mensuales, caché KV y llamadas a Claude Haiku |
| `tools/generate-pro-code.js` | Utilidad CLI para generar códigos Pro firmados sin necesitar base de datos |
| `sw.js` | Service Worker con estrategia *"Primero Red, respaldo en Caché"* |
| `tests/` | Tests automatizados con `node:test` (`logic.test.js` y `worker.test.js`) |

## 2. Reglas de Seguridad y Privacidad Inquebrantables

1. **Cero secretos en el repositorio:** `ANTHROPIC_API_KEY` y `PRO_CODE_SECRET` viven exclusivamente en *Variables and Secrets* del Cloudflare Worker.
2. **Privacidad RGPD por diseño:** Nunca almacenar nombres de niños, correos ni alergias en bases de datos del servidor. Todo el estado familiar vive en el `localStorage` del dispositivo del usuario.
3. **Doble filtro antes de la IA (`anonymizePII` + `B-02`):** Todo texto libre debe pasar por `sanitizePreferences()` / `sanitizeField()` antes de enviarse a Anthropic Claude, eliminando emails, teléfonos, DNI/NIE, IBAN, direcciones y patrones de *Prompt Injection*.
4. **Cero dependencias externas en producción:** No añadir paquetes `npm` en tiempo de ejecución.
5. **Verificación obligatoria antes de cada commit:**
   ```bash
   npm run check
   npm test
   ```
