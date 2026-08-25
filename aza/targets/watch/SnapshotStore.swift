import Foundation
import WidgetKit
import os

/// Persists the most recent snapshot in the App Group container.
///
/// WatchConnectivity's `receivedApplicationContext` already survives relaunch,
/// so this looks redundant — it is not. A WidgetKit complication runs in its own
/// process and cannot read the app's `WCSession`; the shared container is the
/// only place both the watch app and the complication can see.
enum SnapshotStore {
    static let appGroup = "group.com.semekor.k.aza"
    private static let filename = "wallet-snapshot.json"
    private static let log = Logger(subsystem: "com.semekor.k.aza.watch", category: "snapshot")

    private static var url: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent(filename)
    }

    static func load() -> WalletSnapshot? {
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        do {
            return try JSONDecoder.snapshot.decode(WalletSnapshot.self, from: data)
        } catch {
            // A snapshot written by an older build may no longer decode. Treat it
            // as absent rather than crashing the app on launch.
            log.error("discarding undecodable snapshot: \(error.localizedDescription)")
            return nil
        }
    }

    static func save(_ snapshot: WalletSnapshot) {
        guard let url else {
            log.error("app group \(appGroup) unavailable — entitlement missing?")
            return
        }
        do {
            try JSONEncoder.snapshot.encode(snapshot).write(to: url, options: .atomic)
            reloadComplications()
        } catch {
            log.error("failed to persist snapshot: \(error.localizedDescription)")
        }
    }

    /// Called when the phone signs out. The watch has no session of its own to
    /// expire, so without this the last known balance stays legible on the wrist
    /// — and in the complication, which outlives the app process — indefinitely.
    static func clear() {
        guard let url else { return }
        do {
            try FileManager.default.removeItem(at: url)
        } catch CocoaError.fileNoSuchFile {
            // Already absent; nothing to do.
        } catch {
            log.error("failed to clear snapshot: \(error.localizedDescription)")
        }
        reloadComplications()
    }

    /// A complication does not observe the container. Without an explicit reload
    /// the watch face keeps rendering the previous balance until WidgetKit's own
    /// budget happens to come round, which can be hours.
    private static func reloadComplications() {
        WidgetCenter.shared.reloadAllTimelines()
    }
}

/// The phone encodes dates with JavaScript's `toISOString()`, which always emits
/// milliseconds. `JSONDecoder.dateDecodingStrategy = .iso8601` uses
/// `.withInternetDateTime` alone and rejects fractional seconds outright, so the
/// obvious spelling of this fails on every single snapshot. Parse both shapes.
private let fractionalFormatter: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()

private let plainFormatter: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
}()

extension JSONDecoder {
    static let snapshot: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let raw = try decoder.singleValueContainer().decode(String.self)
            if let date = fractionalFormatter.date(from: raw) ?? plainFormatter.date(from: raw) {
                return date
            }
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "unparseable date \(raw)")
            )
        }
        return d
    }()
}

extension JSONEncoder {
    /// Symmetric with the decoder above so a re-encoded snapshot round-trips.
    static let snapshot: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(fractionalFormatter.string(from: date))
        }
        return e
    }()
}
