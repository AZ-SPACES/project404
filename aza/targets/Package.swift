// swift-tools-version: 5.9
import PackageDescription
import Foundation

/// Tests for the watch app's model layer.
///
/// A SwiftPM package rather than an Xcode test target on purpose: the watchOS
/// platform components are not installed (see docs/WATCH_APP_PLAN.md), so an
/// Xcode test target could not be *run* by anyone who has not done the multi-GB
/// download. This compiles the same source files for macOS and runs anywhere —
/// including CI, which will never have a watch simulator.
///
/// It deliberately covers only the platform-free files. Everything importing
/// SwiftUI, WatchKit or WatchConnectivity is out of reach here, which is a
/// standing argument for keeping decisions like date parsing and staleness in
/// the model rather than in a view.
let modelSources = ["WalletSnapshot.swift", "SnapshotStore.swift"]

/// Everything else in `watch/` belongs to the Xcode target, not to this package.
/// Computed rather than listed so adding a SwiftUI view does not silently start
/// emitting "unhandled file" warnings that nobody gets round to fixing.
let excludedFromModel: [String] = {
    let dir = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .appendingPathComponent("watch")
    let all = (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []
    return all.filter { !modelSources.contains($0) && !$0.hasPrefix(".") }.sorted()
}()

let package = Package(
    name: "AzaWatchModel",
    platforms: [.macOS(.v13)],
    targets: [
        .target(
            name: "AzaWatchModel",
            path: "watch",
            exclude: excludedFromModel,
            sources: modelSources
        ),
        .testTarget(
            name: "AzaWatchModelTests",
            dependencies: ["AzaWatchModel"],
            path: "watch-tests"
        ),
    ]
)
