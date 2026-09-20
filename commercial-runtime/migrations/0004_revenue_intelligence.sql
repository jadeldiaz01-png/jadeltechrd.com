PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lead_lifecycle_events (
  event_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN (
    'working_lead','qualify_lead','disqualify_lead','close_convert_lead','close_unconvert_lead'
  )),
  source TEXT NOT NULL CHECK (source IN ('human','crm','verified_import')),
  source_event_id TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES project_requests(project_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_lifecycle_source_event
ON lead_lifecycle_events(source, source_event_id)
WHERE source_event_id <> '';

CREATE INDEX IF NOT EXISTS idx_lead_lifecycle_project_stage_created
ON lead_lifecycle_events(project_id, stage, created_at);

CREATE TABLE IF NOT EXISTS revenue_intelligence_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  observed_at TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  aggregate_json TEXT NOT NULL,
  recommendation_json TEXT NOT NULL,
  authority TEXT NOT NULL CHECK (authority = 'NO_EXTERNAL_SIDE_EFFECTS'),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_observed
ON revenue_intelligence_snapshots(observed_at);

CREATE TABLE IF NOT EXISTS revenue_action_proposals (
  proposal_id TEXT PRIMARY KEY,
  snapshot_id TEXT,
  action_type TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PROPOSED','APPROVED','REJECTED','EXPIRED','EXECUTED')),
  requires_human INTEGER NOT NULL CHECK (requires_human IN (0,1)),
  external_side_effect INTEGER NOT NULL CHECK (external_side_effect IN (0,1)),
  proposal_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  approved_by TEXT,
  FOREIGN KEY(snapshot_id) REFERENCES revenue_intelligence_snapshots(snapshot_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_revenue_proposals_state_created
ON revenue_action_proposals(state, created_at);
