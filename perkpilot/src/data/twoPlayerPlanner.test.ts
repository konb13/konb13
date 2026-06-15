import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTwoPlayer, type PlanTarget, type PlannerMember } from './twoPlayerPlanner';
import type { CardOpening } from './issuerRules';

const START = new Date('2026-06-01T00:00:00');

const target = (over: Partial<PlanTarget> & { catalog_id: string; issuer: string }): PlanTarget => ({
  product_name: 'Card',
  annual_fee: 95,
  wanted_by: 'both',
  signup_bonus: { bonus_points: 60000, bonus_value_usd: 1000, min_spend_usd: 4000, min_spend_months: 3 },
  ...over,
});

const opening = (catalog_id: string, issuer: string, opened_date: string): CardOpening => ({
  catalog_id,
  issuer,
  opened_date,
});

test('member at 5/24 cannot be scheduled a Chase card; reason explains why', () => {
  const fiveRecent: CardOpening[] = Array.from({ length: 5 }, (_, i) =>
    opening(`old_${i}`, 'Other', '2026-06-01'),
  );
  const members: PlannerMember[] = [{ id: 'm1', name: 'Kon', openings: fiveRecent }];
  const plan = planTwoPlayer(
    members,
    [target({ catalog_id: 'cat_csp', issuer: 'Chase', wanted_by: 'm1' })],
    { startDate: START },
  );
  assert.equal(plan.moves.length, 0);
  assert.equal(plan.members[0].under_524, false);
  assert.equal(plan.members[0].current_524, 5);
  assert.match(plan.unscheduled[0].reason, /5\/24/);
});

test('two-player both: one spouse applies, then refers the other for the referral bonus', () => {
  const members: PlannerMember[] = [
    { id: 'm1', name: 'Kon', openings: [] },
    { id: 'm2', name: 'Wife', openings: [] },
  ];
  const plan = planTwoPlayer(
    members,
    [
      target({
        catalog_id: 'cat_csp',
        issuer: 'Chase',
        wanted_by: 'both',
        signup_bonus: { bonus_points: 60000, bonus_value_usd: 1000, min_spend_usd: 4000, min_spend_months: 3, referral_bonus_usd: 170 },
      }),
    ],
    { startDate: START },
  );
  assert.equal(plan.moves.length, 2);
  const [first, second] = plan.moves;
  assert.equal(first.refer_from_member_id, null);
  assert.equal(second.refer_from_member_id, first.member_id);
  assert.equal(second.referral_bonus_usd, 170);
  // Referral leg must come strictly after the lead leg.
  assert.ok(new Date(second.date) > new Date(first.date));
  // Total includes welcome bonuses + the referral bonus.
  assert.equal(plan.total_bonus_value_usd, 1000 + 1000 + 170);
});

test('Chase cards are sequenced before non-Chase to beat 5/24', () => {
  const members: PlannerMember[] = [{ id: 'm1', name: 'Kon', openings: [] }];
  const plan = planTwoPlayer(
    members,
    [
      target({ catalog_id: 'cat_venture_x', issuer: 'Capital One', wanted_by: 'm1', signup_bonus: { bonus_points: 75000, bonus_value_usd: 1050, min_spend_usd: 4000, min_spend_months: 3 } }),
      target({ catalog_id: 'cat_csp', issuer: 'Chase', wanted_by: 'm1', signup_bonus: { bonus_points: 60000, bonus_value_usd: 1000, min_spend_usd: 4000, min_spend_months: 3 } }),
    ],
    { startDate: START },
  );
  assert.equal(plan.moves[0].issuer, 'Chase');
});

test('never recommends a card the member already holds', () => {
  const members: PlannerMember[] = [
    { id: 'm1', name: 'Kon', openings: [opening('cat_csp', 'Chase', '2023-01-01')] },
  ];
  const plan = planTwoPlayer(
    members,
    [target({ catalog_id: 'cat_csp', issuer: 'Chase', wanted_by: 'm1' })],
    { startDate: START },
  );
  assert.equal(plan.moves.length, 0);
  assert.match(plan.unscheduled[0].reason, /already holds/);
});

test('min-spend deadline is computed from the application date', () => {
  const members: PlannerMember[] = [{ id: 'm1', name: 'Kon', openings: [] }];
  const plan = planTwoPlayer(
    members,
    [target({ catalog_id: 'cat_csp', issuer: 'Chase', wanted_by: 'm1', signup_bonus: { bonus_points: 60000, bonus_value_usd: 1000, min_spend_usd: 4000, min_spend_months: 3 } })],
    { startDate: START },
  );
  assert.equal(plan.moves[0].date, '2026-06-01');
  assert.equal(plan.moves[0].min_spend_deadline, '2026-09-01');
});
