import { normalizeText } from './text.js';

/**
 * Familias de skills con una tecnología base y sus variantes de nombre. Son
 * equivalencias de **nombre**, no de dominio: saber Git permite nombrar GitHub
 * o GitLab (todos usan git), pero dos variantes entre sí no son equivalentes
 * (GitLab no implica GitHub). PostgreSQL no equivale a MySQL.
 */
const SKILL_FAMILIES: { base: string; variants: string[] }[] = [
  { base: 'git', variants: ['github', 'gitlab', 'bitbucket'] },
  { base: 'kubernetes', variants: ['k8s'] },
  { base: 'node', variants: ['nodejs', 'node js', 'node.js'] },
  { base: 'javascript', variants: ['js'] },
  { base: 'typescript', variants: ['ts'] },
  { base: 'postgresql', variants: ['postgres'] },
  { base: 'mongodb', variants: ['mongo'] },
  { base: 'react', variants: ['reactjs', 'react js', 'react.js'] },
  { base: 'vue', variants: ['vuejs', 'vue js', 'vue.js'] },
  { base: 'gcp', variants: ['google cloud'] },
  { base: 'aws', variants: ['amazon web services'] },
  { base: 'azure', variants: ['microsoft azure'] },
  { base: 'sql server', variants: ['microsoft sql server', 'sqlserver'] },
  { base: 'ci cd', variants: ['cicd', 'ci/cd'] },
  { base: 'docker', variants: ['docker compose', 'docker-compose'] },
  { base: 'tailwind', variants: ['tailwind css'] },
  { base: 'llm', variants: ['llms'] },
];

/** Nombres normalizados que cubren `value`: ella misma, su base y sus variantes. */
export function skillVariants(value: string): string[] {
  const normalized = normalizeText(value);

  if (normalized.length === 0) {
    return [];
  }

  const family = SKILL_FAMILIES.find(
    (candidate) => candidate.base === normalized || candidate.variants.includes(normalized),
  );

  if (family === undefined) {
    return [normalized];
  }

  return [normalized, family.base, ...family.variants].filter(
    (name, index, all) => all.indexOf(name) === index,
  );
}

/**
 * true si dos skills son equivalentes: mismo nombre, o una es la base y la otra
 * una variante de esa base. Dos variantes de la misma base NO son equivalentes.
 */
export function skillsMatch(left: string, right: string): boolean {
  const a = normalizeText(left);
  const b = normalizeText(right);

  if (a.length === 0 || b.length === 0) {
    return false;
  }

  if (a === b) {
    return true;
  }

  return SKILL_FAMILIES.some(
    (family) =>
      (family.base === a && family.variants.includes(b)) ||
      (family.base === b && family.variants.includes(a)),
  );
}
