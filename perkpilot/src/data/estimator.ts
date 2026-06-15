import type { LoyaltyProgram } from './types';
import { PROGRAM_REFERENCE } from './programReference';

// Estimation Engine (build plan §6): estimate_points(program, cash_rate, dates).
// ALWAYS render as a range + confidence badge + deep link to confirm — never a
// single authoritative number. Log user-confirmed actuals to tighten cpp bands.

export type Confidence = 'HIGH' | 'MEDIUM-HIGH' | 'MEDIUM' | 'LOW';

export interface PointsEstimate {
  program: LoyaltyProgram;
  /** Inclusive points range [low, high]. */
  range: [number, number];
  confidence: Confidence;
  flag: string;
  deepLink: string | null;
}

export interface EstimateOptions {
  /** Hyatt fixed-chart category (1-8). */
  hyattCategory?: number;
  /** Hyatt seasonal tier. */
  hyattTier?: 'off_peak' | 'standard' | 'peak';
  /** Rough taxes/fees baked into a dynamic redemption (USD). */
  estTaxesFees?: number;
}

const round = (n: number) => Math.round(n / 100) * 100;

export function estimatePoints(
  program: LoyaltyProgram,
  cashRateUsd: number,
  opts: EstimateOptions = {},
): PointsEstimate {
  const ref = PROGRAM_REFERENCE[program];
  if (!ref) {
    return { program, range: [0, 0], confidence: 'LOW', flag: 'Unknown program', deepLink: null };
  }

  if (ref.pricing_model === 'fixed_chart' && ref.chart) {
    const cat = String(opts.hyattCategory ?? 4);
    const tier = opts.hyattTier ?? 'standard';
    const exact = ref.chart[cat]?.[tier];
    if (exact != null) {
      return {
        program,
        range: [exact, exact],
        confidence: 'HIGH',
        flag: 'Confirm category and seasonal tier for your exact dates.',
        deepLink: 'https://world.hyatt.com/',
      };
    }
  }

  if (ref.pricing_model === 'dynamic') {
    // cash_cents / cpp. Expensive points (cpp_high) -> fewer needed (low end).
    const cashCents = (cashRateUsd - (opts.estTaxesFees ?? 0)) * 100;
    const low = round(cashCents / ref.cpp_high);
    const high = round(cashCents / ref.cpp_low);
    return {
      program,
      range: [Math.max(0, low), Math.max(0, high)],
      confidence: 'MEDIUM',
      flag: 'Award availability not guaranteed; resort/carrier fees may apply.',
      deepLink: null,
    };
  }

  if (ref.pricing_model === 'revenue_based') {
    const cents = cashRateUsd * 100;
    const points = round(cents / ref.cpp_mid);
    return {
      program,
      range: [points, points],
      confidence: 'MEDIUM-HIGH',
      flag: 'Revenue-based: cost tracks the cash fare closely.',
      deepLink: null,
    };
  }

  return {
    program,
    range: [0, 0],
    confidence: 'LOW',
    flag: 'Partner/chart award — confirm sweet-spot cost; no live availability.',
    deepLink: null,
  };
}
