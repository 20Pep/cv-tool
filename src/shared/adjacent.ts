import { skillsMatch } from './skills.js';
import { normalizeText } from './text.js';

/**
 * Grupos de tecnologías **afines**: se usan en el mismo tipo de problema y
 * aprender una da una base real para la otra. No son equivalencias de nombre
 * (eso vive en `skills.ts`): acá MySQL y PostgreSQL sí son afines, pero no se
 * presentan como la misma herramienta.
 *
 * La tabla es deliberadamente corta y curada: la IA no puede inventar pares.
 * Para agregar uno, tiene que ser defendible en una entrevista.
 */
const ADJACENT_GROUPS: readonly (readonly string[])[] = [
  ['sql', 'mysql', 'postgresql', 'sqlite', 'sql server', 'oracle'],
  ['jest', 'vitest', 'mocha', 'jasmine'],
  ['aws', 'gcp', 'azure'],
  ['react', 'next.js', 'preact'],
  ['vue', 'nuxt'],
  ['express', 'fastify', 'koa', 'hapi'],
  ['django', 'flask', 'fastapi'],
  ['power bi', 'tableau', 'looker', 'qlik'],
  ['pandas', 'polars'],
  ['tensorflow', 'pytorch', 'keras'],
  ['javascript', 'typescript'],
  ['java', 'kotlin', 'scala'],
  ['docker', 'podman'],
  ['excel', 'google sheets'],
  ['figma', 'sketch', 'adobe xd'],
  ['seo', 'sem'],
  ['airflow', 'dagster', 'prefect'],
  ['terraform', 'pulumi'],
  ['tailwind', 'bootstrap'],
  ['github actions', 'gitlab ci', 'jenkins', 'circleci'],
];

function groupFor(value: string): readonly string[] | undefined {
  return ADJACENT_GROUPS.find((group) => group.some((member) => skillsMatch(member, value)));
}

/**
 * true si dos skills son afines: pertenecen al mismo grupo curado y no son la
 * misma cosa ni una variante de nombre de la otra.
 */
export function areAdjacent(left: string, right: string): boolean {
  const a = normalizeText(left);
  const b = normalizeText(right);

  if (a.length === 0 || b.length === 0 || a === b || skillsMatch(a, b)) {
    return false;
  }

  const leftGroup = groupFor(a);
  const rightGroup = groupFor(b);

  return leftGroup !== undefined && leftGroup === rightGroup;
}

/** Nombres afines disponibles para una skill del perfil. */
export function adjacentNamesFor(skill: string): string[] {
  const group = groupFor(skill);

  if (group === undefined) {
    return [];
  }

  return group.filter((member) => !skillsMatch(member, skill));
}
