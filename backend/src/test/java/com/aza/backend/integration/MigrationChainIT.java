package com.aza.backend.integration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Runs the real Flyway chain against a real PostgreSQL, then asserts Hibernate agrees
 * with what it produced.
 *
 * <p>Booting this context is itself the strongest assertion in the class. The
 * integration profile sets {@code ddl-auto=validate} with {@code baseline-on-migrate=false},
 * so the application only starts if every migration from V1 applies cleanly to an empty
 * database <em>and</em> every entity mapping matches the resulting schema. A missing
 * column, a stale CHECK constraint, or a migration that alters a table nothing creates —
 * the V50, V51 and V57 defects — all fail here instead of on the production droplet.
 */
class MigrationChainIT extends PostgresIntegrationTest {

    @Autowired DataSource dataSource;
    @Autowired Flyway flyway;

    @Test
    void everyMigrationApplied_inOrder_andNoneFailed() throws Exception {
        MigrationInfo[] applied = flyway.info().applied();

        assertTrue(applied.length > 0, "Flyway ran no migrations — the chain did not execute");

        List<String> failed = Arrays.stream(applied)
                .filter(m -> m.getState() != null && m.getState().isFailed())
                .map(m -> m.getVersion() + " " + m.getDescription())
                .toList();
        assertTrue(failed.isEmpty(), "Migrations in a failed state: " + failed);

        // Versions must be strictly ascending. An out-of-order or duplicated version is
        // how two branches silently collide on the same number.
        List<String> versions = Arrays.stream(applied)
                .filter(m -> m.getVersion() != null)
                .map(m -> m.getVersion().getVersion())
                .toList();
        for (int i = 1; i < versions.size(); i++) {
            assertTrue(
                    compareVersions(versions.get(i - 1), versions.get(i)) < 0,
                    "Migration versions are not strictly ascending: "
                            + versions.get(i - 1) + " then " + versions.get(i));
        }
    }

    @Test
    void pendingMigrationsAreEmptyAfterStartup() {
        // Anything still pending means the application booted against a schema that is
        // not the one the repository describes.
        MigrationInfo[] pending = flyway.info().pending();
        List<String> names = Arrays.stream(pending)
                .map(m -> m.getVersion() + " " + m.getDescription())
                .toList();
        assertTrue(names.isEmpty(), "Migrations left pending after startup: " + names);
    }

    @Test
    void coreLedgerTablesExistWithTheConstraintsTheMoneyPathRelies_on() throws Exception {
        try (Connection c = dataSource.getConnection()) {
            assertTableExists(c, "users");
            assertTableExists(c, "wallets");
            assertTableExists(c, "transactions");
            assertTableExists(c, "merchants");
            assertTableExists(c, "agents");

            // One wallet per (user, type) — the constraint that makes "the user's personal
            // wallet" a well-defined row rather than a query that might return two.
            assertTrue(hasUniqueOn(c, "wallets", List.of("user_id", "type")),
                    "wallets is missing its UNIQUE (user_id, type) constraint");

            // Idempotency keys must be unique, or a replayed request creates a second
            // transaction instead of returning the first.
            assertTrue(hasUniqueOn(c, "transactions", List.of("idempotency_key")),
                    "transactions is missing its UNIQUE (idempotency_key) constraint");
        }
    }

    @Test
    void moneyColumnsAreExactDecimals_neverFloatingPoint() throws Exception {
        // Invariant 5, asserted at the schema rather than in Java. A float column would
        // silently lose fractions of a pesewa no matter how careful the service layer is.
        String sql = """
                SELECT table_name, column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND (column_name LIKE '%amount%'
                       OR column_name LIKE '%balance%'
                       OR column_name IN ('fee_amount', 'used_amount'))
                  -- A boolean cannot hold a monetary value, so a name match on one is a
                  -- false positive by construction, not a column to fix. The case that
                  -- forced this: merchant_notification_preferences.email_low_balance is
                  -- one of eight email_* notification toggles, and that table's actual
                  -- money column, low_balance_threshold, is NUMERIC(15,2) and passes.
                  AND data_type <> 'boolean'
                """;
        List<String> offenders = new ArrayList<>();
        try (Connection c = dataSource.getConnection();
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String type = rs.getString("data_type");
                if (!type.equals("numeric")) {
                    offenders.add(rs.getString("table_name") + "." + rs.getString("column_name")
                            + " is " + type);
                }
            }
        }
        assertTrue(offenders.isEmpty(), "Money columns must be NUMERIC: " + offenders);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static int compareVersions(String a, String b) {
        String[] pa = a.split("\\.");
        String[] pb = b.split("\\.");
        for (int i = 0; i < Math.max(pa.length, pb.length); i++) {
            long va = i < pa.length ? Long.parseLong(pa[i]) : 0;
            long vb = i < pb.length ? Long.parseLong(pb[i]) : 0;
            if (va != vb) return Long.compare(va, vb);
        }
        return 0;
    }

    private void assertTableExists(Connection c, String table) throws Exception {
        try (ResultSet rs = c.getMetaData().getTables(null, "public", table, null)) {
            assertTrue(rs.next(), "Expected table " + table + " to exist after migration");
        }
    }

    private boolean hasUniqueOn(Connection c, String table, List<String> columns) throws Exception {
        String sql = """
                SELECT c.conname, pg_get_constraintdef(c.oid) AS def
                FROM pg_constraint c
                JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = ? AND c.contype IN ('u', 'p')
                """;
        try (var ps = c.prepareStatement(sql)) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String def = rs.getString("def").toLowerCase();
                    if (columns.stream().allMatch(def::contains)) return true;
                }
            }
        }
        // A unique *index* satisfies the same requirement without being a constraint row.
        try (var ps = c.prepareStatement(
                "SELECT indexdef FROM pg_indexes WHERE tablename = ?")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String def = rs.getString("indexdef").toLowerCase();
                    if (def.contains("unique") && columns.stream().allMatch(def::contains)) return true;
                }
            }
        }
        return false;
    }
}
