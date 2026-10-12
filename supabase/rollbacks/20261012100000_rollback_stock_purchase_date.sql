-- Rollback for 20261012100000_stock_purchase_date.sql. Loses the purchase
-- dates of bulk items. Run by hand after a backup; never applied by
-- scripts/migrate.js. Afterwards delete this migration's row from app_migrations.
ALTER TABLE stock_items DROP COLUMN IF EXISTS purchase_date;
