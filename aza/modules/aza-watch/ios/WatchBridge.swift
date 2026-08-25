import Foundation
import WatchConnectivity
import os

/// Phone half of the watch link.
///
/// Owns the single `WCSession` on the iOS side and keeps the most recent
/// snapshot so a watch asking to refresh gets an answer immediately rather than
/// waiting on a network round trip through JS.
final class WatchBridge: NSObject {
    static let shared = WatchBridge()

    private let log = Logger(subsystem: "com.semekor.k.aza", category: "watch-bridge")
    private let lock = NSLock()
    private var latest: String?

    /// Set by the Expo module so a refresh request from the watch can reach JS,
    /// which owns the API client and the react-query cache.
    var onRefreshRequested: (() -> Void)?

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    /// True only when there is a watch paired *and* the watch app is installed
    /// on it. JS uses this to skip the work of building a snapshot nobody reads.
    var isWatchAppAvailable: Bool {
        guard WCSession.isSupported() else { return false }
        let session = WCSession.default
        return session.isPaired && session.isWatchAppInstalled
    }

    func send(_ json: String) throws {
        lock.lock()
        latest = json
        lock.unlock()

        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else {
            // Cached above, so the next refresh request or activation still has it.
            log.debug("session not activated; snapshot cached only")
            return
        }
        guard session.isPaired, session.isWatchAppInstalled else { return }

        // updateApplicationContext replaces any undelivered previous value, which
        // is what we want: an old balance is never worth delivering late.
        try session.updateApplicationContext(["snapshot": json])
    }
}

extension WatchBridge: WCSessionDelegate {
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            log.error("activation failed: \(error.localizedDescription)")
        }
    }

    // Both are required on iOS (not watchOS) and fire when the user switches to a
    // different paired watch. Reactivating binds the session to the new device;
    // without it the link silently dies after a watch swap.
    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        guard message["type"] as? String == "refresh" else {
            replyHandler([:])
            return
        }

        // Answer with what we already have so the watch never blocks on the
        // network, then ask JS for something fresher. The new value arrives as a
        // normal application context update a moment later.
        lock.lock()
        let cached = latest
        lock.unlock()
        replyHandler(cached.map { ["snapshot": $0] } ?? [:])

        DispatchQueue.main.async { [weak self] in
            self?.onRefreshRequested?()
        }
    }
}
