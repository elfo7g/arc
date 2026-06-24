import Foundation

struct ArcAPI {
    var baseURL: URL {
        let value = Bundle.main.object(forInfoDictionaryKey: "ArcAPIBaseURL") as? String
        return URL(string: value ?? "http://localhost:4173")!
    }

    func sendNightRitual(messages: [RitualMessage], questionCount: Int, forceFinish: Bool) async throws -> NightRitualResponse {
        let url = baseURL.appendingPathComponent("api/nilo/night-ritual")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(NightRitualRequest(
            messages: messages.map { .init(role: $0.role.rawValue, text: $0.text) },
            questionCount: questionCount,
            forceFinish: forceFinish,
            activeQuests: []
        ))

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, 200..<300 ~= httpResponse.statusCode else {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode(NightRitualResponse.self, from: data)
    }
}

private struct NightRitualRequest: Encodable {
    var messages: [Message]
    var questionCount: Int
    var forceFinish: Bool
    var activeQuests: [String]

    struct Message: Encodable {
        var role: String
        var text: String
    }
}
