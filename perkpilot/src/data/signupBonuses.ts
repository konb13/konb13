import type { SignupBonus } from './types';

// Current welcome offers, keyed by catalog_id. Kept separate from the catalog
// so offers (which churn monthly) can be re-verified on their own cadence. The
// two-player planner reads these; cards absent here have no chase-worthy bonus.
//
// Values are illustrative public-offer levels, not guarantees — the planner
// always frames a bonus as an estimate.

export const SIGNUP_BONUSES: Record<string, SignupBonus> = {
  cat_csp: { bonus_points: 60000, bonus_value_usd: 1020, min_spend_usd: 4000, min_spend_months: 3, referral_bonus_usd: 170 },
  cat_csr: { bonus_points: 60000, bonus_value_usd: 1020, min_spend_usd: 4000, min_spend_months: 3, referral_bonus_usd: 170 },
  cat_amex_gold: { bonus_points: 60000, bonus_value_usd: 1020, min_spend_usd: 6000, min_spend_months: 6, referral_bonus_usd: 250 },
  cat_amex_platinum: { bonus_points: 80000, bonus_value_usd: 1360, min_spend_usd: 8000, min_spend_months: 6, referral_bonus_usd: 250 },
  cat_venture_x: { bonus_points: 75000, bonus_value_usd: 1050, min_spend_usd: 4000, min_spend_months: 3 },
  cat_venture: { bonus_points: 75000, bonus_value_usd: 1050, min_spend_usd: 4000, min_spend_months: 3 },
  cat_hyatt: { bonus_points: 30000, bonus_value_usd: 510, min_spend_usd: 3000, min_spend_months: 3 },
  cat_bonvoy_boundless: { bonus_points: 85000, bonus_value_usd: 680, min_spend_usd: 4000, min_spend_months: 3 },
  cat_bonvoy_brilliant: { bonus_points: 95000, bonus_value_usd: 760, min_spend_usd: 6000, min_spend_months: 6, referral_bonus_usd: 250 },
  cat_united_explorer: { bonus_points: 60000, bonus_value_usd: 780, min_spend_usd: 3000, min_spend_months: 3 },
  cat_ihg_premier: { bonus_points: 140000, bonus_value_usd: 840, min_spend_usd: 3000, min_spend_months: 3 },
  cat_southwest_priority: { bonus_points: 50000, bonus_value_usd: 700, min_spend_usd: 1000, min_spend_months: 3 },
  cat_citi_strata_premier: { bonus_points: 75000, bonus_value_usd: 1200, min_spend_usd: 4000, min_spend_months: 3 },
};

export const getSignupBonus = (catalogId: string): SignupBonus | undefined =>
  SIGNUP_BONUSES[catalogId];
