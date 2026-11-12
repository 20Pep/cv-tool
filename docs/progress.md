# Progreso

## Paso 0 — Prototipo de prompts y spike de OpenCode

**Estado:** completado con observaciones (2026-11-10).

- [x] Bootstrap mínimo: `package.json`, `tsconfig.json`, `biome.json`,
      Vitest, `docs/`, `.gitignore`.
- [x] Fixtures ficticios: perfil, ofertas en español e inglés, oferta con
      prompt injection.
- [x] Prompts en `prompts/cv.system.md` y `prompts/letter.system.md`.
- [x] Adaptador mínimo de OpenCode (`src/server/providers/`), con
      `generate/text`, detección de servidor, modelos y errores.
- [x] Extracción y validación de JSON (`json.ts`, Zod).
- [x] Validación anti-invención (`validate.ts`) con tests.
- [x] Corrida en español: CV y carta válidos; inyección resistida.
- [x] Corrida en inglés: CV y carta válidos; inyección resistida.
- [x] Resultados y decisiones en `docs/decisions.md`.

**Criterios de “Listo cuando” de PROJECT.md §14.0:**

- [x] (a) Hablar con `opencode serve` / servicio local de OpenCode.
- [x] (b) Correr sin tools: se usa `generate/text`, sin sesión ni agente.
- [x] (c) Obtener JSON utilizable y validarlo con Zod.
- [x] (d) CV y carta de ejemplo con calidad aceptable (español e inglés).

**Observaciones que no bloquean el Paso 1:**

- La latencia varía entre 15 y 116 s. Medir concurrencia y decidir si la vista
  previa necesita job + polling.
- El modelo `deepseek-v4.1-flash` con `variant: low` es el default; comparar
  con otros modelos de Go en el Paso 0/2.
- En ofertas en inglés, `headline`, `role` y algunas skills siguen en español:
  resolver en la plantilla o ampliar el esquema.
- `keywordsMissing` del modelo es ruidoso; se reemplaza por `keywords.ts` en el
  Paso 4/5.
- La validación no detecta afirmaciones inventadas sin cifras. Ver D-007.

**Cómo reproducir el prototipo:**

```powershell
npm run prototype
$env:CVTOOL_OFFER='fixtures/offers/data-analyst-en.md'
$env:CVTOOL_RUN_NAME='data-analyst-en'
npm run prototype
```

Las salidas quedan en `outputs/prototype/<nombre>/` y están en `.gitignore`.
Variables opcionales: `CVTOOL_PROVIDER`, `CVTOOL_MODEL`, `CVTOOL_VARIANT`,
`CVTOOL_OPENCODE_URL`, `OPENCODE_SERVER_PASSWORD`.

**Próximo paso:** Paso 1 — base del proyecto.

## Paso 1 — Base del proyecto

**Estado:** completado (2026-11-11).

- [x] Servidor Fastify en `127.0.0.1` con `@fastify/cookie` y
      `@fastify/static`.
- [x] Frontend React 19 + Vite 8 + Tailwind 4, servido por Vite en desarrollo
      y por Fastify en producción.
- [x] `security.ts`: Host/Origin, token de lanzamiento de un solo uso, cookie
      `HttpOnly; SameSite=Strict`, CSP y cabeceras.
- [x] SQLite con `better-sqlite3`, WAL, `foreign_keys`, `busy_timeout` y
      runner de migraciones.
- [x] Migración `001_init.sql` con las tablas del modelo de datos.
- [x] `bin/cv-tool.js` y `scripts/dev.ts`.
- [x] `npm run dev` y `npm start` verificados.
- [x] `better-sqlite3` verificado en Node 24 (13.1.1, SQLite 3.54.1, sin compilador).
- [x] `@react-pdf/renderer` + `unpdf` verificados con un PDF generado y texto
      extraído.
- [x] Tests de seguridad, base de datos y PDF: 28 tests pasan.

**Cómo probar:**

```powershell
npm run dev      # Fastify + Vite, abre el navegador
npm run build    # frontend + servidor compilado
npm start        # ejecuta dist/server + dist/web
```

En desarrollo los datos van a `./data`. En producción van a la carpeta de
datos del sistema (`env-paths`). Se puede forzar otra ubicación con
`CVTOOL_DATA_DIR`.

Variables útiles: `CVTOOL_PORT` (default 3000), `CVTOOL_VITE_PORT` (default
5173), `CVTOOL_NO_OPEN=1` para no abrir el navegador.

**Observaciones:**

- El token de lanzamiento es de un solo uso. Si se abre dos veces la misma URL,
  la segunda falla; hay que reiniciar cv-tool.
- La cookie no usa `Secure` porque la app habla HTTP en loopback.
- En producción la app usa un puerto fijo; si está ocupado, muestra un error
  claro y sugiere `CVTOOL_PORT`.
- `npm start` requiere `npm run build` antes.
- shadcn/ui todavía no está instalado; la UI inicial usa Tailwind directo.
  Se incorpora cuando haya componentes que lo justifiquen.

## Paso 2 — Proveedores + Ajustes

**Estado:** completado (2026-11-12).

- [x] `ProviderService`: detección de OpenCode, listado de modelos, orden con
      OpenCode Go primero y prueba de conexión.
- [x] `settings.ts`: selección persistida en SQLite bajo la clave `llm`, con
      validación Zod y default `opencode-go/deepseek-v4.1-flash` (`low`).
- [x] `GET /api/providers`, `GET/PUT /api/settings`,
      `POST /api/providers/test`.
- [x] Pantalla `/ajustes` con estado de OpenCode, selector de modelo y
      variante, “Probar conexión” y “Guardar ajustes”.
- [x] Navegación con `react-router`: Inicio y Ajustes.
- [x] Tests con proveedor falso: 43 tests pasan.
- [x] Prueba real contra OpenCode Go: 103 modelos, conexión `ok` en 1,8 s.
- [x] La selección sobrevive a un reinicio del servidor.

**Cómo probar:**

```powershell
npm run dev
```

Abrí **Ajustes**, elegí un modelo de OpenCode Go y usá **Probar conexión**.
Después **Guardar ajustes** y reiniciá la app: la selección debe seguir ahí.

**Observaciones:**

- La lista incluye modelos de todos los proveedores que OpenCode conoce.
  “Probar conexión” es la verificación real; un modelo de Google con
  credenciales vencidas va a fallar ahí.
- shadcn/ui sigue sin instalarse; Ajustes usa Tailwind directo. Se incorpora en
  el Paso 3, cuando aparezcan formularios grandes.
- “Probar conexión” hace una llamada real de pocos tokens y puede tardar.

**Próximo paso:** Paso 3 — ingesta de documentos y perfil maestro.

## Paso 3 — Ingesta y perfil maestro

**Estado:** completado (2026-11-12).

- [x] Subida multipart de PDF, DOCX, TXT y MD, con límite de 10 MB, validación
      por extensión y firma, nombres sanitizados y almacenamiento con UUID.
- [x] Extracción de texto con `unpdf` (PDF), `mammoth` (DOCX) y UTF-8
      (TXT/MD). Límite de 40 páginas y 200.000 caracteres.
- [x] `GET/POST/DELETE /api/documents`.
- [x] `prompts/profile.system.md`.
- [x] `buildProfile.ts`: prompt, validación Zod, hasta 2 intentos, ids
      normalizados, procesamiento por documento y fusión si el texto total
      supera 120.000 caracteres.
- [x] `GET/PUT /api/profile` y `POST /api/profile/generate`.
- [x] Persistencia en la tabla `profile`, con versión y fecha de actualización.
- [x] Pantalla `/perfil`: documentos, subida, borrado, generación con IA y
      editor JSON validado.
- [x] 68 tests pasan. Se agregó un DOCX ficticio para probar `mammoth`.
- [x] Prueba real: CV ficticio subido, perfil generado con OpenCode Go,
      guardado como versión 1 y recuperado después de reiniciar.
- [x] `/perfil` servido por Fastify: 200.

**Cómo probar:**

```powershell
npm run dev
```

1. Abrí **Perfil**.
2. Subí `fixtures/documents/ana-perez-cv.txt` o un CV propio.
3. Usá **Generar perfil con IA**.
4. Revisá el JSON, corregí lo que haga falta y **Guardar perfil**.

**Observaciones:**

- El editor del perfil es JSON por ahora, para no perder campos. El formulario
  amigable y la vista previa completa llegan en el Paso 5.
- Los PDFs escaneados sin texto seleccionable se rechazan con un mensaje claro;
  no hay OCR.
- La extracción está probada con PDF generado, TXT, DOCX ficticio y MD. Falta
  probar con una variedad de CVs reales.
- La fusión por documento prioriza los CV y los documentos más recientes, y
  deduplica experiencias, bullets, skills, educación, proyectos,
  certificaciones e idiomas. Los conflictos no se marcan todavía para revisión.
- El perfil generado no se guarda hasta que la persona confirma.

**Próximo paso:** Paso 4 — keywords y match % por código.

## Paso 4 — Keywords por código

**Estado:** completado (2026-11-12).

- [x] `keywords.ts` con normalización sin acentos, tokenización, stopwords en
      español e inglés y n-gramas de 1 a 3 palabras.
- [x] Priorización de términos técnicos, frases repetidas y líneas de
      requisitos/responsabilidades.
- [x] Filtro de relleno genérico, empresas, ubicaciones y encabezados.
- [x] `matchKeywords` y `analyzeOffer`: cubiertas, faltantes y match %.
- [x] Cinco ofertas de prueba en español e inglés: analista de datos ES/EN,
      frontend ES, backend EN y marketing ES.
- [x] Tests de keywords y match: 9 tests nuevos.

**Observaciones:**

- No hay stemming ni lematización: “gestioné” y “gestión” no se unifican. La
  comparación es por token/frase normalizada.
- No hay sinónimos ni traducción entre idiomas. El CV final debe estar en el
  idioma de la oferta para que el match sea justo.
- El match % se devuelve en escala 0–100.
- Las keywords del modelo (`keywordsUsed`/`keywordsMissing`) se van a
  reemplazar por las calculadas en código en el Paso 5.

## Paso 5 — Generación de CV y carta

**Estado:** completado (2026-11-12).

- [x] `tailor.ts`: genera CV y carta con los prompts, valida con Zod y
      `validate.ts`, y reintenta hasta dos veces con el error concreto.
- [x] `TailoredCV` acepta `headline` y `role` opcionales para traducir el
      titular y el cargo al idioma de la oferta.
- [x] Las keywords y el match % se calculan por código y reemplazan las que
      devuelve el modelo.
- [x] `POST /api/applications/preview` con detección simple de empresa/puesto.
- [x] Pantalla `/postulaciones/nueva`: oferta, borrador de carta, empresa,
      puesto, URL, vista previa, keywords, match % y edición JSON validada.
- [x] Tests con proveedor falso: generación, reintentos, errores y API.
- [x] Prueba real con OpenCode Go: oferta ES con **69% de match**, 9 keywords
      cubiertas y 4 faltantes.
- [x] Oferta con prompt injection: no agregó Kubernetes/Rust, no inventó 7 años
      y no escribió archivos; `/postulaciones/nueva` responde 200.

**Observaciones:**

- El CV y la carta se generan en llamadas secuenciales; la latencia puede ser
  de uno a varios minutos.
- La edición de la vista previa es JSON y todavía no guarda la postulación ni
  recalcula el match después de editar. Eso llega en el Paso 6.
- `headline` y `role` se traducen, pero las skills se mantienen como están en
  el perfil. En ofertas en inglés puede quedar alguna skill en español.
- La empresa y el puesto se sugieren con heurísticas a partir del texto; la
  persona los confirma.
- No se ejecuta nada del texto de la oferta: el adaptador usa `generate/text`
  sin herramientas.

## Paso 6 — Plantilla ATS, PDFs y archivos

**Estado:** completado (2026-11-12).

- [x] `CvDocument.tsx` en una columna, sin tablas ni imágenes, con secciones
      localizadas según el idioma de la oferta.
- [x] `LetterDocument.tsx` con encabezado, fecha, asunto, saludo, párrafos y
      cierre.
- [x] `filename.ts` con formato
      `Nombre_Apellido_Puesto_Empresa[_Carta].pdf`, sin acentos, máximo 100
      caracteres y resolución de colisiones.
- [x] `renderApplicationPdfs` escribe ambos PDFs en `outputs/`.
- [x] `POST /api/applications` valida, recalcula keywords/match, renderiza los
      PDFs y guarda la postulación como `draft` con historial.
- [x] `GET /api/applications/:id/files/cv|letter` descarga los PDFs.
- [x] Botón **Guardar y generar PDFs** en la vista previa, con descargas.
- [x] Tests de nombre, plantillas, extracción de texto y creación/descarga:
      100 tests pasan.
- [x] Prueba real: postulación #1 creada, match 69%, PDFs de 3,5 KB y 3,3 KB,
      texto extraído con nombre, skills y bullets.

**Observaciones:**

- La plantilla usa Helvetica y no incrusta fuentes externas.
- La carta agrega la fecha actual; el CV no incluye foto ni íconos.
- Los PDFs se guardan con el nombre final en `outputs/` y las rutas relativas
  en SQLite.
- Las skills siguen sin traducirse; en ofertas en inglés puede quedar alguna
  en español.
- No hay validación de “una página” para CVs largos.

## Paso 7 — Tracker

**Estado:** completado (2026-11-12).

- [x] `GET /api/applications` con filtros por estado y texto.
- [x] `GET /api/applications/:id` con oferta original e historial.
- [x] `PATCH /api/applications/:id` para estado, notas, URL, empresa y puesto.
- [x] Cambio de estado con historial y `sent_at` automático al pasar a `sent`.
- [x] Pantalla `/tracker` con tabla TanStack, filtros, cambio de estado,
      detalle, notas, descargas y exportación.
- [x] Días transcurridos desde el envío (o desde la creación si es borrador).
- [x] `GET /api/export/xlsx` con `exceljs`.
- [x] 109 tests pasan.
- [x] Prueba real: ciclo `draft → sent → interview → offer`, historial de 4
      entradas, filtro por estado y Excel de 6,9 KB; `/tracker` responde 200.

**Observaciones:**

- No hay reglas de transición: se permite cualquier estado, incluido volver
  atrás.
- `sent_at` se setea la primera vez que la postulación pasa a `sent` y no se
  limpia.
- Los filtros se resuelven en la API y también en el cliente para la búsqueda
  inmediata.
- No hay paginación; el tracker está pensado para uso personal.
- `exceljs` trae dependencias transitivas antiguas con avisos de npm audit, pero
  está dentro del stack aprobado. No afecta la ejecución local.

**Próximo paso:** Paso 8 — pulido, README y publicación.

## Pasos siguientes

- [ ] Paso 8 — Pulido y publicación.
