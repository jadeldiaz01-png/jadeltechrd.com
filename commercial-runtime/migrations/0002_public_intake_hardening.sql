ALTER TABLE project_requests ADD COLUMN request_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_project_requests_request_fingerprint
ON project_requests(request_fingerprint);
