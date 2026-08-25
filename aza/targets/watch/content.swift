import SwiftUI
import WatchKit

struct ContentView: View {
    @EnvironmentObject private var phone: PhoneLink

    /// Reveal is per-launch and never persisted: the point of the phone's
    /// balance-hidden preference is that a glance should not expose the figure,
    /// and a sticky reveal would quietly undo that.
    @State private var revealed = false

    /// Set when a pull-to-refresh found no phone to ask. Cleared on the next
    /// successful delivery — a gesture that does nothing and says nothing reads
    /// as a broken app rather than an absent phone.
    @State private var refreshUnreachable = false

    var body: some View {
        NavigationStack {
            List {
                balanceSection
                alertsSection
                spendingSection
                transactionsSection
                actionsSection
                securitySection
            }
            .listStyle(.carousel)
            .navigationTitle("Aza")
            .refreshable {
                refreshUnreachable = !phone.requestRefresh()
            }
        }
        .onAppear { phone.requestRefresh() }
        .onChange(of: phone.snapshot) { _ in refreshUnreachable = false }
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
            .onTapGesture(perform: toggleReveal)
            .accessibilityAddTraits(phone.snapshot.balanceHidden ? .isButton : [])
            .accessibilityLabel(
                isConcealed
                    ? "Balance hidden. Double tap to reveal."
                    : "Balance \(phone.snapshot.formattedBalance)"
            )
            // Double Tap (Series 9 and later): the pinch is the wrist's
            // one-handed gesture, and revealing the balance is unambiguously the
            // primary thing to do on this screen.
            .modifier(PrimaryHandGesture(enabled: phone.snapshot.balanceHidden))
        }
    }

    private var isConcealed: Bool {
        phone.snapshot.balanceHidden && !revealed
    }

    private func toggleReveal() {
        guard phone.snapshot.balanceHidden else { return }
        WKInterfaceDevice.current().play(.click)
        withAnimation { revealed.toggle() }
    }

    /// Never let a stale figure pass for a live one. If the phone has not been
    /// opened in a while the application context can be hours old, and on a
    /// balance that is the difference between useful and misleading.
    ///
    /// Wrapped in a TimelineView because staleness is a function of *now*, not of
    /// the snapshot: without a periodic tick a view left on the wrist keeps
    /// claiming "Updated 09:14" in calm grey long after it stopped being true.
    @ViewBuilder
    private var freshnessLabel: some View {
        if phone.snapshot.isEmpty {
            Label("Open Aza on your phone", systemImage: "iphone")
                .font(.caption2)
                .foregroundStyle(.secondary)
        } else if refreshUnreachable {
            Label("Phone not reachable", systemImage: "iphone.slash")
                .font(.caption2)
                .foregroundStyle(.orange)
        } else if phone.isRefreshing {
            Label("Updating…", systemImage: "arrow.triangle.2.circlepath")
                .font(.caption2)
                .foregroundStyle(.secondary)
        } else {
            TimelineView(.periodic(from: .now, by: 60)) { context in
                let captured = phone.snapshot.capturedAt
                    .formatted(date: .omitted, time: .shortened)

                if phone.snapshot.isStale(asOf: context.date) {
                    Label("as of \(captured)", systemImage: "clock.arrow.circlepath")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                } else {
                    Text("Updated \(captured)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // ── Pending work ─────────────────────────────────────────────────────────

    /// Counts come from the server, not from the five rows below, so this stays
    /// truthful when there is more pending than the watch list can show.
    @ViewBuilder
    private var alertsSection: some View {
        if phone.snapshot.requestCount > 0 || phone.snapshot.pendingCount > 0 {
            Section {
                if phone.snapshot.requestCount > 0 {
                    AlertRow(
                        icon: "hand.raised.fill",
                        tint: .orange,
                        title: count(phone.snapshot.requestCount, "money request"),
                        subtitle: "Open Aza to respond"
                    )
                }
                if phone.snapshot.pendingCount > 0 {
                    AlertRow(
                        icon: "clock.fill",
                        tint: .secondary,
                        title: count(phone.snapshot.pendingCount, "transfer") + " pending",
                        subtitle: nil
                    )
                }
            }
        }
    }

    private func count(_ n: Int, _ noun: String) -> String {
        "\(n) \(noun)\(n == 1 ? "" : "s")"
    }

    // ── Spending ─────────────────────────────────────────────────────────────

    @ViewBuilder
    private var spendingSection: some View {
        if phone.snapshot.spending != nil || phone.snapshot.budget != nil {
            Section("Spending") {
                if let spending = phone.snapshot.spending {
                    StatRow(label: "Sent today", value: spending.sentToday, concealed: isConcealed)
                    StatRow(label: "This month", value: spending.spentThisMonth, concealed: isConcealed)
                }
                if let budget = phone.snapshot.budget {
                    BudgetRow(budget: budget, concealed: isConcealed)
                }
            }
        }
    }

    // ── Recent transactions ──────────────────────────────────────────────────

    @ViewBuilder
    private var transactionsSection: some View {
        if !phone.snapshot.transactions.isEmpty {
            Section("Recent") {
                ForEach(phone.snapshot.transactions) { txn in
                    NavigationLink {
                        TransactionDetailView(transaction: txn, concealed: isConcealed)
                    } label: {
                        TransactionRow(transaction: txn, concealed: isConcealed)
                    }
                }
            }
        }
    }

    // ── Actions ──────────────────────────────────────────────────────────────

    /// Receiving is the only money operation safe on an unattended wrist: the
    /// code discloses a public handle and nothing else. Sending stays on the phone.
    @ViewBuilder
    private var actionsSection: some View {
        if !phone.snapshot.payLink.isEmpty {
            Section {
                NavigationLink {
                    ReceiveView(
                        payLink: phone.snapshot.payLink,
                        handle: phone.snapshot.handle,
                        displayName: phone.snapshot.displayName
                    )
                } label: {
                    Label("Receive", systemImage: "qrcode")
                        .font(.caption)
                }
            }
        }
    }

    // ── Security ─────────────────────────────────────────────────────────────

    /// The one control here that changes anything, and the reason the watch is
    /// worth reaching for at all in this situation: the moment you want to freeze
    /// a wallet is usually the moment your phone is what went missing.
    ///
    /// Freezing cannot lose anyone money — it only stops movement — so it is safe
    /// on a wrist in a way that nothing in the sending direction is. Unfreezing
    /// deliberately is not here; that one needs the phone.
    private var securitySection: some View {
        Section {
            SafeActionButton(
                title: "Freeze wallet",
                armedTitle: "Confirm freeze",
                icon: "lock.fill",
                tint: .primary,
                perform: { await phone.run("freezeWallet") }
            )
        } footer: {
            Text("Stops all transfers. Unfreeze from your phone.")
                .font(.caption2)
        }
    }
}

// ── Rows ─────────────────────────────────────────────────────────────────────

struct TransactionRow: View {
    let transaction: SnapshotTransaction
    let concealed: Bool

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.caption2)
                .foregroundStyle(iconTint)

            VStack(alignment: .leading, spacing: 1) {
                Text(transaction.name)
                    .font(.caption)
                    .lineLimit(1)
                Text("\(transaction.day) · \(transaction.time)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
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

    private var icon: String {
        if transaction.isPending { return "clock" }
        return transaction.isCredit ? "arrow.down.left" : "arrow.up.right"
    }

    private var iconTint: Color {
        if transaction.isPending { return .orange }
        return transaction.isCredit ? .green : .secondary
    }
}

private struct AlertRow: View {
    let icon: String
    let tint: Color
    let title: String
    let subtitle: String?

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.caption2)
                .foregroundStyle(tint)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.caption)
                if let subtitle {
                    Text(subtitle).font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// The one figure on this screen that is a proportion rather than an amount, so
/// it gets the one shape that reads as a proportion at a glance.
private struct BudgetRow: View {
    let budget: SnapshotBudget
    let concealed: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text("Budget").font(.caption2).foregroundStyle(.secondary)
                Spacer(minLength: 4)
                Text(concealed ? "••" : "\(budget.spent) / \(budget.limit)")
                    .font(.caption2.weight(.medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }

            // The bar is drawn clamped, but an over-budget bar turns red rather
            // than silently sitting full — "at the limit" and "past it" are
            // different facts and should not look the same.
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule().fill(.quaternary)
                    Capsule()
                        .fill(budget.isOver ? Color.red : Color.accentColor)
                        .frame(width: geometry.size.width * budget.clampedFraction)
                }
            }
            .frame(height: 4)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            concealed
                ? "Budget hidden"
                : "Budget: \(budget.spent) of \(budget.limit)\(budget.isOver ? ", over budget" : "")"
        )
    }
}

private struct StatRow: View {
    let label: String
    let value: String
    let concealed: Bool

    var body: some View {
        HStack {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Spacer(minLength: 4)
            Text(concealed ? "••" : value)
                .font(.caption2.weight(.medium))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .accessibilityElement(children: .combine)
    }
}

/// `handGestureShortcut` is watchOS 11+. Kept behind a modifier so the call site
/// stays readable and the 9.4 deployment floor is not raised for a nicety.
private struct PrimaryHandGesture: ViewModifier {
    let enabled: Bool

    func body(content: Content) -> some View {
        if #available(watchOS 11.0, *), enabled {
            content.handGestureShortcut(.primaryAction)
        } else {
            content
        }
    }
}

#Preview {
    ContentView().environmentObject(PhoneLink())
}
