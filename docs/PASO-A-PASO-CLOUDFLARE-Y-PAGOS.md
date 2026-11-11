# Guía Paso a Paso: Checklist de lo que te falta configurar para lanzar DinnerKids

El código del proyecto (`index.html`, `logic.js`, `worker.js`, `sw.js`, `privacidad.html`) **ya está 100 % terminado, adaptado a móvil y con los 11 tests pasando**.

Aquí tienes exactamente lo que te falta hacer en tus cuentas (tardarás unos **10 minutos en total**) para dejar **DinnerKids** publicado a **coste 0 €/mes**, libre para todo el mundo y listo para recibir donativos de **un café (mínimo 2 €)** sin pedir registro al usuario.

---

## Paso 0 · Subir los últimos commits locales a tu repositorio privado de GitHub (1 minuto)

Todos los cambios ya están guardados en tu rama local `edge-pwa`. Para subirlos a tu cuenta de GitHub con tus credenciales de Windows, abre PowerShell en `c:\Users\carlos\Documents\dinnerkids` y ejecuta:

```powershell
git push origin edge-pwa
```

*(Si quieres previsualizar antes la web en tu ordenador, ejecuta `npm.cmd run serve` y abre `http://localhost:8000`).*

---

## Paso 1 · Publicar la Web gratis en Cloudflare Pages

Tu repositorio público **`ortisiano/dinnerkids`** ya tiene la versión definitiva en la rama **`main`**:

1. Entra en tu panel de [Cloudflare Dashboard](https://dash.cloudflare.com/) → menú izquierdo **Workers & Pages**.
2. Pulsa **Create** → pestaña **Pages** → **Connect to Git**.
3. Elige tu repositorio **`ortisiano/dinnerkids`** y selecciona la rama de producción **`main`**.
4. En **Build settings**:
   - *Framework preset*: `None`
   - *Build command*: *(déjalo vacío)*
   - *Build output directory*: `/` (o `.`)
5. Pulsa **Save and Deploy**. En unos 15 segundos verás el check verde y tu enlace temporal `https://dinnerkids.pages.dev`.
6. En la pestaña **Custom domains** de ese proyecto Pages, añade:
   - `dinnerkids.es`
   - `www.dinnerkids.es`
   Cloudflare creará los registros DNS y el certificado SSL gratis automáticamente.

---

## Paso 2 · Activar el Cloudflare Worker (`api.dinnerkids.es`) y la memoria `DK_KV`

Este Worker gestiona tu IA (Claude Haiku), la caché gratuita por hash (para que el segundo padre del mismo cole consuma **0 tokens**) y el **bloqueo de cada código personal a 1 único dispositivo** (`checkAndBindDevice`).

1. En el menú de Cloudflare ve a **Workers & Pages** → **KV** → pulsa **Create a namespace** y llámalo **`DK_KV`**.
2. Ve a **Workers & Pages** → **Create** → **Create Worker** → llámalo **`dinnerkids-api`** y pega el contenido de `worker.js` (o conéctalo por Git a tu rama `edge-pwa`).
3. Dentro del Worker, entra en **Settings** → **Bindings** → **Add** → **KV Namespace**:
   - *Variable name*: `DK_KV`
   - *KV namespace*: selecciona el **`DK_KV`** que acabas de crear.
4. En **Settings** → **Variables and Secrets**, añade estos **2 secretos (*Secret*)**:
   - **`ANTHROPIC_API_KEY`**: tu clave de Anthropic (`sk-ant-...`). *(Truco de seguridad: en la consola de Anthropic ponle un límite mensual de gasto de p. ej. 5 € para dormir 100 % tranquilo).*
   - **`PRO_CODE_SECRET`**: inventa una frase larga tuya (por ejemplo `MiSecretoDinnerKids_2026_SuperSeguro_99!`). Con esta frase se firman y verifican matemáticamente los códigos sin necesitar base de datos.
5. En **Settings** → **Domains & Routes** → **Add** → **Custom Domain**: escribe **`api.dinnerkids.es`**.

---

## Paso 3 · Configurar el botón de Café / Sponsor (mín. 2 €) SIN pedir cuenta al usuario

> **Importante sobre GitHub Sponsors vs Ko-fi / Stripe:**
> - **GitHub Sponsors (`github.com/sponsors/ortisiano`)** exige obligatoriamente que la persona que dona tenga cuenta en GitHub e inicie sesión. Está genial dejarlo como enlace secundario para informáticos, pero un padre o madre normal no tendrá cuenta de GitHub.
> - **Para que cualquier padre o madre te invite a un café de 2 € SIN registrarse en ningún sitio** (pagando en 10 segundos con Apple Pay, Google Pay o tarjeta), usa **Ko-fi** o un **Stripe Payment Link**:

### Opción A (Recomendada): Ko-fi (`ko-fi.com/ortisiano` — Sin cuenta para el donante)
1. Crea tu página gratuita en [ko-fi.com](https://ko-fi.com/) con el nombre `ortisiano` (`https://ko-fi.com/ortisiano`, que ya está enlazado en `index.html`).
2. En **Settings → Payment**, conecta tu cuenta de Stripe.
   - *Nota fiscal/autónomo:* En tu panel de Stripe activa **Manual Payouts (Retiradas manuales)** para que el saldo se quede acumulado sin transferirse a tu cuenta bancaria hasta el momento en que tramites el alta de autónomo.
3. En **Page Settings**, fija el precio mínimo del café (*Coffee Price*) en **2 €**.
4. Cualquier padre o madre podrá pulsar **`☕ Invitar a un Ko-fi (mín. 2 €)`**, pagar con Apple Pay / Google Pay / Tarjeta **sin crearse cuenta** y poner solo su email para recibir su código `DK02-...`.

### Opción B (Alternativa directa en Stripe con 0 % comisión extra): Stripe Payment Link
- Si en algún momento prefieres no pasar ni por Ko-fi, dentro de tu panel de **Stripe → Payment Links** puedes crear un enlace de donación llamado *"❤ Sponsor DinnerKids — Invitar a un café (2 €)"* con Apple Pay y Google Pay activos. No pide cuenta al usuario y va directo a tu saldo de Stripe.

---

## Paso 4 · Cómo generar códigos individuales (bloqueados a 1 usuario) y códigos de Colegio/AMPA

Cada código `DK02` lleva firma criptográfica (`HMAC-SHA256`) y cuando el usuario pulsa **"🔑 Activar en este Dispositivo"**, el Worker lo vincula en `DK_KV` a ese móvil/ordenador (`maxDevices: 1`). **Si se lo pasa a otro padre, al segundo dispositivo le saldrá bloqueado automáticamente.**

Abre PowerShell en la carpeta del proyecto y usa la **misma frase `PRO_CODE_SECRET`** que pusiste en el Paso 2:

```powershell
# 1. Definir tu frase secreta en la terminal
$env:PRO_CODE_SECRET="MiSecretoDinnerKids_2026_SuperSeguro_99!"

# 2. Generar 1 código individual de Café Solidario (2 € -> bloqueado a 1 solo usuario/dispositivo)
npm.cmd run gen-code -- DK02 202706

# 3. Generar 10 códigos individuales distintos de golpe (para tener una lista lista para entregar)
npm.cmd run gen-code -- DK02 202706 10

# 4. Generar un código colectivo para un Colegio / AMPA cuando te escriban al botón "Solicitar para mi Cole"
# (Permite hasta 300 familias del mismo colegio y 400 menús IA/mes)
npm.cmd run gen-code -- AMPA 202706
```
