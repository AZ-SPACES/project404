import ExpoModulesCore

public class AzaWatchModule: Module {
    public func definition() -> ModuleDefinition {
        Name("AzaWatch")

        Events("onRefreshRequested", "onWatchStateChanged", "onCommand")

        OnCreate {
            WatchBridge.shared.activate()
            WatchBridge.shared.onRefreshRequested = { [weak self] in
                self?.sendEvent("onRefreshRequested", [:])
            }
            WatchBridge.shared.onWatchStateChanged = { [weak self] in
                self?.sendEvent("onWatchStateChanged", [:])
            }
            WatchBridge.shared.onCommand = { [weak self] payload in
                self?.sendEvent("onCommand", payload)
            }
        }

        Property("isWatchAppAvailable") {
            WatchBridge.shared.isWatchAppAvailable
        }

        AsyncFunction("sendSnapshot") { (json: String) in
            try WatchBridge.shared.send(json)
        }

        AsyncFunction("clearSnapshot") {
            try WatchBridge.shared.clear()
        }

        AsyncFunction("resolveCommand") { (commandId: String, ok: Bool, message: String) in
            WatchBridge.shared.resolve(commandId: commandId, ok: ok, message: message)
        }
    }
}
