import XCTest
@testable import AzaWatchModel

/// The snapshot is the entire contract between the phone and the wrist, and it
/// crosses as an untyped JSON string. Nothing at build time connects the two
/// sides, and every failure mode here is silent on the device: a decode error
/// logs one line to the Console and leaves a blank watch.
final class WalletSnapshotTests: XCTestCase {

    /// Written the way `useWatchSync` writes it — including the milliseconds
    /// JavaScript's `toISOString()` always emits.
    private func json(
        capturedAt: String = "2026-08-25T09:14:32.123Z",
        extra: String = ""
    ) -> Data {
        """
        {
          "formattedBalance": "GH₵ 1,240.00",
          "currency": "GHS",
          "transactions": [],
          "capturedAt": "\(capturedAt)",
          "balanceHidden": false,
          "handle": "kwame",
          "payLink": "https://aza.systems/pay/kwame",
          "displayName": "Kwame Mensah",
          "spending": null,
          "pendingCount": 0,
          "requestCount": 0\(extra)
        }
        """.data(using: .utf8)!
    }

    private func decode(_ data: Data) throws -> WalletSnapshot {
        try JSONDecoder.snapshot.decode(WalletSnapshot.self, from: data)
    }

    // ── Dates ────────────────────────────────────────────────────────────────

    /// The regression this whole file exists for. `dateDecodingStrategy = .iso8601`
    /// uses `.withInternetDateTime` alone, which rejects fractional seconds — so
    /// the obvious spelling fails on *every* snapshot the phone sends.
    func testDecodesFractionalSeconds() throws {
        let snapshot = try decode(json())
        XCTAssertEqual(
            snapshot.capturedAt.timeIntervalSince1970,
            1787649272.123,
            accuracy: 0.01
        )
    }

    func testDecodesWithoutFractionalSeconds() throws {
        let snapshot = try decode(json(capturedAt: "2026-08-25T09:14:32Z"))
        XCTAssertEqual(snapshot.capturedAt.timeIntervalSince1970, 1787649272, accuracy: 0.01)
    }

    func testRejectsUnparseableDate() {
        XCTAssertThrowsError(try decode(json(capturedAt: "yesterday afternoon")))
    }

    func testRoundTripsThroughTheEncoder() throws {
        let original = try decode(json())
        let reencoded = try JSONEncoder.snapshot.encode(original)
        XCTAssertEqual(try decode(reencoded), original)
    }

    // ── Forward compatibility ────────────────────────────────────────────────

    /// The watch app updates through the App Store; the phone app updates through
    /// Expo OTA. A phone that has run ahead and added a field must not blank the
    /// wrist until the watch catches up.
    func testIgnoresUnknownFields() throws {
        let snapshot = try decode(json(extra: #", "somethingNewer": {"a": 1}"#))
        XCTAssertEqual(snapshot.currency, "GHS")
    }

    func testDecodesNestedSpending() throws {
        let data = """
        {
          "formattedBalance": "GH₵ 1.00", "currency": "GHS", "transactions": [],
          "capturedAt": "2026-08-25T09:14:32.000Z", "balanceHidden": true,
          "handle": "", "payLink": "", "displayName": "",
          "spending": { "sentToday": "GH₵ 240.00", "spentThisMonth": "GH₵ 1,980.00" },
          "pendingCount": 2, "requestCount": 1
        }
        """.data(using: .utf8)!

        let snapshot = try decode(data)
        XCTAssertEqual(snapshot.spending?.sentToday, "GH₵ 240.00")
        XCTAssertTrue(snapshot.balanceHidden)
        XCTAssertEqual(snapshot.pendingCount, 2)
    }

    // ── Staleness ────────────────────────────────────────────────────────────

    func testStalenessBoundary() throws {
        let snapshot = try decode(json())
        let captured = snapshot.capturedAt

        XCTAssertFalse(snapshot.isStale(asOf: captured.addingTimeInterval(14 * 60)))
        XCTAssertTrue(snapshot.isStale(asOf: captured.addingTimeInterval(16 * 60)))
    }

    /// The phone resends on a 10-minute heartbeat, so a snapshot that has merely
    /// gone unchanged must never reach the threshold. If this fails, the watch is
    /// back to calling correct balances stale.
    func testHeartbeatIntervalStaysInsideTheStalenessWindow() throws {
        let snapshot = try decode(json())
        XCTAssertFalse(snapshot.isStale(asOf: snapshot.capturedAt.addingTimeInterval(10 * 60)))
    }

    func testPlaceholderReadsAsEmptyRatherThanStale() {
        XCTAssertTrue(WalletSnapshot.placeholder.isEmpty)
        XCTAssertNil(WalletSnapshot.placeholder.spending)
    }

    func testDecodedSnapshotIsNotEmpty() throws {
        XCTAssertFalse(try decode(json()).isEmpty)
    }

    // ── Transactions ─────────────────────────────────────────────────────────

    func testDecodesTransactionsAndStatusLabel() throws {
        let data = """
        {
          "formattedBalance": "GH₵ 1.00", "currency": "GHS",
          "capturedAt": "2026-08-25T09:14:32.000Z", "balanceHidden": false,
          "handle": "", "payLink": "", "displayName": "", "spending": null,
          "pendingCount": 0, "requestCount": 0,
          "transactions": [{
            "id": "txn_1", "name": "Ama Serwaa", "amount": "GH₵ 50.00",
            "isCredit": false, "time": "14:32", "day": "Today",
            "kind": "Money Request", "status": "PENDING", "isPending": true,
            "note": "lunch", "canDecline": true
          }]
        }
        """.data(using: .utf8)!

        let txn = try XCTUnwrap(try decode(data).transactions.first)
        XCTAssertEqual(txn.statusLabel, "Pending")
        XCTAssertTrue(txn.canDecline)
        XCTAssertEqual(txn.note, "lunch")
    }

    func testStatusLabelIsEmptyWhenStatusIsMissing() throws {
        let data = """
        {
          "formattedBalance": "GH₵ 1.00", "currency": "GHS",
          "capturedAt": "2026-08-25T09:14:32.000Z", "balanceHidden": false,
          "handle": "", "payLink": "", "displayName": "", "spending": null,
          "pendingCount": 0, "requestCount": 0,
          "transactions": [{
            "id": "t", "name": "n", "amount": "a", "isCredit": true,
            "time": "1", "day": "Today", "kind": "Transfer", "status": "",
            "isPending": false, "note": "", "canDecline": false
          }]
        }
        """.data(using: .utf8)!

        XCTAssertEqual(try decode(data).transactions.first?.statusLabel, "")
    }
}
