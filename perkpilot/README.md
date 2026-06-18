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
| Cash → points estimator (§6 spec) | ✅ `src/data/estimator.ts` + `app/estimator.tsx` (+ unit tests) |
| Retention-offer crowdsourcing (§10 idea #2) | ✅ `src/data/retentionOffers.ts` + `app/retention.tsx`, `app/log-retention.tsx` (+ unit tests) |
| Apple-style adaptive UI + brand assets (light/dark, inset lists, frosted tab bar) | ✅ `src/ui/theme.ts`, `src/ui/components.tsx`, `scripts/gen-assets.mjs` |
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
│  ├─ data/                 # types, catalog, program_reference, clients, estimator, value-at-risk, planners
│  ├─ ui/                   # adaptive iOS theme (theme.ts) + component kit (components.tsx)
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

### Run it on your phone (Expo Go)

```bash
cd perkpilot
npm install
npx expo start          # a QR code appears in the terminal
```

Install **Expo Go** from the App Store / Play Store and scan the QR code (use
the Camera app on iOS). The app loads over the local network on your device —
no build step. Push notifications are limited inside Expo Go; for full
notification testing, make a dev build with `npx expo run:ios`.

### Regenerate brand assets

```bash
node scripts/gen-assets.mjs   # rewrites assets/icon.png, splash, adaptive-icon, favicon
```

### Verify the core logic without a device

```bash
npm run typecheck
npm test           # estimator + value-at-risk unit tests
```

---

## Go live (Supabase) — real two-person setup

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is fine).
2. **Apply the backend.** Open the project's **SQL Editor**, paste the whole of
   `supabase/bootstrap.sql`, and run it. That single file is every migration +
   the catalog/program seed, in order. (Regenerate it with
   `node scripts/gen-bootstrap.mjs` if you change the schema or catalog.)
3. **Enable email OTP.** Authentication → Providers → Email: turn on email
   sign-in and **disable "Confirm email"** (the app verifies a 6-digit code).
4. **Point the app at it** (`cp .env.example .env`):
   ```
   EXPO_PUBLIC_USE_MOCK_DATA=false
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-ANON-KEY
   ```
5. **Run it** (`npx expo start`) and sign in with your email + the code.
   - First sign-in → **Set up your household** → *Create new*. The Household tab
     then shows a 6-character **invite code**.
   - Your spouse installs the app, signs in with their own email, chooses
     *Join with code*, and enters that invite code. You now share one dataset.

The anon key is safe to embed in the client (it only acts through RLS). Every
row is scoped to the caller's household by the policies in `0002_rls.sql`;
onboarding is handled by the `create_household` / `join_household` RPCs in
`0006_onboarding.sql`. No per-query filtering in the app.

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
