import Foundation

/// Calls the deployed `nilo` Supabase Edge Function (see
/// `supabase/functions/nilo/index.ts`) instead of the old local Web API this
/// prototype originally pointed at.
struct ArcAPI {
    let supabase: ArcSupabaseClient

    func sendNightRitual(messages: [RitualMessage], questionCount: Int, forceFinish: Bool) async throws -> NightRitualResponse {
        let body: [String: Any] = [
            "messages": messages.map { ["role": $0.role == .nilo ? "nilo" : "user", "text": $0.text] },
            "questionCount": questionCount,
            "forceFinish": forceFinish,
            "activeQuests": []
        ]
        let data = try await supabase.invokeNilo(route: "night-ritual", body: body)
        return try JSONDecoder().decode(NightRitualResponse.self, from: data)
    }

    func fetchChapterProposals(memories: [[String: Any]]) async throws -> ChaptersResponse {
        let data = try await supabase.invokeNilo(route: "chapters", body: ["memories": memories])
        return try JSONDecoder().decode(ChaptersResponse.self, from: data)
    }

    func fetchQuestProposals(memories: [[String: Any]], declinedThemes: [String], ongoingThemes: [String]) async throws -> QuestProposalsResponse {
        let data = try await supabase.invokeNilo(route: "quest-proposals", body: [
            "memories": memories,
            "declinedThemes": declinedThemes,
            "ongoingThemes": ongoingThemes
        ])
        return try JSONDecoder().decode(QuestProposalsResponse.self, from: data)
    }
}
