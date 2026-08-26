import SwiftUI

/// The full record for one transaction, read-only.
///
/// Everything shown here already travelled in the snapshot — the watch makes no
/// call of its own to open a row. Acting on a transaction (resending, disputing,
/// answering a request) stays on the phone, so this view states where to go
/// rather than offering a control that cannot work.
struct TransactionDetailView: View {
    @EnvironmentObject private var phone: PhoneLink

    let transaction: SnapshotTransaction

    /// Carried through from the list so opening a row cannot become a way around
    /// the phone's balance-hidden preference.
    let concealed: Bool

    @State private var revealed = false

    private var showsAmount: Bool { !concealed || revealed }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                amountHeader

                Divider()

                DetailRow(label: transaction.isCredit ? "From" : "To", value: transaction.name)
                DetailRow(label: "When", value: "\(transaction.day) · \(transaction.time)")
                DetailRow(label: "Type", value: transaction.kind)

                if !transaction.statusLabel.isEmpty {
                    DetailRow(
                        label: "Status",
                        value: transaction.statusLabel,
                        tint: transaction.isPending ? .orange : nil
                    )
                }

                if !transaction.note.isEmpty {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Note")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(transaction.note)
                            .font(.caption)
                    }
                }

                // Declining is the only change the watch may make to a
                // transaction. It fails closed and the endpoint takes no
                // passcode; accepting takes one, and that lives on the phone.
                if transaction.canDecline {
                    SafeActionButton(
                        title: "Decline",
                        armedTitle: "Confirm decline",
                        icon: "xmark.circle",
                        tint: .orange,
                        perform: { await phone.run("declineRequest", id: transaction.id) }
                    )
                    .padding(.top, 4)
                }

                Text(transaction.canDecline ? "Pay on iPhone" : "Manage on iPhone")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 2)
        }
        .navigationTitle(transaction.isCredit ? "Received" : "Sent")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var amountHeader: some View {
        HStack(spacing: 6) {
            Image(systemName: transaction.isCredit ? "arrow.down.left" : "arrow.up.right")
                .font(.caption)
                .foregroundStyle(transaction.isCredit ? .green : .secondary)

            Text(showsAmount ? transaction.amount : "••••")
                .font(.system(.title3, design: .rounded).weight(.semibold))
                .foregroundStyle(transaction.isCredit ? .green : .primary)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .contentShape(Rectangle())
        .onTapGesture {
            guard concealed else { return }
            withAnimation { revealed.toggle() }
        }
        .accessibilityLabel(
            showsAmount
                ? "\(transaction.isCredit ? "Received" : "Sent") \(transaction.amount)"
                : "Amount hidden. Double tap to reveal."
        )
    }
}

private struct DetailRow: View {
    let label: String
    let value: String
    var tint: Color?

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption)
                .foregroundStyle(tint ?? .primary)
        }
        .accessibilityElement(children: .combine)
    }
}
