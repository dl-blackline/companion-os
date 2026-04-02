/* ── Stripe Financial Connections types ── */

export interface LinkedAccount {
  id: string;
  user_id: string;
  provider: 'plaid' | 'stripe';
  stripe_account_id: string | null;
  institution_name: string | null;
  account_display_name: string | null;
  account_last4: string | null;
  account_type: string | null;
  account_subtype: string | null;
  nickname: string | null;
  user_notes: string | null;
  website_url: string | null;
  livemode: boolean;
  status: 'connected' | 'error' | 'disconnected';
  last_sync_at: string | null;
  disconnected_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  latest_balance: BalanceSnapshot | null;
}

export interface BalanceSnapshot {
  id: string;
  connection_id: string;
  available_balance: number | null;
  current_balance: number | null;
  currency: string;
  as_of: string;
  created_at: string;
}

export interface LinkedAccountsDashboard {
  accounts: LinkedAccount[];
  totalTransactions: number;
  ledgerEntries: LedgerEntry[];
  aggregates: AccountAggregates;
}

export interface AccountAggregates {
  totalBalance: number;
  totalAvailableCredit: number;
  totalCashOnHand: number;
  accountCount: number;
}

export interface LedgerEntry {
  id: string;
  user_id: string;
  connection_id: string | null;
  title: string;
  amount: number;
  direction: 'inflow' | 'outflow';
  due_date: string;
  recurrence: 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
  category: string | null;
  notes: string | null;
  status: 'pending' | 'completed' | 'skipped' | 'overdue';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Unified transactions ── */

export type TransactionDirection = 'inflow' | 'outflow';
export type TransactionStatus = 'posted' | 'pending';

export interface NormalizedTransaction {
  id: string;
  user_id: string;
  connection_id: string;
  stripe_transaction_id: string | null;
  stripe_financial_connections_account_id: string | null;
  institution_name: string | null;
  account_display_name: string | null;
  account_last4: string | null;
  account_subtype: string | null;
  transaction_date: string | null;
  posted_at: string | null;
  amount: number;
  direction: TransactionDirection;
  description: string | null;
  merchant_name: string | null;
  category: string | null;
  user_category_override: string | null;
  notes: string | null;
  status: TransactionStatus;
  livemode: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransactionPagination {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface TransactionFeedResponse {
  transactions: NormalizedTransaction[];
  pagination: TransactionPagination;
}

/* ── Transaction filters (frontend) ── */

export interface TransactionFilters {
  connectionId?: string;
  institution?: string;
  category?: string;
  userCategory?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  direction?: TransactionDirection | '';
  hasNotes?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/* ── Categories ── */

export interface TransactionCategory {
  name: string;
  icon: string | null;
  color: string | null;
  is_system: boolean;
}

export interface CategoriesDashboard {
  categories: TransactionCategory[];
}

/* ── FC session ── */

export interface StripeSessionPayload {
  clientSecret: string;
  sessionId: string;
}
