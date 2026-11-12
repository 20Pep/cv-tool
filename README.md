# cv-tool

Herramienta **local-first** para adaptar tu CV y tu carta de presentación a cada
oferta de trabajo, generar PDFs compatibles con filtros ATS y llevar el
seguimiento de tus postulaciones.

- La app **no busca ofertas ni postula por vos**. Vos pegás la oferta y enviás.
- Tus datos viven en tu computadora.
- La IA que elijas recibe solo el contenido que le mandás para generar el perfil,
  el CV o la carta.
- Sin cuentas, sin nube, sin telemetría.
- Inicio guiado: primero conectás tu IA, después cargás tu perfil una vez y al
  final adaptás cada oferta.
- Una sola caja para pegar la oferta y todo el contexto; la empresa y el puesto
  se detectan del texto.
- Modo claro y oscuro.

## Requisitos

- **Node.js 24 o superior**.
- **OpenCode** instalado y con un proveedor de IA configurado (por ejemplo,
  OpenCode Go).
- Un navegador moderno.

## Instalación rápida

Cuando el paquete esté publicado en npm:

```bash
npx cv-tool
```

Eso inicia el servidor local, abre el navegador y te deja la app en
`http://127.0.0.1:3000`.

### Desde el código fuente

```bash
npm install
npm run dev
```

`npm run dev` levanta Fastify y Vite, y abre el navegador. Para ejecutar la
versión compilada:

```bash
npm run build
npm start
```

## Configurar OpenCode

1. Instalá OpenCode y configurá tu proveedor. Si usás **OpenCode Go**, verificá
   que tu suscripción esté activa.
2. Comprobá que OpenCode responde:

   ```bash
   opencode models
   opencode service status
   ```

3. Abrí **Ajustes** en cv-tool, elegí un modelo de OpenCode Go y usá
   **Probar conexión**.
4. Guardá los ajustes.

cv-tool no guarda API keys. Las credenciales las administra OpenCode. El
adaptador descubre el servicio local en este orden:

1. `CVTOOL_OPENCODE_URL` (o `OPENCODE_SERVER_URL`) +
   `OPENCODE_SERVER_PASSWORD`.
2. `~/.config/opencode/service.json`.
3. `http://127.0.0.1:4096`.

## Primer uso

1. **Inicio**: seguí los tres pasos. Si todavía no conectaste una IA, el botón
   principal te lleva a **Ajustes**. Si no hay perfil, te lleva a **Perfil**.
   Cuando todo está listo, el inicio es directamente la caja para pegar la
   oferta: no hay un click extra.
2. **Perfil**: subí tu CV (PDF, DOCX, TXT o MD), generá el perfil con IA,
   revisalo y guardalo. Podés agregar un **esquema de carta** opcional.
3. **Nueva**: pegá la oferta completa y todo el contexto en una sola caja.
   cv-tool detecta empresa y puesto del texto, genera la vista previa y guarda
   la postulación con **Guardar y generar PDFs**.
4. **Tracker**: marcá la postulación como enviada cuando la envíes de verdad,
   seguí los estados y exportá el historial a Excel.
5. **Ajustes**: cambiá el modelo o volvé a probar la conexión cuando quieras.

La app siempre te deja revisar antes de guardar. Ninguna postulación se marca
como enviada automáticamente.

## Qué genera

- CV adaptado en PDF, una columna, sin tablas ni imágenes, con texto
  seleccionable.
- Carta de presentación en PDF, a partir de tu perfil y de la oferta (o de tu
  borrador).
- Archivos con nombre `Nombre_Apellido_Puesto_Empresa.pdf` y
  `..._Carta.pdf`.
- Keywords cubiertas y faltantes, y un **match %** calculado por código, no por
  la IA.
- Una fila en el tracker con estado, historial, días transcurridos, notas y
  enlaces a los PDFs.

## Privacidad

- Los datos, la base SQLite, los uploads y los PDFs quedan en tu máquina.
- En desarrollo se usa `./data`. En producción, la carpeta de datos del sistema
  (`env-paths`). Podés forzar otra ubicación con `CVTOOL_DATA_DIR`.
- Si usás OpenCode Go, el contenido del CV y de la oferta se envía al servicio
  de inferencia de OpenCode. **Local-first aplica al almacenamiento, no
  necesariamente a la inferencia.**
- No hay telemetría ni llamadas de red propias más allá de OpenCode.
- Los logs no incluyen contenido de CVs, ofertas ni tokens.

## Seguridad

- El servidor escucha solo en `127.0.0.1`.
- Valida `Host` y `Origin`, exige una cookie de sesión y usa un token de
  lanzamiento de un solo uso.
- El texto de la oferta se trata como contenido no confiable y va delimitado en
  el prompt.
- El MVP usa `generate/text` de OpenCode: no hay sesión de agente ni ejecución
  de herramientas.
- Toda salida de la IA pasa por Zod y por las reglas anti-invención antes de
  mostrarse o guardarse.
- Los nombres de archivo se sanitizan y las descargas se resuelven dentro de
  `outputs/`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Fastify + Vite en modo desarrollo |
| `npm run build` | Compila el frontend y el servidor |
| `npm start` | Ejecuta lo compilado |
| `npm test` | Tests unitarios y de integración |
| `npm run test:e2e` | Compila y corre Playwright |
| `npm run lint` | Biome |
| `npm run typecheck` | TypeScript estricto |
| `npm run prototype` | Spike de prompts contra OpenCode |
| `npm run check` | typecheck + lint + test |

Variables útiles:

- `CVTOOL_PORT` (default 3000)
- `CVTOOL_VITE_PORT` (default 5173)
- `CVTOOL_DATA_DIR`
- `CVTOOL_NO_OPEN=1` para no abrir el navegador
- `CVTOOL_OPENCODE_URL`, `OPENCODE_SERVER_PASSWORD`

## Problemas comunes

**“OpenCode no está disponible”.**
Abrí OpenCode y comprobá `opencode service status`. En Ajustes usá
**Actualizar** o **Probar conexión**.

**“Sesión no válida”.**
Volvé a ejecutar `cv-tool` y usá la URL que abre automáticamente. El token de
lanzamiento es de un solo uso.

**El puerto está ocupado.**
Cerrá la otra instancia o ejecutá con `CVTOOL_PORT=3001`.

**Un PDF no tiene texto.**
Los PDFs escaneados sin texto seleccionable no se pueden leer (no hay OCR).
Probá con una versión exportada desde tu editor.

**El modelo tarda o falla.**
Probá otro modelo en Ajustes. Los modelos gratuitos pueden tener límites de
uso. La generación puede tardar uno o dos minutos.

**`npm start` no arranca.**
Ejecutá `npm run build` antes.

## Límites actuales

- El editor del perfil y de la vista previa es JSON; el formulario amigable
  llegará más adelante.
- Las skills del CV no se traducen entre idiomas.
- No hay OCR para PDFs escaneados.
- No hay búsqueda de ofertas, scraping ni postulación automática.
- No hay autenticación de usuarios, nube ni sincronización.
- El tracker no tiene paginación; está pensado para uso personal.

## Desarrollo

```bash
npm install
npm run dev
npm test
npm run test:e2e
```

Los `fixtures/` son **ficticios**. No uses datos reales de personas en tests ni
en commits.

Estructura principal:

```
src/server/     Fastify, SQLite, proveedores, ingesta, generación, render
src/web/        React + Vite + Tailwind
src/shared/     Esquemas Zod y tipos compartidos
migrations/     Migraciones SQL numeradas
prompts/        Prompts versionados
fixtures/       Datos ficticios de prueba
docs/           Progreso y decisiones
```

## Licencia

MIT. Ver `LICENSE`.
