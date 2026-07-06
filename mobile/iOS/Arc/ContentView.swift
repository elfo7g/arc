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

private struct HomeTabView: View {
    @EnvironmentObject private var store: ArcStore
    @State private var draft = ""

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            ForEach(store.ritualMessages) { message in
                Text(message.text)
                    .font(message.role == .nilo ? .title3 : .body)
                    .foregroundStyle(message.role == .nilo ? .white : .white.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }
            Spacer()
            HStack {
                TextField("今日を書く", text: $draft)
                    .textFieldStyle(.roundedBorder)
                Button("送信") {
                    let text = draft
                    draft = ""
                    Task { await store.submitNightLine(text) }
                }
                .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty || store.isSending)
            }
            .padding()
        }
        .navigationTitle("")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    store.isSettingsPresented = true
                } label: {
                    Image(systemName: "gearshape")
                }
                .arcGlassChip()
            }
        }
        .sheet(isPresented: $store.isSettingsPresented) {
            SettingsView()
        }
    }
}

private struct JournalTabView: View {
    @EnvironmentObject private var store: ArcStore

    var body: some View {
        List(store.journal) { entry in
            VStack(alignment: .leading, spacing: 6) {
                Text(entry.title).font(.headline)
                ForEach(entry.summaryLines, id: \.self) { line in
                    Text(line).font(.subheadline).foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle(ArcTab.journal.title)
        .scrollContentBackground(.hidden)
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
