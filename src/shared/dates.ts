export function parseDbDate(value: string): Date {
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  return new Date(normalized);
}

export function daysSince(value: string, now = new Date()): number {
  const date = parseDbDate(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

export type DateRange = 'month' | 'year' | 'all';

/** Inicio del período (hora local). `all` no filtra: devuelve null. */
export function startOfPeriod(range: DateRange, now = new Date()): Date | null {
  if (range === 'all') {
    return null;
  }

  return range === 'month'
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), 0, 1);
}

/** ¿La fecha (guardada en la base) cae dentro del período elegido? */
export function isWithinPeriod(value: string, range: DateRange, now = new Date()): boolean {
  const start = startOfPeriod(range, now);

  if (start === null) {
    return true;
  }

  const date = parseDbDate(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date >= start;
}
