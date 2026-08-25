import Foundation
import os

/// Persists the most recent snapshot in the App Group container.
///
/// WatchConnectivity's `receivedApplicationContext` already survives relaunch,
/// so this looks redundant — it is not. A WidgetKit complication runs in its own
/// process and cannot read the app's `WCSession`; the shared container is the
/// only place both the watch app and a future complication can see. Writing here
/// now keeps the complication a UI addition later rather than a re-architecture.
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
        } catch {
            log.error("failed to persist snapshot: \(error.localizedDescription)")
        }
    }
}

extension JSONDecoder {
    /// ISO-8601 on the wire: the phone side is JavaScript, where `toISOString()`
    /// is the only date format that survives the bridge unambiguously.
    static let snapshot: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}

extension JSONEncoder {
    static let snapshot: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()
}
