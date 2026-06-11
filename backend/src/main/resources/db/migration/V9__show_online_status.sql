-- ─── Privacy: "show online status" toggle ─────────────────────────────────────
-- When false, other users see OFFLINE and no last-seen for this user, and no
-- presence events are fanned out for them. Admin views always see the truth.
-- Schema is normally applied by Hibernate ddl-auto=update; this file documents
-- the change for production DBs that apply migrations manually.

ALTER TABLE users ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN DEFAULT TRUE;
UPDATE users SET show_online_status = TRUE WHERE show_online_status IS NULL;
