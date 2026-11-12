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
