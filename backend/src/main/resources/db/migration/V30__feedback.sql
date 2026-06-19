-- V30: In-app product feedback (rating + optional comment), tagged by the
-- screen/context it was submitted from (e.g. the spending summary).

CREATE TABLE IF NOT EXISTS feedback (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL,
    rating      INTEGER NOT NULL,
    comment     TEXT,
    context     VARCHAR(60),
    created_at  TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_context ON feedback (context);
