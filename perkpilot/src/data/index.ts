import type { DataClient } from './client';
import { MockClient } from './mockClient';
import { USE_MOCK_DATA } from './config';

let instance: DataClient | null = null;

/** Returns the singleton data client chosen by the USE_MOCK_DATA flag. */
export function getClient(): DataClient {
  if (instance) return instance;
  if (USE_MOCK_DATA) {
    instance = new MockClient();
  } else {
    // Lazy-require so the Supabase SDK isn't bundled into mock-only builds.
    const { SupabaseDataClient } = require('./supabaseClient') as typeof import('./supabaseClient');
    instance = new SupabaseDataClient();
  }
  return instance;
}

export * from './types';
export * from './client';
export * from './feeAnalysis';
export * from './twoPlayerPlanner';
export { computeRetentionStats, computeAllRetentionStats } from './retentionOffers';
export { SIGNUP_BONUSES, getSignupBonus } from './signupBonuses';
export { USE_MOCK_DATA } from './config';
