import SwiftUI
import UserNotifications
import WatchKit

/// The custom wrist interface for a money push.
///
/// The system banner shows a truncated sentence in a grey box. A credit landing
/// is the moment a payments app most wants to own, and it is the whole reason to
/// wear one: amount first, at size, in the colour that says which direction the
/// money went.
enum MoneyNotificationKind {
    case received
    case sent
    /// Someone is asking *for* money. Rendered distinctly from a credit because
    /// it is the opposite event, and because it is the only one of the three
    /// that is waiting on the user to do something.
    case requested

    var icon: String {
        switch self {
        case .received: return "arrow.down.left.circle.fill"
        case .sent: return "arrow.up.right.circle.fill"
        case .requested: return "hand.raised.circle.fill"
        }
    }

    var tint: Color {
        switch self {
        case .received: return .green
        case .sent: return .secondary
        case .requested: return .orange
        }
    }

    func caption(_ counterparty: String) -> String {
        switch self {
        case .received: return "from \(counterparty)"
        case .sent: return "to \(counterparty)"
        case .requested: return "\(counterparty) asked you"
        }
    }
}

struct MoneyNotificationView: View {
    let kind: MoneyNotificationKind
    let amount: String
    let counterparty: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: kind.icon)
                .font(.title3)
                .foregroundStyle(kind.tint)

            // The push always carries a usable title; `amount` is the structured
            // field added alongside it and is preferred when present.
            Text(amount.isEmpty ? title : amount)
                .font(.system(.title3, design: .rounded).weight(.semibold))
                .foregroundStyle(kind == .received ? .green : .primary)
                .minimumScaleFactor(0.5)
                .lineLimit(1)

            if !counterparty.isEmpty {
                Text(kind.caption(counterparty))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            } else if !message.isEmpty {
                Text(message)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
            }
        }
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity)
    }
}

/// Bridges `UNNotification` into the SwiftUI view above.
///
/// `didReceive` is called before the body is read, so the properties it sets are
/// what render — no published state needed.
final class MoneyNotificationController: WKUserNotificationHostingController<MoneyNotificationView> {
    private var kind: MoneyNotificationKind = .received
    private var amount = ""
    private var counterparty = ""
    private var title = ""
    private var message = ""

    override var body: MoneyNotificationView {
        MoneyNotificationView(
            kind: kind,
            amount: amount,
            counterparty: counterparty,
            title: title,
            message: message
        )
    }

    override func didReceive(_ notification: UNNotification) {
        let content = notification.request.content
        title = content.title
        message = content.body

        // Expo nests the data map one level down; FCM flattens it. Read both so
        // the scene works whichever transport delivered the push.
        // `userInfo` is keyed by AnyHashable, so it is narrowed to string keys
        // first — the payload is JSON off the wire and has no others.
        let info = content.userInfo.reduce(into: [String: Any]()) { result, entry in
            if let key = entry.key as? String { result[key] = entry.value }
        }
        let data = (info["body"] as? [String: Any]) ?? (info["data"] as? [String: Any]) ?? info

        amount = data["amount"] as? String ?? ""
        counterparty = data["counterparty"] as? String ?? ""
        switch data["type"] as? String {
        case "TRANSFER_COMPLETED": kind = .sent
        case "MONEY_REQUESTED": kind = .requested
        default: kind = .received
        }
    }
}
