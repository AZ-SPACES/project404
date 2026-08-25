import Foundation

/// The read-only slice of wallet state the phone mirrors to the watch.
///
/// Deliberately small and non-sensitive. It carries no tokens, no key material
/// and no identifiers beyond the counterparty name already rendered on the
/// phone. The watch never authenticates against the API — the phone is the
/// source of truth and this is the only wallet data that ever reaches the
/// wrist. See docs/WATCH_APP_PLAN.md.
struct WalletSnapshot: Codable, Equatable {
    let formattedBalance: String
    let currency: String
    let transactions: [SnapshotTransaction]

    /// When the *phone* captured this, not when the watch received it.
    ///
    /// Surfaced in the UI on purpose. WatchConnectivity delivers an application
    /// context on iOS's schedule, not ours: if the phone app has not run for
    /// hours the snapshot is hours old, and a balance that looks live but is
    /// stale is worse than one that admits its age.
    let capturedAt: Date

    /// Mirrors `balanceHiddenByDefault` from the phone's DisplayProvider. A user
    /// who hides their balance on the phone's home screen has said something
    /// about shoulder-surfing, and a wrist is more exposed than a pocket — so the
    /// preference travels rather than being re-asked for.
    let balanceHidden: Bool

    static let placeholder = WalletSnapshot(
        formattedBalance: "—",
        currency: "GHS",
        transactions: [],
        capturedAt: .distantPast,
        balanceHidden: false
    )

    /// Nothing has ever arrived from the phone.
    var isEmpty: Bool { capturedAt == .distantPast }

    /// Old enough that the balance should be presented as a last-known value
    /// rather than the current one.
    var isStale: Bool { Date().timeIntervalSince(capturedAt) > 15 * 60 }
}

struct SnapshotTransaction: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    /// Pre-formatted by the phone. Currency formatting rules live in one place
    /// (`utils/transactionUtils`) and are not worth reimplementing in Swift.
    let amount: String
    let isCredit: Bool
    let time: String
}
