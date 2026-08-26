import SwiftUI
import WidgetKit

/// Budget on the watch face.
///
/// The one wallet figure that is a proportion rather than an amount, which makes
/// it the one that survives being shrunk to a circular complication: a ring is
/// legible at 30 points in a way that "GH₵ 1,240.00" never is. It is also the
/// number worth checking more often than the balance — the balance tells you
/// what you have, this tells you whether to spend it.
struct BudgetComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AzaBudgetComplication", provider: BudgetProvider()) { entry in
            BudgetComplicationView(entry: entry)
                .modifier(ComplicationBackground())
        }
        .configurationDisplayName("Budget")
        .description("How much of this month's budget you have used.")
        .supportedFamilies([.accessoryCircular, .accessoryInline, .accessoryRectangular])
    }
}

struct BudgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> BalanceEntry {
        BalanceEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (BalanceEntry) -> Void) {
        completion(BalanceEntry(
            date: Date(),
            snapshot: context.isPreview ? .placeholder : SnapshotReader.load()
        ))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BalanceEntry>) -> Void) {
        let entry = BalanceEntry(date: Date(), snapshot: SnapshotReader.load())
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
    }
}

struct BudgetComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: BalanceEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            Text(inlineText)

        case .accessoryCircular:
            if let budget, !isConcealed {
                Gauge(value: budget.clamped) {
                    Image(systemName: "chart.pie")
                } currentValueLabel: {
                    Text("\(Int((budget.fraction * 100).rounded()))")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                }
                .gaugeStyle(.accessoryCircularCapacity)
                .tint(budget.isOver ? .red : nil)
            } else {
                // No budget set is not zero spent. Say which one it is.
                VStack(spacing: 0) {
                    Image(systemName: "chart.pie").font(.system(size: 12))
                    Text(isConcealed ? "••" : "—").font(.system(size: 13, weight: .semibold))
                }
                .widgetAccentable()
            }

        default:
            VStack(alignment: .leading, spacing: 2) {
                Text("Budget").font(.caption2).foregroundStyle(.secondary)
                if let budget, !isConcealed {
                    Text("\(budget.spent) / \(budget.limit)")
                        .font(.system(.caption, design: .rounded).weight(.semibold))
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                    Gauge(value: budget.clamped) { EmptyView() }
                        .gaugeStyle(.accessoryLinearCapacity)
                        .tint(budget.isOver ? .red : nil)
                } else {
                    Text(emptyLabel).font(.caption2).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var budget: ComplicationBudget? { entry.snapshot?.budget }

    /// The balance-hidden preference covers this too: a budget ring plus a
    /// spending figure reconstructs most of what hiding the balance was meant
    /// to keep off an overlooked wrist.
    private var isConcealed: Bool { entry.snapshot?.balanceHidden ?? false }

    private var emptyLabel: String {
        if isConcealed { return "Hidden" }
        return entry.snapshot == nil ? "Open Aza on your phone" : "No budget set"
    }

    private var inlineText: String {
        guard let budget, !isConcealed else { return "Budget \(isConcealed ? "••" : "—")" }
        return "Budget \(Int((budget.fraction * 100).rounded()))%"
    }
}
