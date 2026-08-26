import SwiftUI

/// The user's static receive code.
///
/// The one money operation that belongs on an unattended wrist: it discloses a
/// public payment handle and nothing else — the same string the phone prints on
/// a shareable QR poster. No balance, no history, no credential. It also works
/// with the phone out of range, since the link travelled in the snapshot.
struct ReceiveView: View {
    let payLink: String
    let handle: String
    let displayName: String

    @Environment(\.displayScale) private var displayScale

    /// Encoded once per link rather than per render. Cheap even on a watch, but
    /// there is no reason to redo it on every layout pass.
    @State private var code: QRCode?

    /// The spec's four-module margin. A code drawn flush to the edge of a dark
    /// watch face is one a phone camera will hunt for and often miss.
    private static let quietZone = 4

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                if let code {
                    Canvas { context, size in draw(code, in: context, size: size) }
                        .aspectRatio(1, contentMode: .fit)
                        .frame(maxWidth: .infinity)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                } else {
                    ProgressView().frame(height: 120)
                }

                if !handle.isEmpty {
                    Text("@\(handle)")
                        .font(.caption.weight(.medium))
                }

                Text("Scan to pay \(displayName.isEmpty ? "me" : displayName)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 2)
        }
        .navigationTitle("Receive")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: payLink) { code = QRCode.encode(payLink) }
        .accessibilityLabel("Payment code for \(handle.isEmpty ? displayName : "@\(handle)")")
    }

    /// Modules are snapped to whole pixels and all drawn in one path. Letting
    /// them land on fractional boundaries antialiases every edge, which on a
    /// screen this small is the difference between a code that scans first try
    /// and one the user has to angle into the light.
    private func draw(_ code: QRCode, in context: GraphicsContext, size: CGSize) {
        let span = code.size + Self.quietZone * 2
        let pixel = 1 / max(displayScale, 1)
        let module = max((min(size.width, size.height) / CGFloat(span) / pixel).rounded(.down) * pixel, pixel)
        let side = module * CGFloat(span)
        let origin = CGPoint(x: (((size.width - side) / 2) / pixel).rounded() * pixel,
                             y: (((size.height - side) / 2) / pixel).rounded() * pixel)

        context.fill(Path(CGRect(origin: origin, size: CGSize(width: side, height: side))),
                     with: .color(.white))

        var dark = Path()
        for y in 0..<code.size {
            for x in 0..<code.size where code.isDark(x: x, y: y) {
                dark.addRect(CGRect(x: origin.x + CGFloat(x + Self.quietZone) * module,
                                    y: origin.y + CGFloat(y + Self.quietZone) * module,
                                    width: module, height: module))
            }
        }
        context.fill(dark, with: .color(.black))
    }
}
