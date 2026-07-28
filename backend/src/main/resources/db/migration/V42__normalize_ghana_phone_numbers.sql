-- Repairs phone numbers stored with a redundant trunk zero after the country
-- code (e.g. '+2330241234567'), produced by clients that concatenated '+233'
-- with a 0-prefixed local number. Those rows could never receive SMS (Arkesel
-- rejects 13-digit recipients) and will not match the normalized lookups the
-- backend now performs.
--
-- Guard: skip any row whose corrected number would collide with an existing
-- account (phone_number is UNIQUE); those few need manual review instead of a
-- failed deployment.
UPDATE users u
SET phone_number = '+233' || substring(u.phone_number FROM 6)
WHERE u.phone_number LIKE '+2330%'
  AND length(u.phone_number) = 14
  AND NOT EXISTS (
      SELECT 1 FROM users v
      WHERE v.phone_number = '+233' || substring(u.phone_number FROM 6)
  );
