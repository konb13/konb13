import type {
  AddRetentionOfferInput,
  Benefit,
  CardCatalogEntry,
  Household,
  PointsAccount,
  RetentionOffer,
  RetentionStats,
  User,
  UserCard,
  ValueAtRiskSummary,
} from './types';
import type { FeeAnalysis } from './feeAnalysis';
import type { PlanRequestTarget, PlannerOptions, TwoPlayerPlan } from './twoPlayerPlanner';
import { CARD_CATALOG } from './catalog';
import { computeValueAtRisk } from './valueAtRisk';

export interface Session {
  userId: string;
  email: string;
}

/**
 * The single data surface the UI talks to. Two implementations exist behind a
 * feature flag: an in-memory mock (default, zero backend) and Supabase. Keeping
 * the screens on this interface means flipping EXPO_PUBLIC_USE_MOCK_DATA is the
 * only change needed to go live.
 */
export interface DataClient {
  // auth
  getSession(): Promise<Session | null>;
  signIn(email: string): Promise<Session>;
  signOut(): Promise<void>;

  // household
  getHousehold(): Promise<Household | null>;
  getMembers(): Promise<User[]>;

  // catalog (global, read-only in the app)
  getCatalog(): Promise<CardCatalogEntry[]>;

  // cards + benefits (household-wide)
  listUserCards(): Promise<UserCard[]>;
  addUserCard(input: AddUserCardInput): Promise<UserCard>;
  listBenefits(userCardId?: string): Promise<Benefit[]>;
  setBenefitUsed(benefitId: string, used: boolean): Promise<void>;

  // points
  listPointsAccounts(): Promise<PointsAccount[]>;

  // derived
  getValueAtRisk(): Promise<ValueAtRiskSummary>;
  /** Keep/downgrade/cancel analysis for cards with a fee due within `withinDays`. */
  getFeeDecisions(withinDays?: number): Promise<FeeAnalysis[]>;
  /** Sequenced two-player signup-bonus application plan for the household. */
  getTwoPlayerPlan(targets: PlanRequestTarget[], options?: PlannerOptions): Promise<TwoPlayerPlan>;

  // retention-offer crowdsourcing
  listRetentionOffers(catalogId?: string): Promise<RetentionOffer[]>;
  addRetentionOffer(input: AddRetentionOfferInput): Promise<RetentionOffer>;
  getRetentionStats(): Promise<RetentionStats[]>;
}

export interface AddUserCardInput {
  user_id: string;
  catalog_id: string;
  opened_date: string | null;
  annual_fee_due_date: string | null;
  last4: string | null;
  nickname: string | null;
}

export function getCatalogSync(): CardCatalogEntry[] {
  return CARD_CATALOG;
}

export { computeValueAtRisk };
