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

**Próximo paso:** Paso 2 — capa de proveedores + Ajustes.

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
- [x] `better-sqlite3` verificado en Node 24 (SQLite 3.53.4, sin compilador).
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

## Pasos siguientes

- [ ] Paso 2 — Capa de proveedores + Ajustes.
- [ ] Paso 3 — Ingesta y perfil maestro.
- [ ] Paso 4 — Keywords por código.
- [ ] Paso 5 — Generación y validación con reintentos.
- [ ] Paso 6 — Render y archivos.
- [ ] Paso 7 — Tracker.
- [ ] Paso 8 — Pulido y publicación.
