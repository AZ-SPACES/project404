import SwiftUI

@main
struct AzaWatchApp: App {
    /// One link for the app's lifetime. Recreating it would re-activate the
    /// WCSession and drop the cached snapshot mid-session.
    @StateObject private var phone = PhoneLink()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(phone)
        }

        // watchOS routes a push to a custom interface by APNs category. These two
        // are set server-side in NotificationService.watchNotificationCategory;
        // every other notification type keeps the system banner on purpose.
        WKNotificationScene(
            controller: MoneyNotificationController.self,
            category: "MONEY_RECEIVED"
        )
        WKNotificationScene(
            controller: MoneyNotificationController.self,
            category: "TRANSFER_COMPLETED"
        )
        WKNotificationScene(
            controller: MoneyNotificationController.self,
            category: "MONEY_REQUESTED"
        )
    }
}
