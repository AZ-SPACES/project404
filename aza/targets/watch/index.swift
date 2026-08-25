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
    }
}
