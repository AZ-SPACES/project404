-- Aza-hosted mini app bundles.
--
-- Until now every mini app was EXTERNAL: the developer hosted their own build and
-- submitted a URL. Developers without a domain or server can now upload a static
-- bundle instead, which Aza serves from its own origin.
--
-- Each hosted app gets its own hostname (<subdomain>-mini.aza.systems) rather than a
-- path on a shared host, so that one mini app cannot read another's localStorage,
-- cookies, IndexedDB or service workers. That isolation is the whole reason for the
-- column; it is not cosmetic.
--
-- Additive and rollout-safe: every column is nullable or defaulted, so the previous
-- backend keeps working against this schema during the deploy window.

ALTER TABLE mini_apps
    ADD COLUMN IF NOT EXISTS hosting_mode VARCHAR(20) NOT NULL DEFAULT 'EXTERNAL';

-- Base DNS label, without the "-mini" affix that is applied when building the URL.
-- Lowercase alphanumeric + hyphen. NULL for EXTERNAL apps. Note mini app ids allow
-- underscores (e.g. "bolt_ghana") which are not valid in hostnames, so this is derived
-- and stored separately rather than reusing id.
ALTER TABLE mini_apps
    ADD COLUMN IF NOT EXISTS subdomain VARCHAR(63);

-- Version currently symlinked to <appId>/current and served to users.
ALTER TABLE mini_apps
    ADD COLUMN IF NOT EXISTS bundle_version VARCHAR(40);

-- Uploaded but not yet approved. Served at <subdomain>-mini-preview.aza.systems for
-- reviewers, and promoted to bundle_version on approval.
ALTER TABLE mini_apps
    ADD COLUMN IF NOT EXISTS pending_bundle_version VARCHAR(40);

ALTER TABLE mini_apps
    ADD COLUMN IF NOT EXISTS bundle_size_bytes BIGINT;

ALTER TABLE mini_apps
    ADD COLUMN IF NOT EXISTS bundle_uploaded_at TIMESTAMP;

-- One app per subdomain. Partial so the many EXTERNAL apps (subdomain IS NULL) do not
-- collide. mini_apps is small (one row per submission), so a plain index is fine here —
-- no CONCURRENTLY needed, and this stays inside Flyway's transaction.
CREATE UNIQUE INDEX IF NOT EXISTS ux_mini_apps_subdomain
    ON mini_apps (subdomain)
    WHERE subdomain IS NOT NULL;

-- Deliberately no CHECK constraint on hosting_mode: V34 and V38 both had to drop enum
-- CHECK constraints that blocked adding new values. The enum is validated in Java.
