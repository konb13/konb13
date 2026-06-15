import type { CardCatalogEntry, SignupBonus, User, UserCard } from './types';
import {
  type CardOpening,
  applicationCooldownDays,
  count524,
  isSubjectTo524,
  isUnder524,
  next524OpensAt,
} from './issuerRules';

// "Spouse two-player mode" (build plan §10, idea #3): the sequenced household
// card-application planner. Who applies for what, in what order, respecting
// Chase 5/24, application velocity, once-per-lifetime, and two-player referral
// routing (one spouse applies, then refers the other for the referral bonus).
//
// Pure rules engine — no external data. Deterministic for testability.

export interface PlannerMember {
  id: string;
  name: string;
  /** Existing card history (drives 5/24 and "already held"). */
  openings: CardOpening[];
}

export type WantedBy = 'either' | 'both' | string; // string = a specific member id

export interface PlanTarget {
  catalog_id: string;
  issuer: string;
  product_name: string;
  annual_fee: number;
  signup_bonus: SignupBonus;
  wanted_by: WantedBy;
}

export interface PlannerOptions {
  startDate?: Date;
  cycleDays?: number;
  maxCycles?: number;
}

export interface PlanMove {
  order: number;
  date: string;
  member_id: string;
  member_name: string;
  catalog_id: string;
  card_name: string;
  issuer: string;
  bonus_value_usd: number;
  min_spend_usd: number;
  min_spend_deadline: string;
  refer_from_member_id: string | null;
  refer_from_member_name: string | null;
  referral_bonus_usd: number;
  rationale: string[];
}

export interface MemberStatus {
  member_id: string;
  name: string;
  current_524: number;
  under_524: boolean;
  next_524_opens_at: string | null;
}

export interface TwoPlayerPlan {
  members: MemberStatus[];
  moves: PlanMove[];
  total_bonus_value_usd: number;
  unscheduled: { catalog_id: string; card_name: string; reason: string }[];
  notes: string[];
}

interface Acq {
  id: string;
  target: PlanTarget;
  /** Fixed member for 'both'/specific; null for 'either' (assigned at schedule time). */
  assignedTo: string | null;
  /** For the 2nd leg of a referable 'both' target: the leg that must come first. */
  referFromAcqId: string | null;
  scheduledCycle: number | null;
  scheduledMemberId: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

const holds = (m: PlannerMember, catalogId: string) =>
  m.openings.some((o) => o.catalog_id === catalogId);

export function planTwoPlayer(
  members: PlannerMember[],
  targets: PlanTarget[],
  options: PlannerOptions = {},
): TwoPlayerPlan {
  const startDate = options.startDate ?? new Date();
  const cycleDays = options.cycleDays ?? 30;
  const maxCycles = options.maxCycles ?? 24;
  const notes: string[] = [];

  // Per-member simulated state.
  const sim = new Map<string, { openings: CardOpening[]; lastApp: Date | null }>();
  for (const m of members) sim.set(m.id, { openings: [...m.openings], lastApp: null });
  const memberById = new Map(members.map((m) => [m.id, m]));

  // 1. Expand targets into acquisitions.
  const acqs: Acq[] = [];
  let acqSeq = 0;
  for (const t of targets) {
    const bonus = t.signup_bonus;
    if (t.wanted_by === 'both') {
      // Leg 1 → member with more 5/24 runway when it's a Chase card; else first.
      const ordered = orderForLeadLeg(members, t, startDate);
      const lead = ordered[0];
      const follow = ordered[1] ?? ordered[0];
      const leg1: Acq = { id: `a${acqSeq++}`, target: t, assignedTo: lead.id, referFromAcqId: null, scheduledCycle: null, scheduledMemberId: null };
      acqs.push(leg1);
      if (follow.id !== lead.id) {
        const referable = (bonus.referral_bonus_usd ?? 0) > 0;
        acqs.push({
          id: `a${acqSeq++}`,
          target: t,
          assignedTo: follow.id,
          referFromAcqId: referable ? leg1.id : null,
          scheduledCycle: null,
          scheduledMemberId: null,
        });
      }
    } else if (t.wanted_by === 'either') {
      acqs.push({ id: `a${acqSeq++}`, target: t, assignedTo: null, referFromAcqId: null, scheduledCycle: null, scheduledMemberId: null });
    } else {
      acqs.push({ id: `a${acqSeq++}`, target: t, assignedTo: t.wanted_by, referFromAcqId: null, scheduledCycle: null, scheduledMemberId: null });
    }
  }

  const moves: PlanMove[] = [];

  // 2. Simulate cycles.
  for (let cycle = 0; cycle < maxCycles; cycle++) {
    if (acqs.every((a) => a.scheduledCycle !== null)) break;
    const date = addDays(startDate, cycle * cycleDays);

    for (const m of members) {
      const state = sim.get(m.id)!;

      const candidate = pickCandidate(acqs, m, state, date, cycle);
      if (!candidate) continue;

      const { target } = candidate;
      const dateIso = date.toISOString().slice(0, 10);
      candidate.scheduledCycle = cycle;
      candidate.scheduledMemberId = m.id;

      // Update simulated state.
      state.openings.push({ catalog_id: target.catalog_id, issuer: target.issuer, opened_date: dateIso });
      state.lastApp = date;

      // Resolve referral.
      let referFromId: string | null = null;
      let referFromName: string | null = null;
      let referralBonus = 0;
      if (candidate.referFromAcqId) {
        const leg1 = acqs.find((a) => a.id === candidate.referFromAcqId);
        if (leg1?.scheduledMemberId) {
          referFromId = leg1.scheduledMemberId;
          referFromName = memberById.get(referFromId)?.name ?? null;
          referralBonus = target.signup_bonus.referral_bonus_usd ?? 0;
        }
      }

      moves.push({
        order: moves.length + 1,
        date: dateIso,
        member_id: m.id,
        member_name: m.name,
        catalog_id: target.catalog_id,
        card_name: `${target.issuer} ${target.product_name}`,
        issuer: target.issuer,
        bonus_value_usd: target.signup_bonus.bonus_value_usd,
        min_spend_usd: target.signup_bonus.min_spend_usd,
        min_spend_deadline: addMonths(dateIso, target.signup_bonus.min_spend_months),
        refer_from_member_id: referFromId,
        refer_from_member_name: referFromName,
        referral_bonus_usd: referralBonus,
        rationale: buildRationale(target, m, state.openings, date, referFromName, referralBonus),
      });
    }
  }

  // 3. Report anything left unscheduled, with a reason.
  const unscheduled = acqs
    .filter((a) => a.scheduledCycle === null)
    .map((a) => {
      const m = a.assignedTo ? memberById.get(a.assignedTo) : null;
      let reason = 'Could not fit within the planning horizon.';
      if (m && holds(m, a.target.catalog_id)) {
        reason = `${m.name} already holds this card (welcome bonus is once per lifetime).`;
      } else if (m && isSubjectTo524(a.target.issuer)) {
        const opensAt = next524OpensAt(sim.get(m.id)!.openings, addDays(startDate, maxCycles * cycleDays));
        if (opensAt) reason = `${m.name} is at 5/24 — Chase eligibility opens ~${opensAt}.`;
      }
      return { catalog_id: a.target.catalog_id, card_name: `${a.target.issuer} ${a.target.product_name}`, reason };
    });

  const total_bonus_value_usd = moves.reduce(
    (s, mv) => s + mv.bonus_value_usd + mv.referral_bonus_usd,
    0,
  );

  if (moves.some((m) => m.issuer.toLowerCase() === 'chase')) {
    notes.push('Chase applications are sequenced first while each of you is under 5/24.');
  }
  if (moves.some((m) => m.refer_from_member_id)) {
    notes.push('Shared cards are routed so one of you refers the other, earning the referral bonus on top of the welcome offer.');
  }

  const memberStatuses: MemberStatus[] = members.map((m) => ({
    member_id: m.id,
    name: m.name,
    current_524: count524(m.openings, startDate),
    under_524: isUnder524(m.openings, startDate),
    next_524_opens_at: next524OpensAt(m.openings, startDate),
  }));

  return { members: memberStatuses, moves, total_bonus_value_usd, unscheduled, notes };
}

export interface PlanRequestTarget {
  catalog_id: string;
  wanted_by: WantedBy;
}

/** Assemble and run a plan from app-shaped data (members, their cards, catalog). */
export function buildPlanFromData(args: {
  members: User[];
  userCards: UserCard[];
  catalog: CardCatalogEntry[];
  requests: PlanRequestTarget[];
  getSignupBonus: (catalogId: string) => SignupBonus | undefined;
  options?: PlannerOptions;
}): TwoPlayerPlan {
  const { members, userCards, catalog, requests, getSignupBonus, options } = args;
  const catalogById = (id: string) => catalog.find((c) => c.id === id);

  const plannerMembers: PlannerMember[] = members.map((m) => ({
    id: m.id,
    name: m.display_name,
    openings: userCards
      .filter((uc) => uc.user_id === m.id && uc.opened_date)
      .map((uc) => ({
        catalog_id: uc.catalog_id,
        issuer: catalogById(uc.catalog_id)?.issuer ?? 'Other',
        opened_date: uc.opened_date as string,
      })),
  }));

  const targets: PlanTarget[] = [];
  const skipped: { catalog_id: string; card_name: string; reason: string }[] = [];
  for (const req of requests) {
    const cat = catalogById(req.catalog_id);
    const bonus = getSignupBonus(req.catalog_id);
    if (!cat) continue;
    if (!bonus) {
      skipped.push({ catalog_id: req.catalog_id, card_name: `${cat.issuer} ${cat.product_name}`, reason: 'No current welcome offer worth chasing.' });
      continue;
    }
    targets.push({
      catalog_id: cat.id,
      issuer: cat.issuer,
      product_name: cat.product_name,
      annual_fee: cat.annual_fee,
      signup_bonus: bonus,
      wanted_by: req.wanted_by,
    });
  }

  const plan = planTwoPlayer(plannerMembers, targets, options);
  return { ...plan, unscheduled: [...plan.unscheduled, ...skipped] };
}

/** Order members so the lead referral leg goes to the better-positioned spouse. */
function orderForLeadLeg(members: PlannerMember[], t: PlanTarget, asOf: Date): PlannerMember[] {
  if (!isSubjectTo524(t.issuer)) return [...members];
  return [...members].sort((a, b) => count524(a.openings, asOf) - count524(b.openings, asOf));
}

/** The best eligible acquisition for `member` this cycle, or null. */
function pickCandidate(
  acqs: Acq[],
  member: PlannerMember,
  state: { openings: CardOpening[]; lastApp: Date | null },
  date: Date,
  cycle: number,
): Acq | null {
  const eligible = acqs.filter((a) => {
    if (a.scheduledCycle !== null) return false;
    // Assigned to someone else?
    if (a.assignedTo && a.assignedTo !== member.id) return false;
    // Already held (history) or already scheduled for this member this run?
    if (holds(member, a.target.catalog_id)) return false;
    if (state.openings.some((o) => o.catalog_id === a.target.catalog_id)) return false;
    // Velocity cooldown.
    if (state.lastApp) {
      const wait = applicationCooldownDays(a.target.issuer);
      if ((date.getTime() - state.lastApp.getTime()) / DAY_MS < wait) return false;
    }
    // Chase 5/24 gate.
    if (isSubjectTo524(a.target.issuer) && !isUnder524(state.openings, date)) return false;
    // Referral leg must follow its lead leg (strictly earlier cycle).
    if (a.referFromAcqId) {
      const lead = acqs.find((x) => x.id === a.referFromAcqId);
      if (!lead || lead.scheduledCycle === null || lead.scheduledCycle >= cycle) return false;
    }
    return true;
  });
  if (eligible.length === 0) return null;

  // Priority: Chase first (grab before 5/24 fills), then higher bonus value.
  eligible.sort((a, b) => {
    const chaseA = isSubjectTo524(a.target.issuer) ? 0 : 1;
    const chaseB = isSubjectTo524(b.target.issuer) ? 0 : 1;
    if (chaseA !== chaseB) return chaseA - chaseB;
    return b.target.signup_bonus.bonus_value_usd - a.target.signup_bonus.bonus_value_usd;
  });
  return eligible[0];
}

function buildRationale(
  target: PlanTarget,
  member: PlannerMember,
  openingsAfter: CardOpening[],
  date: Date,
  referFromName: string | null,
  referralBonus: number,
): string[] {
  const out: string[] = [];
  if (isSubjectTo524(target.issuer)) {
    // count524 includes the just-added opening; the pre-application count is -1.
    const count = count524(openingsAfter, date) - 1;
    out.push(`Chase card — applied while under 5/24 (${count}/24 before this).`);
  }
  if (referFromName) {
    out.push(`Referred by ${referFromName} (+$${referralBonus} referral bonus on top of the welcome offer).`);
  }
  out.push(
    `Spend $${target.signup_bonus.min_spend_usd.toLocaleString()} within ${target.signup_bonus.min_spend_months} months for ~$${target.signup_bonus.bonus_value_usd.toLocaleString()}.`,
  );
  return out;
}
