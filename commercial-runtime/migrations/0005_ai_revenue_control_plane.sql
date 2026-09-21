PRAGMA foreign_keys = ON;

-- Settlement evidence is separate from payment matching. MATCHED is not cash settlement.
CREATE TABLE IF NOT EXISTS settlement_events (
  settlement_id TEXT PRIMARY KEY,
  ledger_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('paypal')),
  settlement_reference_hash TEXT NOT NULL,
  settled_amount_usd REAL NOT NULL CHECK (settled_amount_usd >= 0),
  currency_code TEXT NOT NULL CHECK (currency_code = 'USD'),
  evidence_sha256 TEXT NOT NULL CHECK (length(evidence_sha256) = 64),
  settled_at TEXT NOT NULL,
  reconciled_at TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(ledger_id) REFERENCES payment_ledger(ledger_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_settlement_events_settled_at
ON settlement_events(settled_at);

CREATE TABLE IF NOT EXISTS ai_model_runs (
  run_id TEXT PRIMARY KEY,
  run_kind TEXT NOT NULL CHECK (run_kind IN ('REVENUE_ADVISOR','MULTIMODAL_QC','SCHEDULED_REVENUE_ADVISOR')),
  model_id TEXT NOT NULL,
  source_sha TEXT NOT NULL CHECK (length(source_sha) = 40),
  input_sha256 TEXT NOT NULL CHECK (length(input_sha256) = 64),
  prompt_revision TEXT NOT NULL,
  schema_revision TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('STARTED','SUCCEEDED','FAILED')),
  policy_mode TEXT NOT NULL CHECK (policy_mode = 'SHADOW_RECOMMEND_ONLY'),
  output_json TEXT NOT NULL DEFAULT '{}',
  provider_request_id TEXT NOT NULL DEFAULT '',
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  error_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_model_runs_kind_created
ON ai_model_runs(run_kind, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_recommendation_feedback (
  feedback_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('USEFUL','NOT_USEFUL','REJECTED_RISK','STALE')),
  actor TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY(run_id) REFERENCES ai_model_runs(run_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_run_created
ON ai_recommendation_feedback(run_id, created_at DESC);
