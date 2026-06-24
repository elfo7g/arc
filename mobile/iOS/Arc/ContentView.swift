import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: ArcStore

    var body: some View {
        ZStack {
            ArcBackground()

            VStack(spacing: 0) {
                HeaderView()
                    .padding(.horizontal, 20)
                    .padding(.top, 18)

                TabContentView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                BottomTabBar()
                    .padding(.horizontal, 14)
                    .padding(.bottom, 10)
            }
        }
        .sheet(isPresented: $store.isSettingsPresented) {
            SettingsView()
                .environmentObject(store)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }
}

private struct ArcBackground: View {
    var body: some View {
        ZStack {
            Image("ArcHomeBackground")
                .resizable()
                .scaledToFill()
                .ignoresSafeArea()

            LinearGradient(
                colors: [
                    Color.black.opacity(0.72),
                    Color(red: 0.02, green: 0.03, blue: 0.07).opacity(0.84),
                    Color.black.opacity(0.9)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        }
    }
}

private struct HeaderView: View {
    @EnvironmentObject private var store: ArcStore

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Arc")
                    .font(.system(size: 34, weight: .semibold, design: .serif))
                Text("夜に帰ってくる人生アプリ")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                store.isSettingsPresented = true
            } label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 18, weight: .medium))
                    .frame(width: 42, height: 42)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.arcLine, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
        }
        .foregroundStyle(Color.arcInk)
    }
}

private struct TabContentView: View {
    @EnvironmentObject private var store: ArcStore

    var body: some View {
        Group {
            switch store.selectedTab {
            case .home:
                HomeView()
            case .journal:
                JournalView()
            case .quests:
                QuestView()
            case .story:
                StoryView()
            case .memory:
                MemoryView()
            }
        }
        .transition(.opacity.combined(with: .move(edge: .bottom)))
        .animation(.easeOut(duration: 0.22), value: store.selectedTab)
    }
}

private struct HomeView: View {
    @EnvironmentObject private var store: ArcStore
    @State private var text = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("おかえり。")
                        .font(.system(size: 42, weight: .semibold, design: .serif))
                    Text(formattedDate)
                        .font(.callout)
                        .foregroundStyle(Color.arcGold)
                    if let days = store.daysSinceBirth() {
                        Text("\(days)日目")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .foregroundStyle(Color.arcInk)

                RitualLogCard()

                VStack(spacing: 12) {
                    TextField("Niloに短く答える...", text: $text, axis: .vertical)
                        .lineLimit(2...4)
                        .textFieldStyle(.plain)
                        .padding(16)
                        .background(Color.arcPanel, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(Color.arcLine, lineWidth: 1)
                        )
                        .onChange(of: text) { _, newValue in
                            if newValue.count > 50 {
                                text = String(newValue.prefix(50))
                            }
                        }

                    HStack {
                        Text("\(text.count)/50")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Button(store.isSending ? "記録中..." : "答える") {
                            let value = text
                            text = ""
                            Task { await store.submitNightLine(value) }
                        }
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isSending)
                        .buttonStyle(ArcPrimaryButtonStyle())
                    }
                }

                if let latest = store.latestEntry {
                    TodayCard(entry: latest)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 24)
            .padding(.bottom, 110)
        }
    }

    private var formattedDate: String {
        Date.now.formatted(.dateTime.month().day().weekday(.wide).locale(Locale(identifier: "ja_JP")))
    }
}

private struct RitualLogCard: View {
    @EnvironmentObject private var store: ArcStore

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image("NiloLight")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 34, height: 34)
                Text("Night Ritual")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Color.arcGold)
                    .textCase(.uppercase)
            }

            ForEach(store.ritualMessages) { message in
                VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                    Text(message.role == .user ? "あなた" : "Nilo")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(message.role == .user ? Color.arcGold : .secondary)
                    Text(message.text)
                        .font(.system(.body, design: .serif))
                        .foregroundStyle(Color.arcInk)
                }
                .frame(maxWidth: .infinity, alignment: message.role == .user ? .trailing : .leading)
            }
        }
        .padding(18)
        .background(Color.arcPanelStrong, in: RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(Color.arcLine, lineWidth: 1)
        )
    }
}

private struct TodayCard: View {
    var entry: JournalEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("今日のあなた")
                .font(.headline)
            Text(entry.title)
                .font(.system(size: 23, weight: .semibold, design: .serif))
            Text(entry.niloLine)
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.arcPanel, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.arcLine, lineWidth: 1)
        )
    }
}

private struct QuestView: View {
    @EnvironmentObject private var store: ArcStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(eyebrow: "Quiet quests", title: "クエスト", subtitle: "明日の自分が少し続きを見たくなる約束。")

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(store.activeQuests) { quest in
                        QuestTile(quest: quest)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 24)
            .padding(.bottom, 110)
        }
    }
}

private struct QuestTile: View {
    @EnvironmentObject private var store: ArcStore
    var quest: Quest

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image("NiloNormal")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 28, height: 28)
                Spacer()
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        store.complete(quest)
                    }
                } label: {
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .bold))
                        .frame(width: 30, height: 30)
                        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.arcLine, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }

            Text(quest.source == "daily" ? "Daily" : "Quest")
                .font(.caption2.weight(.bold))
                .foregroundStyle(Color.arcGold)
                .textCase(.uppercase)

            Text(quest.title)
                .font(.system(size: 16, weight: .semibold, design: .serif))
                .lineLimit(3)
                .foregroundStyle(Color.arcInk)

            Spacer()
        }
        .padding(14)
        .aspectRatio(1, contentMode: .fit)
        .background(Color.arcPanel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.arcLine, lineWidth: 1)
        )
    }
}

private struct JournalView: View {
    @EnvironmentObject private var store: ArcStore

    var body: some View {
        ListPage(eyebrow: "One reflection a day", title: "日記", subtitle: "今日の自分に戻る場所。") {
            ForEach(store.journal) { entry in
                VStack(alignment: .leading, spacing: 8) {
                    Text(entry.title)
                        .font(.system(size: 21, weight: .semibold, design: .serif))
                    ForEach(entry.summaryLines, id: \.self) { line in
                        Text(line)
                            .foregroundStyle(.secondary)
                    }
                }
                .arcCard()
            }
        }
    }
}

private struct StoryView: View {
    var body: some View {
        ListPage(eyebrow: "Life chapters", title: "人生の章", subtitle: "あなたのストーリーを章として残します。") {
            EmptyState(title: "まだ章はありません", body: "大きな場面が日記に残ると、ここに章として灯ります。")
        }
    }
}

private struct MemoryView: View {
    @EnvironmentObject private var store: ArcStore

    var body: some View {
        ListPage(eyebrow: "Nilo remembers", title: "Niloの記憶", subtitle: "日記とは別に、大事な場面だけを残します。") {
            if store.memories.isEmpty {
                EmptyState(title: "まだ大事な場面はありません", body: "残したい場面を選ぶと、ここに保存されます。")
            } else {
                ForEach(store.memories) { memory in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(memory.title)
                            .font(.headline)
                        Text(memory.body)
                            .foregroundStyle(.secondary)
                    }
                    .arcCard()
                }
            }
        }
    }
}

private struct SettingsView: View {
    @EnvironmentObject private var store: ArcStore
    @State private var name = ""
    @State private var birthdate = Date()
    @State private var hasBirthdate = false

    var body: some View {
        NavigationStack {
            Form {
                Section("プロフィール") {
                    TextField("名前", text: $name)
                    Toggle("生年月日を設定", isOn: $hasBirthdate)
                    if hasBirthdate {
                        DatePicker("生年月日", selection: $birthdate, displayedComponents: .date)
                    }
                    if let days = store.daysSinceBirth() {
                        Text("\(days)日目")
                    }
                }

                Section("接続") {
                    Text("API接続先は Info.plist の ArcAPIBaseURL で切り替えます。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("設定")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        store.saveProfile(name: name, birthdate: hasBirthdate ? birthdate : nil)
                        store.isSettingsPresented = false
                    }
                }
            }
            .onAppear {
                name = store.profile.name
                if let date = store.profile.birthdate {
                    birthdate = date
                    hasBirthdate = true
                }
            }
        }
    }
}

private struct BottomTabBar: View {
    @EnvironmentObject private var store: ArcStore

    var body: some View {
        HStack(spacing: 0) {
            ForEach(ArcTab.allCases) { tab in
                Button {
                    store.selectedTab = tab
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.symbol)
                            .font(.system(size: 18, weight: .medium))
                        Text(tab.title)
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(store.selectedTab == tab ? Color.arcGold : Color.arcMuted)
                    .padding(.vertical, 10)
                    .background(
                        store.selectedTab == tab ? Color.arcGold.opacity(0.12) : Color.clear,
                        in: RoundedRectangle(cornerRadius: 12)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(8)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(Color.arcLine, lineWidth: 1)
        )
    }
}

private struct PageTitle: View {
    var eyebrow: String
    var title: String
    var subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(eyebrow)
                .font(.caption.weight(.bold))
                .foregroundStyle(Color.arcGold)
                .textCase(.uppercase)
            Text(title)
                .font(.system(size: 38, weight: .semibold, design: .serif))
            Text(subtitle)
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .foregroundStyle(Color.arcInk)
    }
}

private struct ListPage<Content: View>: View {
    var eyebrow: String
    var title: String
    var subtitle: String
    var content: Content

    init(eyebrow: String, title: String, subtitle: String, @ViewBuilder content: () -> Content) {
        self.eyebrow = eyebrow
        self.title = title
        self.subtitle = subtitle
        self.content = content()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(eyebrow: eyebrow, title: title, subtitle: subtitle)
                content
            }
            .padding(.horizontal, 20)
            .padding(.top, 24)
            .padding(.bottom, 110)
        }
    }
}

private struct EmptyState: View {
    var title: String
    var bodyText: String

    init(title: String, body: String) {
        self.title = title
        self.bodyText = body
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            Text(bodyText)
                .foregroundStyle(.secondary)
        }
        .arcCard()
    }
}

private struct ArcPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(Color.black)
            .padding(.horizontal, 18)
            .padding(.vertical, 11)
            .background(Color.arcGold.opacity(configuration.isPressed ? 0.75 : 1), in: Capsule())
    }
}

private extension View {
    func arcCard() -> some View {
        padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.arcPanel, in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color.arcLine, lineWidth: 1)
            )
    }
}

private extension Color {
    static let arcInk = Color(red: 0.96, green: 0.93, blue: 0.87)
    static let arcMuted = Color(red: 0.68, green: 0.67, blue: 0.72)
    static let arcGold = Color(red: 0.86, green: 0.70, blue: 0.42)
    static let arcLine = Color(red: 0.92, green: 0.80, blue: 0.57).opacity(0.22)
    static let arcPanel = Color(red: 0.04, green: 0.06, blue: 0.12).opacity(0.78)
    static let arcPanelStrong = Color(red: 0.03, green: 0.04, blue: 0.08).opacity(0.9)
}
