package com.aza.backend.service;

import com.aza.backend.exception.AppException;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Stores and serves developer-uploaded mini app bundles.
 *
 * <p>Layout on disk — shared with nginx via the {@code miniapp_bundles} volume:
 * <pre>
 * /srv/miniapps/&lt;appId&gt;/
 *     20260812T142530Z/     ← an extracted upload
 *     20260811T090012Z/
 *     current  → 20260811T090012Z   (symlink, what users get)
 *     preview  → 20260812T142530Z   (symlink, what reviewers get)
 * </pre>
 *
 * <p>Versions are immutable directories, so approving is a symlink swap and rolling back is
 * the same swap in reverse — neither re-uploads nor rebuilds anything.
 *
 * <p>Every uploaded archive is attacker-controlled. Extraction defends against path traversal
 * (zip slip), decompression bombs, entry floods and symlink escapes; see
 * {@link #extractInto}.
 */
@Service
@Slf4j
public class MiniAppBundleService {

    /**
     * Version directory names — also the sort key for cleanup, so the timestamp stays leading
     * and fixed-width. Millisecond resolution plus a random suffix, because two uploads for the
     * same app can land in the same instant (a double-clicked upload button is enough) and a
     * collision would otherwise fail the second one.
     */
    private static final DateTimeFormatter VERSION_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmssSSS'Z'");

    /** A single DNS label: lowercase alphanumeric, inner hyphens, 1–63 chars. */
    private static final Pattern DNS_LABEL = Pattern.compile("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$");

    private static final java.security.SecureRandom RANDOM = new java.security.SecureRandom();

    /**
     * Extensions that would be executed rather than served if this bundle ever landed on a
     * host with a language runtime enabled. nginx serves these as inert bytes today, so this
     * is defence in depth against a future misconfiguration — and a clear signal to the
     * developer that mini apps are static.
     */
    private static final List<String> FORBIDDEN_EXTENSIONS = List.of(
            ".php", ".php3", ".php4", ".php5", ".phtml", ".jsp", ".jspx", ".asp", ".aspx",
            ".cgi", ".pl", ".py", ".rb", ".sh", ".exe", ".so", ".dll");

    private final Path bundleRoot;
    private final String hostSuffix;
    private final long maxUncompressedBytes;
    private final int maxEntries;
    private final int maxCompressionRatio;
    private final int versionsToKeep;

    public MiniAppBundleService(
            @Value("${aza.miniapps.bundle-root:/srv/miniapps}") String bundleRoot,
            @Value("${aza.miniapps.host-suffix:miniapps.aza.systems}") String hostSuffix,
            @Value("${aza.miniapps.max-uncompressed-bytes:52428800}") long maxUncompressedBytes,
            @Value("${aza.miniapps.max-entries:2000}") int maxEntries,
            @Value("${aza.miniapps.max-compression-ratio:120}") int maxCompressionRatio,
            @Value("${aza.miniapps.versions-to-keep:5}") int versionsToKeep) {
        this.bundleRoot = Paths.get(bundleRoot).toAbsolutePath().normalize();
        this.hostSuffix = hostSuffix;
        this.maxUncompressedBytes = maxUncompressedBytes;
        this.maxEntries = maxEntries;
        this.maxCompressionRatio = maxCompressionRatio;
        this.versionsToKeep = versionsToKeep;
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    @Data
    @Builder
    public static class StoredBundle {
        private String version;
        private long sizeBytes;
        private int fileCount;
        private String previewUrl;
    }

    /**
     * Derives the DNS label a hosted app is served from. Mini app ids are developer-chosen
     * slugs that may contain underscores ({@code bolt_ghana}); hostnames may not, so
     * underscores become hyphens.
     *
     * @throws AppException if the id cannot produce a valid, non-reserved DNS label
     */
    public String deriveSubdomain(String appId) {
        String label = appId.toLowerCase(Locale.ROOT).replace('_', '-');
        if (!DNS_LABEL.matcher(label).matches()) {
            throw new AppException("INVALID_APP_ID",
                    "App id \"" + appId + "\" cannot be used as a hostname. Use 1–63 characters: "
                            + "letters, digits, underscore or hyphen, starting and ending with a letter or digit.",
                    HttpStatus.BAD_REQUEST);
        }
        // "-preview" is how reviewers reach an unapproved bundle, so an app may not claim it.
        if (label.endsWith("-preview")) {
            throw new AppException("RESERVED_APP_ID",
                    "App ids ending in \"-preview\" are reserved.", HttpStatus.BAD_REQUEST);
        }
        return label;
    }

    /** Live URL for a hosted app. Trailing slash matters: bundles are served from the root. */
    public String publicUrl(String subdomain) {
        return "https://" + subdomain + "." + hostSuffix + "/";
    }

    /** Where a reviewer sees an uploaded-but-unapproved bundle. */
    public String previewUrl(String subdomain) {
        return "https://" + subdomain + "-preview." + hostSuffix + "/";
    }

    /**
     * Validates and extracts an uploaded zip into a fresh immutable version directory, then
     * points {@code preview} at it. Does not touch {@code current} — the bundle is not served
     * to users until {@link #promote} runs on approval.
     */
    public StoredBundle store(String appId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException("EMPTY_BUNDLE", "No bundle file was uploaded.", HttpStatus.BAD_REQUEST);
        }

        Path appDir = resolveAppDir(appId);
        String version = newVersion(appDir);
        // Extract to a staging directory first so a failed or malicious upload never leaves a
        // half-written version behind for the symlink to find.
        Path staging = appDir.resolve(".staging-" + version);
        Path target = appDir.resolve(version);

        try {
            Files.createDirectories(staging);
            ExtractionResult result = extractInto(file, staging);
            Path root = locateWebRoot(staging);

            // Developers overwhelmingly zip the folder rather than its contents, so a bundle
            // whose index.html sits one level down is normal input, not an error. Lift it.
            if (!root.equals(staging)) {
                Path lifted = appDir.resolve(".lifted-" + version);
                Files.move(root, lifted, StandardCopyOption.ATOMIC_MOVE);
                deleteRecursively(staging);
                Files.move(lifted, target, StandardCopyOption.ATOMIC_MOVE);
            } else {
                Files.move(staging, target, StandardCopyOption.ATOMIC_MOVE);
            }

            linkAtomically(appDir.resolve("preview"), version);
            pruneOldVersions(appDir);

            log.info("Stored mini app bundle {} v{} — {} files, {} bytes",
                    appId, version, result.fileCount, result.totalBytes);

            return StoredBundle.builder()
                    .version(version)
                    .sizeBytes(result.totalBytes)
                    .fileCount(result.fileCount)
                    .previewUrl(previewUrl(deriveSubdomain(appId)))
                    .build();

        } catch (AppException e) {
            quietlyDelete(staging);
            throw e;
        } catch (IOException e) {
            quietlyDelete(staging);
            log.error("Failed to store mini app bundle for {}", appId, e);
            throw new AppException("BUNDLE_STORAGE_FAILED",
                    "Could not store the uploaded bundle. Please try again.",
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Builds a version identifier that does not already exist for this app. The random suffix
     * only appears on an actual collision, so the common case stays readable.
     */
    private String newVersion(Path appDir) {
        String base = VERSION_FORMAT.format(LocalDateTime.now());
        String candidate = base;
        for (int attempt = 0; Files.exists(appDir.resolve(candidate)); attempt++) {
            if (attempt > 20) {
                throw new AppException("BUNDLE_VERSION_COLLISION",
                        "Could not allocate a bundle version. Please retry.",
                        HttpStatus.INTERNAL_SERVER_ERROR);
            }
            candidate = base + "-" + Long.toString(RANDOM.nextInt(0x10000), 16);
        }
        return candidate;
    }

    /** Points {@code current} at an already-extracted version. Called on admin approval. */
    public void promote(String appId, String version) {
        Path appDir = resolveAppDir(appId);
        Path versionDir = appDir.resolve(version);
        if (!Files.isDirectory(versionDir)) {
            throw new AppException("BUNDLE_NOT_FOUND",
                    "Bundle version " + version + " is no longer on disk. Ask the developer to re-upload.",
                    HttpStatus.CONFLICT);
        }
        try {
            linkAtomically(appDir.resolve("current"), version);
            log.info("Promoted mini app {} to bundle version {}", appId, version);
        } catch (IOException e) {
            log.error("Failed to promote mini app {} to {}", appId, version, e);
            throw new AppException("BUNDLE_PROMOTE_FAILED",
                    "Could not publish the bundle.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /** Stops serving an app without deleting its bundles, so it can be restored by promoting again. */
    public void unpublish(String appId) {
        try {
            Files.deleteIfExists(resolveAppDir(appId).resolve("current"));
            log.info("Unpublished mini app {}", appId);
        } catch (IOException e) {
            log.warn("Failed to unpublish mini app {}: {}", appId, e.getMessage());
        }
    }

    // ── Extraction ─────────────────────────────────────────────────────────────

    private record ExtractionResult(long totalBytes, int fileCount) {}

    /**
     * Streams the archive into {@code destination}, enforcing every limit as it goes rather
     * than after the fact — a decompression bomb must be stopped mid-write, not measured once
     * it has already filled the disk.
     *
     * <p>Guards, in order of what they stop:
     * <ul>
     *   <li><b>Zip slip</b> — an entry named {@code ../../etc/cron.d/x} escaping the target
     *       directory. Each entry is resolved, normalised and checked to still be under
     *       {@code destination}.</li>
     *   <li><b>Decompression bombs</b> — a few KB expanding to gigabytes. Bounded both by a
     *       running total and a per-entry compression ratio.</li>
     *   <li><b>Entry floods</b> — hundreds of thousands of tiny files exhausting inodes.</li>
     *   <li><b>Executable payloads</b> — server-side script extensions, rejected outright.</li>
     * </ul>
     */
    private ExtractionResult extractInto(MultipartFile file, Path destination) throws IOException {
        long totalBytes = 0;
        int fileCount = 0;

        try (ZipInputStream zip = new ZipInputStream(file.getInputStream())) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName();

                if (++fileCount > maxEntries) {
                    throw new AppException("BUNDLE_TOO_MANY_FILES",
                            "Bundle contains more than " + maxEntries + " files.", HttpStatus.BAD_REQUEST);
                }

                // Zip slip: resolve then verify containment. Checking for ".." textually is not
                // enough — encodings and absolute paths get through. Containment is the check.
                Path resolved = destination.resolve(name).normalize();
                if (!resolved.startsWith(destination)) {
                    log.warn("Rejected mini app bundle: entry escapes target directory ({})", name);
                    throw new AppException("BUNDLE_UNSAFE_PATH",
                            "Bundle contains an unsafe file path: " + name, HttpStatus.BAD_REQUEST);
                }

                if (entry.isDirectory()) {
                    Files.createDirectories(resolved);
                    zip.closeEntry();
                    continue;
                }

                String lower = name.toLowerCase(Locale.ROOT);
                for (String ext : FORBIDDEN_EXTENSIONS) {
                    if (lower.endsWith(ext)) {
                        throw new AppException("BUNDLE_FORBIDDEN_FILE",
                                "Mini apps are static sites and cannot contain server-side code. "
                                        + "Remove: " + name, HttpStatus.BAD_REQUEST);
                    }
                }

                Files.createDirectories(resolved.getParent());
                long written = copyBounded(zip, resolved, totalBytes);
                totalBytes += written;

                // Per-entry bomb check. A tiny compressed entry that explodes is the signature;
                // entries under 1 MB expanded are too small to matter whatever their ratio.
                long compressed = entry.getCompressedSize();
                if (compressed > 0 && written > 1_048_576 && written / compressed > maxCompressionRatio) {
                    throw new AppException("BUNDLE_SUSPICIOUS_COMPRESSION",
                            "Bundle entry " + name + " has an implausible compression ratio and was rejected.",
                            HttpStatus.BAD_REQUEST);
                }

                zip.closeEntry();
            }
        }

        if (fileCount == 0) {
            throw new AppException("BUNDLE_EMPTY",
                    "The uploaded zip is empty.", HttpStatus.BAD_REQUEST);
        }
        return new ExtractionResult(totalBytes, fileCount);
    }

    /**
     * Copies one entry, aborting the moment the running total would exceed the cap. The
     * declared entry size in a zip header is attacker-supplied, so the only trustworthy
     * measure is what we actually write.
     */
    private long copyBounded(InputStream in, Path target, long alreadyWritten) throws IOException {
        byte[] buffer = new byte[8192];
        long written = 0;
        try (var out = Files.newOutputStream(target, StandardOpenOption.CREATE_NEW,
                StandardOpenOption.WRITE)) {
            int read;
            while ((read = in.read(buffer)) != -1) {
                written += read;
                if (alreadyWritten + written > maxUncompressedBytes) {
                    throw new AppException("BUNDLE_TOO_LARGE",
                            "Bundle exceeds the " + (maxUncompressedBytes / 1_048_576)
                                    + " MB uncompressed limit.", HttpStatus.PAYLOAD_TOO_LARGE);
                }
                out.write(buffer, 0, read);
            }
        }
        return written;
    }

    /**
     * Finds the directory holding {@code index.html} — either the extraction root, or a single
     * top-level folder inside it (the shape you get from zipping {@code dist/} rather than its
     * contents).
     */
    private Path locateWebRoot(Path staging) throws IOException {
        if (Files.isRegularFile(staging.resolve("index.html"))) {
            return staging;
        }
        try (var entries = Files.list(staging)) {
            List<Path> children = entries.toList();
            if (children.size() == 1 && Files.isDirectory(children.get(0))
                    && Files.isRegularFile(children.get(0).resolve("index.html"))) {
                return children.get(0);
            }
        }
        throw new AppException("BUNDLE_NO_INDEX",
                "No index.html found at the root of the bundle. Zip the contents of your build "
                        + "output (e.g. dist/), not the project folder.",
                HttpStatus.BAD_REQUEST);
    }

    // ── Filesystem helpers ─────────────────────────────────────────────────────

    /**
     * Resolves an app's directory, re-validating the id. The id reaches here from a path
     * variable, so it is treated as untrusted even though callers have already loaded the
     * entity by it.
     */
    private Path resolveAppDir(String appId) {
        Path dir = bundleRoot.resolve(deriveSubdomain(appId)).normalize();
        if (!dir.startsWith(bundleRoot)) {
            throw new AppException("INVALID_APP_ID", "Invalid app id.", HttpStatus.BAD_REQUEST);
        }
        return dir;
    }

    /**
     * Repoints a symlink without a window where it is missing: create it under a temporary
     * name, then atomically rename over the existing one. A user loading the app during a
     * promote sees either the old version or the new one, never a 404.
     */
    private void linkAtomically(Path link, String targetVersion) throws IOException {
        Path temp = link.resolveSibling(link.getFileName() + ".tmp-" + System.nanoTime());
        Files.createSymbolicLink(temp, Paths.get(targetVersion));
        Files.move(temp, link, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }

    /**
     * Keeps the most recent versions and deletes the rest, preserving whatever {@code current}
     * and {@code preview} point at even if they have aged out — rollback targets must survive.
     */
    private void pruneOldVersions(Path appDir) {
        try {
            String live = readLinkTarget(appDir.resolve("current"));
            String preview = readLinkTarget(appDir.resolve("preview"));

            List<Path> versions;
            try (var entries = Files.list(appDir)) {
                versions = entries
                        .filter(Files::isDirectory)
                        .filter(p -> !Files.isSymbolicLink(p))
                        .sorted(Comparator.comparing((Path p) -> p.getFileName().toString()).reversed())
                        .toList();
            }

            versions.stream()
                    .skip(versionsToKeep)
                    .filter(p -> !p.getFileName().toString().equals(live))
                    .filter(p -> !p.getFileName().toString().equals(preview))
                    .forEach(this::quietlyDelete);
        } catch (IOException e) {
            // Cleanup is housekeeping; a failure here must not fail the developer's upload.
            log.warn("Could not prune old bundle versions in {}: {}", appDir, e.getMessage());
        }
    }

    private String readLinkTarget(Path link) {
        try {
            return Files.isSymbolicLink(link) ? Files.readSymbolicLink(link).getFileName().toString() : null;
        } catch (IOException e) {
            return null;
        }
    }

    private void quietlyDelete(Path path) {
        try {
            deleteRecursively(path);
        } catch (IOException e) {
            log.warn("Could not delete {}: {}", path, e.getMessage());
        }
    }

    private void deleteRecursively(Path path) throws IOException {
        if (!Files.exists(path, LinkOption.NOFOLLOW_LINKS)) return;
        try (var walk = Files.walk(path)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException e) {
                    log.warn("Could not delete {}: {}", p, e.getMessage());
                }
            });
        }
    }
}
