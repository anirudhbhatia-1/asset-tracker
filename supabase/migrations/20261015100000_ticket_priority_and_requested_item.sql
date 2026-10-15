-- Ticket priority (chosen by the person raising it; resolvers can change it)
-- and a free-text "what do you need" for hardware requests that don't fit a
-- category. Additive; existing tickets become 'medium'.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'medium';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requested_item TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_priority_check') THEN
    ALTER TABLE tickets ADD CONSTRAINT tickets_priority_check
      CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_requested_item_length') THEN
    ALTER TABLE tickets ADD CONSTRAINT tickets_requested_item_length
      CHECK (requested_item IS NULL OR char_length(requested_item) <= 100);
  END IF;
END $$;
