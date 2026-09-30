-- Client-owned assets go back to the client when returned, so they get their
-- own status instead of rejoining company stock as 'available'.
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_status_check;
ALTER TABLE assets ADD CONSTRAINT assets_status_check
  CHECK (status IN ('available', 'in-use', 'retired', 'returned'));

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_returned_client_only;
ALTER TABLE assets ADD CONSTRAINT assets_returned_client_only
  CHECK (status <> 'returned' OR asset_type = 'client');

-- Client assets not with an employee were handed back to the client.
UPDATE assets SET status = 'returned', updated_at = NOW()
WHERE asset_type = 'client' AND status = 'available' AND assigned_to IS NULL;
