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
