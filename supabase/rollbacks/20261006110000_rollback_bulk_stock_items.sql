-- Rollback for 20261006110000_bulk_stock_items.sql. DESTROYS all bulk item
-- data and its history: take a backup first. Run by hand; never applied by
-- scripts/migrate.js. Afterwards delete the row for this migration from
-- app_migrations.
BEGIN;
DROP TABLE IF EXISTS stock_history;
DROP TABLE IF EXISTS stock_holdings;
DROP TABLE IF EXISTS stock_items;
COMMIT;
