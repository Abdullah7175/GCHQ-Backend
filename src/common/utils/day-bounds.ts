/** Parse ISO date or YYYY-MM-DD into inclusive day bounds (UTC). */
export function parseDayBound(iso: string, endOfDay: boolean): Date {
  const raw = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return endOfDay
      ? new Date(`${raw}T23:59:59.999Z`)
      : new Date(`${raw}T00:00:00.000Z`);
  }
  return new Date(raw);
}

export function escapeIlike(term: string): string {
  return term.trim().replace(/[%_\\]/g, '\\$&');
}
