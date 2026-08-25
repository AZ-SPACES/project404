import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var phone: PhoneLink

    /// Reveal is per-launch and never persisted: the point of the phone's
    /// balance-hidden preference is that a glance should not expose the figure,
    /// and a sticky reveal would quietly undo that.
    @State private var revealed = false

    var body: some View {
        NavigationStack {
            List {
                balanceSection
                transactionsSection
            }
            .listStyle(.carousel)
            .navigationTitle("Aza")
            .refreshable { phone.requestRefresh() }
        }
        .onAppear { phone.requestRefresh() }
    }

    // ── Balance ──────────────────────────────────────────────────────────────

    private var balanceSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 4) {
                Text(phone.snapshot.currency)
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                if isConcealed {
                    Text("••••")
                        .font(.system(.title2, design: .rounded).weight(.semibold))
                        .accessibilityLabel("Balance hidden. Double tap to reveal.")
                } else {
                    Text(phone.snapshot.formattedBalance)
                        .font(.system(.title3, design: .rounded).weight(.semibold))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                }

                freshnessLabel
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .onTapGesture {
                guard phone.snapshot.balanceHidden else { return }
                withAnimation { revealed.toggle() }
            }
        }
    }

    private var isConcealed: Bool {
        phone.snapshot.balanceHidden && !revealed
    }

    /// Never let a stale figure pass for a live one. If the phone has not been
    /// opened in a while the application context can be hours old, and on a
    /// balance that is the difference between useful and misleading.
    @ViewBuilder
    private var freshnessLabel: some View {
        if phone.snapshot.isEmpty {
            Label("Open Aza on your phone", systemImage: "iphone")
                .font(.caption2)
                .foregroundStyle(.secondary)
        } else if phone.snapshot.isStale {
            Label(
                "as of \(phone.snapshot.capturedAt.formatted(date: .omitted, time: .shortened))",
                systemImage: "clock.arrow.circlepath"
            )
            .font(.caption2)
            .foregroundStyle(.orange)
        } else {
            Text("Updated \(phone.snapshot.capturedAt.formatted(date: .omitted, time: .shortened))")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    // ── Recent transactions ──────────────────────────────────────────────────

    @ViewBuilder
    private var transactionsSection: some View {
        if !phone.snapshot.transactions.isEmpty {
            Section("Recent") {
                ForEach(phone.snapshot.transactions) { txn in
                    TransactionRow(transaction: txn, concealed: isConcealed)
                }
            }
        }
    }
}

private struct TransactionRow: View {
    let transaction: SnapshotTransaction
    let concealed: Bool

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: transaction.isCredit ? "arrow.down.left" : "arrow.up.right")
                .font(.caption2)
                .foregroundStyle(transaction.isCredit ? .green : .secondary)

            VStack(alignment: .leading, spacing: 1) {
                Text(transaction.name)
                    .font(.caption)
                    .lineLimit(1)
                Text(transaction.time)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 4)

            // Amounts are concealed with the balance. Hiding the total while
            // listing every amount beside it would defeat the point.
            Text(concealed ? "••" : transaction.amount)
                .font(.caption2.weight(.medium))
                .foregroundStyle(transaction.isCredit ? .green : .primary)
                .lineLimit(1)
        }
        .accessibilityElement(children: .combine)
    }
}

#Preview {
    ContentView().environmentObject(PhoneLink())
}
