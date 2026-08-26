import AppIntents
import Foundation

/// Siri and Shortcuts entry points.
///
/// Both read the App Group snapshot the phone already mirrored — no network, no
/// token, no launch. That is the whole reason these are safe to expose: an
/// intent cannot reach anything the watch app itself could not already show.
struct CheckBalanceIntent: AppIntent {
    static var title: LocalizedStringResource = "Check balance"
    static var description = IntentDescription("Reads your latest Aza wallet balance.")

    /// Answering in place is the point; launching the app to read one number
    /// would defeat it.
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = SnapshotStore.load(), !snapshot.isEmpty else {
            return .result(dialog: "I don't have your balance yet. Open Aza on your iPhone.")
        }

        // A user who hid the balance on the phone did so against being overlooked.
        // Siri says it out loud, on a speaker, to whoever is standing there —
        // the preference has to hold here or it means nothing.
        guard !snapshot.balanceHidden else {
            return .result(dialog: "Your balance is hidden. Open Aza to see it.")
        }

        let balance = "\(snapshot.formattedBalance)"
        if snapshot.isStale() {
            let time = snapshot.capturedAt.formatted(date: .omitted, time: .shortened)
            return .result(dialog: "\(balance), as of \(time). Open Aza on your iPhone to update it.")
        }
        return .result(dialog: "Your Aza balance is \(balance).")
    }
}

struct SpentTodayIntent: AppIntent {
    static var title: LocalizedStringResource = "Check today's spending"
    static var description = IntentDescription("Reads how much you have sent from Aza today.")
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = SnapshotStore.load(), let spending = snapshot.spending else {
            return .result(dialog: "I don't have your spending yet. Open Aza on your iPhone.")
        }
        guard !snapshot.balanceHidden else {
            return .result(dialog: "Your figures are hidden. Open Aza to see them.")
        }
        return .result(dialog: "You've sent \(spending.sentToday) today.")
    }
}

/// Puts both intents in the Shortcuts gallery and makes the phrases sayable
/// without the user wiring anything up first.
struct AzaShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CheckBalanceIntent(),
            phrases: [
                "What's my \(.applicationName) balance",
                "Check my \(.applicationName) balance",
                "How much is in my \(.applicationName) wallet",
            ],
            shortTitle: "Balance",
            systemImageName: "creditcard"
        )
        AppShortcut(
            intent: SpentTodayIntent(),
            phrases: [
                "How much have I spent on \(.applicationName) today",
                "What did I send on \(.applicationName) today",
            ],
            shortTitle: "Spent today",
            systemImageName: "arrow.up.right"
        )
    }
}
