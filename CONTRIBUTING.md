# 🤝 Guía para Contribuir en DinnerKids

¡Gracias por tu interés en mejorar **DinnerKids**! Cualquier aportación (nuevas recetas infantiles saludables, mejoras de accesibilidad, corrección de errores o mejoras en el parser de menús escolares) es bienvenida.

---

## 🌿 Flujo de ramas (`development` → PR → `main`)

En este repositorio seguimos un flujo claro para proteger la versión en producción (`https://dinnerkids.es`):

1. **`main` (Producción):**
   - Contiene únicamente el código estable desplegado en `dinnerkids.es`.
   - **No se hacen commits directos en `main`.** Todo cambio entra mediante **Pull Request (PR)** revisada y aprobada por `@ortisiano`.
2. **`development` (Rama de integración y desarrollo):**
   - Es la rama activa de trabajo diario.
   - Si quieres proponer una mejora o añadir recetas, crea tu rama a partir de `development` (por ejemplo: `feat/nuevas-recetas-pescado` o `fix/parser-comedor`) y abre tu **Pull Request hacia `development`** (o de `development` a `main` para pases a producción).

```text
tu-rama (feat/...) ──► Pull Request ──► development (pruebas) ──► Pull Request + Aprobación ──► main (dinnerkids.es)
```

> **⚠️ Al mergear, usa "Create a merge commit", NO "Squash and merge".**
> Con squash, `main` recibe un único commit nuevo y el historial de `development`
> diverge de la base común: la siguiente PR de `development` a `main` verá los
> mismos archivos como "creados dos veces" y chocará con conflictos *add/add*
> aunque el contenido sea correcto (pasó con el uptime monitor). Con merge
> commit, `main` y `development` comparten historial y las PRs futuras son limpias.

---

## 🛠️ Cómo preparar tu entorno local

DinnerKids tiene **cero dependencias externas en producción** (HTML + JS puro). Solo necesitas **Node.js >= 20** para ejecutar las comprobaciones y los tests:

```bash
# 1. Clonar el repositorio y cambiar a la rama development
git clone https://github.com/ortisiano/dinnerkids.git
cd dinnerkids
git checkout development

# 2. Verificar que la sintaxis y los tests pasan
npm run check
npm test
```

Para abrir la aplicación en tu navegador local basta con servir la carpeta con cualquier servidor estático (por ejemplo `npx serve .` o `npx wrangler dev`).

---

## 🍲 Cómo añadir o mejorar recetas infantiles

Todas las recetas están en [`logic.js`](logic.js) dentro del catálogo `RECIPES` (y su espejo estático en [`recetas.json`](recetas.json)). Cada receta debe seguir esta estructura:

- `id`: Número único o identificador.
- `name`: Nombre claro del plato.
- `group`: Grupo nutricional principal (`fish`, `egg`, `meat`, `veg`, `legume`, `pasta`, `dairy`, `fruit`).
- `allergens`: Lista de alérgenos presentes (`gluten`, `lactosa`, `huevo`, `pescado`, `frutos_secos`, `sesamo`, etc.).
- `time`: Tiempo estimado en minutos (`10` a `25` min).
- `ingredients`: Lista de ingredientes sencillos.
- `steps`: Pasos breves y claros para cocinar en familia.

---

## 🔒 Reglas inquebrantables del proyecto

Antes de abrir una Pull Request, asegúrate de que tu código cumple estas 4 reglas:

1. **Privacidad RGPD por diseño:** Ningún dato personal o familiar puede enviarse ni guardarse en bases de datos externas. Todo vive en `localStorage`.
2. **Doble filtro antes de la IA (`anonymizePII` + `B-02`):** Cualquier texto libre debe pasar por los sanitizadores de `logic.js`.
3. **Cero dependencias externas en tiempo de ejecución:** No añadir librerías pesadas al frontend ni al Worker.
4. **Tests en verde:** GitHub Actions ejecutará automáticamente `npm run check` y `npm test` en cada Pull Request.

