// Core domain types — mirror the Supabase schema in supabase/migrations.
// "The card_catalog and program_reference tables are the product." (Build plan §5)

export type UUID = string;

export type HouseholdRole = 'owner' | 'member';

export interface Household {
  id: UUID;
  name: string;
  created_at: string;
}

export interface User {
  id: UUID;
  household_id: UUID;
  display_name: string;
  email: string;
  role: HouseholdRole;
}

// ---------------------------------------------------------------------------
// Catalog (global, admin-maintained) — the benefits database.
// ---------------------------------------------------------------------------

export type CardNetwork = 'visa' | 'mastercard' | 'amex' | 'discover';

export type CatalogStatus = 'active' | 'discontinued' | 'application_paused';

export type BenefitType =
  | 'free_night_cert'
  | 'statement_credit'
  | 'lounge'
  | 'companion_pass'
  | 'other';

export type ResetCycle =
  | 'annual'
  | 'calendar_year'
  | 'cardmember_year'
  | 'one_time';

/** A benefit as defined on the catalog card (the template, not an instance). */
export interface BenefitTemplate {
  type: BenefitType;
  name: string;
  est_value_usd: number;
  reset_cycle: ResetCycle;
  /** Days before expiration to remind, e.g. [30, 7, 1]. */
  notify_days_before: number[];
}

export interface CardCatalogEntry {
  id: UUID;
  issuer: string;
  product_name: string;
  network: CardNetwork;
  annual_fee: number;
  referral_url: string | null;
  referral_active: boolean;
  /** category -> multiplier, e.g. { dining: 4, travel: 3, other: 1 } */
  earn_rates: Record<string, number>;
  benefits_template: BenefitTemplate[];
  /** Critical: benefits change constantly. Surfaced in UI as a trust signal. */
  last_verified_at: string;
  status: CatalogStatus;
}

// ---------------------------------------------------------------------------
// User-owned instances.
// ---------------------------------------------------------------------------

export type UserCardStatus = 'open' | 'closed' | 'product_changed';

/** An instance of a catalog card owned by a person. */
export interface UserCard {
  id: UUID;
  user_id: UUID;
  catalog_id: UUID;
  opened_date: string | null;
  annual_fee_due_date: string | null;
  last4: string | null;
  nickname: string | null;
  status: UserCardStatus;
}

/** A benefit instance attached to a user_card. */
export interface Benefit {
  id: UUID;
  user_card_id: UUID;
  type: BenefitType;
  name: string;
  est_value_usd: number;
  expiration_date: string | null;
  reset_cycle: ResetCycle;
  used: boolean;
  used_date: string | null;
  notify_days_before: number[];
}

// ---------------------------------------------------------------------------
// Loyalty balances + the reference table that powers the estimator.
// ---------------------------------------------------------------------------

export type LoyaltyProgram =
  | 'bonvoy'
  | 'hyatt'
  | 'hilton'
  | 'ihg'
  | 'amex_mr'
  | 'chase_ur'
  | 'capital_one'
  | 'citi_typ'
  | 'united'
  | 'delta_skymiles'
  | 'southwest'
  | 'jetblue'
  | 'alaska';

export type ExpirationPolicy = 'inactivity_months' | 'hard_date' | 'none';

export type PointsAccountType = 'loyalty' | 'vacation_club';

export interface PointsAccount {
  id: UUID;
  user_id: UUID;
  program: LoyaltyProgram;
  balance: number;
  balance_updated_at: string;
  expiration_policy: ExpirationPolicy;
  /** Computed from last activity + inactivity window. */
  inactivity_deadline: string | null;
  /** For vacation-club style points with a hard lapse date. */
  hard_deadline: string | null;
  account_type: PointsAccountType;
}

export type PricingModel = 'fixed_chart' | 'dynamic' | 'revenue_based';

export interface ProgramReference {
  program: LoyaltyProgram;
  display_name: string;
  /** cents-per-point valuation band. */
  cpp_low: number;
  cpp_mid: number;
  cpp_high: number;
  pricing_model: PricingModel;
  /** For Hyatt-style published charts: category -> { off_peak, standard, peak }. */
  chart: Record<string, { off_peak: number; standard: number; peak: number }> | null;
  /** program -> transfer ratio (e.g. amex_mr -> bonvoy at 1:1). */
  transfer_partners: Partial<Record<LoyaltyProgram, number>> | null;
  expiration_rule_text: string;
}

// ---------------------------------------------------------------------------
// Derived: the flagship Value-at-Risk feed (a query, not a table).
// ---------------------------------------------------------------------------

export type RiskUrgency = 'red' | 'amber' | 'green';

export interface ValueAtRiskItem {
  kind: 'benefit' | 'points';
  id: UUID;
  user_id: UUID;
  title: string;
  subtitle: string;
  est_value_usd: number;
  deadline: string | null;
  days_left: number | null;
  urgency: RiskUrgency;
}

export interface ValueAtRiskSummary {
  total_at_risk_usd: number;
  items: ValueAtRiskItem[];
}
