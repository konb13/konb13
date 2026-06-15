import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAnnualFee } from './feeAnalysis';
import type { Benefit, CardCatalogEntry, UserCard } from './types';

const catalog: Record<string, CardCatalogEntry> = {
  cat_csr: {
    id: 'cat_csr', issuer: 'Chase', product_name: 'Sapphire Reserve', network: 'visa',
    annual_fee: 550, referral_url: null, referral_active: false, earn_rates: {},
    benefits_template: [], last_verified_at: '2026-06-01', status: 'active',
  },
  cat_csp: {
    id: 'cat_csp', issuer: 'Chase', product_name: 'Sapphire Preferred', network: 'visa',
    annual_fee: 95, referral_url: null, referral_active: false, earn_rates: {},
    benefits_template: [], last_verified_at: '2026-06-01', status: 'active',
  },
};
const catalogById = (id: string) => catalog[id];

const card = (catalog_id: string): UserCard => ({
  id: 'uc_x', user_id: 'u_1', catalog_id, opened_date: '2024-01-01',
  annual_fee_due_date: '2026-07-01', last4: null, nickname: null, status: 'open',
});

const benefit = (used: boolean, value: number): Benefit => ({
  id: 'b_' + Math.random(), user_card_id: 'uc_x', type: 'statement_credit',
  name: 'Credit', est_value_usd: value, expiration_date: '2026-12-31',
  reset_cycle: 'calendar_year', used, used_date: used ? '2026-03-01' : null,
  notify_days_before: [30, 7],
});

test('already broke even -> keep', () => {
  const a = analyzeAnnualFee({
    card: card('cat_csr'), catalog: catalog.cat_csr,
    benefits: [benefit(true, 600)], catalogById,
  });
  assert.equal(a.recommendation, 'keep');
  assert.equal(a.realized_value, 600);
});

test('on track only if remaining is used -> keep_if_used', () => {
  const a = analyzeAnnualFee({
    card: card('cat_csr'), catalog: catalog.cat_csr,
    benefits: [benefit(true, 300), benefit(false, 300)], catalogById,
  });
  assert.equal(a.recommendation, 'keep_if_used');
  assert.equal(a.net_if_used, 50); // 300 + 300 - 550
});

test('cannot beat fee but downgrade exists -> downgrade', () => {
  const a = analyzeAnnualFee({
    card: card('cat_csr'), catalog: catalog.cat_csr,
    benefits: [benefit(true, 100), benefit(false, 100)], catalogById,
  });
  assert.equal(a.recommendation, 'downgrade');
  assert.equal(a.downgrade_to, 'Sapphire Preferred');
});

test('expired unused benefits do not count toward remaining', () => {
  const expired: Benefit = { ...benefit(false, 500), expiration_date: '2020-01-01' };
  const a = analyzeAnnualFee({
    card: card('cat_csr'), catalog: catalog.cat_csr,
    benefits: [expired], catalogById,
  });
  assert.equal(a.remaining_value, 0);
  assert.equal(a.recommendation, 'downgrade');
});

test('no-fee card -> keep with no math', () => {
  const a = analyzeAnnualFee({
    card: card('cat_csp'),
    catalog: { ...catalog.cat_csp, annual_fee: 0 },
    benefits: [], catalogById,
  });
  assert.equal(a.recommendation, 'keep');
});
