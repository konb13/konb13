import Constants from 'expo-constants';

// Resolve runtime config from env (EXPO_PUBLIC_*) with app.json `extra` as a
// fallback. Mock mode is the default so the app runs with zero backend setup.

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

const envFlag = process.env.EXPO_PUBLIC_USE_MOCK_DATA;

export const USE_MOCK_DATA: boolean =
  envFlag != null ? envFlag !== 'false' : extra.useMockData !== false;

export const SUPABASE_URL: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? (extra.supabaseUrl as string) ?? '';

export const SUPABASE_ANON_KEY: string =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? (extra.supabaseAnonKey as string) ?? '';
