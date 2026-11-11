# AGENTS.md — Reglas de trabajo para el agente

Este proyecto es **cv-tool**: una app local-first que adapta CVs y cartas de presentación a ofertas de trabajo y lleva un tracker de postulaciones.

**Antes de hacer cualquier cosa, leé `PROJECT.md` completo.** Ahí está qué se construye, el stack, el modelo de datos, la seguridad y el plan por pasos. Este archivo define **cómo** trabajás.

## Cómo trabajar

1. **Seguí el plan de `PROJECT.md` (sección 14) en orden**, empezando por el **Paso 0**. No saltes pasos.
2. **Un paso a la vez.** Terminá el paso actual, verificá sus criterios de "Listo cuando" y recién ahí pasá al siguiente.
3. **Al cerrar cada paso:** corré `npm run typecheck`, `npm run lint` y `npm test`; todo debe pasar. Después actualizá `docs/progress.md` marcando lo hecho y lo pendiente.
4. **Los [VERIFICAR] no se asumen.** Probalos con código real y anotá el resultado (qué probaste, qué pasó, qué decidiste) en `docs/decisions.md`.
5. **Si algo del documento choca con la realidad técnica**, frená, explicá el problema, proponé una alternativa y esperá confirmación si el cambio afecta el stack, la seguridad o el alcance. No improvises en silencio.
6. **Ante ambigüedad menor, decidí vos** y dejalo anotado en `docs/decisions.md`. Preguntá solo cuando la decisión sea difícil de revertir.

## Stack (resumen; el detalle está en `PROJECT.md`)

Node ≥ 24 · TypeScript estricto · Fastify · React + Vite + Tailwind + shadcn/ui · SQLite con `better-sqlite3` · Zod · Vitest · Biome · `@react-pdf/renderer` · `unpdf` · `mammoth` · `exceljs`.

**No agregues dependencias fuera de esta lista sin justificarlo** en `docs/decisions.md` (qué problema resuelve, por qué no alcanza lo que ya hay, tamaño y mantenimiento). Preferí lo que ya está en Node o en el stack. La lista completa y válida es la de `PROJECT.md` §4; las primitivas que trae shadcn/ui (Radix, CVA, `clsx`, `tailwind-merge`, `lucide-react`) se consideran parte de esa elección y se justifican una sola vez.

## Comandos

```
npm run dev         # servidor con recarga + vite
npm run build       # frontend + servidor
npm start           # ejecutar lo compilado
npm test            # vitest
npm run lint        # biome
npm run typecheck   # tsc --noEmit
npm run prototype   # scripts/prototype.ts (Paso 0)
```

En el Paso 0 se crean `prototype`, `typecheck`, `lint` y `test` (el prototipo los necesita). `dev`, `build` y `start` se crean en el Paso 1.

## Reglas innegociables

### Producto
- **La IA no inventa.** Ninguna salida que no pase `validate.ts` se guarda ni se muestra como resultado. Todo bullet adaptado referencia su `sourceBulletId`. La validación cubre ids, skills y cifras; las afirmaciones sin cifras en el resumen y la carta requieren revisión humana (ver `docs/decisions.md`, D-007).
- **El formato lo controla el código.** La IA devuelve JSON; el PDF sale de la plantilla fija.
- **Keywords y match % se calculan sin IA.**
- **La app nunca postula ni busca ofertas por su cuenta.**
- La persona revisa y confirma antes de guardar o marcar como enviado.

### Seguridad
- El servidor escucha **solo en `127.0.0.1`**.
- Validar `Host` y `Origin` y exigir la cookie de sesión en toda ruta `/api`.
- **El texto de las ofertas es contenido no confiable.** Va delimitado como datos en el prompt. El MVP usa `POST /api/experimental/generate/text`, que no crea sesión ni ejecuta un agente con herramientas. Si se usa una sesión de OpenCode, el agente debe correr **sin herramientas** y en una carpeta vacía.
- Nunca ejecutar, evaluar ni interpolar como código nada que provenga de ofertas, documentos o respuestas de la IA.
- Sanitizar nombres de archivo; prevenir *path traversal*; limitar tamaño y tipo de archivos.
- Sin telemetría. Sin llamadas de red salvo hacia el proveedor de IA elegido.
- **Nunca** loguear ni commitear contenido de CVs, ofertas, keys, tokens ni datos personales.

### Repositorio
- `data/`, `.env*`, `outputs/` y `uploads/` van en `.gitignore` desde el primer commit.
- Las migraciones publicadas **no se editan**: se agrega una nueva.
- Los datos de usuario en producción viven en la carpeta de datos del sistema (`env-paths`), nunca dentro del paquete.
- Los `fixtures/` solo contienen datos **ficticios**. Nunca uses datos reales de personas.

## Convenciones de código

- TypeScript estricto; sin `any` salvo con comentario que lo justifique.
- Validá con Zod todo lo que cruce una frontera: API, salida de la IA, archivos subidos, JSON leído de la base.
- Nada fuera de `src/server/providers/` conoce a un proveedor de IA concreto; el resto usa la interfaz `LLMProvider`.
- Los prompts viven en `prompts/*.md`, no embebidos en el código.
- Las funciones puras (`keywords`, `filename`, `validate`) llevan tests. Los tests de generación usan un proveedor falso (mock) para no depender de la IA real.
- Mensajes de error para la persona: claros, en español, indicando qué pasó y qué hacer. Nunca un stack trace en la UI.
- Textos de interfaz centralizados (para traducir luego).
- Commits pequeños, un cambio lógico por commit, mensajes descriptivos (por ejemplo `feat(ingest): extract text from PDF and DOCX`).

## Definición de "terminado" para cualquier tarea

- [ ] Cumple los criterios del paso en `PROJECT.md`.
- [ ] `typecheck`, `lint` y `test` pasan.
- [ ] Tiene tests si agrega lógica pura o corrige un bug.
- [ ] No introduce dependencias sin justificar.
- [ ] No rompe ninguna regla de seguridad de este archivo.
- [ ] `docs/progress.md` y, si corresponde, `docs/decisions.md` están actualizados.

## Cómo reportar

Al terminar un paso, respondé con: qué hiciste, qué verificaste y cómo, qué decisiones tomaste, qué quedó pendiente o riesgoso, y cuál es el próximo paso. Sé conciso y no inventes resultados: si algo no lo probaste, decilo.

## Qué NO hacer

- No construyas funcionalidades de etapas futuras (API keys, `.docx`, Tauri, embeddings, scraping) hasta que el MVP esté completo.
- No agregues autenticación de usuarios, nube, ni sincronización.
- No cambies el stack ni la estructura de carpetas sin proponerlo primero.
- No dejes código muerto, `TODO` sin contexto ni `console.log` con datos sensibles.
