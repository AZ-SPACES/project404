-- Recurring splits — rent, the water, the wifi.
--
-- A definition stored once that produces an ordinary expense_split on schedule. Nothing
-- about the resulting split is special, so netting, reminders, and settling up all work
-- on it without knowing this table exists.
--
-- People are held by id rather than by handle: resolving a username every month would
-- break the split the day somebody changed theirs.

CREATE TABLE IF NOT EXISTS recurring_splits (
    id            UUID PRIMARY KEY,
    version       BIGINT,
    creator_id    UUID           NOT NULL,
    description   VARCHAR(140)   NOT NULL,
    total_amount  NUMERIC(15, 2) NOT NULL,
    currency      VARCHAR(3)     NOT NULL DEFAULT 'GHS',
    split_mode    VARCHAR(16)    NOT NULL DEFAULT 'EQUAL',
    frequency     VARCHAR(16)    NOT NULL DEFAULT 'MONTHLY',
    day_of_period INTEGER        NOT NULL,
    next_run_on   DATE           NOT NULL,
    last_run_on   DATE,
    active        BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP,

    CONSTRAINT recurring_splits_amount_positive CHECK (total_amount > 0),
    -- Monthly is capped at 28 so a rent split never silently skips February; weekly
    -- uses 1-7. One check covers both because 7 is inside 1-28.
    CONSTRAINT recurring_splits_day_sane CHECK (
        (frequency = 'MONTHLY' AND day_of_period BETWEEN 1 AND 28)
        OR (frequency = 'WEEKLY' AND day_of_period BETWEEN 1 AND 7))
);

CREATE INDEX IF NOT EXISTS idx_recurring_splits_creator ON recurring_splits (creator_id);
CREATE INDEX IF NOT EXISTS idx_recurring_splits_due ON recurring_splits (active, next_run_on);

CREATE TABLE IF NOT EXISTS recurring_split_participants (
    id                 UUID PRIMARY KEY,
    recurring_split_id UUID           NOT NULL REFERENCES recurring_splits (id),
    user_id            UUID           NOT NULL,
    amount             NUMERIC(15, 2),
    shares             INTEGER,
    percentage         NUMERIC(5, 2),

    CONSTRAINT uk_recurring_split_participants_split_user UNIQUE (recurring_split_id, user_id),
    CONSTRAINT recurring_split_participants_weights_sane CHECK (
        (amount IS NULL OR amount > 0)
        AND (shares IS NULL OR shares > 0)
        AND (percentage IS NULL OR (percentage > 0 AND percentage <= 100)))
);

CREATE INDEX IF NOT EXISTS idx_recurring_split_participants_split
    ON recurring_split_participants (recurring_split_id);
