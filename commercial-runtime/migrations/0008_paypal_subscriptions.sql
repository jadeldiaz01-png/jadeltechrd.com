PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS paypal_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'paypal'),
  provider_product_id TEXT NOT NULL DEFAULT '',
  provider_plan_id TEXT NOT NULL DEFAULT '',
  provider_subscription_id TEXT NOT NULL DEFAULT '',
  provider_approval_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVAL_PENDING','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED','EXPIRED')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency_code TEXT NOT NULL CHECK (currency_code = 'USD'),
  last_payment_at TEXT,
  last_event_type TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (quote_id) REFERENCES quotes(quote_id) ON DELETE RESTRICT,
  FOREIGN KEY (project_id) REFERENCES project_requests(project_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_paypal_subscriptions_provider_id
ON paypal_subscriptions(provider, provider_subscription_id)
WHERE provider_subscription_id <> '';

CREATE INDEX IF NOT EXISTS idx_paypal_subscriptions_project_status
ON paypal_subscriptions(project_id, status, created_at);
