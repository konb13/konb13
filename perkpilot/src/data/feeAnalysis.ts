import type { Benefit, CardCatalogEntry, UserCard } from './types';
import { daysUntil } from './valueAtRisk';

// Annual-fee keep / downgrade / cancel engine (build plan §10, idea #1):
// "60 days before a fee posts: 'You used $410 of this card's $695 in benefits
// this year — here's the keep/downgrade/cancel math.'" Pure rules, no external
// data — a strong, shareable premium hook.

export type FeeRecommendation = 'keep' | 'keep_if_used' | 'downgrade' | 'cancel';

export interface FeeAnalysis {
  user_card_id: string;
  catalog_id: string;
  card_name: string;
  annual_fee: number;
  fee_due_date: string | null;
  days_until_fee: number | null;
  /** Benefit value already captured this cardmember year. */
  realized_value: number;
  /** Unused, not-yet-expired benefit value still on the table. */
  remaining_value: number;
  /** Full sticker value of the card's benefits. */
  total_value: number;
  /** realized + remaining − annual_fee. */
  net_if_used: number;
  recommendation: FeeRecommendation;
  /** A no-/lower-fee product to product-change into, if one exists. */
  downgrade_to: string | null;
  headline: string;
}

// Known downgrade paths within an issuer family (catalog_id -> target catalog_id).
const DOWNGRADE_PATHS: Record<string, string> = {
  cat_amex_platinum: 'cat_amex_green',
  cat_amex_gold: 'cat_amex_green',
  cat_csr: 'cat_csp',
  cat_venture_x: 'cat_venture',
  cat_hilton_aspire: 'cat_hilton_surpass',
  cat_hilton_surpass: 'cat_hilton_nfo',
};

export interface FeeAnalysisInput {
  card: UserCard;
  catalog: CardCatalogEntry;
  benefits: Benefit[];
  catalogById: (id: string) => CardCatalogEntry | undefined;
  now?: Date;
}

export function analyzeAnnualFee(input: FeeAnalysisInput): FeeAnalysis {
  const { card, catalog, benefits, catalogById, now = new Date() } = input;

  const realized_value = benefits
    .filter((b) => b.used)
    .reduce((s, b) => s + b.est_value_usd, 0);

  const remaining_value = benefits
    .filter((b) => {
      if (b.used) return false;
      const d = daysUntil(b.expiration_date, now);
      return d === null || d >= 0; // not already expired
    })
    .reduce((s, b) => s + b.est_value_usd, 0);

  const total_value = benefits.reduce((s, b) => s + b.est_value_usd, 0);
  const annual_fee = catalog.annual_fee;
  const net_if_used = realized_value + remaining_value - annual_fee;

  const downgradeId = DOWNGRADE_PATHS[catalog.id] ?? null;
  const downgradeName = downgradeId
    ? catalogById(downgradeId)?.product_name ?? null
    : null;

  let recommendation: FeeRecommendation;
  if (annual_fee === 0) {
    recommendation = 'keep';
  } else if (realized_value >= annual_fee) {
    recommendation = 'keep'; // already broke even
  } else if (realized_value + remaining_value >= annual_fee) {
    recommendation = 'keep_if_used'; // on track only if you use what's left
  } else if (downgradeId) {
    recommendation = 'downgrade';
  } else {
    recommendation = 'cancel';
  }

  const days_until_fee = daysUntil(card.annual_fee_due_date, now);
  const card_name = card.nickname ?? `${catalog.issuer} ${catalog.product_name}`;

  return {
    user_card_id: card.id,
    catalog_id: catalog.id,
    card_name,
    annual_fee,
    fee_due_date: card.annual_fee_due_date,
    days_until_fee,
    realized_value,
    remaining_value,
    total_value,
    net_if_used,
    recommendation,
    downgrade_to: downgradeName,
    headline: buildHeadline({
      card_name,
      annual_fee,
      realized_value,
      remaining_value,
      recommendation,
      downgradeName,
    }),
  };
}

/** Build keep/cancel analyses for every open card whose fee is due within N days. */
export function computeFeeDecisions(args: {
  userCards: UserCard[];
  benefits: Benefit[];
  catalog: CardCatalogEntry[];
  withinDays?: number;
  now?: Date;
}): FeeAnalysis[] {
  const { userCards, benefits, catalog, withinDays = 90, now = new Date() } = args;
  const catalogById = (id: string) => catalog.find((c) => c.id === id);

  return userCards
    .filter((card) => {
      if (card.status !== 'open') return false;
      const d = daysUntil(card.annual_fee_due_date, now);
      return d !== null && d >= 0 && d <= withinDays;
    })
    .map((card) => {
      const cat = catalogById(card.catalog_id);
      if (!cat) return null;
      return analyzeAnnualFee({
        card,
        catalog: cat,
        benefits: benefits.filter((b) => b.user_card_id === card.id),
        catalogById,
        now,
      });
    })
    .filter((a): a is FeeAnalysis => a !== null)
    .sort((a, b) => (a.days_until_fee ?? 9999) - (b.days_until_fee ?? 9999));
}

function buildHeadline(a: {
  card_name: string;
  annual_fee: number;
  realized_value: number;
  remaining_value: number;
  recommendation: FeeRecommendation;
  downgradeName: string | null;
}): string {
  const used = `You've used $${a.realized_value.toLocaleString()} of this card's $${a.annual_fee.toLocaleString()} fee in benefits`;
  switch (a.recommendation) {
    case 'keep':
      return a.annual_fee === 0
        ? 'No annual fee — nothing to decide.'
        : `${used} — already worth it. Keep it.`;
    case 'keep_if_used':
      return `${used}. There's still $${a.remaining_value.toLocaleString()} on the table — use it before the fee posts and you come out ahead.`;
    case 'downgrade':
      return `${used}, and even using everything left won't beat the fee. Consider a product change to ${a.downgradeName}.`;
    case 'cancel':
      return `${used}, and the remaining benefits won't cover the fee. Cancel unless retention offers a credit.`;
  }
}
