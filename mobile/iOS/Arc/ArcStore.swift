import Foundation
import SwiftUI

@MainActor
final class ArcStore: ObservableObject {
    @Published var selectedTab: ArcTab = .home
    @Published var ritualMessages: [RitualMessage] = [
        RitualMessage(role: .nilo, text: "今日、一番印象に残ったことは？")
    ]
    @Published var journal: [JournalEntry] = []
    @Published var memories: [MemoryEntry] = []
    @Published var profile = ArcProfile()
    @Published var isSettingsPresented = false
    @Published var isSending = false

    private let api = ArcAPI()
    private let storageKey = "arc.ios.state.v1"
    private var questionCount = 1

    init() {
        load()
    }

    var latestEntry: JournalEntry? {
        journal.first
    }

    func submitNightLine(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isSending else { return }

        ritualMessages.append(RitualMessage(role: .user, text: String(trimmed.prefix(50))))
        isSending = true

        do {
            let shouldFinish = questionCount >= 5
            let response = try await api.sendNightRitual(
                messages: ritualMessages,
                questionCount: questionCount,
                forceFinish: shouldFinish
            )
            apply(response)
        } catch {
            applyFallback()
        }

        isSending = false
        save()
    }

    func saveProfile(name: String, birthdate: Date?) {
        profile.name = name
        profile.birthdate = birthdate
        save()
    }

    func daysSinceBirth() -> Int? {
        guard let birthdate = profile.birthdate else { return nil }
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: birthdate)
        let today = calendar.startOfDay(for: Date())
        return calendar.dateComponents([.day], from: start, to: today).day
    }

    private func apply(_ response: NightRitualResponse) {
        if response.done {
            let closing = response.closingMessage ?? response.niloMessage ?? "ここまでで、今夜の記録にしましょう。"
            ritualMessages.append(RitualMessage(role: .nilo, text: closing))
            journal.insert(JournalEntry(
                title: response.title ?? "今夜の記録",
                summaryLines: response.summaryLines?.prefix(5).map(String.init) ?? ["今日の言葉を短く残しました。"],
                niloLine: response.niloLine ?? closing
            ), at: 0)
            resetRitual()
        } else {
            questionCount = min(5, questionCount + 1)
            ritualMessages.append(RitualMessage(
                role: .nilo,
                text: response.nextQuestion ?? "もう少しだけ、その場面を残すなら？"
            ))
        }
    }

    private func applyFallback() {
        let userLines = ritualMessages.filter { $0.role == .user }.map(\.text)
        let title = userLines.first ?? "今夜の記録"
        let closing = "ここまでで、今夜の記録にしましょう。"
        ritualMessages.append(RitualMessage(role: .nilo, text: closing))
        journal.insert(JournalEntry(
            title: String(title.prefix(24)),
            summaryLines: userLines.isEmpty ? ["今日の印象を短く残しました。"] : userLines,
            niloLine: closing
        ), at: 0)
        resetRitual()
    }

    private func resetRitual() {
        questionCount = 1
        ritualMessages = [RitualMessage(role: .nilo, text: "今日、一番印象に残ったことは？")]
    }

    private func save() {
        let state = PersistedArcState(journal: journal, memories: memories, profile: profile)
        if let data = try? JSONEncoder().encode(state) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    private func load() {
        guard
            let data = UserDefaults.standard.data(forKey: storageKey),
            let state = try? JSONDecoder().decode(PersistedArcState.self, from: data)
        else { return }

        journal = state.journal
        memories = state.memories
        profile = state.profile
    }
}