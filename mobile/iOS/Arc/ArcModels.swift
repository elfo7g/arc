import Foundation

enum ArcTab: String, CaseIterable, Identifiable, Codable {
    case home
    case journal
    case quests
    case story
    case memory

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "ホーム"
        case .journal: "日記"
        case .quests: "クエスト"
        case .story: "章"
        case .memory: "記憶"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house"
        case .journal: "book.closed"
        case .quests: "safari"
        case .story: "flag"
        case .memory: "circle.hexagongrid"
        }
    }
}

struct RitualMessage: Identifiable, Codable, Equatable {
    enum Role: String, Codable {
        case user
        case nilo
    }

    var id = UUID()
    var role: Role
    var text: String
}

struct JournalEntry: Identifiable, Codable, Equatable {
    var id = UUID()
    var date = Date()
    var title: String
    var summaryLines: [String]
    var niloLine: String
}

struct Quest: Identifiable, Codable, Equatable {
    var id = UUID()
    var title: String
    var source: String
    var isCompleted = false
    var createdAt = Date()
}

struct MemoryEntry: Identifiable, Codable, Equatable {
    var id = UUID()
    var title: String
    var body: String
    var date = Date()
}

struct ArcProfile: Codable, Equatable {
    var name = ""
    var birthdate: Date?
}

struct NightRitualResponse: Decodable {
    var done: Bool
    var nextQuestion: String?
    var title: String?
    var summaryLines: [String]?
    var niloLine: String?
    var niloMessage: String?
    var closingMessage: String?
    var quests: [GeneratedQuest]?
    var questSuggestion: String?
}

struct GeneratedQuest: Decodable {
    var title: String
}

struct PersistedArcState: Codable {
    var journal: [JournalEntry]
    var quests: [Quest]
    var memories: [MemoryEntry]
    var profile: ArcProfile
}
