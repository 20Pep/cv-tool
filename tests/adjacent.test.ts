import { describe, expect, it } from 'vitest';
import { adjacentNamesFor, areAdjacent } from '../src/shared/adjacent.js';

describe('skills afines', () => {
  it('reconoce pares del mismo grupo', () => {
    expect(areAdjacent('MySQL', 'PostgreSQL')).toBe(true);
    expect(areAdjacent('SQL', 'PostgreSQL')).toBe(true);
    expect(areAdjacent('Jest', 'Vitest')).toBe(true);
    expect(areAdjacent('AWS', 'GCP')).toBe(true);
    expect(areAdjacent('React', 'Next.js')).toBe(true);
  });

  it('no confunde afines con equivalencias de nombre', () => {
    expect(areAdjacent('PostgreSQL', 'Postgres')).toBe(false);
    expect(areAdjacent('K8s', 'Kubernetes')).toBe(false);
  });

  it('no mezcla grupos distintos', () => {
    expect(areAdjacent('React', 'Vue')).toBe(false);
    expect(areAdjacent('MySQL', 'Jest')).toBe(false);
    expect(areAdjacent('GitLab', 'GitHub')).toBe(false);
    expect(areAdjacent('SQL', 'Python')).toBe(false);
  });

  it('lista las alternativas afines de una skill', () => {
    const names = adjacentNamesFor('MySQL');
    expect(names).toContain('postgresql');
    expect(names).not.toContain('mysql');
  });
});
