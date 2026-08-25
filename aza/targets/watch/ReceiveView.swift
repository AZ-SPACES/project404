import SwiftUI
import CoreImage
import CoreImage.CIFilterBuiltins

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

    /// Generated once per link rather than per render: CoreImage rasterisation is
    /// cheap on a phone and conspicuously not on a watch.
    @State private var code: UIImage?

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                if let code {
                    Image(uiImage: code)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: .infinity)
                        .padding(6)
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
        .task(id: payLink) { code = Self.makeCode(from: payLink) }
        .accessibilityLabel("Payment code for \(handle.isEmpty ? displayName : "@\(handle)")")
    }

    private static func makeCode(from link: String) -> UIImage? {
        guard !link.isEmpty else { return nil }

        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(link.utf8)
        // Medium correction: a watch screen is small, and every level above M
        // costs modules that turn into unscannable noise at this size.
        filter.correctionLevel = "M"

        guard let output = filter.outputImage else { return nil }

        // The generator emits roughly one pixel per module. Scale up before
        // rasterising so the code stays crisp instead of being smoothed into
        // something a scanner cannot read.
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 8, y: 8))
        guard let cgImage = CIContext().createCGImage(scaled, from: scaled.extent) else {
            return nil
        }
        return UIImage(cgImage: cgImage)
    }
}
