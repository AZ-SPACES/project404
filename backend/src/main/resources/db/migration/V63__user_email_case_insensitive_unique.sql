-- users.email is UNIQUE, but Postgres compares it byte-for-byte, so "Kofi@Gmail.com" and
-- "kofi@gmail.com" are two different rows to the database and one person can hold two
-- accounts on one mailbox. Nothing about an email address makes case meaningful: mail
-- delivers to the same inbox either way, and every login and recovery lookup in the
-- backend searches with email.toLowerCase(), so a mixed-case row is also a row its owner
-- cannot log into by email.
--
-- Until now the invariant was held by convention: signup lowercases before inserting, and
-- so does the verified email-change flow. That convention had a hole -- PUT /users/me
-- wrote request.getEmail() through unchanged -- and conventions acquire new holes every
-- time someone adds a write path. This moves the rule into the database, where a future
-- code path cannot forget it.
--
-- The existing users_email_key stays. It is what the equality lookups in findByEmail
-- actually use; this index is a constraint, not a lookup path.

-- If case-variant duplicates already exist, this migration stops the deploy on purpose.
-- Each pair is two accounts -- with two wallets, two ledgers, two KYC records -- for one
-- person, so which one survives is a support and compliance decision, not something a
-- migration should pick. The message names the addresses so that work can start.
DO $$
DECLARE
    dupes TEXT;
BEGIN
    SELECT string_agg(email_lower, ', ')
      INTO dupes
      FROM (
          SELECT lower(email) AS email_lower
            FROM users
           GROUP BY lower(email)
          HAVING COUNT(*) > 1
      ) d;

    IF dupes IS NOT NULL THEN
        RAISE EXCEPTION
            'Multiple accounts differ only by the case of their email address: %. Each is one person holding two accounts, with separate wallets and KYC. Merge or close the duplicates before deploying; do not delete rows to clear this.', dupes;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key
    ON users (lower(email));
