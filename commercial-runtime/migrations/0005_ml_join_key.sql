ALTER TABLE project_requests ADD COLUMN analytics_join_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_requests_analytics_join_id
ON project_requests(analytics_join_id)
WHERE analytics_join_id IS NOT NULL AND analytics_join_id <> '';
