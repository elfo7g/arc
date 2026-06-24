import SwiftUI

@main
struct ArcApp: App {
    @StateObject private var store = ArcStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .preferredColorScheme(.dark)
        }
    }
}
