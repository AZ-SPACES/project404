import XCTest
@testable import AzaWatchModel

/// The watch draws its receive code itself — Core Image, which every other
/// Apple platform would use for this, does not exist on watchOS. That makes
/// this encoder ours to be right about, and a QR code is unusually unforgiving:
/// a single wrong module is not a slightly worse image, it is a code that fails
/// to scan, in a hand, in a shop, with no error message anywhere.
///
/// The two golden symbols below were verified module-for-module against Core
/// Image's `CIQRCodeGenerator` at correction level M, and decoded back to their
/// original strings with `VNDetectBarcodesRequest`, on macOS where both exist.
final class QRCodeTests: XCTestCase {

    private func render(_ code: QRCode) -> [String] {
        (0..<code.size).map { y in
            String((0..<code.size).map { code.isDark(x: $0, y: y) ? "#" : "." })
        }
    }

    // ── Golden symbols ───────────────────────────────────────────────────────

    /// A representative pay link: version 3, the size every real handle lands on.
    func testEncodesPayLinkToKnownSymbol() throws {
        let code = try XCTUnwrap(QRCode.encode("https://aza.systems/pay/kwame"))
        XCTAssertEqual(code.size, 29)
        XCTAssertEqual(render(code), [
        "#######.....#.#..#.#..#######",
        "#.....#...##....##..#.#.....#",
        "#.###.#..#..#.##.#....#.###.#",
        "#.###.#..##.##..#..#..#.###.#",
        "#.###.#..#.##....##...#.###.#",
        "#.....#.#####..######.#.....#",
        "#######.#.#.#.#.#.#.#.#######",
        "..........####.####..........",
        "#..#.##.#..#..#.#...##.#.....",
        ".###.....#.#.#.##...#.#..#..#",
        "#.#.######.#####.###.....###.",
        "##......#.#..#..#.#...###.##.",
        "..###.###.#.#.##.#.####..#.##",
        ".#..#..#.....#######...#.....",
        "#..#..#..###.##.....#...#####",
        "###......##....#.##....#.#.#.",
        ".####.##..##.#...#.#.#.....#.",
        ".####..###.######.....##.#..#",
        "#.###.#.#.###.###.#...#....##",
        "...#.#.###.##.#..##.#..##..##",
        "#..##.#.#......#...######.#..",
        "........#.#...##...##...#.###",
        "#######..#.##...#...#.#.#..#.",
        "#.....#.#...#.##..#.#...###..",
        "#.###.#..#.##...##..#####..#.",
        "#.###.#.#..###.#.#.#..#.###.#",
        "#.###.#...#..#.###.#.#..###.#",
        "#.....#..###....#####......#.",
        "#######.#....#.#..#.#...##.#.",
        ])
    }

    /// 120 bytes, which crosses into version 7 — the first version carrying an
    /// explicit version-information block, a code path nothing shorter reaches.
    func testEncodesLongLinkAcrossVersionInformationBoundary() throws {
        let link = "https://aza.systems/pay/" + String(repeating: "kwame-mensah", count: 8)
        let code = try XCTUnwrap(QRCode.encode(link))
        XCTAssertEqual(code.size, 45)
        XCTAssertEqual(render(code), [
        "#######.#..#.#..##..#..#..##..#.##..#.#######",
        "#.....#..#.##.#.####.#.#.######.##.#..#.....#",
        "#.###.#.#.....###.###.#....#...#.#.#..#.###.#",
        "#.###.#..######.##..#.####.#..##...##.#.###.#",
        "#.###.#..#.#.#...#..#####.#...#...###.#.###.#",
        "#.....#.#.#...#..##.#...#.##.##.......#.....#",
        "#######.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#######",
        ".........#.##.#...###...###.###.#..#.........",
        "#.#...##.##..###...######..##.#.#.##...#..#.#",
        "#.#..#.###.#...#...###..##.###.#.#.#...###.##",
        "#..########..####.###...#..###.##......##.#.#",
        "#.#.#........#.#.#...#.#....#...###...####...",
        ".#.####.#.#.##########..#.#.#.#.#.##.##.##.#.",
        "###.#...###.#.##..#.######.#.#.#.#.#.#.##..##",
        "..#...#..###.##..#.#.#..##.###..##..##.#..#.#",
        ".#####.#...#.#..#....#.##...#..##....##.##..#",
        "###...#...###..##.#.#..#....#...#.##..#.##...",
        "#.##.#.##..#.#..#.##..#.##.#.#.###.#.#.#....#",
        "..###.#.#..####....#....##..#..###...#......#",
        ".####..####.######.#.#.#.#.##..#######..##.##",
        "#..#######.#.##...#.#####.#.#...#.########..#",
        ".#.##...#..###..#.###...#..###..##.##...##..#",
        ".#..#.#.#.#.#.#.#####.#.##.#.#...#..#.#.###.#",
        "...##...###....###..#...#..###..#.#.#...##.#.",
        "..#.#####..#.##.###########.#.#.##..#####....",
        "..###....#....#.##.#######.#...###..####.##.#",
        "...##.#..#.#########..##.#...#..##....#.##..#",
        "#...##.#...###...##..#...##.#.#.##.##.#..#...",
        ".##...#..##...####.##.#.#.#.###.#.####.....#.",
        ".#.#.#...###...#.####.#.##.###.#...##.##.##.#",
        "...##.##.###...#.#.#.###.#..##...#..#####.#.#",
        ".#.###.###.......#...#.#....##.##.###.#..#.#.",
        ".....##.#...#.#.#####.#.#.#.###.####.#.#.#..#",
        "#.#.#...#.#.###.#####.####.#.#..##.#####...##",
        "....#.##.##...###..#.###.#...#...#.##.###.#.#",
        ".####..##...##..##..####.##.#...####.##.##.##",
        "#..##.##.###.#...#..#####.#.#.#.#.########.#.",
        "........##.#......###...##...#.#.#.##...##..#",
        "#######.####..##....#.#.##.#.#..##..#.#.###.#",
        "#.....#..###..#..#.##...#...#####..##...##.#.",
        "#.###.#....#.##.#########.#.#.#.#.#.#####....",
        "#.###.#....#.#.#.##.##...#.#.#.##...##..#..##",
        "#.###.#.#.....####...#.#....##.#.#..#.###...#",
        "#.....#..#...####...##..##.##.#.####.#.#.#...",
        "#######.#..###.##.#.#..##.#.#...#.####..##..#",
        ])
    }

    // ── Version selection ────────────────────────────────────────────────────

    /// The smallest version that fits wins. Every version up is four more
    /// modules across the same physical width, and on a 40mm screen that is
    /// paid for directly in how close a camera has to get.
    func testChoosesSmallestVersionThatFits() throws {
        // Level M byte-mode capacities, minus the two-byte header, for v1–v3.
        for (byteCount, expectedSize) in [(14, 21), (15, 25), (26, 25), (27, 29), (42, 29)] {
            let code = try XCTUnwrap(QRCode.encode(String(repeating: "a", count: byteCount)))
            XCTAssertEqual(code.size, expectedSize, "\(byteCount) bytes")
        }
    }

    /// Version 10 widens the character-count field, so its capacity is 213 and
    /// not the 216 data codewords the version holds.
    func testRefusesPayloadsBeyondVersionTen() {
        XCTAssertNotNil(QRCode.encode(String(repeating: "a", count: 213)))
        XCTAssertNil(QRCode.encode(String(repeating: "a", count: 214)))
    }

    /// A snapshot that arrived before the phone knew the handle carries an empty
    /// link. `ReceiveView` shows a spinner rather than an unscannable square.
    func testRefusesEmptyInput() {
        XCTAssertNil(QRCode.encode(""))
    }

    func testEncodesMultiByteCharactersByUTF8Length() throws {
        // Three bytes each, so 71 of them just exceed version 3's 42-byte limit.
        XCTAssertEqual(try XCTUnwrap(QRCode.encode(String(repeating: "\u{20B5}", count: 14))).size, 29)
        XCTAssertEqual(try XCTUnwrap(QRCode.encode(String(repeating: "\u{20B5}", count: 15))).size, 33)
    }

    // ── Structure ────────────────────────────────────────────────────────────

    /// Finder patterns in three corners and the alternating timing lines between
    /// them are what a scanner locks onto before it reads a single data module.
    func testDrawsFunctionPatterns() throws {
        let code = try XCTUnwrap(QRCode.encode("https://aza.systems/pay/kwame"))

        for (originX, originY) in [(0, 0), (code.size - 7, 0), (0, code.size - 7)] {
            for y in 0..<7 {
                for x in 0..<7 {
                    let ring = max(abs(x - 3), abs(y - 3))
                    XCTAssertEqual(code.isDark(x: originX + x, y: originY + y), ring != 2,
                                   "finder at (\(originX), \(originY)) module (\(x), \(y))")
                }
            }
        }

        for i in 8..<(code.size - 8) {
            XCTAssertEqual(code.isDark(x: i, y: 6), i % 2 == 0, "horizontal timing at \(i)")
            XCTAssertEqual(code.isDark(x: 6, y: i), i % 2 == 0, "vertical timing at \(i)")
        }
    }

    /// Out-of-bounds reads answer "light" rather than trapping: the drawing code
    /// walks a rect that may be larger than the symbol.
    func testTreatsOutOfBoundsAsLight() throws {
        let code = try XCTUnwrap(QRCode.encode("https://aza.systems/pay/kwame"))
        XCTAssertFalse(code.isDark(x: -1, y: 0))
        XCTAssertFalse(code.isDark(x: 0, y: code.size))
    }

    /// Mask selection scores eight candidates and keeps one; a tie broken by
    /// iteration order would still scan, but would make the goldens above flap.
    func testEncodingIsDeterministic() throws {
        let first = try XCTUnwrap(QRCode.encode("https://aza.systems/pay/kwame"))
        let second = try XCTUnwrap(QRCode.encode("https://aza.systems/pay/kwame"))
        XCTAssertEqual(first, second)
    }
}
