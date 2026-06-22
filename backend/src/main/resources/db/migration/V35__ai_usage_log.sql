-- V35: Per-call AI/LLM usage log (metadata only — never prompt/reply text).
-- Powers the admin AI-usage view: volume, cost/abuse monitoring, and a coarse
-- keyword-derived topic bucket so admins can see what the assistant is used for
-- without storing financial PII.

CREATE TABLE IF NOT EXISTS ai_usage_log (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL,
    endpoint    VARCHAR(20) NOT NULL,
    model       VARCHAR(60),
    msg_len     INTEGER NOT NULL,
    topic       VARCHAR(30),
    blocked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage_log (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage_log (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_topic ON ai_usage_log (topic);
