import SwiftUI
import WidgetKit

/// Balance on the watch face.
///
/// The reason the watch app exists: the whole interaction is a wrist raise, with
/// no app launch at all. It renders whatever the phone last mirrored into the
/// shared container — the complication never fetches, never authenticates, and
/// cannot show anything the watch app could not already show.
struct BalanceComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AzaBalanceComplication", provider: BalanceProvider()) { entry in
            BalanceComplicationView(entry: entry)
                .modifier(ComplicationBackground())
        }
        .configurationDisplayName("Balance")
        .description("Your Aza wallet balance at a glance.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryInline,
            .accessoryRectangular,
        ])
    }
}

/// `containerBackground` is watchOS 10+, and mandatory there — a complication
/// that omits it is letterboxed inside its family's frame. It does not exist at
/// the 9.4 deployment floor, so it cannot simply be called unconditionally.
struct ComplicationBackground: ViewModifier {
    func body(content: Content) -> some View {
        if #available(watchOS 10.0, *) {
            content.containerBackground(.clear, for: .widget)
        } else {
            content
        }
    }
}

struct BalanceEntry: TimelineEntry {
    let date: Date
    let snapshot: ComplicationSnapshot?

    /// Drives Smart Stack surfacing. Defaulted because only the attention
    /// complication has a reason to score itself — a balance is equally relevant
    /// whenever you choose to look at it.
    var relevance: TimelineEntryRelevance?

    init(date: Date, snapshot: ComplicationSnapshot?, relevance: TimelineEntryRelevance? = nil) {
        self.date = date
        self.snapshot = snapshot
        self.relevance = relevance
    }
}

struct BalanceProvider: TimelineProvider {
    func placeholder(in context: Context) -> BalanceEntry {
        BalanceEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (BalanceEntry) -> Void) {
        // The gallery preview must show something legible, and a real balance in
        // the picker is a privacy leak in a screenshot-able surface.
        let snapshot = context.isPreview ? .placeholder : SnapshotReader.load()
        completion(BalanceEntry(date: Date(), snapshot: snapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BalanceEntry>) -> Void) {
        let entry = BalanceEntry(date: Date(), snapshot: SnapshotReader.load())

        // The real refresh signal is `WidgetCenter.reloadAllTimelines()` from the
        // watch app the moment a snapshot lands (see SnapshotStore.save). This
        // interval is only a backstop so the staleness styling still turns over
        // on a face whose phone stopped talking to it entirely.
        let next = Date().addingTimeInterval(15 * 60)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct BalanceComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: BalanceEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            Text(inlineText)

        case .accessoryCircular:
            VStack(spacing: 0) {
                Text(entry.snapshot?.currency ?? "GHS")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.secondary)
                Text(compactAmount)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
            }
            .widgetAccentable()

        case .accessoryCorner:
            Text(compactAmount)
                .font(.system(.body, design: .rounded).weight(.semibold))
                .widgetLabel("Aza \(entry.snapshot?.currency ?? "GHS")")

        default:
            VStack(alignment: .leading, spacing: 1) {
                Text("Aza")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(fullAmount)
                    .font(.system(.title3, design: .rounded).weight(.semibold))
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                Text(footnote)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// The balance-hidden preference has to reach the face too. A complication is
    /// the single most overlooked surface on the device — it is on screen to
    /// anyone glancing at the wrist, with no tap required.
    private var isConcealed: Bool { entry.snapshot?.balanceHidden ?? false }

    private var fullAmount: String {
        guard let snapshot = entry.snapshot else { return "—" }
        return isConcealed ? "••••" : snapshot.formattedBalance
    }

    /// Circular and corner families have room for a number, not for a currency
    /// symbol and thousands separators as well.
    private var compactAmount: String {
        guard let snapshot = entry.snapshot else { return "—" }
        guard !isConcealed else { return "••" }

        let digits = snapshot.formattedBalance.filter { $0.isNumber || $0 == "." }
        guard let value = Double(digits) else { return snapshot.formattedBalance }

        if value >= 1_000_000 { return String(format: "%.1fM", value / 1_000_000) }
        if value >= 1_000 { return String(format: "%.1fk", value / 1_000) }
        return String(format: "%.0f", value)
    }

    private var inlineText: String {
        guard let snapshot = entry.snapshot else { return "Aza —" }
        return isConcealed ? "Aza ••••" : "Aza \(snapshot.formattedBalance)"
    }

    private var footnote: String {
        guard let snapshot = entry.snapshot else { return "Open Aza on your phone" }
        let time = snapshot.capturedAt.formatted(date: .omitted, time: .shortened)
        return snapshot.isStale ? "as of \(time)" : "Updated \(time)"
    }
}
