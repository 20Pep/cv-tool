import { describe, expect, it } from 'vitest';
import {
  daysSince,
  endOfDateInput,
  isWithinDates,
  isWithinPeriod,
  parseDateInput,
  parseDbDate,
  startOfPeriod,
} from '../src/shared/dates.js';

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

describe('isWithinPeriod', () => {
  const now = new Date(2026, 10, 12); // 12 de noviembre de 2026, hora local.

  it('incluye lo del mes actual y excluye lo anterior', () => {
    // Fechas al mediodía: así el resultado no depende del huso horario.
    expect(isWithinPeriod('2026-11-15 12:00:00', 'month', now)).toBe(true);
    expect(isWithinPeriod('2026-10-15 12:00:00', 'month', now)).toBe(false);
  });

  it('el rango anual incluye desde enero', () => {
    expect(isWithinPeriod('2026-06-15 12:00:00', 'year', now)).toBe(true);
    expect(isWithinPeriod('2025-12-15 12:00:00', 'year', now)).toBe(false);
  });

  it('una fecha inválida no entra en ningún período con filtro', () => {
    expect(isWithinPeriod('fecha-rota', 'month', now)).toBe(false);
  });

  it('"all" no filtra nada', () => {
    expect(isWithinPeriod('2020-01-01 00:00:00', 'all', now)).toBe(true);
    expect(isWithinPeriod('fecha-rota', 'all', now)).toBe(true);
  });

  it('startOfPeriod devuelve el primer día del mes y del año', () => {
    expect(startOfPeriod('month', now)).toEqual(new Date(2026, 10, 1));
    expect(startOfPeriod('year', now)).toEqual(new Date(2026, 0, 1));
    expect(startOfPeriod('all', now)).toBeNull();
  });
});

describe('rango de fechas libre', () => {
  it('parsea yyyy-mm-dd como día local', () => {
    expect(parseDateInput('2026-11-12')).toEqual(new Date(2026, 10, 12));
    expect(parseDateInput('2026-02-30')).toBeNull();
    expect(parseDateInput('12/11/2026')).toBeNull();
  });

  it('el fin del día incluye todo ese día', () => {
    expect(endOfDateInput('2026-11-12')).toEqual(new Date(2026, 10, 12, 23, 59, 59, 999));
  });

  it('incluye fechas dentro del rango y excluye las de afuera', () => {
    expect(isWithinDates('2026-11-15 12:00:00', '2026-11-01', '2026-11-30')).toBe(true);
    expect(isWithinDates('2026-10-31 12:00:00', '2026-11-01', '2026-11-30')).toBe(false);
    expect(isWithinDates('2026-12-01 12:00:00', '2026-11-01', '2026-11-30')).toBe(false);
  });

  it('un extremo vacío no filtra por ese lado', () => {
    expect(isWithinDates('2026-11-15 12:00:00', '2026-11-01', '')).toBe(true);
    expect(isWithinDates('2026-11-15 12:00:00', '', '2026-11-30')).toBe(true);
    expect(isWithinDates('2020-01-01 12:00:00', '', '')).toBe(true);
  });

  it('una fecha inválida queda afuera si hay algún filtro', () => {
    expect(isWithinDates('fecha-rota', '2026-11-01', '')).toBe(false);
  });
});
