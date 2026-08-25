import Foundation
import WatchConnectivity
import WatchKit
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

    /// True between a user-initiated refresh and its answer, so the UI can say
    /// "asking" instead of appearing to ignore the gesture.
    @Published private(set) var isRefreshing = false

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
    /// Only reaches a phone that is awake with the app running. When it cannot,
    /// the cached context stays on screen — which is exactly why the UI always
    /// shows how old that value is, and why an unreachable phone is reported
    /// rather than silently swallowed.
    @discardableResult
    func requestRefresh() -> Bool {
        let session = WCSession.default
        guard session.activationState == .activated, session.isReachable else { return false }

        isRefreshing = true
        session.sendMessage(
            ["type": "refresh"],
            replyHandler: { [weak self] reply in
                self?.apply(reply, source: .refresh)
                DispatchQueue.main.async { self?.isRefreshing = false }
            },
            errorHandler: { [weak self] error in
                self?.log.error("refresh request failed: \(error.localizedDescription)")
                DispatchQueue.main.async { self?.isRefreshing = false }
            }
        )
        return true
    }

    /// What came back from a command the wrist asked the phone to perform.
    struct CommandOutcome {
        let ok: Bool
        /// Written for a 41mm screen by whoever produced it — rendered verbatim.
        let message: String
    }

    /// Ask the phone to perform an action.
    ///
    /// The watch is a keyboard here and nothing more: it holds no token, and the
    /// phone re-checks authorisation with the server before anything happens.
    /// Only actions that fail closed are reachable — see `WatchCommandAction` in
    /// modules/aza-watch/index.ts for why that list is what it is.
    func run(_ action: String, id: String = "") async -> CommandOutcome {
        let session = WCSession.default
        guard session.activationState == .activated, session.isReachable else {
            return CommandOutcome(ok: false, message: "Phone not reachable")
        }

        let outcome: CommandOutcome = await withCheckedContinuation { continuation in
            session.sendMessage(
                [
                    "type": "command",
                    "commandId": UUID().uuidString,
                    "action": action,
                    "id": id,
                ],
                replyHandler: { reply in
                    continuation.resume(returning: CommandOutcome(
                        ok: reply["ok"] as? Bool ?? false,
                        message: reply["message"] as? String ?? "Done"
                    ))
                },
                errorHandler: { [weak self] error in
                    self?.log.error("command failed: \(error.localizedDescription)")
                    continuation.resume(returning: CommandOutcome(
                        ok: false, message: "Phone not reachable"
                    ))
                }
            )
        }

        WKInterfaceDevice.current().play(outcome.ok ? .success : .failure)

        // The phone refetches and pushes after a successful command, but that
        // arrives on WatchConnectivity's schedule. Ask, so the screen the user is
        // looking at reflects what they just did.
        if outcome.ok { requestRefresh() }

        return outcome
    }

    private enum Source {
        /// The user asked, so confirming with a haptic is wanted feedback.
        case refresh
        /// iOS delivered it on its own schedule; a tap on the wrist would be noise.
        case push
    }

    /// Snapshots cross as a JSON string, not a nested dictionary.
    ///
    /// WatchConnectivity payloads must be property-list types, so a nested
    /// Codable struct would have to be flattened and rebuilt by hand on both
    /// sides. One encoded string keeps a single schema, defined once in
    /// `WalletSnapshot`, and makes a version mismatch a decode error we log
    /// rather than silently missing fields.
    private func apply(_ payload: [String: Any], source: Source) {
        // Sign-out travels the same channel. Checked first: a logout must win
        // over any snapshot still sitting in the same context.
        if payload["cleared"] as? Bool == true {
            SnapshotStore.clear()
            DispatchQueue.main.async { self.snapshot = .placeholder }
            return
        }

        guard let raw = payload["snapshot"] as? String,
              let data = raw.data(using: .utf8) else { return }
        do {
            let decoded = try JSONDecoder.snapshot.decode(WalletSnapshot.self, from: data)
            SnapshotStore.save(decoded)
            DispatchQueue.main.async {
                let changed = decoded != self.snapshot
                self.snapshot = decoded
                if source == .refresh, changed {
                    WKInterfaceDevice.current().play(.success)
                }
            }
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
        apply(session.receivedApplicationContext, source: .push)
        DispatchQueue.main.async { self.isReachable = session.isReachable }
    }

    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        apply(context, source: .push)
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.isReachable = session.isReachable }
    }
}
