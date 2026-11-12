import { describe, expect, it } from 'vitest';
import { daysSince, parseDbDate } from '../src/shared/dates.js';

describe('fechas', () => {
  it('parsea fechas de SQLite como UTC', () => {
    expect(parseDbDate('2026-11-10 00:00:00').toISOString()).toBe('2026-11-10T00:00:00.000Z');
  });

  it('calcula días transcurridos', () => {
    expect(daysSince('2026-11-10 00:00:00', new Date('2026-11-12T00:00:00Z'))).toBe(2);
  });

  it('nunca devuelve días negativos', () => {
    expect(daysSince('2026-11-20 00:00:00', new Date('2026-11-12T00:00:00Z'))).toBe(0);
  });
});
