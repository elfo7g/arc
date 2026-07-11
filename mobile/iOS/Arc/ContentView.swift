import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: ArcStore

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if store.isSignedIn {
                SignedInView()
            } else {
                SignInView()
            }
        }
        .tint(Color(red: 0.85, green: 0.78, blue: 0.6))
    }
}

// MARK: - Sign in

private struct SignInView: View {
    @EnvironmentObject private var store: ArcStore
    @State private var email = ""
    @State private var otpToken = ""
    @State private var otpSent = false
    @State private var isBusy = false

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image("NiloNormal")
                .resizable()
                .scaledToFit()
                .frame(width: 96, height: 96)
            Text("Arc")
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(.white)

            VStack(spacing: 14) {
                Button {
                    Task {
                        isBusy = true
                        await store.signInWithGoogle()
                        isBusy = false
                    }
                } label: {
                    Text("Googleでサインイン")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)

                VStack(spacing: 10) {
                    TextField("メールアドレス", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .textFieldStyle(.roundedBorder)

                    if otpSent {
                        TextField("確認コード", text: $otpToken)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.roundedBorder)

                        Button("コードを確認") {
                            Task {
                                isBusy = true
                                await store.verifyEmailOTP(email: email, token: otpToken)
                                isBusy = false
                            }
                        }
                        .buttonStyle(.bordered)
                    } else {
                        Button("確認コードを送る") {
                            Task {
                                isBusy = true
                                await store.sendEmailOTP(email: email)
                                otpSent = true
                                isBusy = false
                            }
                        }
                        .buttonStyle(.bordered)
                        .disabled(email.isEmpty)
                    }
                }
            }
            .padding(.horizontal, 32)

            if let message = store.authErrorMessage {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            if isBusy || store.isLoadingState {
                ProgressView().tint(.white)
            }

            Spacer()
        }
    }
}

// MARK: - Signed in shell

private struct SignedInView: View {
    @EnvironmentObject private var store: ArcStore

    var body: some View {
        TabView(selection: $store.selectedTab) {
            NavigationStack {
                HomeTabView()
            }
            .tag(ArcTab.home)
            .tabItem { Label(ArcTab.home.title, systemImage: ArcTab.home.symbol) }

            NavigationStack {
                PlaceholderTabView(tab: .quests)
            }
            .tag(ArcTab.quests)
            .tabItem { Label(ArcTab.quests.title, systemImage: ArcTab.quests.symbol) }

            NavigationStack {
                JournalTabView()
            }
            .tag(ArcTab.journal)
            .tabItem { Label(ArcTab.journal.title, systemImage: ArcTab.journal.symbol) }

            NavigationStack {
                PlaceholderTabView(tab: .story)
            }
            .tag(ArcTab.story)
            .tabItem { Label(ArcTab.story.title, systemImage: ArcTab.story.symbol) }
        }
        .arcTabBarGlass()
    }
}

// MARK: - Home

private struct HomeTabView: View {
    @EnvironmentObject private var store: ArcStore
    @State private var draft = ""

    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            // 誕生日基準の生涯日数「Day 12,345」。利用日数ではない(streakでは
            // ないので中断しても減らず、罪悪感を作らない)。創業者発案 2026-07-11。
            if store.ritualMessages.count == 1, let day = store.lifeDay {
                Text("Day \(day.formatted(.number.grouping(.automatic)))")
                    .font(.system(size: 13, weight: .regular))
                    .kerning(2)
                    .foregroundStyle(.white.opacity(0.45))
            }
            if store.ritualMessages.count == 1 {
                Text(store.homeGreeting)
                    .font(.system(size: 15, weight: .light))
                    .foregroundStyle(.white.opacity(0.65))
            }

            if store.lifeChatAvailable && store.ritualMessages.count == 1 {
                // 儀式の扉が閉じている間は、問いではなく静かな誘いの一行。
                Text("たずねたいことが\nあれば、どうぞ。")
                    .font(.title3)
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            } else {
                ForEach(store.ritualMessages) { message in
                    Text(message.text)
                        .font(message.role == .nilo ? .title3 : .body)
                        .foregroundStyle(message.role == .nilo ? .white : .white.opacity(0.7))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }
            }
            if let notice = store.ritualNotice {
                Text("⚠ \(notice)")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.6))
                    .accessibilityAddTraits(.updatesFrequently)
            }
            Spacer()

            if store.lifeChatAvailable && store.ritualMessages.count == 1 {
                Button {
                    store.openLifeChat()
                } label: {
                    Text("たずねる")
                        .font(.system(size: 15))
                        .padding(.horizontal, 26)
                        .padding(.vertical, 10)
                }
                .arcGlassChip()
                .accessibilityLabel("たずねる")
                .padding(.bottom, 12)
            } else {
                HStack {
                    TextField("今日を書く", text: $draft)
                        .textFieldStyle(.roundedBorder)
                        .disabled(!store.ritualDoorOpen && store.ritualMessages.count == 1)
                    Button("送信") {
                        let text = draft
                        draft = ""
                        Task { await store.submitNightLine(text) }
                    }
                    .disabled(
                        draft.trimmingCharacters(in: .whitespaces).isEmpty
                        || store.isSending
                        || (!store.ritualDoorOpen && store.ritualMessages.count == 1)
                    )
                }
                .padding()
            }
        }
        .navigationTitle("")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    store.isSettingsPresented = true
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("設定を開く")
                .arcGlassChip()
            }
        }
        .sheet(isPresented: $store.isSettingsPresented) {
            SettingsView()
        }
        .fullScreenCover(isPresented: $store.lifeChatOpen) {
            LifeChatView()
        }
    }
}

// MARK: - Life chat (「たずねる」)

// セッションの生ログはstoreの一時stateのみ。保存されるのは、ユーザーが明示
// して「日記に残す」を選んだ要約(と、そのときだけ対話ログ)だけ。
private struct LifeChatView: View {
    @EnvironmentObject private var store: ArcStore
    @State private var input = ""

    private var sendDisabled: Bool {
        input.trimmingCharacters(in: .whitespaces).isEmpty || store.lifeChatBusy || store.lifeChatSummary != nil
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 0) {
                HStack {
                    Text("NILO")
                        .font(.system(size: 12, weight: .medium))
                        .kerning(3)
                        .foregroundStyle(.white.opacity(0.5))
                    Spacer()
                    Button("とじる") {
                        store.closeLifeChat()
                    }
                    .font(.system(size: 14))
                    .foregroundStyle(.white.opacity(0.7))
                    .accessibilityLabel("とじる")
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 8)

                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            if store.lifeChatMessages.isEmpty {
                                Text("あなたのこれまでの記録から、Niloが探して差し出します。")
                                    .font(.footnote)
                                    .foregroundStyle(.white.opacity(0.5))
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .padding(.top, 40)
                            }
                            ForEach(Array(store.lifeChatMessages.enumerated()), id: \.offset) { index, message in
                                HStack {
                                    if message.role == "user" { Spacer(minLength: 48) }
                                    Text(message.text)
                                        .font(.body)
                                        .foregroundStyle(message.role == "user" ? .white.opacity(0.75) : .white)
                                        .padding(.vertical, 8)
                                        .padding(.horizontal, 12)
                                        .background(
                                            message.role == "user"
                                                ? Color.white.opacity(0.08)
                                                : Color.clear,
                                            in: RoundedRectangle(cornerRadius: 12)
                                        )
                                    if message.role != "user" { Spacer(minLength: 48) }
                                }
                                .id(index)
                            }
                            if !store.lifeChatMessages.isEmpty && store.lifeChatSummary == nil {
                                Button {
                                    Task { await store.summarizeLifeChat() }
                                } label: {
                                    Text(store.lifeChatSummaryBusy ? "日記にまとめています…" : "この対話を日記にまとめる")
                                        .font(.footnote)
                                }
                                .buttonStyle(.bordered)
                                .disabled(store.lifeChatBusy || store.lifeChatSummaryBusy)
                                .accessibilityLabel("この対話を日記にまとめる")
                                .frame(maxWidth: .infinity, alignment: .center)
                            }
                            if let summary = store.lifeChatSummary {
                                LifeChatSummaryCard(summary: summary)
                            }
                            if store.lifeChatBusy {
                                ProgressView().tint(.white.opacity(0.6))
                                    .frame(maxWidth: .infinity, alignment: .center)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom, 16)
                    }
                    .onChange(of: store.lifeChatMessages.count) { _, count in
                        withAnimation { proxy.scrollTo(max(0, count - 1), anchor: .bottom) }
                    }
                }

                VStack(spacing: 10) {
                    if store.lifeChatSupportVisible {
                        SupportResourceCard()
                    }
                    if let notice = store.lifeChatNotice {
                        Text("⚠ \(notice)")
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.6))
                            .accessibilityAddTraits(.updatesFrequently)
                    }
                    HStack(spacing: 10) {
                        TextField("記録に、たずねたいことを", text: $input)
                            .textFieldStyle(.roundedBorder)
                            .disabled(store.lifeChatBusy || store.lifeChatSummary != nil)
                            .onSubmit { send() }
                        Button {
                            send()
                        } label: {
                            Image(systemName: "arrow.up")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(sendDisabled)
                        .accessibilityLabel("送信")
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 12)
            }
        }
    }

    private func send() {
        guard !sendDisabled else { return }
        let text = input
        input = ""
        Task { await store.sendLifeChatMessage(text) }
    }
}

private struct LifeChatSummaryCard: View {
    @EnvironmentObject private var store: ArcStore
    let summary: LifeChatSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("日記の下書き")
                .font(.caption)
                .kerning(1.5)
                .foregroundStyle(.white.opacity(0.5))
            Text(summary.title ?? "今夜の記録")
                .font(.headline)
                .foregroundStyle(.white)
            ForEach(summary.summaryLines ?? [], id: \.self) { line in
                Text(line)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.8))
            }
            if let niloLine = summary.niloLine, !niloLine.isEmpty {
                Text(niloLine)
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.55))
            }
            HStack {
                Button("やめる") {
                    store.lifeChatSummary = nil
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("やめる")
                Spacer()
                Button("日記に残す") {
                    Task { await store.saveLifeChatSummary() }
                }
                .buttonStyle(.borderedProminent)
                .accessibilityLabel("日記に残す")
            }
            .padding(.top, 4)
        }
        .padding(16)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
    }
}

// 深刻なつらさが続く回答を見たときだけ、評価も励ましもせず、静かに相談先を
// 差し出す(離脱防止方針書 §03)。導線は主張せずただそこに在る。
private struct SupportResourceCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("もし今、抱えているものが重すぎると感じたら。あなたの話を、評価せずに聞いてくれる場所があります。")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.75))
            Link("相談できる窓口を見る（まもろうよ こころ／厚生労働省）",
                 destination: URL(string: "https://www.mhlw.go.jp/mamorouyokokoro/")!)
                .font(.footnote)
        }
        .padding(12)
        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Journal

private struct JournalTabView: View {
    @EnvironmentObject private var store: ArcStore
    @State private var selectedMonthKey: String?

    private var months: [JournalMonth] {
        store.journalMonths
    }

    private var activeMonthKey: String? {
        if let selected = selectedMonthKey, months.contains(where: { $0.monthKey == selected }) {
            return selected
        }
        return months.first?.monthKey
    }

    private var activeEntries: [JournalEntry] {
        months.first { $0.monthKey == activeMonthKey }?.entries ?? []
    }

    var body: some View {
        VStack(spacing: 0) {
            // 直近6ヶ月だけの月ピッカー。空白月や件数は出さない(RN側と同じ)。
            if months.count > 1 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(months) { month in
                            let selected = month.monthKey == activeMonthKey
                            Button {
                                selectedMonthKey = month.monthKey
                            } label: {
                                Text(Self.monthLabel(month.monthKey))
                                    .font(.footnote)
                                    .foregroundStyle(selected ? .white : .white.opacity(0.5))
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 7)
                                    .background(
                                        Color.white.opacity(selected ? 0.12 : 0.04),
                                        in: Capsule()
                                    )
                            }
                            .accessibilityLabel(Self.monthLabel(month.monthKey))
                            .accessibilityAddTraits(selected ? [.isSelected] : [])
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                }
            }
            List {
                if activeEntries.isEmpty {
                    Text("この月の記録はまだありません。")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .listRowBackground(Color.clear)
                }
                ForEach(activeEntries) { entry in
                    JournalEntryRow(entry: entry)
                        .listRowBackground(Color.clear)
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle(ArcTab.journal.title)
    }

    static func monthLabel(_ monthKey: String) -> String {
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2, let year = Int(parts[0]), let month = Int(parts[1]) else { return monthKey }
        return "\(year)年\(month)月"
    }
}

// 一日の記録: 出来事(小・淡)の上に意味(主役)。対話ログがある日は「···」を
// 淡く添え、タップでその場に静かに展開する(モーダルへは遷移しない)。
private struct JournalEntryRow: View {
    let entry: JournalEntry
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.dateLabel)
                .font(.caption2)
                .foregroundStyle(.tertiary)
            Text(entry.title)
                .font(.headline)
            ForEach(entry.lines, id: \.self) { line in
                Text(line)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if !entry.dialogue.isEmpty {
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) { expanded.toggle() }
                } label: {
                    Text("···")
                        .font(.subheadline)
                        .foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(expanded ? "対話ログをとじる" : "対話ログをひらく")
                if expanded {
                    VStack(alignment: .leading, spacing: 5) {
                        ForEach(Array(entry.dialogue.enumerated()), id: \.offset) { _, message in
                            Text(message.text)
                                .font(.footnote)
                                .foregroundStyle(message.role == "user" ? .secondary : .primary.opacity(0.8))
                        }
                    }
                    .padding(.top, 2)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

private struct PlaceholderTabView: View {
    let tab: ArcTab

    var body: some View {
        VStack {
            Spacer()
            Text("\(tab.title)は準備中です")
                .foregroundStyle(.secondary)
            Spacer()
        }
        .navigationTitle(tab.title)
    }
}

private struct SettingsView: View {
    @EnvironmentObject private var store: ArcStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Button("サインアウト", role: .destructive) {
                    store.signOut()
                    dismiss()
                }
            }
            .navigationTitle("設定")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Liquid Glass (iOS 26+), matching where the RN attempt wanted it:
// current tab + back button chrome only, never content-layer cards.

private extension View {
    @ViewBuilder
    func arcTabBarGlass() -> some View {
        if #available(iOS 26, *) {
            self.toolbarBackground(.visible, for: .tabBar)
        } else {
            self
        }
    }

    @ViewBuilder
    func arcGlassChip() -> some View {
        if #available(iOS 26, *) {
            self.buttonStyle(.glass)
        } else {
            self.buttonStyle(.bordered)
        }
    }
}
