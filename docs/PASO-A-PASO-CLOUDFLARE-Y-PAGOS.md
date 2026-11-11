# Guía Paso a Paso: Qué tienes que hacer tú en GitHub, Cloudflare y Ko-fi / Sponsors

Esta guía resume exactamente los pasos que debes hacer en tus cuentas (tardarás unos **10 minutos en total**) para dejar **DinnerKids** publicado a **coste 0 €/mes**, libre para todo el mundo y listo para recibir donativos de **un café (mínimo 2 €)** o permitir que cada usuario configure su propio token de IA.

---

## Paso 1 · Publicar la Web gratis en Cloudflare Pages (con tu repositorio PRIVADO)

Como tu repositorio `ortisiano/dinnerkids-private` es **privado**, usar **Cloudflare Pages** te permite publicar la web gratis sin hacer público tu código:

1. Entra en tu panel de [Cloudflare Dashboard](https://dash.cloudflare.com/) → menú izquierdo **Workers & Pages**.
2. Pulsa **Create** → pestaña **Pages** → **Connect to Git**.
3. Elige tu repositorio **`ortisiano/dinnerkids-private`** y selecciona la rama **`edge-pwa`**.
4. En **Build settings**:
   - *Framework preset*: `None`
   - *Build command*: *(déjalo vacío)*
   - *Build output directory*: `/`
5. Pulsa **Save and Deploy**.
6. En la pestaña **Custom domains** de ese proyecto Pages, añade `dinnerkids.es` y `www.dinnerkids.es`. Cloudflare creará el registro DNS y el certificado SSL automáticamente.

---

## Paso 2 · Activar el Cloudflare Worker (`api.dinnerkids.es`) y la caché KV (Sustituto gratuito de Qdrant + bloqueo a 1 usuario)

1. En el menú de Cloudflare ve a **Workers & Pages** → **KV** → pulsa **Create a namespace** y llámalo **`DK_KV`**.
2. Ve a **Workers & Pages** → **Create** → **Create Worker** → llámalo **`dinnerkids-api`** y pega el código de `worker.js` (o conéctalo por Git a la misma rama `edge-pwa`).
3. Dentro del Worker, entra en **Settings** → **Bindings** → **Add** → **KV Namespace**:
   - *Variable name*: `DK_KV`
   - *KV namespace*: selecciona el **`DK_KV`** que acabas de crear.
4. En **Settings** → **Variables and Secrets**, añade estos 2 secretos (*Secret*):
   - **`ANTHROPIC_API_KEY`**: tu clave de Anthropic (`sk-ant-...`). *(Truco de seguridad: en la consola de Anthropic ponle un límite mensual de gasto de p. ej. 5 € para dormir 100 % tranquilo).*
   - **`PRO_CODE_SECRET`**: inventa una frase larga tuya (por ejemplo `MiSecretoDinnerKids_2026_SuperSeguro_99!`). Con esta frase se firman y verifican los Códigos de Café sin necesitar base de datos.
5. En **Settings** → **Domains & Routes** → **Add** → **Custom Domain**: escribe **`api.dinnerkids.es`**.

---

## Paso 3 · Configurar el Café Solidario (mínimo 2 €) en Ko-fi y GitHub Sponsors

En la web ya no aparecen 3 planes comerciales raros: ahora se explica claramente que **DinnerKids es gratis para todo el mundo**, y quien quiera usar tu IA (Claude Haiku) te invita a **un café de mínimo 2 € en Ko-fi** (o configura su propio token `sk-ant-...`).

### A) En Ko-fi (Recomendado para familias porque no pide cuenta de GitHub)
1. Crea tu página gratuita en [ko-fi.com](https://ko-fi.com/) (por ejemplo `ko-fi.com/ortisiano`).
2. En **Settings → Payment**, conecta tu cuenta de Stripe (y en Stripe mantén activado **Manual Payouts / Retiradas manuales** para que el saldo se quede acumulado sin pasar a tu banco hasta que tramites el alta de autónomo).
3. En **Page Settings**, fija el precio mínimo del café (*Coffee Price*) en **2 €**.
4. Para entregar un **código único por persona** (ya que el Worker bloquea cada código `DK02` al primer móvil/navegador que lo activa para que no se lo pasen entre varios):
   - Puedes enviarle su código individual generado en 1 segundo cuando te llegue el aviso del café, o subir una lista de códigos únicos en un producto de **Ko-fi Shop (2 €)** para entrega inmediata.

### B) En GitHub Sponsors (Opcional)
1. Entra en [github.com/sponsors](https://github.com/sponsors) con tu usuario `ortisiano`.
2. Configura una aportación desde **2 €** y envía un código `DK02` individual al patrocinador.

---

## Paso 4 · Cómo generar códigos individuales (1 solo usuario) en 1 segundo

Cada código `DK02` lleva una firma criptográfica (`HMAC-SHA256`) y, en cuanto el usuario pulsa **"Activar y Vincular en este Dispositivo"**, el Cloudflare Worker lo vincula en `DK_KV` a ese dispositivo (`maxDevices: 1`). **Si se lo pasa a otra persona, el Worker lo bloquea automáticamente.**

Para crear **1 código individual** o una **tanda de 10 códigos distintos** válidos hasta **junio de 2027 (`202706`)**, ejecuta:

```bash
# Generar 1 código individual de Café Solidario (2 € -> 1 solo usuario/dispositivo)
PRO_CODE_SECRET="TuFraseSecreta" npm run gen-code -- DK02 202706

# Generar 10 códigos individuales distintos de golpe para tenerlos listos:
PRO_CODE_SECRET="TuFraseSecreta" npm run gen-code -- DK02 202706 10

# Generar un código colectivo si algún día un Colegio / AMPA te lo pide:
PRO_CODE_SECRET="TuFraseSecreta" npm run gen-code -- AMPA 202706
```
