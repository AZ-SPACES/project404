package com.aza.backend.service;

import com.aza.backend.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Every mini app bundle is an archive uploaded by an untrusted third party, so the extractor
 * is a genuine attack surface: it writes attacker-named files to a path nginx then serves.
 * These tests cover the four ways that goes wrong — escaping the target directory, filling
 * the disk, exhausting inodes, and smuggling executable content — plus the forgiving cases
 * that keep honest developers out of the support queue.
 */
class MiniAppBundleServiceTest {

    @TempDir
    Path bundleRoot;

    private MiniAppBundleService service;

    @BeforeEach
    void setUp() {
        service = new MiniAppBundleService(
                bundleRoot.toString(),
                "miniapps.aza.systems",
                1_048_576,   // 1 MB uncompressed cap, small enough to trip in a test
                50,          // 50 entries
                120,         // compression ratio
                3);          // versions kept
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static MockMultipartFile zipOf(Map<String, byte[]> entries) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            for (Map.Entry<String, byte[]> e : entries.entrySet()) {
                zip.putNextEntry(new ZipEntry(e.getKey()));
                zip.write(e.getValue());
                zip.closeEntry();
            }
        }
        return new MockMultipartFile("file", "bundle.zip", "application/zip", out.toByteArray());
    }

    private static Map<String, byte[]> validBundle() {
        Map<String, byte[]> files = new LinkedHashMap<>();
        files.put("index.html", "<!doctype html><title>hi</title>".getBytes(StandardCharsets.UTF_8));
        files.put("assets/app.js", "console.log(1)".getBytes(StandardCharsets.UTF_8));
        return files;
    }

    // ── Happy paths ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("stores a valid bundle and points preview at it without publishing")
    void storesValidBundle() throws IOException {
        MiniAppBundleService.StoredBundle stored = service.store("my_app", zipOf(validBundle()));

        Path appDir = bundleRoot.resolve("my-app");
        assertTrue(Files.isRegularFile(appDir.resolve(stored.getVersion()).resolve("index.html")));
        assertTrue(Files.isSymbolicLink(appDir.resolve("preview")));
        assertEquals(2, stored.getFileCount());

        // Crucially: uploading must not publish. Users keep seeing whatever was already live.
        assertFalse(Files.exists(appDir.resolve("current")),
                "upload must not create the current symlink — only approval publishes");
    }

    @Test
    @DisplayName("lifts a bundle whose index.html sits inside one top-level folder")
    void liftsSingleWrapperDirectory() throws IOException {
        // The shape you get from zipping `dist/` rather than its contents. Extremely common,
        // and rejecting it would generate more support load than it prevents mistakes.
        Map<String, byte[]> files = new LinkedHashMap<>();
        files.put("dist/index.html", "<!doctype html>".getBytes(StandardCharsets.UTF_8));
        files.put("dist/assets/app.js", "1".getBytes(StandardCharsets.UTF_8));

        MiniAppBundleService.StoredBundle stored = service.store("my_app", zipOf(files));

        Path versionDir = bundleRoot.resolve("my-app").resolve(stored.getVersion());
        assertTrue(Files.isRegularFile(versionDir.resolve("index.html")),
                "index.html should be lifted to the served root");
        assertFalse(Files.exists(versionDir.resolve("dist")), "wrapper directory should be gone");
    }

    @Test
    @DisplayName("promote swaps current, and rollback is the same swap in reverse")
    void promoteAndRollback() throws IOException {
        String v1 = service.store("my_app", zipOf(validBundle())).getVersion();
        service.promote("my_app", v1);

        Path current = bundleRoot.resolve("my-app").resolve("current");
        assertEquals(v1, Files.readSymbolicLink(current).getFileName().toString());

        Map<String, byte[]> v2Files = new LinkedHashMap<>(validBundle());
        v2Files.put("index.html", "<!doctype html>v2".getBytes(StandardCharsets.UTF_8));
        String v2 = service.store("my_app", zipOf(v2Files)).getVersion();

        // The new upload is staged only — current must still serve v1 until approval.
        assertEquals(v1, Files.readSymbolicLink(current).getFileName().toString());

        service.promote("my_app", v2);
        assertEquals(v2, Files.readSymbolicLink(current).getFileName().toString());

        service.promote("my_app", v1); // rollback
        assertEquals(v1, Files.readSymbolicLink(current).getFileName().toString());
    }

    @Test
    @DisplayName("unpublish stops serving but keeps the bundle for reinstatement")
    void unpublishKeepsBundleOnDisk() throws IOException {
        String v1 = service.store("my_app", zipOf(validBundle())).getVersion();
        service.promote("my_app", v1);

        service.unpublish("my_app");

        assertFalse(Files.exists(bundleRoot.resolve("my-app").resolve("current")));
        assertTrue(Files.isDirectory(bundleRoot.resolve("my-app").resolve(v1)),
                "suspending must not destroy the bundle — reinstating is a promote away");
    }

    // ── Attacks ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("rejects zip slip via ../ traversal")
    void rejectsZipSlip() throws IOException {
        Map<String, byte[]> files = new LinkedHashMap<>(validBundle());
        files.put("../../../../etc/cron.d/pwned", "* * * * * root sh".getBytes(StandardCharsets.UTF_8));

        AppException e = assertThrows(AppException.class, () -> service.store("my_app", zipOf(files)));
        assertEquals("BUNDLE_UNSAFE_PATH", e.getCode());

        // The escape target must not exist anywhere outside the app directory.
        assertFalse(Files.exists(bundleRoot.getParent().resolve("etc")));
    }

    @Test
    @DisplayName("rejects an absolute path entry")
    void rejectsAbsolutePath() throws IOException {
        Map<String, byte[]> files = new LinkedHashMap<>(validBundle());
        files.put("/tmp/aza-pwned.txt", "x".getBytes(StandardCharsets.UTF_8));

        AppException e = assertThrows(AppException.class, () -> service.store("my_app", zipOf(files)));
        assertEquals("BUNDLE_UNSAFE_PATH", e.getCode());
    }

    @Test
    @DisplayName("aborts a decompression bomb mid-write rather than after filling the disk")
    void rejectsDecompressionBomb() throws IOException {
        // 4 MB of zeros compresses to a few KB and blows the 1 MB cap configured above.
        Map<String, byte[]> files = new LinkedHashMap<>(validBundle());
        files.put("bomb.bin", new byte[4 * 1_048_576]);

        AppException e = assertThrows(AppException.class, () -> service.store("my_app", zipOf(files)));
        assertEquals("BUNDLE_TOO_LARGE", e.getCode());
    }

    @Test
    @DisplayName("rejects an entry flood")
    void rejectsTooManyEntries() throws IOException {
        Map<String, byte[]> files = new LinkedHashMap<>(validBundle());
        for (int i = 0; i < 100; i++) {
            files.put("f" + i + ".txt", "x".getBytes(StandardCharsets.UTF_8));
        }

        AppException e = assertThrows(AppException.class, () -> service.store("my_app", zipOf(files)));
        assertEquals("BUNDLE_TOO_MANY_FILES", e.getCode());
    }

    @Test
    @DisplayName("rejects server-side script files")
    void rejectsExecutableContent() throws IOException {
        Map<String, byte[]> files = new LinkedHashMap<>(validBundle());
        files.put("shell.php", "<?php system($_GET['c']); ?>".getBytes(StandardCharsets.UTF_8));

        AppException e = assertThrows(AppException.class, () -> service.store("my_app", zipOf(files)));
        assertEquals("BUNDLE_FORBIDDEN_FILE", e.getCode());
    }

    @Test
    @DisplayName("a rejected upload leaves nothing behind")
    void failedUploadLeavesNoStagingDirectory() throws IOException {
        Map<String, byte[]> files = new LinkedHashMap<>(validBundle());
        files.put("shell.php", "x".getBytes(StandardCharsets.UTF_8));

        assertThrows(AppException.class, () -> service.store("my_app", zipOf(files)));

        Path appDir = bundleRoot.resolve("my-app");
        if (Files.exists(appDir)) {
            try (var entries = Files.list(appDir)) {
                assertEquals(0, entries.count(), "failed upload must not leave a staging directory");
            }
        }
    }

    // ── Validation ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("requires index.html at the served root")
    void rejectsBundleWithoutIndex() throws IOException {
        Map<String, byte[]> files = new LinkedHashMap<>();
        files.put("main.js", "console.log(1)".getBytes(StandardCharsets.UTF_8));

        AppException e = assertThrows(AppException.class, () -> service.store("my_app", zipOf(files)));
        assertEquals("BUNDLE_NO_INDEX", e.getCode());
    }

    @Test
    @DisplayName("rejects an empty upload")
    void rejectsEmptyUpload() {
        MockMultipartFile empty = new MockMultipartFile("file", "b.zip", "application/zip", new byte[0]);
        AppException e = assertThrows(AppException.class, () -> service.store("my_app", empty));
        assertEquals("EMPTY_BUNDLE", e.getCode());
    }

    @Test
    @DisplayName("maps underscores to hyphens so ids remain valid hostnames")
    void derivesDnsSafeSubdomain() {
        assertEquals("bolt-ghana", service.deriveSubdomain("bolt_ghana"));
        assertEquals("https://bolt-ghana.miniapps.aza.systems/", service.publicUrl("bolt-ghana"));
        assertEquals("https://bolt-ghana-preview.miniapps.aza.systems/", service.previewUrl("bolt-ghana"));
    }

    @Test
    @DisplayName("refuses ids that would collide with the preview host")
    void rejectsReservedPreviewSuffix() {
        AppException e = assertThrows(AppException.class, () -> service.deriveSubdomain("my_app_preview"));
        assertEquals("RESERVED_APP_ID", e.getCode());
    }

    @Test
    @DisplayName("prunes old versions but never one that is still linked")
    void prunesOldVersionsKeepingLinked() throws IOException {
        String first = service.store("my_app", zipOf(validBundle())).getVersion();
        service.promote("my_app", first);

        // versionsToKeep = 3; push the promoted version well past the retention window.
        for (int i = 0; i < 5; i++) {
            Map<String, byte[]> files = new LinkedHashMap<>(validBundle());
            files.put("index.html", ("<!doctype html>" + i).getBytes(StandardCharsets.UTF_8));
            service.store("my_app", zipOf(files));
        }

        assertTrue(Files.isDirectory(bundleRoot.resolve("my-app").resolve(first)),
                "the live version must survive pruning or the running app would 404");
    }
}
