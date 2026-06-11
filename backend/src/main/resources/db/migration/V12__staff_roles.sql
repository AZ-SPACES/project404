-- V12: Staff roles — back-office privilege as data with grant/revoke history.
-- Staff are regular AZA users; privilege lives here, not on the users row.
-- Revocation is an UPDATE (revoked_at/revoked_by), never a DELETE, so the
-- trail of who held which power when is permanent (BoG / partner-bank audits).

CREATE TABLE staff_roles (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(32) NOT NULL,  -- 'SUPPORT' | 'COMPLIANCE' | 'FINANCE' | 'ADMIN'
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMP NOT NULL DEFAULT now(),
    revoked_at TIMESTAMP,
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_staff_roles_user_active ON staff_roles (user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX uq_staff_roles_user_role_active ON staff_roles (user_id, role) WHERE revoked_at IS NULL;

-- Migrate legacy enum admins. users.role becomes a vestigial bootstrap flag
-- after this; authorization reads staff_roles.
INSERT INTO staff_roles (user_id, role)
SELECT id, 'ADMIN' FROM users WHERE role = 'ADMIN';
