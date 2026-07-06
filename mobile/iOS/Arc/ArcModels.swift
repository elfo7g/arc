import Foundation

enum ArcTab: String, CaseIterable, Identifiable {
    case home
    case quests
    case journal
    case story

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "ホーム"
        case .quests: "クエスト"
        case .journal: "日記"
        case .story: "章"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house"
        case .quests: "safari"
        case .journal: "book.closed"
        case .story: "flag"
        }
    }
}

struct RitualMessage: Identifiable, Equatable {
    enum Role {
        case user
        case nilo
    }

    var id = UUID()
    var role: Role
    var text: String
}

struct JournalEntry: Identifiable, Equatable, Codable {
    var id = UUID()
    var date = Date()
    var title: String
    var summaryLines: [String]
    var niloLine: String
}

// MARK: - JSON passthrough

/// A JSON value that round-trips losslessly. `UserStateBlob` uses this for every
/// field this native client doesn't have its own model for yet (profile detail,
/// settings, notifications, quest proposals, chapters, ...), so syncing state
/// from this app never silently drops data only the RN app understands.
indirect enum JSONValue: Codable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            self = .null
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}

/// The synced `user_state` blob (see `get_user_state`/`set_user_state` RPCs).
/// Only `journal` and `memories` are modeled strongly here since this is the
/// first pass of the native client; everything else round-trips through `rest`
/// untouched. When this client adds a feature (e.g. chapters), promote that key
/// out of `rest` into its own typed field, same pattern as `journal`.
struct UserStateBlob: Codable, Equatable {
    var journal: [JournalEntry]
    var memories: [JSONValue]
    var rest: [String: JSONValue]

    private struct DynamicKey: CodingKey {
        var stringValue: String
        var intValue: Int? { nil }
        init?(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { nil }
    }

    init(journal: [JournalEntry] = [], memories: [JSONValue] = [], rest: [String: JSONValue] = [:]) {
        self.journal = journal
        self.memories = memories
        self.rest = rest
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicKey.self)
        var rest: [String: JSONValue] = [:]
        var journal: [JournalEntry] = []
        var memories: [JSONValue] = []

        for key in container.allKeys {
            switch key.stringValue {
            case "journal":
                journal = (try? container.decode([JournalEntry].self, forKey: key)) ?? []
            case "memories":
                memories = (try? container.decode([JSONValue].self, forKey: key)) ?? []
            default:
                if let value = try? container.decode(JSONValue.self, forKey: key) {
                    rest[key.stringValue] = value
                }
            }
        }

        self.journal = journal
        self.memories = memories
        self.rest = rest
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: DynamicKey.self)
        for (key, value) in rest {
            guard let codingKey = DynamicKey(stringValue: key) else { continue }
            try container.encode(value, forKey: codingKey)
        }
        if let key = DynamicKey(stringValue: "journal") {
            try container.encode(journal, forKey: key)
        }
        if let key = DynamicKey(stringValue: "memories") {
            try container.encode(memories, forKey: key)
        }
    }
}

// MARK: - Edge Function contract (supabase/functions/nilo)

struct NightRitualResponse: Decodable {
    var done: Bool
    var nextQuestion: String?
    var title: String?
    var summaryLines: [String]?
    var niloLine: String?
    var niloMessage: String?
    var closingMessage: String?
    var moodLabel: String?
    var tag: String?
}

struct ChapterProposal: Decodable, Identifiable {
    var id = UUID()
    var period: String
    var observation: String
    var meaningFrom: String?
    var meaningTo: String?

    enum CodingKeys: String, CodingKey {
        case period, observation, meaningFrom, meaningTo
    }
}

struct ChaptersResponse: Decodable {
    var proposals: [ChapterProposal]
}

struct QuestProposal: Decodable, Identifiable {
    var id = UUID()
    var theme: String
    var observation: String
    var invitation: String

    enum CodingKeys: String, CodingKey {
        case theme, observation, invitation
    }
}

struct QuestProposalsResponse: Decodable {
    var proposals: [QuestProposal]
}
