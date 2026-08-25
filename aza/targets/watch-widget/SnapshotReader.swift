import Foundation

/// The complication's own narrow view of the snapshot.
///
/// Deliberately *not* the watch app's `WalletSnapshot`. Each target compiles its
/// own sources, so sharing the type would mean duplicating it — and duplicating
/// the full struct means every field the app adds becomes a decode failure here
/// the day someone forgets. `JSONDecoder` ignores keys it was not asked about,
/// so declaring only what a watch face can actually render makes this file
/// immune to schema growth rather than coupled to it.
struct ComplicationSnapshot: Equatable {
    let formattedBalance: String
    let currency: String
    let capturedAt: Date
    let balanceHidden: Bool
    let pendingCount: Int
    let requestCount: Int
    let budget: ComplicationBudget?

    /// What the face should nudge about, if anything. Requests outrank pending
    /// transfers because only one of the two is waiting on the user.
    var attention: Int { requestCount + pendingCount }

    var isStale: Bool { Date().timeIntervalSince(capturedAt) > 15 * 60 }

    static let placeholder = ComplicationSnapshot(
        formattedBalance: "GH₵ 1,240.00",
        currency: "GHS",
        capturedAt: Date(),
        balanceHidden: false,
        pendingCount: 0,
        requestCount: 1,
        budget: ComplicationBudget(spent: "GH₵ 620", limit: "GH₵ 1,000", fraction: 0.62)
    )
}

struct ComplicationBudget: Equatable, Decodable {
    let spent: String
    let limit: String
    let fraction: Double

    var isOver: Bool { fraction > 1 }
    var clamped: Double { min(max(fraction, 0), 1) }
}

private struct Wire: Decodable {
    let formattedBalance: String
    let currency: String
    let capturedAt: String
    let balanceHidden: Bool
    /// Optional so a snapshot written by an older watch app still decodes here
    /// rather than blanking every complication on the face.
    let pendingCount: Int?
    let requestCount: Int?
    let budget: ComplicationBudget?
}

enum SnapshotReader {
    static let appGroup = "group.com.semekor.k.aza"
    private static let filename = "wallet-snapshot.json"

    /// Nil when the user has never opened the phone app, or has signed out — the
    /// watch app clears the file on logout, and the face must follow.
    static func load() -> ComplicationSnapshot? {
        guard let url = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent(filename),
              let data = try? Data(contentsOf: url),
              let wire = try? JSONDecoder().decode(Wire.self, from: data)
        else { return nil }

        // JavaScript's toISOString() always emits milliseconds, which
        // `.withInternetDateTime` alone rejects. Same trap as the watch app's
        // decoder — see targets/watch/SnapshotStore.swift.
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]

        guard let date = fractional.date(from: wire.capturedAt)
            ?? plain.date(from: wire.capturedAt) else { return nil }

        return ComplicationSnapshot(
            formattedBalance: wire.formattedBalance,
            currency: wire.currency,
            capturedAt: date,
            balanceHidden: wire.balanceHidden,
            pendingCount: wire.pendingCount ?? 0,
            requestCount: wire.requestCount ?? 0,
            budget: wire.budget
        )
    }
}
