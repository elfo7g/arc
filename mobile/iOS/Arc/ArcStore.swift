import Foundation
import SwiftUI

@MainActor
final class ArcStore: ObservableObject {
    @Published var selectedTab: ArcTab = .home
    @Published var ritualMessages: [RitualMessage] = [
        RitualMessage(role: .nilo, text: "今日、一番印象に残ったことは？")
    ]
    @Published var journal: [JournalEntry] = []
    @Published var isSettingsPresented = false
    @Published var isSending = false
    @Published var isLoadingState = false
    @Published var authErrorMessage: String?

    let supabase = ArcSupabaseClient()
    private lazy var api = ArcAPI(supabase: supabase)
    private var userState = UserStateBlob()
    private var questionCount = 1

    var isSignedIn: Bool { supabase.isSignedIn }

    var latestEntry: JournalEntry? { journal.first }

    func loadStateIfSignedIn() async {
        guard isSignedIn else { return }
        isLoadingState = true
        defer { isLoadingState = false }
        do {
            userState = try await supabase.getUserState()
            journal = userState.journal
        } catch {
            authErrorMessage = "同期に失敗しました。もう一度お試しください。"
        }
    }

    func signInWithGoogle() async {
        do {
            try await supabase.signInWithGoogle()
            await loadStateIfSignedIn()
        } catch {
            authErrorMessage = "Googleサインインに失敗しました。"
        }
    }

    func sendEmailOTP(email: String) async {
        do {
            try await supabase.sendEmailOTP(email: email)
        } catch {
            authErrorMessage = "確認コードの送信に失敗しました。"
        }
    }

    func verifyEmailOTP(email: String, token: String) async {
        do {
            try await supabase.verifyEmailOTP(email: email, token: token)
            await loadStateIfSignedIn()
        } catch {
            authErrorMessage = "確認コードが正しくありません。"
        }
    }

    func signOut() {
        supabase.signOut()
        journal = []
        userState = UserStateBlob()
        resetRitual()
    }

    func submitNightLine(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isSending else { return }

        ritualMessages.append(RitualMessage(role: .user, text: String(trimmed.prefix(200))))
        isSending = true
        defer { isSending = false }

        do {
            let shouldFinish = questionCount >= 5
            let response = try await api.sendNightRitual(
                messages: ritualMessages,
                questionCount: questionCount,
                forceFinish: shouldFinish
            )
            await apply(response)
        } catch {
            applyFallback()
        }
    }

    private func apply(_ response: NightRitualResponse) async {
        if response.done {
            let closing = response.closingMessage ?? response.niloMessage ?? "ここまでで、今夜の記録にしましょう。"
            ritualMessages.append(RitualMessage(role: .nilo, text: closing))
            journal.insert(JournalEntry(
                title: response.title ?? "今夜の記録",
                summaryLines: response.summaryLines.map { Array($0.prefix(5)) } ?? ["今日の言葉を短く残しました。"],
                niloLine: response.niloLine ?? closing
            ), at: 0)
            resetRitual()
            await persistState()
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

    private func persistState() async {
        userState.journal = journal
        do {
            try await supabase.setUserState(userState)
        } catch {
            // Sync failure is non-fatal for this pass; the entry is still visible
            // locally, and the next successful sync will carry it up.
        }
    }
}
