PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS payment_events (
  provider_event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('paypal')),
  event_type TEXT NOT NULL,
  resource_id TEXT NOT NULL DEFAULT '',
  resource_status TEXT NOT NULL DEFAULT '',
  gross_amount TEXT NOT NULL DEFAULT '',
  currency_code TEXT NOT NULL DEFAULT '',
  raw_event_json TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('VERIFIED','REJECTED')),
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_events_type_received
ON payment_events(event_type, received_at);

CREATE TABLE IF NOT EXISTS payment_ledger (
  ledger_id TEXT PRIMARY KEY,
  provider_event_id TEXT NOT NULL UNIQUE,
  project_id TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('paypal')),
  ledger_state TEXT NOT NULL CHECK (ledger_state IN ('RECEIVED','RECONCILING','MATCHED','REQUIRES_HUMAN','REJECTED')),
  amount_usd TEXT NOT NULL DEFAULT '',
  currency_code TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(provider_event_id) REFERENCES payment_events(provider_event_id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id) REFERENCES project_requests(project_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_payment_ledger_state_created
ON payment_ledger(ledger_state, created_at);

CREATE TABLE IF NOT EXISTS approval_events (
  approval_id TEXT PRIMARY KEY,
  project_id TEXT,
  approval_type TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED','DENIED','NEEDS_INFO')),
  actor TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES project_requests(project_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_approval_project_created
ON approval_events(project_id, created_at);
