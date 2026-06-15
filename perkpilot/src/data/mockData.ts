import type { Benefit, Household, PointsAccount, User, UserCard } from './types';

// A realistic two-person household so the app demos end-to-end with no backend.
// Dates are intentionally near "today" so the Value-at-Risk feed lights up.

const today = new Date();
const iso = (daysFromNow: number): string => {
  const d = new Date(today);
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

export const MOCK_HOUSEHOLD: Household = {
  id: 'hh_1',
  name: 'The Bykhovsky Household',
  created_at: iso(-400),
};

export const MOCK_USERS: User[] = [
  { id: 'u_1', household_id: 'hh_1', display_name: 'Konstantin', email: 'kbykhovsky@gmail.com', role: 'owner' },
  { id: 'u_2', household_id: 'hh_1', display_name: 'Partner', email: 'partner@example.com', role: 'member' },
];

export const MOCK_USER_CARDS: UserCard[] = [
  { id: 'uc_1', user_id: 'u_1', catalog_id: 'cat_amex_platinum', opened_date: iso(-380), annual_fee_due_date: iso(20), last4: '1001', nickname: null, status: 'open' },
  { id: 'uc_2', user_id: 'u_1', catalog_id: 'cat_csr', opened_date: iso(-700), annual_fee_due_date: iso(120), last4: '2002', nickname: null, status: 'open' },
  { id: 'uc_3', user_id: 'u_1', catalog_id: 'cat_hyatt', opened_date: iso(-300), annual_fee_due_date: iso(65), last4: '3003', nickname: null, status: 'open' },
  { id: 'uc_4', user_id: 'u_2', catalog_id: 'cat_amex_gold', opened_date: iso(-200), annual_fee_due_date: iso(160), last4: '4004', nickname: null, status: 'open' },
  { id: 'uc_5', user_id: 'u_2', catalog_id: 'cat_bonvoy_brilliant', opened_date: iso(-500), annual_fee_due_date: iso(45), last4: '5005', nickname: null, status: 'open' },
];

export const MOCK_BENEFITS: Benefit[] = [
  // Platinum (Konstantin)
  { id: 'b_1', user_card_id: 'uc_1', type: 'statement_credit', name: 'Airline Fee Credit', est_value_usd: 200, expiration_date: iso(25), reset_cycle: 'calendar_year', used: false, used_date: null, notify_days_before: [60, 14, 3] },
  { id: 'b_2', user_card_id: 'uc_1', type: 'statement_credit', name: 'Saks Credit (H2)', est_value_usd: 50, expiration_date: iso(5), reset_cycle: 'calendar_year', used: false, used_date: null, notify_days_before: [30, 7] },
  // CSR (Konstantin)
  { id: 'b_3', user_card_id: 'uc_2', type: 'statement_credit', name: 'Travel Credit', est_value_usd: 300, expiration_date: iso(120), reset_cycle: 'cardmember_year', used: true, used_date: iso(-30), notify_days_before: [60, 14, 3] },
  // Hyatt (Konstantin)
  { id: 'b_4', user_card_id: 'uc_3', type: 'free_night_cert', name: 'Anniversary Free Night (Cat 1-4)', est_value_usd: 200, expiration_date: iso(65), reset_cycle: 'cardmember_year', used: false, used_date: null, notify_days_before: [60, 30, 7] },
  // Gold (Partner)
  { id: 'b_5', user_card_id: 'uc_4', type: 'statement_credit', name: 'Dining Credit (this month)', est_value_usd: 10, expiration_date: iso(12), reset_cycle: 'calendar_year', used: false, used_date: null, notify_days_before: [7, 1] },
  // Bonvoy Brilliant (Partner)
  { id: 'b_6', user_card_id: 'uc_5', type: 'free_night_cert', name: 'Annual Free Night Award (85k)', est_value_usd: 600, expiration_date: iso(40), reset_cycle: 'cardmember_year', used: false, used_date: null, notify_days_before: [60, 30, 7] },
  { id: 'b_7', user_card_id: 'uc_5', type: 'statement_credit', name: 'Dining Credit (this month)', est_value_usd: 25, expiration_date: iso(12), reset_cycle: 'calendar_year', used: false, used_date: null, notify_days_before: [7, 1] },
];

export const MOCK_POINTS_ACCOUNTS: PointsAccount[] = [
  { id: 'pa_1', user_id: 'u_1', program: 'chase_ur', balance: 142000, balance_updated_at: iso(-10), expiration_policy: 'none', inactivity_deadline: null, hard_deadline: null, account_type: 'loyalty' },
  { id: 'pa_2', user_id: 'u_1', program: 'hyatt', balance: 38000, balance_updated_at: iso(-90), expiration_policy: 'inactivity_months', inactivity_deadline: iso(75), hard_deadline: null, account_type: 'loyalty' },
  { id: 'pa_3', user_id: 'u_2', program: 'amex_mr', balance: 210000, balance_updated_at: iso(-5), expiration_policy: 'none', inactivity_deadline: null, hard_deadline: null, account_type: 'loyalty' },
  { id: 'pa_4', user_id: 'u_2', program: 'bonvoy', balance: 64000, balance_updated_at: iso(-200), expiration_policy: 'inactivity_months', inactivity_deadline: iso(30), hard_deadline: null, account_type: 'loyalty' },
];
