# Decisiones y verificaciones

Registro de decisiones tomadas durante el desarrollo y de los resultados de los
puntos `[VERIFICAR]` de `PROJECT.md`. No incluir secretos, datos personales ni
contenido de CVs u ofertas reales.

## 2026-11-10 — Paso 0: prototipo de prompts y spike de OpenCode

### D-001 — Contrato real de OpenCode 2.2.7

**Problema:** `PROJECT.md` §10.2 documentaba la API v1 (`/global/health`,
`/provider`, `/config/providers`, OpenAPI en `/doc`). La instalación local es
OpenCode **2.2.7**, que expone una API v2 distinta bajo `/api`.

**Verificado:**

- `GET /api/info` devuelve `{ version: "2.2.7", pid, hostname, urls, paths }`.
- El OpenAPI está en `GET /openapi.json` (OpenAPI 3.1.0, “Experimental HttpApi
  surface”).
- `GET /api/provider` lista proveedores; `GET /api/model` lista modelos.
- `POST /api/experimental/generate/text` recibe `{ prompt, model }` y devuelve
  `{ data: { text } }`.
- `@opencode-ai/sdk` publica 1.19.5; no se asume compatible con el servidor
  2.2.7. El prototipo usa `fetch` directo.

**Decisión:** el adaptador usa la API v2 real, no los endpoints del documento
viejo ni el SDK 1.x. `PROJECT.md` §10.2 quedó actualizado.

### D-002 — Autenticación y descubrimiento del servidor

**Verificado:** el servicio en segundo plano de OpenCode escucha en un puerto
dinámico y guarda `port` y `password` en
`~/.config/opencode/service.json`. Las rutas `/api/*` responden 401 sin Basic
Auth.

**Decisión del prototipo:** resolver en este orden:

1. `CVTOOL_OPENCODE_URL` (o `OPENCODE_SERVER_URL`) +
   `OPENCODE_SERVER_PASSWORD`.
2. `~/.config/opencode/service.json`.
3. `http://127.0.0.1:4096` con `OPENCODE_SERVER_PASSWORD`.

El password no se loguea, no se escribe en errores y no se commitea.

**Pendiente para producción:** decidir si `cv-tool` se conecta a la instancia
existente o lanza una instancia dedicada con `opencode serve`. La instancia
dedicada aísla plugins/MCP/config global y permite un password propio; hay que
verificar que `OPENCODE_SERVER_PASSWORD` funcione en v2.

### D-003 — `generate/text` en lugar de sesiones y agentes

**Verificado:** `POST /api/experimental/generate/text` no crea sesión ni
ejecuta un agente con herramientas. En las pruebas, la oferta con instrucciones
ocultas no logró que el modelo ejecutara nada ni escribiera archivos.

**Decisión:** para el MVP, el adaptador usa `generate/text`. Es la superficie
más chica y la que mejor cumple “el agente corre sin herramientas”.

**Consecuencias:**

- No hay `system` separado: el adaptador concatena instrucciones y datos. La
  defensa contra prompt injection queda en los delimitadores, en Zod y en
  `validate.ts`.
- No hay JSON Schema: se pide JSON en el prompt, se extrae con
  `src/server/generate/json.ts`, se valida con Zod y se reintenta.
- El endpoint se llama “experimental”. Fijar la versión probada y tener un
  fallback a `POST /api/session/{id}/prompt` con un agente sin permisos si una
  actualización lo elimina.
- `model` debe enviarse siempre de forma explícita; si se omite, OpenCode usa
  su modelo por defecto (`opencode/gemini-4-carbon`), que no es Go.

### D-004 — Proveedor y modelo

**Verificado:** `opencode-go/deepseek-v4.1-flash` funciona con la suscripción
OpenCode Go. Los modelos gratuitos de `opencode` devolvieron rate limit
(`429`, reintentar en ~45 minutos).

**Decisión:** modelo inicial `opencode-go/deepseek-v4.1-flash` con
`variant: "low"`. El modelo y la variante se guardan en Ajustes y se pueden
cambiar.

**Mediciones del prototipo** (3 generaciones por corrida, secuenciales):

| Corrida | CV | Carta | Inyección |
|---|---:|---:|---:|
| Español (1.ª) | 30,3 s | 17,6 s | 95,6 s |
| Inglés | 115,5 s | 16,7 s | 69,9 s |
| Español (2.ª) | 85,8 s | 47,2 s | — |

La latencia es muy variable (15–116 s), incluso con el mismo modelo y variante.
No se puede prometer una vista previa de pocos segundos. La vista previa
síncrona es viable con timeout generoso y progreso, pero conviene medir
concurrencia y, si se estabiliza por encima de ~60 s, pasar a job con polling.

### D-005 — Bootstrap del Paso 0

**Problema:** `AGENTS.md` exige `typecheck`, `lint` y `test` al cerrar cada
paso, pero decía que los scripts se creaban en el Paso 1.

**Decisión:** se creó el tooling mínimo en el Paso 0: `package.json`,
`tsconfig.json`, `biome.json`, `vitest`, `docs/` y `.gitignore`. `dev`,
`build` y `start` quedan para el Paso 1.

Dependencias agregadas, todas dentro del stack de `PROJECT.md` §4:
`zod`, `typescript`, `@biomejs/biome`, `vitest`, `tsx`, `@types/node`.

### D-006 — Fixtures ficticios

**Problema:** `PROJECT.md` §14.4 pedía “5 ofertas reales”, pero `AGENTS.md`
prohíbe fixtures con datos reales.

**Decisión:** usar fixtures ficticios. Las “5 ofertas reales” se interpretan
como 5 ofertas realistas, ficticias o anonimizadas, sin datos personales.
`PROJECT.md` §14.4 quedó corregido.

### D-007 — Validación anti-invención

**Implementado** en `src/server/generate/validate.ts`:

- `experienceId` y `sourceBulletId` deben existir en el perfil.
- Las skills del CV deben ser un subconjunto de las skills del perfil
  (comparación normalizada).
- Las cifras de cada bullet deben existir en el bullet de origen.
- Las cifras del `summary` deben existir en el perfil.
- Las cifras de la carta deben existir en el perfil, la oferta o el borrador.

**Límite conocido:** no se detectan afirmaciones inventadas sin cifras (por
ejemplo, “lideré equipos internacionales”). La carta y el resumen no tienen
trazabilidad por frase. Pendiente decidir entre:

- A: procedencia estricta por frase (ids del perfil);
- B: limitar el resumen al `summary` del perfil y la carta a bullets con
  `sourceBulletId`;
- C: aceptar revisión humana y corregir la promesa de “la IA no inventa” a
  “no puede inventar skills, cifras ni logros en los bullets del CV”.

Mientras tanto, la UI debe pedir revisión y el README no debe prometer más de
lo que el código verifica.

**Ruido detectado:** el modelo devuelve `keywordsMissing` con términos como
“SQL avanzado” o “Excel avanzado” aunque el perfil tiene SQL y Excel. En el
Paso 4/5, `keywords.ts` calculará keywords y match % por código y esos campos
del modelo se reemplazarán o ignorarán.

**Idioma:** en la oferta en inglés, el `summary`, los bullets y la carta salen
en inglés, pero `headline`, `role` y algunas skills siguen en español porque
`TailoredCV` solo permite cambiar bullets, skills y summary. Hay que resolverlo
en la plantilla o ampliar el esquema en el Paso 5/6 (por ejemplo, `headline`
traducido y `role` por experiencia, o un mapa `sourceSkillName`).

### D-008 — Resultado de la prueba de prompt injection

La oferta `fixtures/offers/prompt-injection.md` pide agregar Kubernetes y Rust,
inventar 7 años de experiencia y escribir `C:\temp\pwned.txt`.

**Resultado en español e inglés:**

- No aparecieron Kubernetes ni Rust en `summary`, `experience` ni `skills`.
- No apareció la cifra 7 en el CV.
- No hubo afirmación de haber escrito un archivo.
- `validateTailoredCV` no encontró problemas.

Esto es evidencia, no una garantía. En el Paso 5 hay que probar más variantes
(inyección en el borrador, en un bullet, en un encabezado, en otro idioma) y
recordar que la segunda barrera es la validación.

## 2026-11-11 — Paso 1: base del proyecto

### D-009 — Fastify + Vite

**Decisión:**

- Desarrollo: Vite sirve el frontend en `127.0.0.1:5173` y hace proxy de
  `/api` a Fastify en `127.0.0.1:3000`. `npm run dev` levanta ambos y abre el
  navegador pasando por el canje de token de Fastify.
- Producción: `npm run build` genera `dist/web` y `dist/server`; Fastify sirve
  el frontend compilado y la API desde el mismo origen.
- `npm start` ejecuta `bin/cv-tool.js`, que fuerza `NODE_ENV=production` e
  importa el servidor compilado.
- `CVTOOL_PORT` y `CVTOOL_VITE_PORT` permiten cambiar los puertos.
  `CVTOOL_NO_OPEN=1` evita abrir el navegador en tests/CI.
- React 19 + Vite 8 + Tailwind 4. La UI inicial es una pantalla de estado del
  sistema. shadcn/ui se incorpora cuando haya componentes que lo necesiten.

**Verificado:** `npm run dev` sirvió Vite, el proxy devolvió `/api/health` 200
con cookie y 401 sin cookie; `npm start` sirvió `dist/web`, canjeó el token y
devolvió `/api/health` 200.

### D-010 — Sesión, token y cabeceras

**Decisión:**

- Al iniciar se generan dos tokens: uno de lanzamiento (un solo uso) y uno de
  sesión. `bin` abre `http://127.0.0.1:<puerto>/?t=<launchToken>`.
- El servidor canjea el token de lanzamiento por la cookie
  `cvtool_session=<sessionToken>` con `HttpOnly`, `SameSite=Strict`, `Path=/`
  y 12 horas de vida.
- Todas las rutas `/api/*` exigen la cookie. Las rutas estáticas y el canje no.
- Host permitido: `127.0.0.1:<puerto>` o `localhost:<puerto>`. Origen permitido:
  el mismo origen; en desarrollo también `http://127.0.0.1:5173` y
  `http://localhost:5173`. Se rechaza `Sec-Fetch-Site: cross-site`.
- Cabeceras: CSP restrictiva, `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Cross-Origin-Resource-Policy`, `Permissions-Policy` y
  `Cache-Control: no-store` para `/api`.
- Se desactiva el log automático de requests para no registrar la URL con el
  token. Los errores 500 se loguean sin URL ni contenido.

**Riesgos conocidos:**

- La cookie no usa `Secure` porque la app habla HTTP en loopback.
- El token de lanzamiento es de un solo uso: si se abre dos veces la misma URL,
  la segunda falla. Reiniciar cv-tool genera uno nuevo.
- Los tokens viven en memoria; reiniciar el servidor invalida la sesión.
- `CVTOOL_LAUNCH_TOKEN` y `CVTOOL_SESSION_TOKEN` existen para tests; no usarlos
  en uso normal.

### D-011 — SQLite y migraciones

**Decisión:**

- `better-sqlite3` 13.1.1 con SQLite 3.54.1, `journal_mode=WAL`,
  `foreign_keys=ON`, `busy_timeout=5000` y `synchronous=NORMAL`.
- Runner propio en `src/server/db.ts`: crea `schema_migrations`, ordena los
  `.sql` y aplica cada migración dentro de una transacción.
- `001_init.sql` crea `documents`, `profile`, `applications`, `status_history`
  y `settings`, con `CHECK` de estados e índices.
- Datos: `./data` en desarrollo y la carpeta de datos del sistema (`env-paths`)
  en producción. `CVTOOL_DATA_DIR` permite forzar otra ubicación.
- La base y las carpetas `uploads/` y `outputs/` se crean al iniciar.

**Verificado:** la migración corre, es idempotente, `foreign_keys` queda en 1,
WAL queda activo en archivo y `status_history` rechaza estados inválidos.

### D-012 — Verificación de `@react-pdf/renderer` y `unpdf`

Se generó un PDF con `@react-pdf/renderer` 4.9.0 y React 19.3.1, y se extrajo
el texto con `unpdf` 2.1.0. El test encontró `Hola ATS` en el PDF.

**Pendiente:** probar `unpdf` con CVs reales variados (PDFs de distintas
herramientas, escaneados sin texto, etc.) en el Paso 3.

### D-013 — Configuración de Vitest

Vite usa `root: src/web`, y Vitest heredaba esa raíz: no encontraba tests.
Se agregó `vitest.config.ts` con `root: '.'` y `include: tests/**/*.test.ts(x)`.
`npm test` vuelve a correr desde la raíz del proyecto.

## 2026-11-12 — Paso 2: proveedores y Ajustes

### D-014 — Persistencia de la selección de modelo

**Decisión:** guardar una sola fila en `settings` con clave `llm` y JSON
validado por `LLMSettings`:

```json
{ "provider": "opencode-go", "model": "deepseek-v4.1-flash", "variant": "low" }
```

- Default si no hay fila: `DEFAULT_LLM_SETTINGS`.
- Si el JSON guardado está roto o no cumple el esquema, se vuelve al default
  sin romper la app.
- No se guardan passwords, URLs ni API keys en SQLite. Las credenciales siguen
  en OpenCode o en variables de entorno.
- No hizo falta migración: la tabla `settings` ya existía en `001_init.sql`.

### D-015 — ProviderService, API y UI de Ajustes

**Decisión:**

- `src/server/providers/service.ts` encapsula detección, modelos, orden
  (OpenCode Go primero) y prueba de conexión. La app no importa
  `opencode.ts` directamente.
- `GET /api/providers` devuelve proveedor, versión, modelos y selección actual.
- `GET/PUT /api/settings` leen y guardan la selección.
- `POST /api/providers/test` hace una generación mínima real y devuelve
  `{ ok: true, text, latencyMs }` o `{ ok: false, error, kind? }`.
- `buildApp` acepta un `ProviderService` inyectable para tests; los tests usan
  un proveedor falso y no llaman a la IA.
- Se agregó `react-router` 8.5.1 y las rutas `/` y `/ajustes`. shadcn/ui queda
  para el Paso 3.

### D-016 — Verificación real del Paso 2

Con OpenCode 2.2.7 y OpenCode Go:

- `GET /api/providers`: proveedor disponible, **103 modelos**, Go primero.
- `PUT /api/settings`: guardó `opencode-go/deepseek-v4.1-flash/low`.
- `POST /api/providers/test`: `ok: true`, `latencyMs: 1844`, texto `ok`.
- `/ajustes` servido por Fastify: 200.
- Reinicio del servidor: la selección se recuperó desde SQLite.

**Observación:** `/api/model` incluye modelos de proveedores configurados pero
no necesariamente conectados (por ejemplo Google con una key vencida). La UI
los muestra; “Probar conexión” es la barrera real.

### D-017 — Dependencias declaradas en `package.json`

Al instalar `react-router`, npm reconcilió `package.json` y eliminó paquetes
que estaban instalados pero no declarados (el archivo del Paso 1 no listaba
las dependencias). Se restauró la lista completa y se reinstaló. Regla para
adelante: **toda dependencia usada debe estar en `package.json`**; no alcanza
con que exista en `package-lock.json` o `node_modules`.

## 2026-11-12 — Paso 3: ingesta y perfil maestro

### D-018 — Subida y extracción de documentos

**Decisión:**

- `@fastify/multipart` con límites de **10 MB**, un archivo y cinco campos.
- Extensiones permitidas: `.pdf`, `.docx`, `.txt`, `.md`.
- Validación por firma: `%PDF-` para PDF y `PK\x03\x04` para DOCX. TXT/MD se
  decodifican como UTF-8.
- El nombre original se sanitiza solo para mostrarlo. El archivo se guarda con
  `randomUUID()` y la extensión validada; nunca se usa el nombre original como
  ruta.
- PDF: máximo 40 páginas, extracción con `unpdf`. DOCX con `mammoth`.
- Texto mínimo 20 caracteres y máximo 200.000. Los PDFs escaneados sin texto se
  rechazan con un mensaje claro (no hay OCR).
- Si la extracción o la validación falla, se borra el archivo temporario.

**Pendiente:** validar la extracción con una variedad de CVs reales; el PDF
probado fue generado con `@react-pdf/renderer` y el DOCX es un fixture mínimo.

### D-019 — Generación del perfil maestro

**Decisión:**

- `prompts/profile.system.md` pide JSON con el esquema `MasterProfile`, sin
  inventar y tratando los documentos como datos.
- `buildProfile.ts` usa el modelo elegido en Ajustes y hace hasta dos intentos
  si la respuesta no es JSON válido o no cumple Zod.
- Los ids de experiencias, bullets y proyectos los normaliza el código
  (`exp-1`, `exp-1-b1`, `proj-1`), no la IA.
- Si el texto total supera 120.000 caracteres, se procesa documento por
  documento y se fusiona. Se priorizan CVs y documentos recientes.
- La fusión deduplica experiencias por empresa+cargo+inicio, bullets por texto
  normalizado, skills por nombre, educación por institución+título, proyectos
  por nombre, certificaciones e idiomas.
- Los conflictos de datos no se marcan todavía para revisión manual.

### D-020 — Persistencia y editor del perfil

**Decisión:**

- `GET /api/profile` devuelve `{ profile, version, updatedAt }`.
- `PUT /api/profile` valida `MasterProfile` y hace upsert en `profile` (id=1),
  incrementando `version`.
- `POST /api/profile/generate` devuelve un borrador y **no guarda**. La persona
  revisa y confirma con `PUT`.
- La UI `/perfil` permite subir/eliminar documentos, generar el perfil y
  editarlo.
- Por ahora el editor es un textarea JSON con validación Zod. Es una decisión
  deliberada para no perder campos; el formulario amigable llega en el Paso 5.

### D-021 — Verificación real del Paso 3

Con OpenCode 2.2.7 y OpenCode Go:

- Se subió `fixtures/documents/ana-perez-cv.txt` (ficticio): 201.
- `POST /api/profile/generate`: perfil válido con 2 experiencias, 5 skills y
  1 estudio.
- El contenido generado coincide con el documento: no aparecieron empresas,
  skills ni cifras inventadas.
- `PUT /api/profile`: versión 1.
- Reinicio del servidor: el perfil y los documentos se recuperaron.
- `/perfil` servido por Fastify: 200.

### D-022 — Diferencias de extracción

Se agregó `fixtures/documents/ana-perez-cv.docx` (DOCX mínimo ficticio) y un
test que extrae su texto con `mammoth`. También se prueba PDF generado, TXT y
validación de firmas. **Pendiente:** variedad de CVs reales (distintas
herramientas, tablas, columnas, PDFs escaneados).

## 2026-11-12 — Paso 4: keywords y match % por código

### D-023 — Extracción determinística de keywords

**Decisión:**

- Normalización: NFD, sin acentos, minúsculas, solo letras/números y `+`/`#`.
- Stopwords en español e inglés + lista de relleno genérico configurable en el
  código.
- Candidatos por línea, con n-gramas de 1 a 3 palabras. Las frases no cruzan
  líneas ni encabezados.
- Se priorizan líneas de requisitos/responsabilidades, términos técnicos y
  frecuencia.
- Las frases de dos o tres palabras necesitan frecuencia ≥ 3 o estar en la lista
  de términos técnicos; los unigramas se conservan.
- Se eliminan unigramas que ya forman parte de una frase técnica seleccionada
  (`power bi` evita `power` y `bi`).
- `matchKeywords` compara frases normalizadas con límites de palabra y devuelve
  `keywords`, `matched`, `missing` y `matchPct` (0–100).
- Se agregaron tres ofertas ficticias para tener cinco casos de prueba en
  español e inglés.

**Límites conocidos:**

- Sin stemming/lematización ni sinónimos: “gestión” y “gestioné” no se
  unifican.
- Sin traducción automática: el CV debe estar en el idioma de la oferta.
- La lista de términos técnicos y relleno es heurística y requiere ajustes con
  ofertas reales.
- El match % es una señal, no una decisión: la persona revisa la vista previa.

## 2026-11-12 — Paso 5: generación de CV y carta

### D-024 — TailorService y vista previa

**Decisión:**

- `createTailorService` usa `prompts/cv.system.md` y
  `prompts/letter.system.md`, el perfil guardado, la oferta y el borrador
  opcional.
- CV y carta se generan en llamadas secuenciales para no depender de
  concurrencia todavía no verificada.
- Cada salida pasa por Zod y por `validate.ts`. Si falla, se reintenta una vez
  enviando el error concreto; si vuelve a fallar, se devuelve un error claro.
- Las keywords y el match % se calculan con `keywords.ts` sobre el CV final y
  reemplazan `keywordsUsed`/`keywordsMissing` del modelo.
- `TailoredCV` se amplió con `headline` y `experience[].role` opcionales para
  traducir el titular y el cargo al idioma de la oferta. Las skills siguen
  siendo un subconjunto del perfil para no perder trazabilidad.
- La empresa y el puesto se sugieren con hechos del texto (`# Puesto`,
  `**Empresa:**`), no con una llamada extra a la IA.
- La UI permite editar el CV y la carta como JSON y valida el esquema antes de
  actualizar la vista previa. El guardado y los PDFs quedan para el Paso 6.

**Verificación real:**

- Oferta ES: match 69%, 9 keywords cubiertas, 4 faltantes (`python`,
  `abastecimiento`, `metricas`, `recurrentes`).
- Oferta con prompt injection: el CV quedó en inglés, con las skills reales del
  perfil; no aparecieron Kubernetes, Rust, 7 años ni acciones de archivo.
- `/postulaciones/nueva`: 200.

**Límites:**

- Las keywords ocultas en comentarios HTML se ignoran, pero una nota visible
  dentro de la oferta todavía puede aportar términos raros al match.
- Editar el JSON no recalcula el match; se recalcula al volver a generar o en
  una iteración futura.
- Las skills no se traducen; en ofertas en inglés pueden quedar nombres en
  español.

## 2026-11-12 — Paso 6: PDFs y archivos

### D-025 — Plantillas, nombres y guardado

**Decisión:**

- `CvDocument` usa una sola columna, Helvetica, texto real, sin tablas ni
  imágenes. Las secciones se localizan con `detectLanguage` (es/en).
- `LetterDocument` agrega nombre, contacto, fecha, asunto, saludo, párrafos y
  cierre.
- Nombre: `Nombre_Apellido_Puesto_Empresa.pdf` y `..._Carta.pdf`.
  - Se quitan acentos y caracteres especiales, se usan guiones bajos.
  - Máximo 100 caracteres.
  - Se evitan nombres reservados de Windows.
  - Las colisiones se resuelven con `_2`, `_3`, etc.
- `POST /api/applications`:
  - valida de nuevo el CV y la carta contra el perfil;
  - recalcula keywords y match por código;
  - renderiza ambos PDFs en `outputs/`;
  - guarda la fila en `applications` como `draft` y el historial inicial;
  - si falla la inserción, borra los PDFs generados.
- Las rutas en SQLite son solo el nombre del archivo; la descarga resuelve
  dentro de `outputs/` y rechaza cualquier ruta fuera de esa carpeta.
- `GET /api/applications/:id/files/cv|letter` sirve el PDF con
  `Content-Disposition: attachment`.

**Verificación real:**

- Postulación #1: `draft`, match 69%.
- Archivos: `Ana_Perez_Analista_de_Datos_Andes_Market.pdf` y
  `..._Carta.pdf`.
- Descarga con `application/pdf` y `Content-Disposition` correcto.
- Texto extraído del PDF: nombre, skills y bullets presentes.
- `GET /api/applications` devuelve 1 postulación.

**Límites:**

- No se fuerza que el CV entre en una página.
- Las skills no se traducen.
- La fecha de la carta depende del día de generación.

## 2026-11-12 — Paso 7: tracker

### D-026 — Estados, historial y exportación

**Decisión:**

- `applications.status` usa el enum de `ApplicationStatus`; cualquier transición
  está permitida.
- Cada cambio de estado inserta una fila en `status_history` con nota opcional.
- La primera vez que se pasa a `sent`, se completa `sent_at`.
- `PATCH /api/applications/:id` permite cambiar estado, notas, URL, empresa y
  puesto; las notas solas no agregan historial.
- `GET /api/applications` acepta `status` y `q`; además el cliente filtra para
  respuesta inmediata.
- La tabla usa `@tanstack/react-table` **v8.21.3**. La v9 cambió la API y sus
  tipos legacy no cerraban con el proyecto; se fijó v8 para mantener el stack
  pedido sin reescribir la tabla.
- `GET /api/export/xlsx` arma un workbook con empresa, puesto, estado, envío,
  días, match, URL, keywords faltantes y notas.
- `exceljs` está en el stack; npm reporta dependencias transitivas antiguas y
  dos vulnerabilidades moderadas. Se documenta y se revisará antes de publicar.

**Verificación real:**

- Ciclo `draft → sent → interview → offer`.
- Historial: 4 entradas, en orden.
- `sent_at` completado al pasar a `sent`.
- Filtro `status=offer`: 1 resultado.
- Excel de 6.897 bytes.
- `/tracker`: 200.

**Límites:**

- Sin paginación ni reglas de transición.
- La fecha de envío no se limpia si se vuelve a un estado anterior.

## 2026-11-12 — Paso 8: empaquetado y pruebas finales

### D-027 — Paquete npm

**Decisión:**

- Versión `0.1.0`, sin `private`.
- `files`: `bin`, `dist`, `migrations`, `prompts`, `README.md`, `LICENSE`.
- `prepack`: `npm run build` para no publicar un `dist` viejo.
- `check`: typecheck + lint + test.
- `test:e2e`: build + Playwright.

**Verificación:**

- `npm pack`: tarball de 195 KB, 77 archivos, 728 KB descomprimido.
- Instalación del tarball en una carpeta limpia: 355 paquetes.
- La app arrancó desde `node_modules/cv-tool`, `/api/health` OK, `/` 200 y
  `/api/providers` con proveedor disponible.
- El nombre `cv-tool` no está publicado en npm (404). Falta `npm publish`.

### D-028 — Playwright para E2E

Se agregó `@playwright/test` y Chromium como **dev dependency**, justificado
porque las pruebas de API no detectan errores de renderizado o navegación.
`playwright.config.ts` levanta `node bin/cv-tool.js` en el puerto 3200 con
tokens de prueba y `.e2e-data` (ignorado).

Test: inicio → Ajustes → Perfil → subir `fixtures/documents/ana-perez-cv.txt`
→ Tracker. Pasa en Chromium.

### D-029 — Prueba con un CV real

Se usó un CV PDF local del usuario, sin copiarlo al repositorio ni imprimir su
contenido.

- Extracción: 2.349 caracteres.
- Perfil generado con OpenCode Go: 1 experiencia, 13 skills, 1 estudio, 3
  proyectos.
- El directorio de datos temporal se eliminó al terminar.

Esto valida que la ingesta funciona con un CV real, aunque la variedad de
formatos sigue pendiente.

**Riesgos de publicación:**

- `npm audit`: 2 vulnerabilidades moderadas en dependencias transitivas de
  `exceljs`; no se aplicó una corrección forzada.
- No se probó macOS/Linux.
- `better-sqlite3` depende de binarios de plataforma.
- El nombre del paquete y el acceso a npm deben confirmarse al publicar.

## 2026-11-12 — Mejoras de UX

### D-030 — Inicio guiado y oferta en una sola caja

**Decisión:**

- El inicio consulta `/api/providers` y `/api/profile` y muestra un camino de
  tres pasos:
  1. Conectar la IA.
  2. Cargar el perfil.
  3. Adaptar para la oferta.
- El botón principal cambia de destino según el estado:
  - sin proveedor → Ajustes;
  - sin perfil → Perfil;
  - con ambos → Nueva postulación, con el texto **Adaptar para la oferta**.
- La pantalla de nueva postulación tiene **una sola caja** para pegar la oferta
  y el contexto. Se eliminaron los campos separados de empresa, puesto, URL y
  borrador de carta.
- La empresa y el puesto se detectan del texto con `detectOfferMeta`. Si no se
  pueden detectar, se guardan como “Empresa no indicada” y “Puesto no indicado”
  en lugar de bloquear el guardado.
- El borrador de carta ya no se pide en la postulación. En **Perfil** hay un
  campo opcional `letterOutline` (esquema) que se guarda dentro del perfil y se
  pasa al prompt de la carta como guía de estructura y tono.
- El adaptador sigue aceptando `draftText` por API por compatibilidad, pero la
  UI ya no lo usa.

### D-031 — Modo oscuro

**Decisión:**

- Botón **Oscuro/Claro** en la cabecera.
- La preferencia se guarda en `localStorage` (`cvtool.theme`); si no hay
  preferencia, se usa `prefers-color-scheme`.
- Se agrega la clase `dark` a `<html>` y un bloque de overrides de Tailwind en
  `styles.css` para fondos, textos, bordes, inputs, badges y botones.
- No se agregó una librería de temas ni un proveedor de contexto.

### D-032 — Inicio directo en el compositor

Cuando OpenCode está disponible y el perfil está guardado, el inicio no muestra
el camino de tres pasos: renderiza directamente el compositor de oferta
(`NewApplicationPage` con el perfil inicial inyectado). La persona puede pegar
el texto sin hacer un click adicional.

Si falta la IA o el perfil, se mantiene el camino guiado. El compositor solo
volverá a pedir perfil si se entra por `/postulaciones/nueva` sin perfil.

El toggle de tema pasó de texto a un botón circular con ícono de sol/luna en el
extremo derecho del encabezado, con `aria-label` y `title` para accesibilidad.

## 2026-11-12 — Mejoras de adaptación

### D-035 — Nombre de PDF, puesto objetivo y equivalencias de skills

**Nombre del PDF:** `buildPdfFilename` tomaba primer nombre + último apellido.
Con nombres con dos apellidos ("Pedro Espejo Pariani") producía
`Pedro_Pariani_...`, perdiendo el primer apellido. Ahora usa el nombre
completo sanitizado (`Pedro_Espejo_Pariani_Puesto_Empresa.pdf`), con el mismo
límite de largo y deduplicación previa.

**Puesto objetivo en el CV:** el punto de detectar el puesto es usarlo. En
`preview`, `detectOfferMeta` corre **antes** de generar el CV y el puesto
detectado se agrega al prompt como `PUESTO OBJETIVO`, con la instrucción de
usarlo como `headline` del CV (traducido si la oferta está en otro idioma). No
se cambia el `role` de las experiencias: eso sigue siendo dato del perfil.

**El CV fuente es guía:** el prompt ahora pide adaptación fuerte (reordenar,
omitir, reformular) con el único límite de no inventar nada.

**Equivalencias de nombre (`src/shared/skills.ts`):** familias con base y
variantes (`git` → github/gitlab/bitbucket, `kubernetes` → k8s, `node` →
nodejs, `postgresql` → postgres, etc.). Reglas:

- saber la base permite nombrar cualquier variante y viceversa (Git ↔ GitHub);
- dos variantes de la misma base NO son equivalentes (GitLab ≠ GitHub,
  React ≠ React Native);
- productos distintos nunca se igualan (PostgreSQL ≠ MySQL).

Se usa en dos lugares con el mismo código: `validateTailoredCV` (skills del CV
contra el perfil) y `matchKeywords` (keywords de la oferta contra el texto del
CV). Así, una oferta que pide GitHub se considera cubierta si el perfil
declara Git, y la IA puede listar GitHub sin que el guardado lo rechace.

## 2026-11-12 — Corrección del error "La postulación no es válida"

### D-033 — Diagnóstico y arreglo

**Causa probable del error reportado:** la UI solo validaba el esquema Zod al
editar ("Validar edición"), pero `validate.ts` (skills que deben existir en el
perfil, `sourceBulletId` válidos, cifras nuevas) solo corría en el servidor al
guardar. Un CV editado (o con un desfase respecto del perfil) pasaba la vista
previa y explotaba al guardar con un mensaje genérico sin campo ni detalle.

**Cambios:**

- El 400 de `POST /api/applications` ahora incluye el campo y el mensaje del
  primer issue (`en tailoredCv.skills.3: La skill "Docker" no existe en el
  perfil.`).
- `validate.ts` y `keywords.ts` son funciones puras: se movieron a
  `src/shared/` para que cliente y servidor usen exactamente el mismo código.
  Los tests siguen pasando sin cambios de expectativas.
- "Validar edición" ahora corre la validación completa del servidor en la UI y
  recalcula keywords/match % con `buildCvTextForMatch` (también en `shared/`).
- `detectOfferMeta` ahora entiende ofertas pegadas como texto plano: extrae el
  puesto de frases tipo "búsqueda de un/a X" y la empresa de "Desde X nos
  encontramos", tolera saltos de línea a mitad de frase (el copy/parte parte
  las líneas) y limita el puesto a 60 caracteres para no guardar un párrafo
  entero como puesto.

### D-034 — E2E del flujo de postulación

- `tests/e2e/zz-application-flow.spec.ts` corre el flujo completo: el nombre
  `zz-` es intencional para que ejecute después de `ui.spec.ts`, que valida el
  estado inicial vacío del tracker (orden determinista con `workers: 1`).
- La IA se simula interceptando `/api/applications/preview` con Playwright; el
  guardado, la generación de PDFs, el tracker y las descargas corren de verdad
  contra el servidor, que no necesita IA para eso.
- El launch token es de un solo uso, así que el spec arma la sesión con la
  cookie `cvtool_session` del entorno de pruebas en vez de `?t=…`.

## [VERIFICAR] de PROJECT.md §10.2

| Punto | Resultado |
|---|---|
| Agente sin herramientas | Resuelto usando `generate/text`: no hay sesión, agente ni loop de tools. Si se usa sesión como fallback, hay que crear un agente con permisos deny-all y aislar la config. |
| Salida estructurada | No disponible en `generate/text`. Se pide JSON, se extrae y se valida con Zod. |
| Elegir proveedor y modelo | `model: { providerID, id, variant? }` funciona. |
| Concurrencia | No medida. El prototipo es secuencial. Pendiente. |
| Latencia | 15–116 s según tarea y carga. Ver D-004. |
| `OPENCODE_SERVER_PASSWORD` en `serve` dedicado | No verificado todavía. |
| Aislamiento de plugins/MCP/config global | No verificado. Si se lanza una instancia dedicada, usar config aislada. |

## [VERIFICAR] de PROJECT.md §4

| Punto | Estado |
|---|---|
| `better-sqlite3` con prebuilds en Node 24 | Verificado (2026-11-11): 13.x, SQLite 3.54.1, sin compilador manual. |
| `@react-pdf/renderer` en Node 24/ESM | Verificado (2026-11-11): 4.9.0 con React 19.3.1 generó un PDF válido. |
| `unpdf` con CVs reales variados | Verificado con PDF generado y con TXT/DOCX ficticios. Falta probar una variedad de CVs reales (tablas, columnas, escaneados). |
