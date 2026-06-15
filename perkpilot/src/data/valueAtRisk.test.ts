import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeValueAtRisk } from './valueAtRisk';
import { MOCK_BENEFITS, MOCK_POINTS_ACCOUNTS, MOCK_USER_CARDS } from './mockData';

test('value-at-risk excludes used benefits and sums unused at-risk value', () => {
  const summary = computeValueAtRisk({
    benefits: MOCK_BENEFITS,
    userCards: MOCK_USER_CARDS,
    pointsAccounts: MOCK_POINTS_ACCOUNTS,
  });
  // The used CSR travel credit (b_3) must never appear.
  assert.ok(!summary.items.some((i) => i.id === 'b_3'));
  assert.ok(summary.total_at_risk_usd > 0);
});

test('items are sorted by soonest deadline and urgency is graded', () => {
  const summary = computeValueAtRisk({
    benefits: MOCK_BENEFITS,
    userCards: MOCK_USER_CARDS,
    pointsAccounts: MOCK_POINTS_ACCOUNTS,
  });
  const days = summary.items.map((i) => i.days_left ?? Infinity);
  const sorted = [...days].sort((a, b) => a - b);
  assert.deepEqual(days, sorted);
  for (const item of summary.items) {
    if ((item.days_left ?? 99) <= 7) assert.equal(item.urgency, 'red');
  }
});
