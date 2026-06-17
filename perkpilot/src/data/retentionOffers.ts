import type { RetentionOffer, RetentionStats } from './types';

// Pure aggregation over crowdsourced retention reports. Deterministic + tested.

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function computeRetentionStats(offers: RetentionOffer[], catalogId: string): RetentionStats | null {
  const mine = offers.filter((o) => o.catalog_id === catalogId);
  if (mine.length === 0) return null;

  const withOffer = mine.filter((o) => o.offer_type !== 'none');
  const values = withOffer.map((o) => o.value_usd).filter((v): v is number => v != null);
  const points = withOffer.map((o) => o.points_offered).filter((v): v is number => v != null);
  const kept = mine.filter((o) => o.outcome === 'kept').length;

  const latest = [...mine]
    .filter((o) => o.note)
    .sort((a, b) => b.reported_at.localeCompare(a.reported_at))[0];

  return {
    catalog_id: catalogId,
    sample_size: mine.length,
    offer_rate: withOffer.length / mine.length,
    median_value_usd: median(values),
    typical_points: median(points),
    kept_rate: kept / mine.length,
    latest_note: latest?.note ?? null,
  };
}

/** Stats for every card that has at least one report. */
export function computeAllRetentionStats(offers: RetentionOffer[]): RetentionStats[] {
  const ids = Array.from(new Set(offers.map((o) => o.catalog_id)));
  return ids
    .map((id) => computeRetentionStats(offers, id))
    .filter((s): s is RetentionStats => s !== null)
    .sort((a, b) => b.sample_size - a.sample_size);
}
