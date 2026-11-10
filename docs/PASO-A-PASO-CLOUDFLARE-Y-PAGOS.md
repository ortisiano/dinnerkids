# Guía Paso a Paso:Qué tienes que hacer tú en GitHub, Cloudflare y Ko-fi / Sponsors

Esta guía resume exactamente los pasos que debes hacer en tus cuentas (tardarás unos **10 minutos en total**) para dejar **DinnerKids** publicado a **coste 0 €/mes** y listo para recibir pagos de **2 €, 5 € y 10 €**.

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

## Paso 2 · Activar el Cloudflare Worker (`api.dinnerkids.es`) y la caché KV (Sustituto gratuito de Qdrant)

1. En el menú de Cloudflare ve a **Workers & Pages** → **KV** → pulsa **Create a namespace** y llámalo **`DK_KV`**.
2. Ve a **Workers & Pages** → **Create** → **Create Worker** → llámalo **`dinnerkids-api`** y pega el código de `worker.js` (o conéctalo por Git a la misma rama `edge-pwa`).
3. Dentro del Worker, entra en **Settings** → **Bindings** → **Add** → **KV Namespace**:
   - *Variable name*: `DK_KV`
   - *KV namespace*: selecciona el **`DK_KV`** que acabas de crear.
4. En **Settings** → **Variables and Secrets**, añade estos 2 secretos (*Secret*):
   - **`ANTHROPIC_API_KEY`**: tu clave de Anthropic (`sk-ant-...`). *(Truco de seguridad: en la consola de Anthropic ponle un límite mensual de gasto de p. ej. 5 € para dormir 100 % tranquilo).*
   - **`PRO_CODE_SECRET`**: inventa una frase larga tuya (por ejemplo `MiSecretoDinnerKids_2026_SuperSeguro_99!`). Con esta frase se firman y verifican los Códigos Pro sin necesitar base de datos.
5. En **Settings** → **Domains & Routes** → **Add** → **Custom Domain**: escribe **`api.dinnerkids.es`**.

---

## Paso 3 · Configurar Ko-fi y GitHub Sponsors (Niveles de 2 €, 5 € y 10 €)

### A) En Ko-fi (Recomendado para padres y madres porque no pide cuenta de GitHub)
1. Crea tu página gratuita en [ko-fi.com](https://ko-fi.com/) (por ejemplo `ko-fi.com/ortisiano`).
2. En **Settings → Payment**, conecta tu cuenta de Stripe (y en Stripe activa **Manual Payouts / Retiradas manuales** para que el dinero se quede acumulado sin pasar a tu banco hasta el día que te des de alta de autónomo con Lilium Glow).
3. Configura el precio del café en **2 €** y crea 3 opciones en **Ko-fi Shop** o **Membership Tiers**:
   - **2 € — Café Solidario (1 mes Pro)**: En el mensaje automático de agradecimiento (*Thank you message* o descarga automática de Ko-fi Shop) pon un código generado con `DK02`.
   - **5 € — Pase Trimestral**: Pon un código generado con `DK05`.
   - **10 € — Pase Curso Escolar Completo**: Pon un código generado con `DK10`.

### B) En GitHub Sponsors
1. Entra en [github.com/sponsors](https://github.com/sponsors) con tu usuario `ortisiano`.
2. Crea tus niveles (*Tiers*) de **2 €**, **5 €** y **10 €** y en el mensaje de bienvenida del patrocinador incluye el código correspondiente.

---

## Paso 4 · Cómo generar tú mismo códigos Pro en 1 segundo (sin base de datos)

No tienes que guardar los códigos en ninguna base de datos: llevan una firma criptográfica (`HMAC-SHA256`) que el Worker valida matemáticamente con tu `PRO_CODE_SECRET`.

Para crear un código válido hasta **junio de 2027 (`202706`)**, ejecuta:

```bash
# Código de 2 € (Café Solidario: 3 menús/mes, 1 OCR/mes, 10 recetas/mes)
PRO_CODE_SECRET="TuFraseSecreta" npm run gen-code -- DK02 202706

# Código de 5 € (Pase Trimestral: 10 menús/mes, 4 OCR/mes, 35 recetas/mes)
PRO_CODE_SECRET="TuFraseSecreta" npm run gen-code -- DK05 202706

# Código de 10 € (Curso Escolar: 25 menús/mes, 12 OCR/mes, 80 recetas/mes)
PRO_CODE_SECRET="TuFraseSecreta" npm run gen-code -- DK10 202706

# Código para un Colegio / AMPA (400 menús/mes, 20 OCR/mes, 1000 recetas/mes)
PRO_CODE_SECRET="TuFraseSecreta" npm run gen-code -- AMPA 202706
```
