-- When the bulk stock (bags, cables...) was bought. Optional; shown on the
-- item's details and set from the add/edit form.
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS purchase_date DATE;
