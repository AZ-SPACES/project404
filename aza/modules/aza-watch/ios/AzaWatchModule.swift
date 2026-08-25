import ExpoModulesCore

public class AzaWatchModule: Module {
    public func definition() -> ModuleDefinition {
        Name("AzaWatch")

        Events("onRefreshRequested")

        OnCreate {
            WatchBridge.shared.activate()
            WatchBridge.shared.onRefreshRequested = { [weak self] in
                self?.sendEvent("onRefreshRequested", [:])
            }
        }

        Property("isWatchAppAvailable") {
            WatchBridge.shared.isWatchAppAvailable
        }

        AsyncFunction("sendSnapshot") { (json: String) in
            try WatchBridge.shared.send(json)
        }
    }
}
