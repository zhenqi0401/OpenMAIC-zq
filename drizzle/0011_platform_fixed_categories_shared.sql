-- The original cleanup is superseded by 0012. Existing tenant courses can
-- still reference tenant copies, so the ownership-aware remap must happen
-- before those rows are deleted. Keep this migration as a safe checkpoint so
-- Drizzle can advance to the complete 0012 migration.
SELECT 1;
