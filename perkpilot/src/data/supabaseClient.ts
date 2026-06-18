import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AddUserCardInput, DataClient, Session } from './client';
import type {
  Benefit,
  CardCatalogEntry,
  Household,
  PointsAccount,
  User,
  UserCard,
  ValueAtRiskSummary,
} from './types';
import { computeValueAtRisk } from './valueAtRisk';
import { computeFeeDecisions, type FeeAnalysis } from './feeAnalysis';
import { buildPlanFromData, type PlanRequestTarget, type PlannerOptions, type TwoPlayerPlan } from './twoPlayerPlanner';
import { computeAllRetentionStats } from './retentionOffers';
import { getSignupBonus } from './signupBonuses';
import type { AddRetentionOfferInput, RetentionOffer, RetentionStats } from './types';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

// Live implementation. RLS scopes every read/write to the caller's household,
// so the queries here stay deliberately simple (no manual household filters).
// Schema lives in supabase/migrations.

export class SupabaseDataClient implements DataClient {
  private sb: SupabaseClient;

  constructor() {
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.sb.auth.getSession();
    const s = data.session;
    if (!s?.user) return null;
    return { userId: s.user.id, email: s.user.email ?? '' };
  }

  async signIn(email: string): Promise<Session> {
    // Magic-link / OTP. The app deep-links back via the `perkpilot` scheme.
    const { error } = await this.sb.auth.signInWithOtp({ email });
    if (error) throw error;
    return { userId: '', email };
  }

  async verifyOtp(email: string, token: string): Promise<Session> {
    const { data, error } = await this.sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
    return { userId: data.user?.id ?? '', email: data.user?.email ?? email };
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut();
  }

  async getCurrentUser(): Promise<User | null> {
    const { data: auth } = await this.sb.auth.getUser();
    if (!auth.user) return null;
    const { data } = await this.sb.from('users').select('*').eq('id', auth.user.id).maybeSingle();
    return (data as User) ?? null;
  }

  async createHousehold(name: string, displayName: string): Promise<Household> {
    const { data, error } = await this.sb.rpc('create_household', { p_name: name, p_display_name: displayName });
    if (error) throw error;
    return data as Household;
  }

  async joinHousehold(inviteCode: string, displayName: string): Promise<Household> {
    const { data, error } = await this.sb.rpc('join_household', { p_code: inviteCode, p_display_name: displayName });
    if (error) throw error;
    return data as Household;
  }

  async getHousehold(): Promise<Household | null> {
    const { data } = await this.sb.from('households').select('*').limit(1).maybeSingle();
    return (data as Household) ?? null;
  }

  async getMembers(): Promise<User[]> {
    const { data } = await this.sb.from('users').select('*');
    return (data as User[]) ?? [];
  }

  async getCatalog(): Promise<CardCatalogEntry[]> {
    const { data } = await this.sb
      .from('card_catalog')
      .select('*')
      .eq('status', 'active')
      .order('issuer');
    return (data as CardCatalogEntry[]) ?? [];
  }

  async listUserCards(): Promise<UserCard[]> {
    const { data } = await this.sb.from('user_cards').select('*');
    return (data as UserCard[]) ?? [];
  }

  async addUserCard(input: AddUserCardInput): Promise<UserCard> {
    const { data, error } = await this.sb
      .from('user_cards')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    // Benefit instances are materialized server-side by a trigger from the
    // catalog template (see supabase/migrations/0004_add_card_trigger.sql).
    return data as UserCard;
  }

  async listBenefits(userCardId?: string): Promise<Benefit[]> {
    let query = this.sb.from('benefits').select('*');
    if (userCardId) query = query.eq('user_card_id', userCardId);
    const { data } = await query;
    return (data as Benefit[]) ?? [];
  }

  async setBenefitUsed(benefitId: string, used: boolean): Promise<void> {
    await this.sb
      .from('benefits')
      .update({ used, used_date: used ? new Date().toISOString().slice(0, 10) : null })
      .eq('id', benefitId);
  }

  async listPointsAccounts(): Promise<PointsAccount[]> {
    const { data } = await this.sb.from('points_accounts').select('*');
    return (data as PointsAccount[]) ?? [];
  }

  async getValueAtRisk(): Promise<ValueAtRiskSummary> {
    // Prefer the SQL view; fall back to client-side compute if absent.
    const { data, error } = await this.sb.from('value_at_risk').select('*');
    if (error || !data) {
      const [benefits, userCards, pointsAccounts] = await Promise.all([
        this.listBenefits(),
        this.listUserCards(),
        this.listPointsAccounts(),
      ]);
      return computeValueAtRisk({ benefits, userCards, pointsAccounts });
    }
    const items = data as ValueAtRiskSummary['items'];
    return { items, total_at_risk_usd: items.reduce((s, i) => s + i.est_value_usd, 0) };
  }

  async getFeeDecisions(withinDays = 90): Promise<FeeAnalysis[]> {
    const [userCards, benefits, catalog] = await Promise.all([
      this.listUserCards(),
      this.listBenefits(),
      this.getCatalog(),
    ]);
    return computeFeeDecisions({ userCards, benefits, catalog, withinDays });
  }

  async getTwoPlayerPlan(targets: PlanRequestTarget[], options?: PlannerOptions): Promise<TwoPlayerPlan> {
    const [members, userCards, catalog] = await Promise.all([
      this.getMembers(),
      this.listUserCards(),
      this.getCatalog(),
    ]);
    return buildPlanFromData({ members, userCards, catalog, requests: targets, getSignupBonus, options });
  }

  async listRetentionOffers(catalogId?: string): Promise<RetentionOffer[]> {
    let query = this.sb.from('retention_offers').select('*').order('reported_at', { ascending: false });
    if (catalogId) query = query.eq('catalog_id', catalogId);
    const { data } = await query;
    return (data as RetentionOffer[]) ?? [];
  }

  async addRetentionOffer(input: AddRetentionOfferInput): Promise<RetentionOffer> {
    const { data: auth } = await this.sb.auth.getUser();
    const { data, error } = await this.sb
      .from('retention_offers')
      .insert({ ...input, user_id: auth.user?.id })
      .select()
      .single();
    if (error) throw error;
    return data as RetentionOffer;
  }

  async getRetentionStats(): Promise<RetentionStats[]> {
    const offers = await this.listRetentionOffers();
    return computeAllRetentionStats(offers);
  }
}
