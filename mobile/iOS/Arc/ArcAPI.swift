import Foundation

/// Calls the deployed `nilo` Supabase Edge Function (see
/// `supabase/functions/nilo/index.ts`) with the same route payloads the RN
/// client sends. This client is Japanese-only for now, so `language` is fixed.
struct ArcAPI {
    let supabase: ArcSupabaseClient
    let language = "ja"

    func sendNightRitual(
        messages: [RitualMessage],
        questionCount: Int,
        forceFinish: Bool,
        pastMemories: [[String: Any]]
    ) async throws -> NightRitualResponse {
        let body: [String: Any] = [
            "language": language,
            "messages": messages.map { ["role": $0.role == .nilo ? "nilo" : "user", "text": $0.text] },
            "questionCount": questionCount,
            "forceFinish": forceFinish,
            "niloStyle": "empathetic",
            "frequency": "daily",
            "pastMemories": pastMemories,
            "activeQuests": []
        ]
        let data = try await supabase.invokeNilo(route: "night-ritual", body: body)
        return try JSONDecoder().decode(NightRitualResponse.self, from: data)
    }

    // 「たずねる」: send only excerpts (memory essence lines + chapter meta),
    // same data-minimization boundary as the RN client (§4.5 / G3).
    func sendLifeChat(
        messages: [DialogueMessage],
        memories: [[String: Any]],
        chapters: [[String: Any]]
    ) async throws -> LifeChatResponse {
        let body: [String: Any] = [
            "language": language,
            "messages": messages.suffix(12).map { ["role": $0.role, "text": String($0.text.prefix(300))] },
            "memories": memories,
            "chapters": chapters
        ]
        let data = try await supabase.invokeNilo(route: "life-chat", body: body)
        return try JSONDecoder().decode(LifeChatResponse.self, from: data)
    }

    func summarizeLifeChat(messages: [DialogueMessage]) async throws -> LifeChatSummary {
        let body: [String: Any] = [
            "language": language,
            "messages": messages.suffix(12).map { ["role": $0.role, "text": String($0.text.prefix(300))] }
        ]
        let data = try await supabase.invokeNilo(route: "life-chat-summary", body: body)
        return try JSONDecoder().decode(LifeChatSummary.self, from: data)
    }

    func fetchChapterProposals(memories: [[String: Any]]) async throws -> ChaptersResponse {
        let data = try await supabase.invokeNilo(route: "chapters", body: [
            "language": language,
            "memories": memories
        ])
        return try JSONDecoder().decode(ChaptersResponse.self, from: data)
    }

    func fetchQuestProposals(memories: [[String: Any]], declinedThemes: [String], ongoingThemes: [String]) async throws -> QuestProposalsResponse {
        let data = try await supabase.invokeNilo(route: "quest-proposals", body: [
            "language": language,
            "memories": memories,
            "declinedThemes": declinedThemes,
            "ongoingThemes": ongoingThemes
        ])
        return try JSONDecoder().decode(QuestProposalsResponse.self, from: data)
    }
}
