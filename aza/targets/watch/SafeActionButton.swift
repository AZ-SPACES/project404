import SwiftUI

/// A button for an action that changes something, with a deliberate second step.
///
/// Every action reachable from the wrist fails closed, so the risk here is not
/// an attacker — it is a sleeve. A single stray tap freezing a wallet in a
/// market queue is the failure mode worth designing against, so the control
/// arms first and commits second, and the armed state times out on its own.
struct SafeActionButton: View {
    let title: String
    let armedTitle: String
    let icon: String
    let tint: Color
    let perform: () async -> PhoneLink.CommandOutcome

    @State private var isArmed = false
    @State private var isRunning = false
    @State private var result: PhoneLink.CommandOutcome?

    /// Long enough to read the confirm label, short enough that a pocket cannot
    /// leave the control armed for the rest of the day.
    private static let armedTimeout: Duration = .seconds(6)

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button(action: tapped) {
                HStack(spacing: 6) {
                    if isRunning {
                        ProgressView().controlSize(.mini)
                    } else {
                        Image(systemName: isArmed ? "exclamationmark.triangle.fill" : icon)
                            .font(.caption2)
                    }
                    Text(isArmed ? armedTitle : title)
                        .font(.caption)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }
            .tint(isArmed ? .red : tint)
            .disabled(isRunning)

            if let result {
                Text(result.message)
                    .font(.caption2)
                    .foregroundStyle(result.ok ? .green : .orange)
                    .lineLimit(2)
            }
        }
        .accessibilityHint(isArmed ? "Double tap again to confirm" : "Double tap to arm")
    }

    private func tapped() {
        guard !isArmed else {
            commit()
            return
        }

        result = nil
        withAnimation { isArmed = true }

        Task {
            try? await Task.sleep(for: Self.armedTimeout)
            // Only disarm if this timeout is still the reason we are armed —
            // a commit in the meantime has already cleared it.
            if isArmed, !isRunning { withAnimation { isArmed = false } }
        }
    }

    private func commit() {
        isArmed = false
        isRunning = true
        Task {
            let outcome = await perform()
            isRunning = false
            withAnimation { result = outcome }
        }
    }
}
