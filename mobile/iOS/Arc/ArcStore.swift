import Foundation
import SwiftUI

// Mirrors App.js `LIFE_CHAT_MIN_MEMORIES`: the「たずねる」entry appears only
// once the record has grown past this (empty-room protection).
private let lifeChatMinMemories = 5
// 儀式の回答入力上限（創業者決定 2026-07-10）: 漢字圏は100字。この
// クライアントは日本語のみなので固定（App.js `getRitualAnswerLimit`）。
private let ritualAnswerLimit = 100
private let maxReflectionQuestions = 5
// The journal shows a picker over the most recent months only, like the RN
// diary (App.js `DIARY_ARCHIVE_MONTHS`).
private let diaryArchiveMonths = 6

// Crisis-signal keyword lists exist for user safety, not display copy — merged
// across every supported language so the check fires no matter which language
// the user is typing in (App.js `detectPersistentDistress`). Detection runs
// on-device only; nothing about it is sent anywhere.
private let crisisStrongSignals: [String] = [
    "死にたい", "消えたい", "居なくなりたい", "いなくなりたい", "自殺", "自傷", "リストカット", "生きていたくない", "生きる意味がない", "死んでしまいたい",
    "want to die", "wish i was dead", "kill myself", "suicide", "suicidal", "self-harm", "self harm", "cutting myself", "don't want to live", "no reason to live", "end my life",
    "quiero morir", "quisiera estar muerto", "quisiera estar muerta", "matarme", "suicidio", "suicida", "autolesion", "autolesión", "hacerme daño", "cortarme", "no quiero vivir", "no hay razón para vivir", "acabar con mi vida",
    "envie de mourir", "je veux mourir", "me suicider", "suicidaire", "me faire du mal", "m'automutiler", "je ne veux plus vivre", "plus envie de vivre", "mettre fin à mes jours",
    "will sterben", "möchte tot sein", "mich umbringen", "selbstmord", "suizid", "suizidal", "selbstverletzung", "mich ritzen", "will nicht mehr leben", "keinen sinn mehr zu leben",
    "想死", "不想活了", "自杀", "自残", "割腕", "活着没有意义", "想消失", "结束生命",
    "죽고 싶다", "죽고싶다", "사라지고 싶다", "자살", "자해", "손목을 긋", "살고 싶지 않다", "살아갈 의미가 없다"
]
private let crisisSoftSignals: [String] = [
    "つらい", "辛い", "苦しい", "もう無理", "もうだめ", "もうダメ", "限界", "助けて", "誰もいない", "ひとりぼっち", "孤独", "涙が", "泣いて", "眠れない", "消えてしまいたい",
    "it's too hard", "i can't take it", "i can't do this anymore", "at my limit", "help me", "no one is there", "all alone", "so lonely", "crying", "can't sleep", "i want to disappear",
    "es demasiado difícil", "no puedo más", "ya no puedo con esto", "estoy al límite", "ayúdame", "ayuda", "no hay nadie", "estoy solo", "estoy sola", "me siento tan solo", "me siento tan sola", "llorando", "no puedo dormir", "quiero desaparecer",
    "c'est trop dur", "je n'en peux plus", "à bout", "à ma limite", "aide-moi", "personne n'est là", "tout seul", "toute seule", "si seul", "je pleure", "je n'arrive pas à dormir", "je veux disparaître",
    "es ist zu schwer", "ich kann nicht mehr", "am ende meiner kräfte", "an meiner grenze", "hilf mir", "niemand ist da", "ganz allein", "so einsam", "ich weine", "kann nicht schlafen", "möchte verschwinden",
    "好痛苦", "撑不下去", "受不了了", "已经到极限", "救救我", "没有人在", "孤单一人", "好孤独", "在哭", "睡不着", "好想消失",
    "너무 힘들다", "더는 못하겠다", "한계다", "도와줘", "아무도 없다", "혼자다", "너무 외롭다", "눈물이", "울고 있다", "잠을 못 잔다", "사라지고 싶다"
]

// つらさの判定は端末内で完結させる。強い信号は一度でも、弱い信号は複数の
// 回答にまたがって現れたときだけ導線を灯す（＝「続く場合」）。
func detectPersistentDistress(_ messages: [DialogueMessage]) -> Bool {
    let userTexts = messages.filter { $0.role == "user" }.map { $0.text.lowercased() }
    guard !userTexts.isEmpty else { return false }
    if userTexts.contains(where: { text in crisisStrongSignals.contains { text.contains($0.lowercased()) } }) {
        return true
    }
    let withSoft = userTexts.filter { text in crisisSoftSignals.contains { text.contains($0.lowercased()) } }
    return withSoft.count >= 2
}

// MARK: - Date helpers (same semantics as App.js)

func toDateKey(_ date: Date) -> String {
    let components = Calendar.current.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
}

/// The journal's "day" rolls over at 03:00, not midnight (App.js
/// `getJournalDateKey`), so a record written at 1am still belongs to tonight.
func journalDateKey(_ date: Date = Date()) -> String {
    var target = date
    if Calendar.current.component(.hour, from: date) < 3 {
        target = Calendar.current.date(byAdding: .day, value: -1, to: date) ?? date
    }
    return toDateKey(target)
}

func formatDotDate(_ dateKey: String) -> String {
    dateKey.replacingOccurrences(of: "-", with: ".")
}

/// Lifetime day count from a YYYY-MM-DD birthdate — not usage days, so pausing
/// never shrinks it and it can't manufacture guilt (App.js `daysSince`).
func daysSince(_ value: String?) -> Int? {
    guard let value, !value.isEmpty else { return nil }
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.timeZone = TimeZone.current
    guard let birth = formatter.date(from: value) else { return nil }
    let start = Calendar.current.startOfDay(for: birth)
    let today = Calendar.current.startOfDay(for: Date())
    let days = Calendar.current.dateComponents([.day], from: start, to: today).day ?? 0
    return max(0, days)
}

/// 儀式の扉が開く時間帯。RN側は設定で変更できるが、この最初のネイティブ版は
/// 既定値（20:00〜翌03:00）に固定する（App.js `isRitualWindow` の既定）。
func isRitualWindow(_ date: Date = Date()) -> Bool {
    let minutes = Calendar.current.component(.hour, from: date) * 60 + Calendar.current.component(.minute, from: date)
    return minutes >= 20 * 60 || minutes < 3 * 60
}

struct JournalMonth: Identifiable {
    let monthKey: String
    let entries: [JournalEntry]

    var id: String { monthKey }
}

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
    @Published var ritualNotice: String?

    // 「たずねる」(life chat)。セッションのメッセージはこのstateにのみ存在し、
    // AsyncStorage相当にもuser_stateにも保存しない。ユーザーが明示して残すのは
    // 対話から作った短い日記要約だけ(RN側と同じ構造保証)。
    @Published var lifeChatOpen = false
    @Published var lifeChatMessages: [DialogueMessage] = []
    @Published var lifeChatBusy = false
    @Published var lifeChatNotice: String?
    @Published var lifeChatSummary: LifeChatSummary?
    @Published var lifeChatSummaryBusy = false
    @Published var lifeChatSupportVisible = false

    let supabase = ArcSupabaseClient()
    private lazy var api = ArcAPI(supabase: supabase)
    private var userState = UserStateBlob()
    private var questionCount = 1
    private var lifeChatWatchTimer: Timer?

    var isSignedIn: Bool { supabase.isSignedIn }

    // MARK: - Derived home state

    var lifeDay: Int? { daysSince(userState.profileBirthdate) }

    /// 挨拶は時間帯に合わせる(創業者指摘 2026-07-11: 真昼の「おつかれさま」は
    /// 不自然)。夕方〜深夜(17時〜翌5時)は「今日もおつかれさま。」
    var homeGreeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour >= 17 || hour < 5 { return "今日もおつかれさま。" }
        return hour < 12 ? "おはようございます。" : "こんにちは。"
    }

    var journalRecordedToday: Bool {
        let key = journalDateKey()
        return journal.contains { $0.dateKey == key }
    }

    /// 儀式の扉は「未記録 かつ 20:00〜03:00」のときだけ開く(創業者決定
    /// 2026-07-11)。例外は初回の記録だけ — オンボーディングは時間を選ばない。
    var ritualDoorOpen: Bool {
        !journalRecordedToday && (isRitualWindow() || journal.isEmpty)
    }

    /// 「たずねる」は儀式と共存しない: 扉が開いている間と儀式中は出さない。
    /// 記録が育つ前(5件未満)は入口自体を出さない。
    var lifeChatAvailable: Bool {
        userState.memories.count >= lifeChatMinMemories && !ritualDoorOpen && !ritualInProgress
    }

    var ritualInProgress: Bool { ritualMessages.contains { $0.role == .user } || isSending }

    /// Journal grouped into the most recent months, newest first, capped to the
    /// picker's archive window (App.js `getJournalMonthView`).
    var journalMonths: [JournalMonth] {
        let currentKey = String(journalDateKey().prefix(7))
        guard let oldest = Calendar.current.date(byAdding: .month, value: -(diaryArchiveMonths - 1), to: Date()) else { return [] }
        let oldestKey = String(toDateKey(oldest).prefix(7))
        var grouped: [String: [JournalEntry]] = [:]
        for entry in journal {
            let key = entry.monthKey
            guard key.count == 7, key >= oldestKey, key <= currentKey else { continue }
            grouped[key, default: []].append(entry)
        }
        return grouped
            .sorted { $0.key > $1.key }
            .map { key, entries in
                JournalMonth(monthKey: key, entries: entries.sorted { $0.dateKey > $1.dateKey })
            }
    }

    // MARK: - Auth / sync

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
        closeLifeChat()
        resetRitual()
    }

    // MARK: - Night ritual

    func submitNightLine(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isSending else { return }

        ritualNotice = nil
        ritualMessages.append(RitualMessage(role: .user, text: String(trimmed.prefix(ritualAnswerLimit))))
        isSending = true
        defer { isSending = false }

        do {
            let response = try await api.sendNightRitual(
                messages: ritualMessages,
                questionCount: questionCount,
                forceFinish: questionCount >= maxReflectionQuestions,
                pastMemories: userState.memoryExcerpts(limit: 40)
            )
            await apply(response)
        } catch {
            applyFallback()
        }
    }

    private func apply(_ response: NightRitualResponse) async {
        // 意味を受け取れない回答: 対話には足さず差し戻して、同じ問いのまま
        // 書き直させる(創業者決定 2026-07-10)。
        if response.unintelligible == true {
            if ritualMessages.last?.role == .user { ritualMessages.removeLast() }
            ritualNotice = "うまく受け取れませんでした。もう一度、言葉にしてみてください。"
            return
        }
        if response.done {
            let closing = response.closingMessage ?? response.niloMessage ?? "ここまでで、今夜の記録にしましょう。"
            ritualMessages.append(RitualMessage(role: .nilo, text: closing))
            let entryDateKey = journalDateKey()
            let userAnswers = ritualMessages.filter { $0.role == .user }.map(\.text)
            let lines = (response.summaryLines?.isEmpty == false) ? response.summaryLines! : ["今日の言葉を短く残しました。"]
            let entry = JournalEntry(
                dateKey: entryDateKey,
                dateLabel: formatDotDate(entryDateKey),
                title: response.title ?? "今夜の記録",
                lines: lines,
                event: userAnswers.first ?? "",
                meaning: userAnswers.last ?? response.title ?? "",
                source: "home",
                dialogue: ritualMessages.map { DialogueMessage(role: $0.role == .user ? "user" : "nilo", text: String($0.text.prefix(300))) },
                niloLine: response.niloLine ?? closing
            )
            journal.insert(entry, at: 0)
            addRitualMemory(entry: entry, response: response, userAnswers: userAnswers, closing: closing)
            resetRitual()
            await persistState()
        } else {
            questionCount = min(maxReflectionQuestions, questionCount + 1)
            ritualMessages.append(RitualMessage(
                role: .nilo,
                text: response.nextQuestion ?? "もう少しだけ、その場面を残すなら？"
            ))
        }
    }

    /// The journal keeps what happened; the memory keeps what it meant — and
    /// memories are what Nilo may quote later (chapters,「たずねる」). Respects
    /// the RN privacy switch synced in `settings.privacy.memoryLink`.
    private func addRitualMemory(entry: JournalEntry, response: NightRitualResponse, userAnswers: [String], closing: String) {
        guard userState.memoryLinkEnabled else { return }
        let keptPhrase = userAnswers.sorted { $0.count > $1.count }.first ?? ""
        let meaning = (response.niloLine ?? closing).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !meaning.isEmpty || !keptPhrase.isEmpty else { return }
        let memory: JSONValue = .object([
            "id": .string("memory-\(UUID().uuidString.lowercased())"),
            "dateKey": .string(entry.dateKey),
            "dateLabel": .string(entry.dateLabel),
            "essence": .string(meaning.isEmpty ? keptPhrase : meaning),
            "keptPhrase": .string(keptPhrase),
            "moodLabel": .string(response.moodLabel ?? ""),
            "tag": .string(response.tag ?? "夜の振り返り"),
            "journalId": .string(entry.id)
        ])
        userState.memories.insert(memory, at: 0)
    }

    private func applyFallback() {
        let userLines = ritualMessages.filter { $0.role == .user }.map(\.text)
        let closing = "ここまでで、今夜の記録にしましょう。"
        ritualMessages.append(RitualMessage(role: .nilo, text: closing))
        let entryDateKey = journalDateKey()
        journal.insert(JournalEntry(
            dateKey: entryDateKey,
            dateLabel: formatDotDate(entryDateKey),
            title: String((userLines.first ?? "今夜の記録").prefix(24)),
            lines: userLines.isEmpty ? ["今日の印象を短く残しました。"] : userLines,
            event: userLines.first ?? "",
            meaning: userLines.last ?? "",
            source: "home",
            niloLine: closing
        ), at: 0)
        resetRitual()
    }

    private func resetRitual() {
        questionCount = 1
        ritualNotice = nil
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

    // MARK: - Life chat (「たずねる」)

    func openLifeChat() {
        // 判定は押した瞬間に取り直す(描画時の値は儀式時間帯をまたいで古くなりうる)。
        guard !ritualInProgress, lifeChatAvailable else { return }
        lifeChatMessages = []
        lifeChatNotice = nil
        lifeChatSummary = nil
        lifeChatSupportVisible = false
        lifeChatOpen = true
        startLifeChatWatch()
    }

    func closeLifeChat() {
        lifeChatOpen = false
        lifeChatMessages = []
        lifeChatNotice = nil
        lifeChatSummary = nil
        lifeChatBusy = false
        lifeChatSummaryBusy = false
        lifeChatSupportVisible = false
        lifeChatWatchTimer?.invalidate()
        lifeChatWatchTimer = nil
    }

    // 「たずねる」と夜の儀式は共存させない(創業者指示 2026-07-10)。開いたまま
    // 儀式時間帯に入った場合も(その日の儀式が未了なら)静かに閉じる。
    private func startLifeChatWatch() {
        lifeChatWatchTimer?.invalidate()
        lifeChatWatchTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, self.lifeChatOpen else { return }
                if !self.journalRecordedToday && isRitualWindow() {
                    self.closeLifeChat()
                }
            }
        }
    }

    func sendLifeChatMessage(_ text: String) async {
        let cleaned = String(text.replacingOccurrences(of: "\n", with: "").trimmingCharacters(in: .whitespaces).prefix(ritualAnswerLimit))
        guard !cleaned.isEmpty, !lifeChatBusy else { return }
        lifeChatMessages.append(DialogueMessage(role: "user", text: cleaned))
        lifeChatNotice = nil
        lifeChatBusy = true
        defer { lifeChatBusy = false }
        if !lifeChatSupportVisible && detectPersistentDistress(lifeChatMessages) {
            lifeChatSupportVisible = true
        }
        do {
            var chapters: [[String: Any]] = []
            if case .array(let items)? = userState.rest["chapters"] {
                chapters = items.prefix(12).compactMap { item -> [String: Any]? in
                    guard let object = item.objectValue else { return nil }
                    return [
                        "title": object["title"]?.stringValue ?? "",
                        "period": object["period"]?.stringValue ?? "",
                        "observation": object["observation"]?.stringValue ?? ""
                    ]
                }
            }
            let result = try await api.sendLifeChat(
                messages: lifeChatMessages,
                memories: userState.memoryExcerpts(limit: 120),
                chapters: chapters
            )
            let reply = (result.reply ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if reply.isEmpty {
                // Niloの声を捏造せず、システム表示だけで済ませる(儀式のunintelligibleと同じ思想)。
                lifeChatNotice = "いまは応えられないようです。少し待って、もう一度どうぞ。"
            } else {
                lifeChatMessages.append(DialogueMessage(role: "nilo", text: reply))
            }
        } catch {
            lifeChatNotice = "いまは応えられないようです。少し待って、もう一度どうぞ。"
        }
    }

    func summarizeLifeChat() async {
        guard lifeChatMessages.contains(where: { $0.role == "user" }), !lifeChatBusy, !lifeChatSummaryBusy else { return }
        lifeChatNotice = nil
        lifeChatSummaryBusy = true
        defer { lifeChatSummaryBusy = false }
        do {
            let result = try await api.summarizeLifeChat(messages: lifeChatMessages)
            let lines = (result.summaryLines ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            guard !lines.isEmpty else {
                lifeChatNotice = "いまは日記にまとめられないようです。もう一度どうぞ。"
                return
            }
            lifeChatSummary = LifeChatSummary(
                title: (result.title ?? "今夜の記録").trimmingCharacters(in: .whitespacesAndNewlines),
                summaryLines: Array(lines.prefix(5)),
                niloLine: (result.niloLine ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            )
        } catch {
            lifeChatNotice = "いまは日記にまとめられないようです。もう一度どうぞ。"
        }
    }

    // 「たずねる」の生ログは残さない。ユーザーが明示して残すのは、対話から
    // 作った短い日記要約だけ。保存したときだけ、日記詳細で読み返せる対話ログも残す。
    func saveLifeChatSummary() async {
        guard let summary = lifeChatSummary else { return }
        let savedLines = Array((summary.summaryLines ?? ["今日の言葉を短く残しました。"]).prefix(5))
        let entryDateKey = journalDateKey()
        let niloLine = summary.niloLine ?? ""
        journal.insert(JournalEntry(
            dateKey: entryDateKey,
            dateLabel: formatDotDate(entryDateKey),
            title: String((summary.title ?? "今夜の記録").prefix(32)),
            lines: savedLines,
            event: savedLines.first ?? "",
            meaning: String((niloLine.isEmpty ? (savedLines.last ?? "") : niloLine).prefix(90)),
            source: "life-chat-summary",
            dialogue: lifeChatMessages.map { DialogueMessage(role: $0.role, text: String($0.text.prefix(300))) },
            niloLine: String(niloLine.prefix(56))
        ), at: 0)
        lifeChatSummary = nil
        lifeChatMessages = []
        lifeChatNotice = "日記に残しました。対話ログは日記の詳細から見返せます。"
        await persistState()
    }
}
