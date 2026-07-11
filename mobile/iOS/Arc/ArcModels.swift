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

/// One line of a saved dialogue log ("dialogue" on a journal entry), same wire
/// shape the RN app writes: { role: "user"|"nilo", text }.
struct DialogueMessage: Codable, Equatable, Identifiable {
    var role: String
    var text: String

    var id: String { "\(role)-\(text)" }

    init(role: String, text: String) {
        self.role = role
        self.text = text
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        role = (try? container.decode(String.self, forKey: .role)) ?? "nilo"
        text = (try? container.decode(String.self, forKey: .text)) ?? ""
    }
}

/// A journal entry with the RN app's synced schema (see App.js setJournal
/// call sites): id / dateKey / dateLabel / title / lines / event / meaning /
/// source / dialogue / niloLine. Unknown keys round-trip through `rest` so
/// this client never drops fields only the RN app understands.
struct JournalEntry: Identifiable, Equatable, Codable {
    var id: String
    var dateKey: String
    var dateLabel: String
    var title: String
    var lines: [String]
    var event: String
    var meaning: String
    var source: String
    var dialogue: [DialogueMessage]
    var niloLine: String
    var rest: [String: JSONValue]

    var monthKey: String { String(dateKey.prefix(7)) }

    init(
        id: String = "journal-\(UUID().uuidString.lowercased())",
        dateKey: String,
        dateLabel: String,
        title: String,
        lines: [String],
        event: String = "",
        meaning: String = "",
        source: String = "home",
        dialogue: [DialogueMessage] = [],
        niloLine: String = "",
        rest: [String: JSONValue] = [:]
    ) {
        self.id = id
        self.dateKey = dateKey
        self.dateLabel = dateLabel
        self.title = title
        self.lines = lines
        self.event = event
        self.meaning = meaning
        self.source = source
        self.dialogue = dialogue
        self.niloLine = niloLine
        self.rest = rest
    }

    private static let knownKeys: Set<String> = [
        "id", "dateKey", "dateLabel", "title", "lines", "event",
        "meaning", "source", "dialogue", "niloLine"
    ]

    private struct DynamicKey: CodingKey {
        var stringValue: String
        var intValue: Int? { nil }
        init?(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { nil }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicKey.self)
        func string(_ key: String) -> String {
            guard let codingKey = DynamicKey(stringValue: key) else { return "" }
            return (try? container.decode(String.self, forKey: codingKey)) ?? ""
        }
        id = string("id").isEmpty ? "journal-\(UUID().uuidString.lowercased())" : string("id")
        dateKey = string("dateKey")
        dateLabel = string("dateLabel")
        title = string("title")
        event = string("event")
        meaning = string("meaning")
        source = string("source")
        niloLine = string("niloLine")
        if let key = DynamicKey(stringValue: "lines") {
            lines = (try? container.decode([String].self, forKey: key)) ?? []
        } else {
            lines = []
        }
        if let key = DynamicKey(stringValue: "dialogue") {
            dialogue = (try? container.decode([DialogueMessage].self, forKey: key)) ?? []
        } else {
            dialogue = []
        }
        var extra: [String: JSONValue] = [:]
        for key in container.allKeys where !Self.knownKeys.contains(key.stringValue) {
            if let value = try? container.decode(JSONValue.self, forKey: key) {
                extra[key.stringValue] = value
            }
        }
        rest = extra
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: DynamicKey.self)
        for (key, value) in rest {
            guard let codingKey = DynamicKey(stringValue: key) else { continue }
            try container.encode(value, forKey: codingKey)
        }
        func put(_ key: String, _ value: String) throws {
            guard let codingKey = DynamicKey(stringValue: key) else { return }
            try container.encode(value, forKey: codingKey)
        }
        try put("id", id)
        try put("dateKey", dateKey)
        try put("dateLabel", dateLabel)
        try put("title", title)
        try put("event", event)
        try put("meaning", meaning)
        try put("source", source)
        try put("niloLine", niloLine)
        if let key = DynamicKey(stringValue: "lines") {
            try container.encode(lines, forKey: key)
        }
        if let key = DynamicKey(stringValue: "dialogue") {
            try container.encode(dialogue, forKey: key)
        }
    }
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

    var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    var boolValue: Bool? {
        if case .bool(let value) = self { return value }
        return nil
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

    /// The RN app's `profile.birthdate` (YYYY-MM-DD) if the user has set one.
    var profileBirthdate: String? {
        rest["profile"]?.objectValue?["birthdate"]?.stringValue
    }

    /// Mirrors the RN privacy switch that governs whether reflections feed
    /// Nilo's memory (`settings.privacy.memoryLink`). Defaults to on.
    var memoryLinkEnabled: Bool {
        rest["settings"]?.objectValue?["privacy"]?.objectValue?["memoryLink"]?.boolValue ?? true
    }

    /// The excerpt fields the RN app sends to the `nilo` routes (§4.5: only
    /// dateKey / essence / keptPhrase / moodLabel — never journal bodies).
    func memoryExcerpts(limit: Int) -> [[String: Any]] {
        memories.prefix(limit).compactMap { memory in
            guard let object = memory.objectValue else { return nil }
            return [
                "dateKey": object["dateKey"]?.stringValue ?? "",
                "essence": object["essence"]?.stringValue ?? "",
                "keptPhrase": object["keptPhrase"]?.stringValue ?? "",
                "moodLabel": object["moodLabel"]?.stringValue ?? ""
            ]
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
    var unintelligible: Bool?
}

struct LifeChatResponse: Decodable {
    var reply: String?
}

struct LifeChatSummary: Decodable, Equatable {
    var title: String?
    var summaryLines: [String]?
    var niloLine: String?
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
