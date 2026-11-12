# cv-tool — Especificación del proyecto

> Documento principal para el agente de desarrollo. Leelo completo antes de escribir código.
> Las reglas operativas de trabajo están en `AGENTS.md`; este documento define **qué** se construye.
> Todo lo marcado **[VERIFICAR]** no se asume: se prueba, y el resultado se anota en `docs/decisions.md`.

---

## 1. Qué es y para qué sirve

Una app **local-first** para automatizar de forma liviana el proceso de postularse a trabajos.

La persona carga **una sola vez** su material (CVs, portfolio, presentaciones, certificados). Después, por cada oferta que encuentra **a mano**, la pega en la app y recibe:

1. Un **CV adaptado** a la oferta, con keywords relevantes, formato compatible con filtros ATS y archivo nombrado según el puesto.
2. Una **carta de presentación** adaptada al puesto y a la empresa (a partir de un borrador propio si lo hay).
3. Un **registro automático en un tracker** con empresa, puesto, fecha, estado y seguimiento.

**La app NO busca ofertas ni postula sola.** La búsqueda y el envío los hace la persona. La app prepara y registra.

## 2. Objetivo final

Herramienta **open source, gratuita y local-first** que cualquiera pueda correr en su computadora con la IA que ya tenga (OpenCode, API key o modelo local):

- Sin servidor propio, sin cuentas, sin costos operativos.
- Los datos viven en la carpeta del usuario. Lo único que sale de su máquina es lo que envíe el proveedor de IA que él mismo elija.
- Pensada para compartirse: se instala y se ejecuta con un comando (`npx cv-tool`), con documentación clara.

## 3. Principios de diseño (no negociables)

1. **La IA no inventa.** Solo reformula, reordena y prioriza información que ya está en el perfil maestro. Nunca agrega skills, empleos, títulos, métricas ni logros. Lo que la oferta pide y la persona no tiene se reporta como **faltante**, no se inserta en el CV.
2. **El formato lo controla el código, no la IA.** La IA devuelve JSON validado; una plantilla fija ATS-friendly lo convierte en PDF.
3. **Lo medible se calcula por código.** Extracción de keywords y porcentaje de match se hacen sin IA, para que sean deterministas y confiables.
4. **El proveedor de IA es intercambiable.** Todo pasa por una interfaz única (`LLMProvider`). Nada fuera de `providers/` conoce a un proveedor concreto.
5. **Seguro por defecto.** El texto de las ofertas es contenido **no confiable** (puede traer instrucciones ocultas). Ver sección 9.
6. **Simple y liviano.** Pocas dependencias, un solo proceso, un solo archivo de base de datos. Toda dependencia nueva debe justificarse.
7. **La persona siempre revisa.** Nada se marca como "enviado" sin que la persona lo confirme. El perfil maestro y los resultados son editables.

## 4. Stack (decisiones tomadas)

| Capa | Tecnología |
|---|---|
| Runtime | **Node.js ≥ 24 (LTS)**, ESM, `engines` fijado en `package.json` |
| Lenguaje | **TypeScript** estricto en todo el proyecto |
| Backend | **Fastify** (+ `@fastify/static`, `@fastify/multipart`, `@fastify/cookie`) |
| Frontend | **React + Vite + Tailwind CSS + shadcn/ui** |
| Enrutado y formularios | `react-router`, `react-hook-form` + resolver de Zod |
| Tabla del tracker | `@tanstack/react-table` |
| Base de datos | **SQLite** con **`better-sqlite3`**, migraciones en SQL numerado |
| Validación | **Zod** (esquemas compartidos entre server y web) |
| IA (MVP) | **OpenCode** en modo servidor (`opencode serve`) |
| Lectura de archivos | `unpdf` (PDF), `mammoth` (DOCX) |
| PDF del CV y la carta | `@react-pdf/renderer` (corre del lado del servidor) |
| Exportar a Excel | `exceljs` |
| Rutas de datos del usuario | `env-paths` (o equivalente) |
| Calidad | **Vitest** (tests), **Biome** (lint + formato), `tsc --noEmit` |
| Dev | `tsx` (backend con recarga), `vite` (frontend) |

Notas:
- La base de datos queda encapsulada en `db.ts`. Más adelante se podrá migrar a `node:sqlite` (integrado en Node; hoy en estado release candidate) sin tocar el resto del código.
- **[VERIFICADO 2026-11-11]** `better-sqlite3` 13.x se instaló y abrió SQLite 3.54.1 en Node 24 sin compilador manual. Ver `docs/decisions.md`.
- **[VERIFICADO 2026-11-11]** `@react-pdf/renderer` 4.9.0 generó un PDF válido con React 19 en Node 24/ESM; `unpdf` 2.1.0 extrajo el texto. En el Paso 3 se probó además con TXT y DOCX ficticios; falta una variedad de CVs reales.

## 5. Alcance por etapas

### MVP (lo que se construye ahora)
- Adaptador de **OpenCode** como único proveedor de IA.
- Carga de documentos y extracción de texto.
- Perfil maestro en JSON, generado por IA y **editable** por la persona.
- Nueva postulación: pegar oferta (texto) y borrador de carta opcional.
- Generación de CV adaptado + carta, render a PDF, nombre de archivo automático.
- Keywords y match % calculados por código.
- Tracker con estados e historial; exportar a Excel/CSV.
- Pantalla de Ajustes con detección de OpenCode y botón "probar conexión".
- Distribución por npm (`npx cv-tool`).

### v0.2
- Adaptadores por API key: OpenAI-compatible (cubre OpenAI, OpenRouter, Gemini, Ollama, LM Studio) y Anthropic.
- Exportar CV a `.docx`.
- Recordatorios por inactividad (ej. "sin respuesta hace 14 días").

### v0.3
- Traer la oferta desde una URL.
- Varias plantillas de CV.
- Interfaz en inglés.

### Futuro
- Empaquetado como app de escritorio (por ejemplo con Tauri) para quien no use terminal.
- Comparación de keywords por significado (embeddings).

### Fuera de alcance
- Buscar ofertas automáticamente o hacer scraping de portales.
- Postular automáticamente en nombre de la persona.
- Cuentas de usuario, nube, sincronización entre dispositivos.
- Cualquier cosa que requiera un servidor propio.

## 6. Arquitectura

```
Navegador (127.0.0.1)
      │  HTTP + cookie de sesión
      ▼
Servidor Fastify ── SQLite (cv.sqlite)
      │              └─ archivos en uploads/ y outputs/
      │
      └─ LLMProvider (interfaz)
            └─ OpenCodeAdapter ──► opencode serve (127.0.0.1:4096) ──► proveedor que el usuario configuró
```

En producción, Fastify sirve el frontend ya compilado (`dist/web`). En desarrollo, Vite corre aparte con proxy hacia Fastify.

### Estructura de carpetas

```
cv-tool/
├─ AGENTS.md                   # reglas de trabajo del agente
├─ PROJECT.md                  # este documento
├─ bin/cv-tool.js              # entrada de npx: arranca el servidor y abre el navegador
├─ src/
│  ├─ server/
│  │  ├─ index.ts              # arranque de Fastify, rutas, estáticos
│  │  ├─ config.ts             # puertos, rutas de datos, variables de entorno
│  │  ├─ security.ts           # Host/Origin, token de sesión, cabeceras
│  │  ├─ db.ts                 # better-sqlite3 + runner de migraciones
│  │  ├─ providers/
│  │  │  ├─ types.ts           # interfaz LLMProvider
│  │  │  ├─ opencode.ts        # adaptador MVP
│  │  │  └─ index.ts           # registro y detección
│  │  ├─ ingest/
│  │  │  ├─ extract.ts         # PDF/DOCX → texto
│  │  │  └─ buildProfile.ts    # texto crudo → MasterProfile (IA)
│  │  ├─ generate/
│  │  │  ├─ tailor.ts          # llama a la IA, valida con Zod, reintenta
│  │  │  ├─ validate.ts        # reglas anti-invención (sección 8)
│  │  │  ├─ keywords.ts        # keywords y match % sin IA
│  │  │  └─ filename.ts
│  │  ├─ render/
│  │  │  ├─ CvDocument.tsx     # 1 columna, sin tablas ni imágenes
│  │  │  └─ LetterDocument.tsx
│  │  └─ export/xlsx.ts
│  ├─ web/
│  │  ├─ main.tsx
│  │  ├─ pages/                # Perfil · Nueva postulación · Tracker · Ajustes
│  │  └─ components/
│  └─ shared/
│     ├─ schemas.ts            # esquemas Zod
│     └─ types.ts
├─ prompts/                    # prompts en archivos .md, versionados
│  ├─ profile.system.md
│  ├─ cv.system.md
│  └─ letter.system.md
├─ migrations/                 # 001_init.sql, 002_...
├─ fixtures/                   # perfil y ofertas de ejemplo (es/en) + oferta con prompt injection
├─ scripts/prototype.ts        # Paso 0: prueba de prompts contra OpenCode
├─ tests/
├─ docs/decisions.md           # decisiones y resultados de los [VERIFICAR]
├─ docs/progress.md            # checklist del plan, actualizado por el agente
└─ package.json
```

### Ubicación de los datos
- Por defecto: carpeta de datos del usuario según el sistema operativo (vía `env-paths`), **nunca** dentro del paquete ni de `node_modules`.
- En desarrollo: `./data` (en `.gitignore`), configurable con la variable `CVTOOL_DATA_DIR`.
- Contiene `cv.sqlite`, `uploads/` y `outputs/`.

### Scripts de `package.json`
`dev` (servidor + vite), `build` (vite + compilación del servidor), `start`, `test`, `lint`, `typecheck`, `prototype`.

## 7. Modelo de datos (SQLite)

```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cv','portfolio','presentation','certificate','other')),
  path TEXT NOT NULL,
  extracted_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),     -- una sola fila
  data TEXT NOT NULL,                         -- JSON validado con MasterProfile
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE applications (
  id INTEGER PRIMARY KEY,
  company TEXT NOT NULL,
  position TEXT NOT NULL,
  url TEXT,
  job_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','in_process','interview','offer','hired','rejected','withdrawn')),
  sent_at TEXT,
  match_pct REAL,
  missing_keywords TEXT,                      -- JSON array
  cv_path TEXT,
  letter_path TEXT,
  tailored_json TEXT,                         -- salida validada de la IA
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE status_history (
  id INTEGER PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

- Migraciones numeradas en `migrations/` desde el primer día, con una tabla `schema_migrations` y un runner simple en `db.ts`. Otros usuarios tendrán bases existentes: nunca editar una migración ya publicada, siempre agregar una nueva.
- Cada cambio de `status` inserta una fila en `status_history` y actualiza `applications.updated_at`.
- Activar `PRAGMA foreign_keys = ON` y `journal_mode = WAL` al abrir la base.

## 8. Esquemas Zod (contrato con la IA)

Definir en `src/shared/schemas.ts`. Versión inicial (ajustable, pero mantené la trazabilidad por `id`):

```ts
const MasterProfile = z.object({
  basics: z.object({
    fullName: z.string(),
    headline: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  }),
  summary: z.string().optional(),
  experience: z.array(z.object({
    id: z.string(),                       // estable, para trazabilidad
    company: z.string(),
    role: z.string(),
    start: z.string(),
    end: z.string().nullable(),           // null = actual
    location: z.string().optional(),
    bullets: z.array(z.object({ id: z.string(), text: z.string() })),
  })),
  education: z.array(z.object({
    institution: z.string(), degree: z.string(),
    start: z.string().optional(), end: z.string().optional(),
  })).default([]),
  skills: z.array(z.object({ name: z.string(), category: z.string().optional() })),
  projects: z.array(z.object({
    id: z.string(), name: z.string(), description: z.string(),
    url: z.string().optional(), tech: z.array(z.string()).default([]),
  })).default([]),
  certifications: z.array(z.object({ name: z.string(), issuer: z.string().optional(), year: z.string().optional() })).default([]),
  languages: z.array(z.object({ name: z.string(), level: z.string().optional() })).default([]),
});

const TailoredCV = z.object({
  summary: z.string(),
  experience: z.array(z.object({
    experienceId: z.string(),             // debe existir en el perfil
    bullets: z.array(z.object({
      text: z.string(),
      sourceBulletId: z.string(),         // de qué bullet del perfil sale
    })),
  })),
  skills: z.array(z.string()),            // subconjunto de las skills del perfil
  keywordsUsed: z.array(z.string()),
  keywordsMissing: z.array(z.string()),   // la oferta lo pide, el perfil no lo tiene
});

const CoverLetter = z.object({
  greeting: z.string(),
  paragraphs: z.array(z.string()).min(2).max(5),
  closing: z.string(),
});
```

### Validación post-IA (`validate.ts`, obligatoria)
Después de validar el esquema, comprobar:
- Todo `experienceId` y `sourceBulletId` existe en el perfil.
- Todo ítem de `skills` existe en el perfil (comparación normalizada).
- Las cifras y porcentajes de cada bullet adaptado aparecen en el bullet de origen. Si aparece un número nuevo, se rechaza.
- Las cifras del `summary` aparecen en el perfil. Las cifras de la carta aparecen en el perfil, la oferta o el borrador.
- Las afirmaciones sin cifras (por ejemplo, “lideré equipos internacionales”) no se pueden verificar automáticamente. Queda pendiente definir procedencia estricta por frase o aceptar revisión humana; ver `docs/decisions.md`.
- Si algo falla: reintentar hasta 2 veces enviando el error concreto a la IA; si persiste, devolver un error claro a la UI. **Nunca** guardar salida que no pase la validación.

## 9. Seguridad

### 9.1 Servidor local
- Escuchar **solo en `127.0.0.1`**.
- Validar los headers `Host` y `Origin` en cada request y rechazar lo que no sea el origen esperado (protege contra páginas externas que intenten hablar con el servidor local). CORS desactivado. En desarrollo se permite además el origen de Vite, únicamente con `NODE_ENV=development`.
- **Token de sesión:** se genera al iniciar. `bin/cv-tool.js` abre el navegador en `http://127.0.0.1:<puerto>/?t=<token>`; el servidor canjea el token por una cookie `HttpOnly; SameSite=Strict` y exige esa cookie en cada llamada a `/api`.
- Cabeceras: `Content-Security-Policy` restrictiva (`default-src 'self'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- Sanitizar nombres de archivo y evitar *path traversal* en subidas y descargas.
- Límite de tamaño y de páginas por archivo subido; lista de extensiones permitidas (`pdf`, `docx`, `txt`, `md`).
- Servir los archivos generados con `Content-Disposition` explícito.

### 9.2 Prompt injection (el texto de la oferta no es confiable)
- Separar en el prompt las instrucciones del sistema del contenido externo y rodear la oferta con delimitadores explícitos indicando que es **datos, no instrucciones**.
- El modo elegido para el MVP, `POST /api/experimental/generate/text`, no crea sesión ni ejecuta un agente con herramientas. Si en el futuro se usa una sesión, el agente debe correr **sin herramientas** (sin shell, sin lectura/escritura de archivos, sin red) y en una carpeta vacía; hay que aislar plugins/MCP y verificar la configuración.
- La validación de la sección 8 es la segunda barrera: aunque la IA obedezca algo raro, no puede colar skills o logros inexistentes.

### 9.3 Credenciales
- El MVP **no maneja tokens ni keys de IA**: el usuario las configura en OpenCode. Las credenciales de OpenCode Go las administra OpenCode.
- El password del servidor local de OpenCode es un secreto local: se lee de `OPENCODE_SERVER_PASSWORD` o de `service.json`, y nunca se loguea, se muestra en errores ni se commitea.
- Cuando se agreguen API keys (v0.2): no guardarlas en SQLite en texto plano; usar variable de entorno o el almacén de credenciales del sistema. Nunca loguearlas.
- Proteger el servidor de OpenCode con `OPENCODE_SERVER_PASSWORD`; el adaptador usa autenticación HTTP Basic.

### 9.4 Privacidad
- Sin telemetría. Sin llamadas de red salvo hacia el proveedor de IA elegido.
- Los logs no incluyen contenido de CVs, ofertas ni datos personales.
- Si se usa OpenCode Go, el contenido del CV y de la oferta se envía al servicio de inferencia de OpenCode. “Local-first” aplica al almacenamiento, no a la inferencia: hay que informarlo en el README y en Ajustes.

## 10. Proveedores de IA

### 10.1 Interfaz

```ts
export interface LLMProvider {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  listModels(): Promise<{
    provider: string;
    model: string;
    name?: string;
    variants?: string[];
  }[]>;
  generate(req: {
    system: string;
    user: string;
    model?: { provider: string; model: string; variant?: string };
    jsonSchema?: unknown;         // si el proveedor lo soporta
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<string>;            // texto crudo; parseo y validación son de tailor.ts
  getServerInfo?(): Promise<{ version: string }>; // opcional, para Ajustes
}
```

`tailor.ts` y `buildProfile.ts` dependen **solo** de esta interfaz.

### 10.2 Adaptador OpenCode (MVP)

**Contrato verificado contra OpenCode 2.2.7 (2026-11-10).** La API v2 vive bajo `/api`; el OpenAPI está en `/openapi.json`. `@opencode-ai/sdk` 1.x no se asume compatible con el servidor 2.x; el adaptador usa `fetch` directo.

- Servicio local: `opencode serve` o el servicio en segundo plano de OpenCode. En la instalación verificada, el servicio en segundo plano escucha en un puerto dinámico y publica `port`/`password` en `~/.config/opencode/service.json`.
- Autenticación: HTTP Basic, usuario `opencode` por defecto; password en `OPENCODE_SERVER_PASSWORD` o en `service.json`. Nunca loguear el password.
- Endpoints:
  - `GET /api/info`: versión y estado del servidor.
  - `GET /api/provider`: proveedores configurados.
  - `GET /api/model`: modelos, con `providerID`, `modelID` y variantes.
  - `POST /api/experimental/generate/text`: generación sin sesión ni agente.
- `generate/text` recibe `{ prompt, model?: { providerID, id, variant? } }` y devuelve `{ data: { text } }`. No acepta `system` separado ni JSON Schema.
- Errores: `{ _tag, providerID?, reason?, message?, status?, retryAfterMs? }`; mapear a mensajes claros (auth, rate limit, timeout, proveedor).

Tareas del adaptador:
1. `isAvailable()`: `GET /api/info`.
2. `listModels()`: leer `/api/model` y devolver modelos habilitados, con variantes.
3. `generate()`: `POST /api/experimental/generate/text`, con modelo explícito. Pedir JSON en el prompt, extraerlo (`json.ts`), validar con Zod y reintentar.
4. Errores explícitos: servidor caído, credenciales inválidas, rate limit, proveedor desconectado, timeout.

**Fallback:** si una versión futura elimina `generate/text`, usar `POST /api/session/{sessionID}/prompt` con un agente sin permisos (deny-all) y configuración aislada.

**[VERIFICAR] pendientes** (anotar en `docs/decisions.md`):
- Comportamiento ante requests concurrentes (para decidir si se serializan las generaciones).
- Si `OPENCODE_SERVER_PASSWORD` funciona al lanzar un `opencode serve` dedicado.
- Cómo aislar plugins/MCP/config global si se usa una instancia dedicada.
- Latencia estable por modelo y variante (medida inicial: 15–116 s).

### 10.3 Detección y Ajustes
Al iniciar, `providers/index.ts` consulta qué proveedores están disponibles. La pantalla de Ajustes los muestra con estado, selector de modelo y botón **"Probar conexión"** (envía un prompt mínimo y muestra éxito o el error). Si no hay ninguno disponible, la UI explica cómo instalar y levantar OpenCode, sin bloquear el resto de la app (se puede cargar perfil y usar el tracker sin IA).

**Implementado (2026-11-12):** `ProviderService`, `GET /api/providers`, `GET/PUT /api/settings`, `POST /api/providers/test` y pantalla `/ajustes` con selección persistida en SQLite. Ver `docs/decisions.md` (D-014 a D-017).

## 11. Flujos funcionales

### 11.1 Construir el perfil maestro
1. La persona sube archivos → se guardan en `uploads/` → se extrae el texto y se guarda en `documents`.
2. Con el botón "Generar perfil", `buildProfile.ts` envía el texto de los documentos a la IA y recibe un `MasterProfile`. Los ids estables los asigna el código si la IA no los da.
3. La persona **revisa y edita** el perfil en un formulario. Se valida con Zod al guardar.
4. Si sube documentos nuevos, se ofrece "actualizar perfil" mostrando las diferencias; nunca se sobrescribe sin confirmación.

Si el texto total supera la ventana de contexto del modelo, procesar por documento y fusionar, priorizando el CV más reciente ante conflictos y marcando los conflictos para revisión manual.

### 11.2 Nueva postulación
1. La persona pega: texto de la oferta (obligatorio), empresa y puesto (la IA propone, la persona confirma) y, opcionalmente, un borrador de carta y la URL.
2. **Por código:** `keywords.ts` extrae las keywords de la oferta.
3. **Por IA:** `tailor.ts` genera `TailoredCV` y `CoverLetter`, con las reglas anti-invención.
4. **Por código:** se valida (sección 8), se calcula el match % comparando keywords de la oferta contra el texto final del CV y se arma el nombre de archivo.
5. Se muestra una **vista previa editable** del CV y la carta, con keywords cubiertas y faltantes.
6. Al confirmar: se renderizan los PDFs en `outputs/`, se crea la fila en `applications` con estado `draft`, y la persona la marca como `sent` cuando efectivamente postule.

### 11.3 Tracker
- Tabla con empresa, puesto, estado, fecha de envío, **días transcurridos**, match %.
- Filtros por estado y búsqueda de texto.
- Cambio de estado en un clic, con nota opcional; historial visible por postulación.
- Acceso rápido a los PDFs generados y al texto de la oferta original.
- Botón **Exportar a Excel/CSV**.

## 12. Reglas de generación

### 12.1 Keywords (`keywords.ts`, sin IA)
- Normalizar (minúsculas, sin acentos para comparar), tokenizar, eliminar stopwords en español e inglés, considerar n-gramas de 1 a 3 palabras.
- Priorizar términos técnicos y frases repetidas o presentes en secciones de requisitos; ignorar relleno genérico (lista configurable).
- Match % = keywords de la oferta presentes en el CV final / total de keywords relevantes de la oferta. Devolver también las cubiertas y las faltantes.
- Debe tener tests con las ofertas de `fixtures/` en ambos idiomas.

### 12.2 Reglas del prompt del CV (`prompts/cv.system.md`)
- Idioma de salida: el de la oferta.
- Usar **únicamente** información del perfil; cada bullet adaptado indica su `sourceBulletId`.
- Se puede reformular, reordenar, acortar y priorizar según relevancia; incorporar keywords **solo si la experiencia real las respalda**.
- Prohibido agregar herramientas, tecnologías, cifras, cargos, fechas o logros que no estén en el perfil.
- Lo que la oferta pide y no está en el perfil va a `keywordsMissing`.
- Bullets concisos, con verbo de acción al inicio.

### 12.3 Reglas de la carta (`prompts/letter.system.md`)
- Si hay borrador de la persona: conservar su voz y estructura, adaptándolo a puesto y empresa.
- Si no hay: generarla desde el perfil y la oferta, tono profesional y cercano, 3 a 4 párrafos cortos.
- No afirmar nada sobre la empresa que no surja del texto de la oferta o de lo que la persona haya escrito.

### 12.4 Plantilla ATS-friendly (`CvDocument.tsx`)
- **Una columna**, sin tablas, sin columnas de texto, sin imágenes ni íconos, sin cuadros de texto.
- Fuentes estándar, tamaño legible, encabezados convencionales (Experiencia, Educación, Habilidades…) en el idioma de la oferta.
- Texto real seleccionable: verificar en un test extrayendo el texto del PDF generado.
- Fechas en formato consistente; datos de contacto en texto plano.

### 12.5 Nombre de archivo (`filename.ts`)
Formato: `Nombre_Apellido_Puesto_Empresa.pdf` (y `..._Carta.pdf`). Sin acentos ni caracteres especiales, espacios como guion bajo, longitud máxima ≈100 caracteres, colisiones resueltas con sufijo.

## 13. API interna (borrador)

Todas requieren la cookie de sesión.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado de la app y del proveedor |
| GET | `/api/providers` | Proveedores disponibles y modelos |
| POST | `/api/providers/test` | Probar conexión |
| GET/PUT | `/api/settings` | Leer y guardar ajustes |
| GET/POST/DELETE | `/api/documents` | Gestionar archivos cargados |
| POST | `/api/profile/generate` | Generar perfil desde documentos |
| GET/PUT | `/api/profile` | Leer y guardar perfil maestro |
| POST | `/api/applications/preview` | Generar CV + carta (sin guardar) |
| POST | `/api/applications` | Confirmar, renderizar PDFs y guardar |
| GET | `/api/applications` | Listar (filtros por estado y texto) |
| GET/PATCH | `/api/applications/:id` | Ver y actualizar (estado, notas) |
| GET | `/api/applications/:id/files/:kind` | Descargar CV o carta |
| GET | `/api/export/xlsx` | Exportar tracker |

## 14. Plan de trabajo (en este orden)

Cada paso termina con algo ejecutable y verificable. No avances al siguiente sin cumplir los criterios. Al terminar cada paso, actualizá `docs/progress.md`.

0. **Prototipo de prompts y spike de OpenCode.** Sin UI. `scripts/prototype.ts` toma un perfil y una oferta de `fixtures/`, llama a OpenCode y valida la salida con Zod. Resolver acá los **[VERIFICAR]** de la sección 10.2.
   *Listo cuando:* hay evidencia de que se puede (a) hablar con `opencode serve`, (b) correr un agente sin tools, (c) obtener JSON utilizable, y (d) un CV y una carta de ejemplo salen con calidad aceptable. Si (d) falla, ajustar los prompts antes de seguir.
   *Resultado (2026-11-10):* se usó `opencode-go/deepseek-v4.1-flash` con `variant: low`; CV y carta válidos en español e inglés; la oferta con prompt injection fue resistida. Pendiente medir concurrencia y aislar una instancia dedicada. Ver `docs/decisions.md`.
1. **Base del proyecto.** Estructura, Fastify, React servido con Vite, `security.ts` (Host/Origin/token/cookie/cabeceras), SQLite con migración `001`, `bin/cv-tool.js`.
   *Listo cuando:* `npm run dev` y `npm start` funcionan, la app abre en `127.0.0.1`, rechaza requests con `Origin` ajeno o sin cookie y crea la base al iniciar. Verificar `better-sqlite3`, `unpdf` y `@react-pdf/renderer` en Node 24.
   *Resultado (2026-11-11):* completado. `npm run dev` y `npm start` verificados; seguridad, SQLite, `better-sqlite3`, `@react-pdf/renderer` y `unpdf` verificados; 28 tests pasan. Ver `docs/decisions.md`.
2. **Capa de proveedores + adaptador OpenCode.** Interfaz, adaptador, detección y pantalla de Ajustes con "Probar conexión".
   *Listo cuando:* desde la UI se elige modelo y la prueba devuelve una respuesta real.
   *Resultado (2026-11-12):* completado. 103 modelos detectados, conexión real `ok` en 1,8 s, selección persistida y recuperada tras reiniciar. Ver `docs/decisions.md`.
3. **Ingesta y perfil maestro.** Subida de archivos, extracción, `buildProfile.ts`, editor del perfil.
   *Listo cuando:* subiendo un CV real se obtiene un perfil válido, editable y persistido.
   *Resultado (2026-11-12):* completado con un CV ficticio realista; perfil válido, guardado como versión 1 y recuperado tras reiniciar. El editor es JSON por ahora. Ver `docs/decisions.md`.
4. **Keywords por código.** `keywords.ts` con tests.
   *Listo cuando:* los tests pasan con al menos 5 ofertas realistas (ficticias o anonimizadas, sin datos personales) en español e inglés.
   *Resultado (2026-11-12):* completado. Cinco ofertas de prueba, extracción con n-gramas, stopwords y match %; tests de keywords y match. Ver `docs/decisions.md`.
5. **Generación.** `tailor.ts` + `validate.ts` con reintentos y vista previa.
   *Listo cuando:* una oferta de prueba produce CV y carta válidos, y la oferta con prompt injection **no** logra colar contenido inexistente ni ejecutar acciones.
   *Resultado (2026-11-12):* completado. Oferta ES con 69% de match; carta y CV válidos; la inyección no agregó skills, cifras ni acciones. Ver `docs/decisions.md`.
6. **Render y archivos.** Plantilla ATS, PDFs, nombre de archivo.
   *Listo cuando:* el texto extraído del PDF generado coincide con el contenido esperado y el nombre sigue el formato.
   *Resultado (2026-11-12):* completado. CV/carta en PDF, nombres
   `Nombre_Apellido_Puesto_Empresa[_Carta].pdf`, descarga y texto extraído
   verificado. Ver `docs/decisions.md`.
7. **Tracker.** CRUD, estados, historial, días transcurridos, filtros, exportar a Excel.
   *Listo cuando:* se recorre el ciclo draft → sent → interview → offer y se exporta el resultado.
   *Resultado (2026-11-12):* completado. Ciclo verificado, historial de 4 entradas, filtros y Excel generado. Ver `docs/decisions.md`.
8. **Pulido y publicación.** README de instalación (incluye cómo instalar y levantar OpenCode), manejo de errores amigable, estados de carga, datos de ejemplo, `package.json` listo para publicar en npm.
   *Listo cuando:* otra persona, desde cero, puede correr `npx cv-tool` siguiendo solo el README.

## 15. Convenciones

- TypeScript estricto. Sin `any` salvo justificado con comentario.
- Validar con Zod **todo** lo que cruce una frontera (API, IA, archivos, JSON leído de la base).
- Funciones puras (`keywords.ts`, `filename.ts`, `validate.ts`) con tests en Vitest.
- Errores del proveedor de IA: mensajes claros para la persona (qué pasó y qué hacer), nunca stack traces en la UI.
- Logs sin datos personales ni contenido de CVs.
- Commits pequeños y descriptivos; actualizar `docs/decisions.md` ante cualquier desvío de este documento.
- Interfaz en español en el MVP, pero con los textos centralizados para facilitar la traducción en v0.3.
- Si una instrucción de este documento choca con la realidad técnica, **frená, documentá el motivo y proponé alternativa** en vez de improvisar en silencio.

## 16. Criterios de aceptación del MVP

- [ ] Funciona 100% en local, sin ningún backend propio en la nube.
- [ ] Con OpenCode conectado, de una oferta pegada se obtiene CV + carta en PDF y una fila en el tracker.
- [ ] El CV no contiene skills, cifras ni logros ausentes del perfil (validado por código).
- [ ] El PDF es de una columna, con texto seleccionable y nombre `Nombre_Apellido_Puesto_Empresa.pdf`.
- [ ] El match % y las keywords faltantes se calculan sin IA y se muestran en la vista previa.
- [ ] El tracker muestra estado, días transcurridos e historial, y exporta a Excel/CSV.
- [ ] El servidor rechaza requests con `Host`/`Origin` inválidos o sin sesión.
- [ ] Una oferta con prompt injection no produce acciones ni contenido fuera del perfil.
- [ ] Sin OpenCode disponible, la app sigue funcionando (perfil, tracker) y explica cómo conectarlo.
- [ ] `npx cv-tool` funciona desde cero siguiendo el README, y los datos quedan fuera del paquete.
