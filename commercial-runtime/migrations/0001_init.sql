PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS project_requests (
  project_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  service_ids_json TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT 'es-DO',
  state TEXT NOT NULL CHECK (state IN (
    'DRAFT','VALIDATED','POLICY_CHECK','POLICY_ALLOWED','QUOTED','CUSTOMER_APPROVED',
    'PAYMENT_PENDING','PAID','PROVISIONING','ACTIVE','UNKNOWN','RECONCILING','FAILED_FINAL','CANCELLED'
  )),
  policy_status TEXT NOT NULL CHECK (policy_status IN ('PENDING','ALLOWED','DENIED','REQUIRES_HUMAN')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_requests_idempotency ON project_requests(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_project_requests_state_created ON project_requests(state, created_at);
CREATE INDEX IF NOT EXISTS idx_project_requests_email ON project_requests(email);

CREATE TABLE IF NOT EXISTS evidence_events (
  event_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  state TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES project_requests(project_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_evidence_project_created ON evidence_events(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_evidence_correlation ON evidence_events(correlation_id);

CREATE TABLE IF NOT EXISTS dispatch_outbox (
  outbox_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  workflow_instance_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('PENDING','DISPATCHED','FAILED_FINAL')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES project_requests(project_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON dispatch_outbox(status, created_at);
