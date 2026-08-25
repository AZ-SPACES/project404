import Foundation
import WatchConnectivity
import os

/// The watch's link to the phone.
///
/// The phone pushes a `WalletSnapshot` as the WatchConnectivity *application
/// context*, which is the right primitive of the three on offer: we only ever
/// want the newest balance rather than a replayed queue of old ones
/// (`transferUserInfo`), and we cannot require the phone to be awake and
/// foregrounded (`sendMessage`). iOS redelivers the latest context on its own
/// schedule and it survives both apps being relaunched.
///
/// The cost of that choice is staleness, which the UI states outright rather
/// than hides.
final class PhoneLink: NSObject, ObservableObject {
    @Published private(set) var snapshot: WalletSnapshot
    @Published private(set) var isReachable = false

    private let log = Logger(subsystem: "com.semekor.k.aza.watch", category: "phone-link")

    override init() {
        // Render the cached value immediately. Waiting for the session to
        // activate would flash an empty balance on every single launch.
        snapshot = SnapshotStore.load() ?? .placeholder
        super.init()

        guard WCSession.isSupported() else {
            log.error("WCSession is unsupported on this device")
            return
        }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    /// Ask the phone to push a fresh snapshot.
    ///
    /// Best effort by design: it only reaches a phone that is awake with the app
    /// running. When it cannot, the cached context stays on screen — which is
    /// exactly why the UI always shows how old that value is.
    func requestRefresh() {
        let session = WCSession.default
        guard session.activationState == .activated, session.isReachable else { return }
        session.sendMessage(
            ["type": "refresh"],
            replyHandler: { [weak self] reply in self?.apply(reply) },
            errorHandler: { [weak self] error in
                self?.log.error("refresh request failed: \(error.localizedDescription)")
            }
        )
    }

    /// Snapshots cross as a JSON string, not a nested dictionary.
    ///
    /// WatchConnectivity payloads must be property-list types, so a nested
    /// Codable struct would have to be flattened and rebuilt by hand on both
    /// sides. One encoded string keeps a single schema, defined once in
    /// `WalletSnapshot`, and makes a version mismatch a decode error we log
    /// rather than silently missing fields.
    private func apply(_ payload: [String: Any]) {
        guard let raw = payload["snapshot"] as? String,
              let data = raw.data(using: .utf8) else { return }
        do {
            let decoded = try JSONDecoder.snapshot.decode(WalletSnapshot.self, from: data)
            SnapshotStore.save(decoded)
            DispatchQueue.main.async { self.snapshot = decoded }
        } catch {
            log.error("undecodable snapshot from phone: \(error.localizedDescription)")
        }
    }
}

extension PhoneLink: WCSessionDelegate {
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            log.error("session activation failed: \(error.localizedDescription)")
        }
        // Pick up whatever arrived while the app was not running.
        apply(session.receivedApplicationContext)
        DispatchQueue.main.async { self.isReachable = session.isReachable }
    }

    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        apply(context)
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.isReachable = session.isReachable }
    }
}
