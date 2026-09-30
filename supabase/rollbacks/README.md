# Rollback scripts

Manual rollback SQL, kept out of `supabase/migrations/` so migration tools
never apply them automatically. Run one only to deliberately undo the
migration with the same timestamp, after taking a backup.
