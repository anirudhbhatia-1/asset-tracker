-- Add parent_id to track accessories/sub-assets tied to a primary asset
-- A primary asset (e.g. Laptop) has parent_id = NULL
-- A sub-asset (e.g. Adaptor, Bag) has parent_id pointing to its primary asset
ALTER TABLE assets ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES assets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_assets_parent_id ON assets(parent_id);
