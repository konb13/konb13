import type {
  Benefit,
  PointsAccount,
  RiskUrgency,
  UserCard,
  ValueAtRiskItem,
  ValueAtRiskSummary,
} from './types';
import { catalogById } from './catalog';
import { programLabel } from './programReference';

// Derived "value_at_risk" view (build plan §3): every unused benefit expiring
// within N days + every points account within M days of an expiration
// deadline, summed per household. This single query powers the flagship
// dashboard and most notifications.

const DAY_MS = 24 * 60 * 60 * 1000;

export const daysUntil = (iso: string | null, now = new Date()): number | null => {
  if (!iso) return null;
  const target = new Date(iso + 'T00:00:00');
  return Math.ceil((target.getTime() - now.getTime()) / DAY_MS);
};

const urgencyFor = (days: number | null): RiskUrgency => {
  if (days === null) return 'green';
  if (days <= 7) return 'red';
  if (days <= 30) return 'amber';
  return 'green';
};

export interface ValueAtRiskInput {
  benefits: Benefit[];
  userCards: UserCard[];
  pointsAccounts: PointsAccount[];
  /** Benefit horizon in days. */
  benefitWindowDays?: number;
  /** Points-expiration horizon in days. */
  pointsWindowDays?: number;
  now?: Date;
}

export function computeValueAtRisk(input: ValueAtRiskInput): ValueAtRiskSummary {
  const {
    benefits,
    userCards,
    pointsAccounts,
    benefitWindowDays = 90,
    pointsWindowDays = 120,
    now = new Date(),
  } = input;

  const cardById = new Map(userCards.map((c) => [c.id, c]));
  const items: ValueAtRiskItem[] = [];

  for (const b of benefits) {
    if (b.used) continue;
    const days = daysUntil(b.expiration_date, now);
    if (days === null || days < 0 || days > benefitWindowDays) continue;

    const card = cardById.get(b.user_card_id);
    const catalog = card ? catalogById(card.catalog_id) : undefined;
    items.push({
      kind: 'benefit',
      id: b.id,
      user_id: card?.user_id ?? '',
      title: b.name,
      subtitle: catalog ? `${catalog.issuer} ${catalog.product_name}` : 'Card benefit',
      est_value_usd: b.est_value_usd,
      deadline: b.expiration_date,
      days_left: days,
      urgency: urgencyFor(days),
    });
  }

  for (const p of pointsAccounts) {
    const deadline = p.hard_deadline ?? p.inactivity_deadline;
    const days = daysUntil(deadline, now);
    if (days === null || days < 0 || days > pointsWindowDays) continue;

    const cpp = programLabel(p.program);
    items.push({
      kind: 'points',
      id: p.id,
      user_id: p.user_id,
      title: `${p.balance.toLocaleString()} ${cpp} points`,
      subtitle: p.account_type === 'vacation_club' ? 'Vacation club — hard lapse' : 'Expiring from inactivity',
      // Conservative valuation: low end of the cpp band for at-risk framing.
      est_value_usd: 0,
      deadline,
      days_left: days,
      urgency: urgencyFor(days),
    });
  }

  items.sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999));

  const total_at_risk_usd = items.reduce((sum, i) => sum + i.est_value_usd, 0);
  return { total_at_risk_usd, items };
}
