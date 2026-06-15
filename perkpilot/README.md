# PerkPilot

> Never lose a free night, a credit, or a point again — for you and your spouse, in one place.

A household-first credit-card benefits & loyalty-points manager, built from the
**Card & Points Manager Build Plan**. This repo is the **Phase 0 / Phase 1
foundation**: an Expo (React Native) app skeleton wired to a typed data layer,
plus the complete Supabase backend (schema, RLS, the Value-at-Risk view, and a
seeded catalog).

It runs **with zero backend** out of the box on bundled demo data, and flips to
a real Supabase project with one environment variable.

---

## What's built

| Plan area | Status |
| --- | --- |
| Data model — 6 core entities + `program_reference` (§3) | ✅ `src/data/types.ts` + `supabase/migrations` |
| `card_catalog` seed (~25 US cards) (§5: "the catalog is the product") | ✅ `src/data/catalog.ts` → `supabase/seed.sql` |
| `program_reference` seed (13 programs) | ✅ `src/data/programReference.ts` |
| Household + members, Row Level Security scoped to `household_id` | ✅ `supabase/migrations/0002_rls.sql` |
| Value-at-Risk dashboard (traffic-light urgency) | ✅ `app/(tabs)/index.tsx` + `supabase/migrations/0003_value_at_risk.sql` |
| Card list / add-card-from-catalog / per-card benefits | ✅ `app/(tabs)/cards.tsx`, `app/add-card.tsx`, `app/card/[id].tsx` |
| Points accounts | ✅ `app/(tabs)/points.tsx` |
| Cash → points estimator (§6 spec) | ✅ `src/data/estimator.ts` (+ unit tests) |
| Annual-fee keep/downgrade/cancel engine (§10 idea #1) | ✅ `src/data/feeAnalysis.ts` + `app/fee-analysis.tsx` (+ unit tests) |
| Two-player signup-bonus planner — 5/24 + referral routing (§10 idea #3) | ✅ `src/data/twoPlayerPlanner.ts`, `issuerRules.ts` + `app/two-player.tsx` (+ unit tests) |
| Local expiration reminders (30/7/1 day) | ✅ `src/notifications.ts` |
| Auth (email magic-link in live mode) | ✅ `app/sign-in.tsx` + Supabase OTP |

**Not in this slice** (later phases): monetization/RevenueCat gating (the fee
engine is a premium feature once gating lands), the affiliate layer, the
Next.js web SEO site, and the Phase 4 AI award planner.

---

## Architecture

The app never imports Supabase or mock data directly — it talks to a single
`DataClient` interface (`src/data/client.ts`). A factory picks the
implementation from a feature flag:

```
UI screens ─▶ getClient(): DataClient
                 ├─ MockClient          (in-memory, default)
                 └─ SupabaseDataClient   (live, behind RLS)
```

`src/data/catalog.ts` and `src/data/programReference.ts` are the **source of
truth** for the two global tables. `scripts/gen-seed.ts` generates
`supabase/seed.sql` from them, so the demo data and the live DB never drift.

```
perkpilot/
├─ app/                     # expo-router screens
│  ├─ (tabs)/               # At Risk · Cards · Points · Household
│  ├─ card/[id].tsx         # per-card benefits + used toggle
│  └─ add-card.tsx          # add a card from the catalog
├─ src/
│  ├─ data/                 # types, catalog, program_reference, clients, estimator, value-at-risk
│  ├─ ui/                   # theme + component kit
│  ├─ hooks/                # useAsync (load + refresh on focus)
│  └─ notifications.ts      # local 30/7/1-day reminders
├─ supabase/
│  ├─ migrations/           # schema, RLS, value_at_risk view, add-card trigger
│  └─ seed.sql              # generated: card_catalog + program_reference
└─ scripts/gen-seed.ts      # regenerate seed.sql from the TS source of truth
```

---

## Run it (demo mode — no backend)

```bash
cd perkpilot
npm install
npm start          # then press i / a / w for iOS, Android, web
```

The app boots on the bundled two-person household. The **At Risk** tab sums the
credits, certs, and points the household would lose if it did nothing.

### Verify the core logic without a device

```bash
npm run typecheck
npm test           # estimator + value-at-risk unit tests
```

---

## Go live (Supabase)

1. Create a Supabase project.
2. Apply the backend:
   ```bash
   # via the Supabase SQL editor or CLI, in order:
   supabase/migrations/0001_schema.sql
   supabase/migrations/0002_rls.sql
   supabase/migrations/0003_value_at_risk.sql
   supabase/migrations/0004_add_card_trigger.sql
   supabase/seed.sql            # regenerate first with: npx tsx scripts/gen-seed.ts
   ```
3. Point the app at it (`cp .env.example .env`):
   ```
   EXPO_PUBLIC_USE_MOCK_DATA=false
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

RLS scopes every row to the caller's household, so household sharing is just the
policies in `0002_rls.sql` — no per-query filtering in the app.

---

## Design notes carried from the plan

- **The catalog is a first-class asset.** `last_verified_at` is surfaced on the
  card-detail screen as a trust signal; keeping it fresh is the weekly ops habit.
- **Value-at-Risk is a query, not a table** — defined once as a SQL view and
  mirrored client-side (`src/data/valueAtRisk.ts`) for mock mode.
- **The estimator never lies.** `estimatePoints()` always returns a *range* +
  confidence badge, per §6 — never a single authoritative number.
- **No credential storage.** Manual entry only; sidesteps the GLBA-adjacent and
  security risk the plan calls out as a v1 non-goal.
- **The two-player planner is a pure rules engine.** It reads each spouse's
  existing cards to compute Chase 5/24, sequences Chase applications before the
  gate fills, enforces per-issuer application velocity, never re-recommends a
  held card (welcome bonuses are once-per-lifetime), and routes shared cards so
  one spouse refers the other for the referral bonus. No external data, fully
  deterministic, covered by unit tests. Welcome-offer figures live in
  `src/data/signupBonuses.ts` and are re-verified on their own cadence (offers
  churn faster than benefits).
