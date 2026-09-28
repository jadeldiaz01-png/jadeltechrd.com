PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS quotes (
  quote_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  status TEXT NOT NULL CHECK (status IN ('ISSUED','ACCEPTED','EXPIRED','CANCELLED')),
  currency_code TEXT NOT NULL CHECK (currency_code = 'USD'),
  total_amount_minor INTEGER NOT NULL CHECK (total_amount_minor >= 0),
  expires_at TEXT,
  accepted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES project_requests(project_id) ON DELETE RESTRICT,
  UNIQUE(project_id, version)
);

CREATE INDEX IF NOT EXISTS idx_quotes_project_status
ON quotes(project_id, status, created_at);

CREATE TABLE IF NOT EXISTS quote_items (
  quote_item_id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor >= 0),
  line_amount_minor INTEGER NOT NULL CHECK (line_amount_minor >= 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY(quote_id) REFERENCES quotes(quote_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote
ON quote_items(quote_id);

CREATE TABLE IF NOT EXISTS payment_orders (
  payment_order_id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'paypal'),
  provider_order_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('PENDING','COMPLETED','CANCELLED','EXPIRED')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency_code TEXT NOT NULL CHECK (currency_code = 'USD'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(quote_id) REFERENCES quotes(quote_id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id) REFERENCES project_requests(project_id) ON DELETE RESTRICT,
  UNIQUE(quote_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_provider_order
ON payment_orders(provider, provider_order_id)
WHERE provider_order_id <> '';

CREATE INDEX IF NOT EXISTS idx_payment_orders_project_status
ON payment_orders(project_id, status, created_at);

CREATE TABLE IF NOT EXISTS sales_settlements (
  settlement_id TEXT PRIMARY KEY,
  payment_order_id TEXT NOT NULL UNIQUE,
  ledger_id TEXT NOT NULL UNIQUE,
  provider_event_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency_code TEXT NOT NULL CHECK (currency_code = 'USD'),
  status TEXT NOT NULL CHECK (status = 'MATCHED'),
  created_at TEXT NOT NULL,
  FOREIGN KEY(payment_order_id) REFERENCES payment_orders(payment_order_id) ON DELETE RESTRICT,
  FOREIGN KEY(ledger_id) REFERENCES payment_ledger(ledger_id) ON DELETE RESTRICT,
  FOREIGN KEY(provider_event_id) REFERENCES payment_events(provider_event_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sales_settlements_created
ON sales_settlements(created_at);
