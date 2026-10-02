PRAGMA foreign_keys = ON;

ALTER TABLE project_requests ADD COLUMN offer_id TEXT NOT NULL DEFAULT '';
ALTER TABLE project_requests ADD COLUMN offer_landing_path TEXT NOT NULL DEFAULT '';
ALTER TABLE project_requests ADD COLUMN utm_source TEXT NOT NULL DEFAULT '';
ALTER TABLE project_requests ADD COLUMN utm_medium TEXT NOT NULL DEFAULT '';
ALTER TABLE project_requests ADD COLUMN utm_campaign TEXT NOT NULL DEFAULT '';
ALTER TABLE project_requests ADD COLUMN utm_content TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_project_requests_offer_created
ON project_requests(offer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_project_requests_campaign_created
ON project_requests(utm_campaign, created_at);
