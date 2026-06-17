import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRetentionStats, computeAllRetentionStats } from './retentionOffers';
import type { RetentionOffer } from './types';

const offer = (over: Partial<RetentionOffer> & { id: string; catalog_id: string }): RetentionOffer => ({
  user_id: 'u_1',
  reported_at: '2026-01-01',
  channel: 'phone',
  offer_type: 'points',
  points_offered: 50000,
  value_usd: 700,
  spend_required: null,
  note: null,
  outcome: 'kept',
  ...over,
});

test('aggregates offer rate, medians, and kept rate', () => {
  const offers = [
    offer({ id: '1', catalog_id: 'c', value_usd: 700, points_offered: 50000, outcome: 'kept' }),
    offer({ id: '2', catalog_id: 'c', value_usd: 200, points_offered: null, offer_type: 'statement_credit', outcome: 'kept' }),
    offer({ id: '3', catalog_id: 'c', offer_type: 'none', value_usd: null, points_offered: null, outcome: 'canceled' }),
  ];
  const s = computeRetentionStats(offers, 'c')!;
  assert.equal(s.sample_size, 3);
  assert.equal(Math.round(s.offer_rate * 100), 67); // 2 of 3 had an offer
  assert.equal(s.median_value_usd, 450); // median of [200, 700]
  assert.equal(s.typical_points, 50000); // median of [50000]
  assert.equal(Math.round(s.kept_rate * 100), 67);
});

test('returns null for a card with no reports', () => {
  assert.equal(computeRetentionStats([], 'c'), null);
});

test('latest_note picks the most recent note', () => {
  const offers = [
    offer({ id: '1', catalog_id: 'c', reported_at: '2026-01-01', note: 'older' }),
    offer({ id: '2', catalog_id: 'c', reported_at: '2026-05-01', note: 'newer' }),
  ];
  assert.equal(computeRetentionStats(offers, 'c')!.latest_note, 'newer');
});

test('computeAllRetentionStats sorts by sample size desc', () => {
  const offers = [
    offer({ id: '1', catalog_id: 'a' }),
    offer({ id: '2', catalog_id: 'b' }),
    offer({ id: '3', catalog_id: 'b' }),
  ];
  const all = computeAllRetentionStats(offers);
  assert.deepEqual(all.map((s) => s.catalog_id), ['b', 'a']);
});
