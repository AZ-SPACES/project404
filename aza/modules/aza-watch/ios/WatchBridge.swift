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

    /// Fires when the watch is paired or unpaired, or the watch app installed or
    /// removed. JS re-reads `isWatchAppAvailable` and resends.
    var onWatchStateChanged: (() -> Void)?

    /// Set by the Expo module. JS owns the API client, so a command from the
    /// wrist has to travel through it; the reply comes back via `resolve`.
    var onCommand: (([String: Any]) -> Void)?

    /// Reply handlers for commands JS has not answered yet, keyed by command id.
    private var pendingCommands: [String: ([String: Any]) -> Void] = [:]

    /// WatchConnectivity abandons a reply handler that is never called, and the
    /// watch would sit on a spinner until it gave up with an opaque error. If JS
    /// has not answered by now, say so in words the wrist can render.
    private static let commandTimeout: TimeInterval = 25

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

    /// Wipe the wrist.
    ///
    /// Sent as an application context rather than a message because a sign-out
    /// has to survive the watch being out of range: a message would simply fail
    /// and leave the balance on screen, while a context is redelivered whenever
    /// the watch next comes back. The cached snapshot is dropped in the same
    /// breath so a refresh request arriving afterwards cannot replay it.
    func clear() throws {
        lock.lock()
        latest = nil
        lock.unlock()

        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        guard session.isPaired, session.isWatchAppInstalled else { return }

        try session.updateApplicationContext(["cleared": true])
    }
}

// MARK: - Commands

extension WatchBridge {
    /// Answer a command the watch is blocked on. Safe to call for an unknown or
    /// already-answered id: a reply handler may be invoked only once, and the
    /// timeout may have got there first.
    func resolve(commandId: String, ok: Bool, message: String) {
        lock.lock()
        let handler = pendingCommands.removeValue(forKey: commandId)
        lock.unlock()
        handler?(["ok": ok, "message": message])
    }

    fileprivate func beginCommand(
        _ message: [String: Any],
        reply: @escaping ([String: Any]) -> Void
    ) {
        guard let commandId = message["commandId"] as? String,
              let action = message["action"] as? String else {
            reply(["ok": false, "message": "Malformed request"])
            return
        }

        lock.lock()
        pendingCommands[commandId] = reply
        lock.unlock()

        DispatchQueue.main.asyncAfter(deadline: .now() + Self.commandTimeout) { [weak self] in
            self?.resolve(commandId: commandId, ok: false, message: "No response from phone")
        }

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard let onCommand = self.onCommand else {
                // The JS layer is not up. Fail now rather than making the wrist
                // wait out the full timeout for an answer that cannot come.
                self.resolve(commandId: commandId, ok: false, message: "Open Aza on your phone")
                return
            }
            onCommand([
                "commandId": commandId,
                "action": action,
                "id": message["id"] as? String ?? "",
            ])
        }
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
        // Availability is only knowable once the session is up, and JS asked
        // before that. Nudge it to re-evaluate.
        DispatchQueue.main.async { [weak self] in self?.onWatchStateChanged?() }
    }

    // Both are required on iOS (not watchOS) and fire when the user switches to a
    // different paired watch. Reactivating binds the session to the new device;
    // without it the link silently dies after a watch swap.
    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    /// Pairing or watch-app installation changed. Whatever JS last built was
    /// dropped on the floor if no watch was available at the time, so ask it to
    /// send again rather than waiting for the balance to happen to move.
    func sessionWatchStateDidChange(_ session: WCSession) {
        DispatchQueue.main.async { [weak self] in self?.onWatchStateChanged?() }
    }

    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        if message["type"] as? String == "command" {
            beginCommand(message, reply: replyHandler)
            return
        }

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
