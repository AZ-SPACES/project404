import SwiftUI
import WidgetKit

/// Anything waiting on the user.
///
/// Separate from the balance on purpose: a balance is something you go and look
/// at, while a pending request is something that should find you. Those want
/// different places on a face, and someone who wants both should not have to
/// give up a slot to get one.
struct AttentionComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AzaAttentionComplication", provider: AttentionProvider()) { entry in
            AttentionComplicationView(entry: entry)
                .modifier(ComplicationBackground())
        }
        .configurationDisplayName("Waiting on you")
        .description("Money requests and pending transfers.")
        .supportedFamilies([.accessoryCircular, .accessoryInline, .accessoryRectangular])
    }
}

struct AttentionProvider: TimelineProvider {
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
        let snapshot = SnapshotReader.load()
        let entry = BalanceEntry(date: Date(), snapshot: snapshot)

        // Relevance drives Smart Stack surfacing. A face slot is fixed, but the
        // Smart Stack chooses — and a complication showing "nothing waiting"
        // has no business being chosen over one that has something to say.
        let relevance = TimelineEntryRelevance(score: Float(snapshot?.attention ?? 0))
        let scored = BalanceEntry(date: entry.date, snapshot: entry.snapshot, relevance: relevance)

        completion(Timeline(entries: [scored], policy: .after(Date().addingTimeInterval(15 * 60))))
    }
}

struct AttentionComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: BalanceEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            Text(summary)

        case .accessoryCircular:
            VStack(spacing: 0) {
                Image(systemName: icon).font(.system(size: 11))
                Text("\(count)")
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
            }
            .widgetAccentable()

        default:
            VStack(alignment: .leading, spacing: 1) {
                Label("Waiting on you", systemImage: icon)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(summary)
                    .font(.system(.caption, design: .rounded).weight(.semibold))
                    .minimumScaleFactor(0.6)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var requests: Int { entry.snapshot?.requestCount ?? 0 }
    private var pending: Int { entry.snapshot?.pendingCount ?? 0 }
    private var count: Int { requests + pending }

    /// Counts are not amounts, so the balance-hidden preference does not apply:
    /// "2 requests" reveals nothing a shoulder-surfer can use.
    private var icon: String { requests > 0 ? "hand.raised.fill" : "clock" }

    private var summary: String {
        if entry.snapshot == nil { return "Open Aza" }
        if requests > 0 {
            return "\(requests) request\(requests == 1 ? "" : "s")"
        }
        if pending > 0 {
            return "\(pending) pending"
        }
        return "Nothing waiting"
    }
}
