-- Relax NOT NULL on columns no entity writes any more.
--
-- Databases that adopted their schema from ddl-auto carry columns Hibernate created for
-- fields that have since been removed from the entity. Hibernate declares them NOT NULL
-- with no default, and the baseline CREATE TABLE IF NOT EXISTS skips the table because it
-- already exists — so the column survives, unmanaged and unwritten, and every insert into
-- the table fails on it.
--
-- transactions.reference is the live example: it is absent from V1's definition of the
-- table and absent from the Transaction entity, but present and NOT NULL on any adopted
-- database. The effect is that no transaction of any kind can be written there — not a
-- transfer, not a bill payment, not a share of a split.
--
-- Relaxed rather than dropped. Dropping a column is not reversible and some environment
-- may still be reading it; a nullable column that nothing writes is inert either way.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'transactions'
          AND column_name = 'reference'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE transactions ALTER COLUMN reference DROP NOT NULL;
    END IF;
END $$;
