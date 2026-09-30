-- Asset history is an append-only audit log. Deleting an asset used to
-- cascade-delete its history, including the 'deleted' event written just
-- before. Keep the rows and only clear the link to the removed asset.
ALTER TABLE asset_history ALTER COLUMN asset_id DROP NOT NULL;
ALTER TABLE asset_history DROP CONSTRAINT IF EXISTS asset_history_asset_id_fkey;
ALTER TABLE asset_history ADD CONSTRAINT asset_history_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;
