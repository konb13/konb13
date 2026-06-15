// Issuer application rules. v1 focuses on the rule that actually governs a
// two-player US points strategy: Chase's 5/24. Others are modelled lightly and
// extensible. All "no external data" — pure rules.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CardOpening {
  catalog_id: string;
  issuer: string;
  opened_date: string; // ISO date
}

/** Issuers that count new accounts against Chase's 5/24 are *all* issuers; the
 *  gate only applies when *applying to* Chase. */
export function isSubjectTo524(issuer: string): boolean {
  return issuer.toLowerCase() === 'chase';
}

/** Number of personal cards opened across all issuers in the last 24 months. */
export function count524(openings: CardOpening[], asOf: Date): number {
  const cutoff = new Date(asOf.getTime() - 24 * 30.44 * DAY_MS);
  return openings.filter((o) => {
    const d = new Date(o.opened_date + 'T00:00:00');
    return d >= cutoff && d <= asOf;
  }).length;
}

/** Would a Chase application be approved under 5/24 at this moment? */
export function isUnder524(openings: CardOpening[], asOf: Date): boolean {
  return count524(openings, asOf) < 5;
}

/** Minimum days a person should wait between new applications (velocity). */
export function applicationCooldownDays(issuer: string): number {
  switch (issuer.toLowerCase()) {
    case 'chase':
      return 30; // ~2/30 in practice; we schedule 1 Chase app per cycle
    case 'american express':
      return 5;
    case 'citi':
      return 8;
    case 'capital one':
      return 180; // Cap One is application-shy; ~1 per 6 months
    default:
      return 30;
  }
}

/** When the oldest 5/24 slot frees up — i.e. the date the count drops below 5. */
export function next524OpensAt(openings: CardOpening[], asOf: Date): string | null {
  if (isUnder524(openings, asOf)) return null;
  const recent = openings
    .map((o) => new Date(o.opened_date + 'T00:00:00'))
    .filter((d) => d <= asOf)
    .sort((a, b) => a.getTime() - b.getTime());
  // The 5th-most-recent opening rolls off 24 months after it was opened.
  const fifthNewest = recent[recent.length - 5];
  if (!fifthNewest) return null;
  const opens = new Date(fifthNewest.getTime() + 24 * 30.44 * DAY_MS);
  return opens.toISOString().slice(0, 10);
}
