-- V36: Per-user kill switch for the AI assistant. When true, AiService refuses
-- chat/insight/support calls for this user (admin enforcement action).

ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_disabled BOOLEAN NOT NULL DEFAULT FALSE;
