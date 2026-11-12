<div align="center">

<a href="https://dinnerkids.es">
  <img src="https://dinnerkids.es/assets/logo.png" width="110" alt="DinnerKids Logo">
</a>

# 🍽️ DinnerKids

**Planificador inteligente de cenas infantiles según el menú del cole**

<a href="https://dinnerkids.es">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=18&duration=2800&pause=1000&color=FF6B35&center=true&vCenter=true&width=620&lines=Gratis+%C2%B7+Sin+registro+%C2%B7+Sin+anuncios+%C2%B7+Sin+cookies;Tus+datos+no+salen+de+tu+m%C3%B3vil;108+recetas+paso+a+paso+y+filtro+de+alergias;Lectura+autom%C3%A1tica+de+la+foto+o+PDF+del+men%C3%BA" alt="DinnerKids">
</a>

<br>

<p>
  <a href="https://dinnerkids.es"><img src="https://img.shields.io/badge/%E2%96%B6_Abrir_Aplicaci%C3%B3n-dinnerkids.es-FF6B35?style=for-the-badge" alt="Abrir DinnerKids"></a>&nbsp;&nbsp;
  <a href="https://github.com/ortisiano/dinnerkids/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/ortisiano/dinnerkids/ci.yml?branch=main&style=for-the-badge&label=Tests" alt="CI Tests"></a>&nbsp;&nbsp;
  <a href="https://dinnerkids.es/privacidad.html"><img src="https://img.shields.io/badge/Privacidad-RGPD_100%25_Local-2D6A4F?style=for-the-badge" alt="Privacidad"></a>
</p>

<sub>Los peques comen en el cole a mediodía → DinnerKids propone cada noche algo que no repita plato ni grupo nutricional.</sub>

</div>

<br>

---

## ✨ Qué hace

- **⚡ Modo Gratis Instantáneo (100 % en tu navegador, coste 0 € de IA):** cruza el menú escolar con el catálogo de **108 recetas infantiles paso a paso**. Si en el cole comieron pasta o legumbres con pollo, por la noche propone pescado, huevo o verdura.
- **🥜 Filtro de alérgenos oficial UE:** Sin Gluten, Sin Lactosa, Sin Huevo, Sin Pescado, Sin Frutos Secos, Sin Sésamo… más gustos a evitar, tiempo máximo de cocina y rutinas fijas (*"viernes pizza, jueves pescado"*).
- **🔍 Buscador de Nevera gratuito:** cambia cualquier cena al instante según los ingredientes que tengas en casa.
- **📲 Compartir el menú del cole por WhatsApp:** un padre o madre lo carga y el enlace `#cole=...` (sin datos personales) lo tiene listo en un toque para toda la clase.
- **📸 Lectura automática del menú con IA (foto o PDF):** sube la foto o el PDF que manda el AMPA y Claude Vision lo convierte en menú cargado, con alérgenos detectados.
- **🛒 Lista de la compra semanal automática:** agrupada por semana o mes, para tachar en el supermercado y copiar a WhatsApp.
- **☕ Modo IA Pro opcional o tu propio Token (BYOK):** DinnerKids es libre y gratuito para todo el mundo. La IA integrada (menús a medida, recetas personalizadas y lectura del menú) se financia con [Ko-fi](https://ko-fi.com/ortisiano) o [GitHub Sponsors](https://github.com/sponsors/ortisiano), o con tu propia clave `sk-ant-...` guardada solo en tu navegador.

---

## 🌿 Cómo colaborar (`development` → PR → `main`)

¡Contribuciones bienvenidas: nuevas recetas infantiles, mejoras del analizador de menús o correcciones! Guía completa en [**CONTRIBUTING.md**](CONTRIBUTING.md).

- **`main` (Producción):** estable, servido en [`dinnerkids.es`](https://dinnerkids.es). Protegida: solo cambia mediante **Pull Request** aprobada.
- **`development` (Desarrollo):** rama activa de trabajo diario.

```bash
git clone https://github.com/ortisiano/dinnerkids.git
cd dinnerkids
git checkout development

npm run check   # Sintaxis JS
npm test        # Suite de tests (node:test)
```

---

## 🛠️ Comandos de desarrollo

```bash
npm run check                                                   # Comprobar sintaxis JS
npm test                                                        # Ejecutar tests automatizados (node:test)
PRO_CODE_SECRET="tu_secreto" npm run gen-code -- DK02 202706    # Generar 1 código individual Pro
```

---

<div align="center">

**¿Te resulta útil DinnerKids?**  
Es gratuito y abierto. Si te ayuda en tu día a día y quieres apoyar que siga activo:

<p>
  <a href="https://ko-fi.com/ortisiano"><img src="https://img.shields.io/badge/Ko--fi-Invitar_a_un_caf%C3%A9-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Ko-fi"></a>&nbsp;&nbsp;
  <a href="https://github.com/sponsors/ortisiano"><img src="https://img.shields.io/badge/GitHub_Sponsors-Apoyar-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="GitHub Sponsors"></a>
</p>

<sub>Hecho con ♥ por <a href="https://github.com/ortisiano">@ortisiano</a> · Sin registros · Sin rastreadores · Tus datos se quedan en tu dispositivo</sub>

</div>
