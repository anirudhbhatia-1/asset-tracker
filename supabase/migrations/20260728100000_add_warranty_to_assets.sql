-- Add warranty_expiry_date to assets table
ALTER TABLE assets
ADD COLUMN warranty_expiry_date DATE;
