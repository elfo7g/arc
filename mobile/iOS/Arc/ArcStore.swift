import Foundation
import SwiftUI

@MainActor
final class ArcStore: ObservableObject {
    @Published var selectedTab: ArcTab = .home
    @Published var ritualMessages: [RitualMessage] = [
        RitualMessage(role: .nilo, text: "今日、一番印象に残ったことは？")
    ]
    @Published var journal: [JournalEntry] = []
    @Published var quests: [Quest] = []
    @Published var memories: [MemoryEntry] = []
    @Published var profile = ArcProfile()
    @Published var isSettingsPresented = false
    @Published var isSending = false

    private let api = ArcAPI()
    private let storageKey = "arc.ios.state.v1"
    private var questionCount = 1

    init() {
        load()
        ensureDailyQuests()
    }

    var activeQuests: [Quest] {
        quests.filter { !$0.isCompleted }
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

    func complete(_ quest: Quest) {
        guard let index = quests.firstIndex(where: { $0.id == quest.id }) else { return }
        quests[index].isCompleted = true
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
            addGeneratedQuests(response)
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

    private func addGeneratedQuests(_ response: NightRitualResponse) {
        let titles = (response.quests ?? []).map(\.title) + [response.questSuggestion].compactMap { $0 }
        for title in titles where !title.isEmpty {
            guard !quests.contains(where: { $0.title == title && !$0.isCompleted }) else { continue }
            quests.insert(Quest(title: title, source: "night-ritual"), at: 0)
        }
    }

    private func resetRitual() {
        questionCount = 1
        ritualMessages = [RitualMessage(role: .nilo, text: "今日、一番印象に残ったことは？")]
    }

    private func ensureDailyQuests() {
        guard quests.filter({ $0.source == "daily" && !$0.isCompleted }).isEmpty else { return }
        let bank = ["水を1杯飲む", "ストレッチ3分", "本を1ページ読む", "机を片付ける", "日光を10分浴びる", "深呼吸20回"]
        for title in bank.shuffled().prefix(Int.random(in: 2...4)) {
            quests.insert(Quest(title: title, source: "daily"), at: 0)
        }
        save()
    }

    private func save() {
        let state = PersistedArcState(journal: journal, quests: quests, memories: memories, profile: profile)
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
        quests = state.quests
        memories = state.memories
        profile = state.profile
    }
}
