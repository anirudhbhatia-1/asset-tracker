-- Migration: Add JSONB addresses to locations

ALTER TABLE locations 
  DROP COLUMN IF EXISTS address,
  ADD COLUMN IF NOT EXISTS addresses JSONB DEFAULT '[]'::jsonb;
