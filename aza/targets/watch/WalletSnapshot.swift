import Foundation

/// The read-only slice of wallet state the phone mirrors to the watch.
///
/// Deliberately small and non-sensitive. It carries no tokens, no key material
/// and no identifiers beyond the counterparty name and public payment handle
/// already rendered on the phone. The watch never authenticates against the API
/// — the phone is the source of truth and this is the only wallet data that ever
/// reaches the wrist. See docs/WATCH_APP_PLAN.md.
///
/// Field names are load-bearing: they must match `WatchSnapshot` in
/// modules/aza-watch/index.ts exactly. A rename on one side only is caught by
/// src/hooks/__tests__/watchSchemaParity.test.ts, which parses this file.
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

    /// Public payment handle, and the universal link built from it. Showing a
    /// receive code is the one money operation that is safe on an unattended
    /// wrist: it discloses only what the user already prints on a QR poster.
    let handle: String
    let payLink: String
    let displayName: String

    /// Nil until the phone's spending endpoints have answered once.
    let spending: SnapshotSpending?

    /// Nil when the user keeps no budgets. Summed to a single figure on the
    /// phone: a wrist has room for one gauge, not one per category.
    let budget: SnapshotBudget?

    /// Exact totals from the server, not counts of the five rows below — a
    /// "2 pending" badge derived from a truncated list would understate.
    let pendingCount: Int
    let requestCount: Int

    static let placeholder = WalletSnapshot(
        formattedBalance: "—",
        currency: "GHS",
        transactions: [],
        capturedAt: .distantPast,
        balanceHidden: false,
        handle: "",
        payLink: "",
        displayName: "",
        spending: nil,
        budget: nil,
        pendingCount: 0,
        requestCount: 0
    )

    /// Nothing has ever arrived from the phone.
    var isEmpty: Bool { capturedAt == .distantPast }

    /// Old enough that the balance should be presented as a last-known value
    /// rather than the current one. The phone resends on a 10-minute heartbeat
    /// (see useWatchSync), so crossing this line means delivery actually stopped
    /// rather than the balance merely not having moved.
    func isStale(asOf now: Date = Date()) -> Bool {
        now.timeIntervalSince(capturedAt) > 15 * 60
    }
}

struct SnapshotBudget: Codable, Equatable {
    let spent: String
    let limit: String
    /// Not clamped on the way in — being over budget is the state most worth
    /// seeing, so the gauge clamps for drawing and the label tells the truth.
    let fraction: Double

    var isOver: Bool { fraction > 1 }
    var clampedFraction: Double { min(max(fraction, 0), 1) }
}

struct SnapshotSpending: Codable, Equatable {
    let sentToday: String
    let spentThisMonth: String
}

struct SnapshotTransaction: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    /// Pre-formatted by the phone. Currency formatting rules live in one place
    /// (`utils/transactionUtils`) and are not worth reimplementing in Swift.
    let amount: String
    let isCredit: Bool
    /// Clock time, e.g. "14:32".
    let time: String
    /// "Today" | "Yesterday" | "12 Aug". A bare clock time is ambiguous once the
    /// five most recent transactions span more than one day, which is the common
    /// case rather than the edge one.
    let day: String
    let kind: String
    let status: String
    let isPending: Bool
    /// Empty when the transfer carried no note.
    let note: String
    /// True only for a still-pending money request awaiting this user's payment.
    /// The watch offers Decline for these and nothing else; accepting needs a
    /// passcode, which lives on the phone.
    let canDecline: Bool

    var statusLabel: String {
        guard !status.isEmpty else { return "" }
        return status.prefix(1).uppercased() + status.dropFirst().lowercased()
    }
}
