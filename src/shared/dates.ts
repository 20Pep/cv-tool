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

/** Filtro de la UI: los períodos fijos más un rango libre. */
export type DateFilterOption = DateRange | 'custom';

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

/** Inicio del día local para un valor de `<input type="date">`. */
export function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/** Fin del día local (23:59:59.999) para un valor de `<input type="date">`. */
export function endOfDateInput(value: string): Date | null {
  const start = parseDateInput(value);

  if (start === null) {
    return null;
  }

  return new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
}

/**
 * ¿La fecha cae dentro del rango libre? Los extremos vacíos no filtran y la
 * comparación es por hora local, igual que los períodos fijos.
 */
export function isWithinDates(value: string, from: string, to: string): boolean {
  const start = from.trim().length === 0 ? null : parseDateInput(from);
  const end = to.trim().length === 0 ? null : endOfDateInput(to);

  if (start === null && end === null) {
    return true;
  }

  const date = parseDbDate(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  if (start !== null && date < start) {
    return false;
  }

  if (end !== null && date > end) {
    return false;
  }

  return true;
}
