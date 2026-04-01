/**
 * Stripe Financial Connections types.
 *
 * Represents linked bank accounts retrieved through Stripe Financial Connections.
 * Designed for extension with balances, transactions, ownership, and income
 * verification in future phases.
 */

export interface StripeFinancialAccount {
  /** Internal UUID (our DB primary key) */
  id: string;
  /** Stripe FC account ID (e.g. fca_xxx) */
  stripe_financial_connection_account_id: string;
  /** Bank / institution name */
  institution_name: string | null;
  /** Account display name from Stripe */
  account_display_name: string | null;
  /** High-level category: checking, savings, credit, investment, other */
  account_type: string | null;
  /** More specific classification */
  account_subtype: string | null;
  /** active | inactive | disconnected | error */
  account_status: string;
  /** Last 4 digits of the account number */
  last4: string | null;
  /** Whether this was linked in live mode */
  livemode: boolean;
  /** Granted permissions (e.g. balances, transactions, ownership) */
  permissions: string[];
  /** Payment method types supported by this account */
  supported_payment_method_types: string[];
  /** Status of balance data refresh */
  balance_refresh_status: string | null;
  /** Status of ownership data refresh */
  ownership_refresh_status: string | null;
  /** Status of transaction data refresh */
  transaction_refresh_status: string | null;
  /** When the account was first linked */
  linked_at: string;
  /** Last time account metadata was updated */
  updated_at: string;
  /** When the account was disconnected (null if still active) */
  disconnected_at: string | null;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

export interface StripeFinancialConnectionsState {
  /** Whether Stripe FC is configured server-side */
  configured: boolean;
  /** Linked accounts */
  accounts: StripeFinancialAccount[];
  /** Total count of active linked accounts */
  count: number;
}

export interface CreateSessionResult {
  configured: boolean;
  clientSecret?: string;
  sessionId?: string;
  message?: string;
}
