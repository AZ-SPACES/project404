import Foundation

/// A QR symbol, as a square grid of dark/light modules.
///
/// Hand-rolled because Core Image — the one-line way to do this everywhere else
/// in Apple's ecosystem — does not exist on watchOS, and the alternative of
/// having the phone rasterise the code and ship it in the snapshot would put a
/// few kilobytes of PNG through WatchConnectivity on every heartbeat and leave
/// the wrist unable to draw its own code before the phone has spoken once.
///
/// Deliberately narrow: byte mode, error correction level M, versions 1–10.
/// The only thing ever encoded here is a pay link (`https://aza.systems/pay/…`),
/// which is well inside version 3. See `ReceiveView`.
struct QRCode: Equatable {
    /// Width and height in modules, always odd and between 21 and 57.
    let size: Int

    private let modules: [Bool]

    /// Dark modules are the ones a scanner reads as "on". Origin is top-left.
    func isDark(x: Int, y: Int) -> Bool {
        guard x >= 0, x < size, y >= 0, y < size else { return false }
        return modules[y * size + x]
    }

    /// Nil for empty input, or for text too long to fit version 10 at level M
    /// (213 bytes of UTF-8) — the caller shows the link as text instead.
    static func encode(_ text: String) -> QRCode? {
        let bytes = Array(text.utf8)
        guard !bytes.isEmpty, let version = version(fitting: bytes.count) else { return nil }

        var grid = Grid(version: version)
        grid.drawFunctionPatterns()
        grid.draw(codewords: codewords(for: bytes, version: version))
        grid.applyBestMask()

        return QRCode(size: grid.size, modules: grid.modules)
    }
}

// MARK: - Version and capacity tables

private extension QRCode {
    /// Error correction codewords per block, level M, indexed by version.
    static let eccPerBlock = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]

    /// Number of error correction blocks, level M, indexed by version.
    static let blockCount = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]

    static let maxVersion = 10

    /// Total codewords in a symbol, function patterns and remainder bits removed.
    static func totalCodewords(version: Int) -> Int {
        var modules = (16 * version + 128) * version + 64
        if version >= 2 {
            let alignCount = version / 7 + 2
            modules -= (25 * alignCount - 10) * alignCount - 55
            if version >= 7 { modules -= 36 }
        }
        return modules / 8
    }

    static func dataCodewords(version: Int) -> Int {
        totalCodewords(version: version) - eccPerBlock[version] * blockCount[version]
    }

    /// The character count field widens at version 10, so the header costs one
    /// more byte there — worth spending the branch on rather than reserving
    /// three bytes everywhere and occasionally picking a version too large.
    static func headerBytes(version: Int) -> Int { version < 10 ? 2 : 3 }

    /// The smallest version the payload fits in. Smaller is better: fewer
    /// modules across the same physical width means larger modules, which is
    /// what decides whether a phone camera can read a watch screen at all.
    static func version(fitting byteCount: Int) -> Int? {
        (1...maxVersion).first { byteCount + headerBytes(version: $0) <= dataCodewords(version: $0) }
    }
}

// MARK: - Data encoding

private extension QRCode {
    /// Header, payload, padding, and interleaved Reed–Solomon parity.
    static func codewords(for bytes: [UInt8], version: Int) -> [UInt8] {
        var bits = BitBuffer()
        bits.append(0b0100, width: 4)                                   // byte mode
        bits.append(UInt32(bytes.count), width: version < 10 ? 8 : 16)
        for byte in bytes { bits.append(UInt32(byte), width: 8) }

        let capacity = dataCodewords(version: version) * 8
        bits.append(0, width: min(4, capacity - bits.count))             // terminator
        bits.append(0, width: (8 - bits.count % 8) % 8)                  // byte align

        var data = bits.bytes
        // The alternating pad pattern is prescribed by the spec, not arbitrary:
        // it keeps the unused tail from being a long run of one colour.
        var pad: UInt8 = 0xEC
        while data.count < dataCodewords(version: version) {
            data.append(pad)
            pad = pad == 0xEC ? 0x11 : 0xEC
        }

        return interleave(data, version: version)
    }

    /// Splits the data into blocks, appends parity to each, then reads the
    /// blocks column-wise. The interleaving is what makes a burst of damage —
    /// a thumb over one corner — spread thinly across every block instead of
    /// destroying one of them outright.
    static func interleave(_ data: [UInt8], version: Int) -> [UInt8] {
        let blocks = blockCount[version]
        let eccLength = eccPerBlock[version]
        let shortLength = totalCodewords(version: version) / blocks - eccLength
        let shortBlocks = blocks - totalCodewords(version: version) % blocks
        let generator = rsGenerator(degree: eccLength)

        var dataBlocks: [[UInt8]] = []
        var eccBlocks: [[UInt8]] = []
        var start = 0
        for block in 0..<blocks {
            let length = shortLength + (block < shortBlocks ? 0 : 1)
            let chunk = Array(data[start..<(start + length)])
            start += length
            dataBlocks.append(chunk)
            eccBlocks.append(rsRemainder(chunk, generator: generator))
        }

        var result: [UInt8] = []
        for i in 0...shortLength {
            for block in dataBlocks where i < block.count { result.append(block[i]) }
        }
        for i in 0..<eccLength {
            for block in eccBlocks { result.append(block[i]) }
        }
        return result
    }
}

// MARK: - Reed–Solomon over GF(256)

private extension QRCode {
    /// Field multiplication modulo x^8 + x^4 + x^3 + x^2 + 1, the polynomial
    /// the QR spec fixes.
    static func gfMultiply(_ x: UInt8, _ y: UInt8) -> UInt8 {
        var z: UInt8 = 0
        for i in stride(from: 7, through: 0, by: -1) {
            z = (z << 1) ^ ((z >> 7) &* 0x1D)
            z ^= ((y >> UInt8(i)) & 1) &* x
        }
        return z
    }

    /// Coefficients of (x - a^0)(x - a^1)…(x - a^(degree-1)), highest term omitted.
    static func rsGenerator(degree: Int) -> [UInt8] {
        var result = [UInt8](repeating: 0, count: degree)
        result[degree - 1] = 1
        var root: UInt8 = 1
        for _ in 0..<degree {
            for i in 0..<degree {
                result[i] = gfMultiply(result[i], root)
                if i + 1 < degree { result[i] ^= result[i + 1] }
            }
            root = gfMultiply(root, 0x02)
        }
        return result
    }

    static func rsRemainder(_ data: [UInt8], generator: [UInt8]) -> [UInt8] {
        var result = [UInt8](repeating: 0, count: generator.count)
        for byte in data {
            let factor = byte ^ result.removeFirst()
            result.append(0)
            for i in result.indices { result[i] ^= gfMultiply(generator[i], factor) }
        }
        return result
    }
}

// MARK: - Bit buffer

private struct BitBuffer {
    private(set) var bytes: [UInt8] = []
    private(set) var count = 0

    mutating func append(_ value: UInt32, width: Int) {
        guard width > 0 else { return }
        for i in stride(from: width - 1, through: 0, by: -1) {
            if count % 8 == 0 { bytes.append(0) }
            if (value >> UInt32(i)) & 1 == 1 { bytes[count / 8] |= 1 << (7 - UInt8(count % 8)) }
            count += 1
        }
    }
}

// MARK: - Matrix

/// The module grid under construction.
///
/// Tracks which modules are *function* modules (finders, timing, alignment,
/// format and version information) separately from their colour, because those
/// positions are both skipped when laying out data and left untouched by
/// masking.
private struct Grid {
    let version: Int
    let size: Int
    var modules: [Bool]
    private var isFunction: [Bool]

    init(version: Int) {
        self.version = version
        self.size = version * 4 + 17
        self.modules = [Bool](repeating: false, count: size * size)
        self.isFunction = [Bool](repeating: false, count: size * size)
    }

    subscript(x: Int, y: Int) -> Bool {
        get { modules[y * size + x] }
        set { modules[y * size + x] = newValue }
    }

    mutating func setFunction(_ x: Int, _ y: Int, _ dark: Bool) {
        guard x >= 0, x < size, y >= 0, y < size else { return }
        modules[y * size + x] = dark
        isFunction[y * size + x] = true
    }

    func isFunctionModule(_ x: Int, _ y: Int) -> Bool { isFunction[y * size + x] }
}

// MARK: - Function patterns

private extension Grid {
    mutating func drawFunctionPatterns() {
        for i in 0..<size {
            setFunction(6, i, i % 2 == 0)
            setFunction(i, 6, i % 2 == 0)
        }

        // Drawn at 9×9 so the light separator ring falls out of the same loop.
        drawFinder(atX: 3, y: 3)
        drawFinder(atX: size - 4, y: 3)
        drawFinder(atX: 3, y: size - 4)

        let positions = alignmentPositions()
        for (i, x) in positions.enumerated() {
            for (j, y) in positions.enumerated() {
                // The three corners are already occupied by finder patterns.
                let isCorner = (i == 0 && j == 0)
                    || (i == 0 && j == positions.count - 1)
                    || (i == positions.count - 1 && j == 0)
                if !isCorner { drawAlignment(atX: x, y: y) }
            }
        }

        // Placeholder: the real format bits depend on the mask, which is not
        // chosen until the data is in place.
        drawFormatBits(mask: 0)
        drawVersionBits()
    }

    mutating func drawFinder(atX x: Int, y: Int) {
        for dy in -4...4 {
            for dx in -4...4 {
                let distance = max(abs(dx), abs(dy))
                setFunction(x + dx, y + dy, distance != 2 && distance != 4)
            }
        }
    }

    mutating func drawAlignment(atX x: Int, y: Int) {
        for dy in -2...2 {
            for dx in -2...2 {
                setFunction(x + dx, y + dy, max(abs(dx), abs(dy)) != 1)
            }
        }
    }

    func alignmentPositions() -> [Int] {
        guard version > 1 else { return [] }
        let count = version / 7 + 2
        let step = (version * 4 + count * 2 + 1) / (count * 2 - 2) * 2
        var result = [6]
        var position = size - 7
        while result.count < count {
            result.insert(position, at: 1)
            position -= step
        }
        return result
    }

    /// 15 bits: two for the error correction level (00 = M), three for the mask,
    /// ten of BCH parity, then XORed with a fixed pattern so an all-light symbol
    /// cannot be mistaken for a valid one.
    mutating func drawFormatBits(mask: Int) {
        let data = mask  // level M contributes 0b00 in the high bits
        var remainder = data
        for _ in 0..<10 { remainder = (remainder << 1) ^ ((remainder >> 9) * 0x537) }
        let bits = ((data << 10) | remainder) ^ 0x5412

        func bit(_ i: Int) -> Bool { (bits >> i) & 1 == 1 }

        for i in 0...5 { setFunction(8, i, bit(i)) }
        setFunction(8, 7, bit(6))
        setFunction(8, 8, bit(7))
        setFunction(7, 8, bit(8))
        for i in 9..<15 { setFunction(14 - i, 8, bit(i)) }

        // A second copy, so losing one corner does not cost the whole symbol.
        for i in 0..<8 { setFunction(size - 1 - i, 8, bit(i)) }
        for i in 8..<15 { setFunction(8, size - 15 + i, bit(i)) }

        setFunction(8, size - 8, true)  // always dark
    }

    /// Only versions 7 and up carry an explicit version block; below that the
    /// decoder infers the version from the symbol's size.
    mutating func drawVersionBits() {
        guard version >= 7 else { return }
        var remainder = version
        for _ in 0..<12 { remainder = (remainder << 1) ^ ((remainder >> 11) * 0x1F25) }
        let bits = (version << 12) | remainder

        for i in 0..<18 {
            let dark = (bits >> i) & 1 == 1
            let a = size - 11 + i % 3
            let b = i / 3
            setFunction(a, b, dark)
            setFunction(b, a, dark)
        }
    }
}

// MARK: - Data placement and masking

private extension Grid {
    /// Zig-zags up and down two-module-wide columns from the bottom right,
    /// skipping function modules and the vertical timing pattern's column.
    mutating func draw(codewords: [UInt8]) {
        var index = 0
        var right = size - 1
        while right >= 1 {
            if right == 6 { right = 5 }
            for vertical in 0..<size {
                for j in 0..<2 {
                    let x = right - j
                    let upward = ((right + 1) & 2) == 0
                    let y = upward ? size - 1 - vertical : vertical
                    guard !isFunctionModule(x, y), index < codewords.count * 8 else { continue }
                    self[x, y] = (codewords[index >> 3] >> (7 - UInt8(index & 7))) & 1 == 1
                    index += 1
                }
            }
            right -= 2
        }
    }

    /// Tries all eight masks and keeps the one the spec's penalty rules like
    /// best. Any mask decodes, but a bad one can leave finder-like noise in the
    /// data region, which is exactly what makes a code fail to scan in the wild.
    mutating func applyBestMask() {
        var best = 0
        var bestPenalty = Int.max
        for mask in 0..<8 {
            apply(mask: mask)
            drawFormatBits(mask: mask)
            let penalty = penaltyScore()
            if penalty < bestPenalty {
                bestPenalty = penalty
                best = mask
            }
            apply(mask: mask)  // masking is its own inverse
        }
        apply(mask: best)
        drawFormatBits(mask: best)
    }

    mutating func apply(mask: Int) {
        for y in 0..<size {
            for x in 0..<size where !isFunctionModule(x, y) {
                let invert: Bool
                switch mask {
                case 0: invert = (x + y) % 2 == 0
                case 1: invert = y % 2 == 0
                case 2: invert = x % 3 == 0
                case 3: invert = (x + y) % 3 == 0
                case 4: invert = (x / 3 + y / 2) % 2 == 0
                case 5: invert = x * y % 2 + x * y % 3 == 0
                case 6: invert = (x * y % 2 + x * y % 3) % 2 == 0
                default: invert = ((x + y) % 2 + x * y % 3) % 2 == 0
                }
                if invert { self[x, y].toggle() }
            }
        }
    }

    func penaltyScore() -> Int {
        var score = 0

        // Rule 1: runs of five or more same-coloured modules in a line.
        for i in 0..<size {
            score += runPenalty((0..<size).map { self[$0, i] })
            score += runPenalty((0..<size).map { self[i, $0] })
        }

        // Rule 2: solid 2×2 blocks.
        for y in 0..<(size - 1) {
            for x in 0..<(size - 1) {
                let corner = self[x, y]
                if self[x + 1, y] == corner, self[x, y + 1] == corner, self[x + 1, y + 1] == corner {
                    score += 3
                }
            }
        }

        // Rule 3: anything a decoder could mistake for a finder pattern.
        for i in 0..<size {
            score += finderPenalty((0..<size).map { self[$0, i] })
            score += finderPenalty((0..<size).map { self[i, $0] })
        }

        // Rule 4: overall imbalance between dark and light.
        // Each full 5% step away from an even split costs 10.
        let dark = modules.reduce(0) { $0 + ($1 ? 1 : 0) }
        score += abs(dark * 20 - modules.count * 10) / modules.count * 10

        return score
    }

    func runPenalty(_ line: [Bool]) -> Int {
        var score = 0
        var run = 1
        for i in 1..<line.count {
            if line[i] == line[i - 1] {
                run += 1
                if run == 5 { score += 3 } else if run > 5 { score += 1 }
            } else {
                run = 1
            }
        }
        return score
    }

    func finderPenalty(_ line: [Bool]) -> Int {
        // 1:1:3:1:1 dark/light ratio followed (or preceded) by four light modules.
        let forward = [true, false, true, true, true, false, true, false, false, false, false]
        let backward = Array(forward.reversed())
        var score = 0
        guard line.count >= forward.count else { return 0 }
        for start in 0...(line.count - forward.count) {
            let window = Array(line[start..<(start + forward.count)])
            if window == forward || window == backward { score += 40 }
        }
        return score
    }
}
