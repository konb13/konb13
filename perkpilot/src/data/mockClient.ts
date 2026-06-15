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
import { CARD_CATALOG, catalogById } from './catalog';
import { computeValueAtRisk } from './valueAtRisk';
import { computeFeeDecisions, type FeeAnalysis } from './feeAnalysis';
import {
  MOCK_BENEFITS,
  MOCK_HOUSEHOLD,
  MOCK_POINTS_ACCOUNTS,
  MOCK_USERS,
  MOCK_USER_CARDS,
} from './mockData';

// In-memory client. State is module-scoped so edits persist within a session.
// Defaults to the first (owner) user as the signed-in session.

let session: Session | null = { userId: MOCK_USERS[0].id, email: MOCK_USERS[0].email };
const userCards: UserCard[] = [...MOCK_USER_CARDS];
const benefits: Benefit[] = [...MOCK_BENEFITS];
const pointsAccounts: PointsAccount[] = [...MOCK_POINTS_ACCOUNTS];

let idSeq = 1000;
const nextId = (prefix: string) => `${prefix}_${++idSeq}`;
const delay = <T>(value: T): Promise<T> => Promise.resolve(value);

export class MockClient implements DataClient {
  getSession(): Promise<Session | null> {
    return delay(session);
  }

  signIn(email: string): Promise<Session> {
    const user = MOCK_USERS.find((u) => u.email === email) ?? MOCK_USERS[0];
    session = { userId: user.id, email: user.email };
    return delay(session);
  }

  signOut(): Promise<void> {
    session = null;
    return delay(undefined);
  }

  getHousehold(): Promise<Household | null> {
    return delay(MOCK_HOUSEHOLD);
  }

  getMembers(): Promise<User[]> {
    return delay(MOCK_USERS);
  }

  getCatalog(): Promise<CardCatalogEntry[]> {
    return delay(CARD_CATALOG);
  }

  listUserCards(): Promise<UserCard[]> {
    return delay([...userCards]);
  }

  addUserCard(input: AddUserCardInput): Promise<UserCard> {
    const card: UserCard = {
      id: nextId('uc'),
      user_id: input.user_id,
      catalog_id: input.catalog_id,
      opened_date: input.opened_date,
      annual_fee_due_date: input.annual_fee_due_date,
      last4: input.last4,
      nickname: input.nickname,
      status: 'open',
    };
    userCards.push(card);

    // Auto-populate benefit instances from the catalog template with default
    // expirations (build plan Phase 1: "Add card from catalog" behaviour).
    const catalog = catalogById(input.catalog_id);
    if (catalog) {
      for (const t of catalog.benefits_template) {
        benefits.push({
          id: nextId('b'),
          user_card_id: card.id,
          type: t.type,
          name: t.name,
          est_value_usd: t.est_value_usd,
          expiration_date: defaultExpiration(t.reset_cycle, input.opened_date),
          reset_cycle: t.reset_cycle,
          used: false,
          used_date: null,
          notify_days_before: t.notify_days_before,
        });
      }
    }
    return delay(card);
  }

  listBenefits(userCardId?: string): Promise<Benefit[]> {
    const result = userCardId
      ? benefits.filter((b) => b.user_card_id === userCardId)
      : [...benefits];
    return delay(result);
  }

  setBenefitUsed(benefitId: string, used: boolean): Promise<void> {
    const b = benefits.find((x) => x.id === benefitId);
    if (b) {
      b.used = used;
      b.used_date = used ? new Date().toISOString().slice(0, 10) : null;
    }
    return delay(undefined);
  }

  listPointsAccounts(): Promise<PointsAccount[]> {
    return delay([...pointsAccounts]);
  }

  getValueAtRisk(): Promise<ValueAtRiskSummary> {
    return delay(
      computeValueAtRisk({ benefits, userCards, pointsAccounts }),
    );
  }

  getFeeDecisions(withinDays = 90): Promise<FeeAnalysis[]> {
    return delay(
      computeFeeDecisions({ userCards, benefits, catalog: CARD_CATALOG, withinDays }),
    );
  }
}

function defaultExpiration(reset_cycle: string, openedDate: string | null): string | null {
  const base = new Date();
  switch (reset_cycle) {
    case 'calendar_year':
      return `${base.getFullYear()}-12-31`;
    case 'cardmember_year': {
      const opened = openedDate ? new Date(openedDate) : base;
      const next = new Date(base.getFullYear(), opened.getMonth(), opened.getDate());
      if (next.getTime() < base.getTime()) next.setFullYear(next.getFullYear() + 1);
      return next.toISOString().slice(0, 10);
    }
    case 'annual': {
      const d = new Date(base);
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    }
    case 'one_time':
    default:
      return null;
  }
}
