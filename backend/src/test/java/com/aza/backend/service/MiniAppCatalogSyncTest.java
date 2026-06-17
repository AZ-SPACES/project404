package com.aza.backend.service;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Guards against drift between the mobile mini app registry
 * (aza/src/features/hub/miniapps/registry.ts) and its server-side mirror
 * ({@link MiniAppCatalog}). The admin dashboard's "All Mini Apps" catalog is
 * built from {@code MiniAppCatalog.ALL}, so an app that's missing — or whose
 * name/category/description has drifted — is mismanaged or invisible in admin.
 * This test fails CI when the two diverge, naming exactly what's wrong.
 *
 * <p>Scope: this only covers the <b>bundled / first-party</b> apps that live in
 * registry.ts and are compiled into the app. Third-party developer apps are
 * DB-backed ({@code MiniApp} entity) and are intentionally NOT in
 * {@code MiniAppCatalog} — they surface in admin via "Developer Submissions",
 * so they don't belong here.
 */
class MiniAppCatalogSyncTest {

    /** A field like {@code id: 'foo'} or {@code name: "Bar"} inside a registry entry. */
    private static String field(String name, String entryBody) {
        Matcher m = Pattern.compile("(?<![A-Za-z])" + name + ":\\s*(['\"])(.*?)\\1").matcher(entryBody);
        return m.find() ? m.group(2) : null;
    }

    private record App(String name, String category, String description) {}

    @Test
    void backendCatalogMatchesMobileRegistry() throws IOException {
        Map<String, App> registry = readMobileRegistry();
        Map<String, App> catalog = new LinkedHashMap<>();
        for (MiniAppCatalog.Entry e : MiniAppCatalog.ALL) {
            catalog.put(e.id(), new App(e.name(), e.category(), e.description()));
        }

        List<String> problems = new ArrayList<>();

        for (String id : new TreeSet<>(registry.keySet())) {
            if (!catalog.containsKey(id)) {
                problems.add("MISSING from MiniAppCatalog.ALL: '" + id + "' " + registry.get(id));
                continue;
            }
            App want = registry.get(id);
            App have = catalog.get(id);
            if (!want.equals(have)) {
                problems.add("FIELD MISMATCH for '" + id + "':\n"
                        + "      registry: " + want + "\n"
                        + "      catalog : " + have);
            }
        }
        for (String id : new TreeSet<>(catalog.keySet())) {
            if (!registry.containsKey(id)) {
                problems.add("EXTRA in MiniAppCatalog.ALL (not in mobile registry): '" + id + "'");
            }
        }

        if (!problems.isEmpty()) {
            fail("MiniAppCatalog is out of sync with aza/src/features/hub/miniapps/registry.ts.\n"
                    + "Update backend MiniAppCatalog.java to mirror it (id, name, category, description):\n  - "
                    + String.join("\n  - ", problems));
        }
    }

    private Map<String, App> readMobileRegistry() throws IOException {
        Path registry = locateRegistry();
        String source = Files.readString(registry, StandardCharsets.UTF_8);

        // Scope parsing to the MINI_APP_REGISTRY array literal so we don't pick up
        // object literals elsewhere in the file (helper bodies, etc.).
        int start = source.indexOf("MINI_APP_REGISTRY");
        assertTrue(start >= 0, "Could not find MINI_APP_REGISTRY in " + registry);
        int arrayOpen = source.indexOf('[', start);
        int arrayClose = source.indexOf("];", arrayOpen);
        assertTrue(arrayOpen >= 0 && arrayClose > arrayOpen,
                "Could not locate the MINI_APP_REGISTRY array bounds — registry format may have changed.");
        String arrayBody = source.substring(arrayOpen, arrayClose);

        Map<String, App> apps = new LinkedHashMap<>();
        // Each entry is a flat object literal: { id: ..., name: ..., icon: require(...), ... }.
        Matcher entries = Pattern.compile("\\{([^{}]+)\\}").matcher(arrayBody);
        while (entries.find()) {
            String body = entries.group(1);
            String id = field("id", body);
            if (id == null) continue; // not a mini-app entry
            apps.put(id, new App(field("name", body), field("category", body), field("description", body)));
        }

        assertTrue(apps.size() >= 2,
                "Parsed too few entries from " + registry + " — the registry format may have changed; "
                        + "update the parser in this test.");
        return apps;
    }

    /**
     * The backend module runs tests with {@code user.dir} at {@code backend/},
     * so the registry sits one level up in the monorepo. Try a couple of likely
     * roots so the test is robust to where it's invoked from.
     */
    private Path locateRegistry() {
        String rel = "aza/src/features/hub/miniapps/registry.ts";
        for (Path base : new Path[]{Path.of(".."), Path.of("."), Path.of("../..")}) {
            Path candidate = base.resolve(rel).normalize();
            if (Files.exists(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException(
                "Could not locate mobile registry at <repo>/" + rel
                        + " (user.dir=" + System.getProperty("user.dir") + ")");
    }
}
