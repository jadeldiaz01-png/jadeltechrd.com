PRAGMA foreign_keys = ON;

ALTER TABLE quote_items ADD COLUMN price_component TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE quote_items ADD COLUMN catalog_version TEXT NOT NULL DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS idx_quote_items_service_component
ON quote_items(service_id, price_component, catalog_version);
