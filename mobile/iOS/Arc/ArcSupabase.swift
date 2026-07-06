import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

/// Session tokens live in the Keychain only — never `UserDefaults` — mirroring
/// the RN app's move to SecureStore+AES for the same reason: a plaintext token
/// on a compromised device hands over the whole account.
enum ArcKeychain {
    private static let service = "app.arc.nilo.native.session"

    static func save(_ data: Data, key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(attributes as CFDictionary, nil)
    }

    static func load(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess else { return nil }
        return result as? Data
    }

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}

struct ArcAuthSession: Codable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case expiresAt
    }

    init(accessToken: String, refreshToken: String, expiresAt: Date) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        accessToken = try container.decode(String.self, forKey: .accessToken)
        refreshToken = try container.decode(String.self, forKey: .refreshToken)
        if let expiresAt = try? container.decode(Date.self, forKey: .expiresAt) {
            self.expiresAt = expiresAt
        } else {
            let expiresIn = (try? container.decode(Double.self, forKey: .expiresIn)) ?? 3600
            expiresAt = Date().addingTimeInterval(expiresIn)
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(accessToken, forKey: .accessToken)
        try container.encode(refreshToken, forKey: .refreshToken)
        try container.encode(expiresAt, forKey: .expiresAt)
    }

    var isExpired: Bool { Date() >= expiresAt.addingTimeInterval(-30) }
}

enum ArcSupabaseError: Error {
    case missingConfig
    case authFailed(String)
    case requestFailed(String)
}

/// Talks to Supabase directly over REST (Auth + PostgREST RPC) rather than
/// pulling in the supabase-swift SPM package. With no local Xcode to debug SPM
/// resolution against, a small hand-rolled client is the safer bet for a first
/// green CI build; it can be swapped for the official SDK later if desired.
@MainActor
final class ArcSupabaseClient: ObservableObject {
    @Published private(set) var session: ArcAuthSession?

    private let baseURL: URL
    private let anonKey: String
    private let sessionKey = "session.v1"
    private var pkceVerifier: String?

    init() {
        let info = Bundle.main.infoDictionary
        let urlString = (info?["SupabaseURL"] as? String) ?? ""
        anonKey = (info?["SupabaseAnonKey"] as? String) ?? ""
        baseURL = URL(string: urlString) ?? URL(string: "https://example.supabase.co")!
        if let data = ArcKeychain.load(key: sessionKey),
           let restored = try? JSONDecoder().decode(ArcAuthSession.self, from: data) {
            session = restored
        }
    }

    var isSignedIn: Bool { session != nil }

    // MARK: - Email OTP

    func sendEmailOTP(email: String) async throws {
        var request = URLRequest(url: baseURL.appendingPathComponent("auth/v1/otp"))
        request.httpMethod = "POST"
        applyCommonHeaders(&request)
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "create_user": true])
        _ = try await send(request)
    }

    func verifyEmailOTP(email: String, token: String) async throws {
        var request = URLRequest(url: baseURL.appendingPathComponent("auth/v1/verify"))
        request.httpMethod = "POST"
        applyCommonHeaders(&request)
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "type": "email",
            "email": email,
            "token": token
        ])
        let data = try await send(request)
        try storeSession(from: data)
    }

    // MARK: - Google OAuth (PKCE)

    func signInWithGoogle() async throws {
        let verifier = Self.randomURLSafeString(length: 64)
        pkceVerifier = verifier
        let challenge = Self.codeChallenge(for: verifier)
        let redirectURL = "app.arc.nilo.native://auth-callback"

        var components = URLComponents(url: baseURL.appendingPathComponent("auth/v1/authorize"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: redirectURL),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "s256")
        ]

        let callbackURL = try await Self.authenticate(url: components.url!, scheme: "app.arc.nilo.native")
        guard
            let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "code" })?.value
        else {
            throw ArcSupabaseError.authFailed("No authorization code in callback.")
        }

        var request = URLRequest(url: baseURL.appendingPathComponent("auth/v1/token"))
        var urlComponents = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!
        urlComponents.queryItems = [URLQueryItem(name: "grant_type", value: "pkce")]
        request.url = urlComponents.url
        request.httpMethod = "POST"
        applyCommonHeaders(&request)
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "auth_code": code,
            "code_verifier": verifier
        ])
        let data = try await send(request)
        try storeSession(from: data)
    }

    func signOut() {
        session = nil
        ArcKeychain.delete(key: sessionKey)
    }

    // MARK: - user_state RPCs

    func getUserState() async throws -> UserStateBlob {
        let token = try await validAccessToken()
        var request = URLRequest(url: baseURL.appendingPathComponent("rest/v1/rpc/get_user_state"))
        request.httpMethod = "POST"
        applyCommonHeaders(&request)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: [String: Any]())
        let data = try await send(request)
        if data.isEmpty || data == Data("null".utf8) {
            return UserStateBlob()
        }
        return try JSONDecoder().decode(UserStateBlob.self, from: data)
    }

    func setUserState(_ state: UserStateBlob) async throws {
        let token = try await validAccessToken()
        var request = URLRequest(url: baseURL.appendingPathComponent("rest/v1/rpc/set_user_state"))
        request.httpMethod = "POST"
        applyCommonHeaders(&request)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let payload = try JSONEncoder().encode(state)
        let stateObject = try JSONSerialization.jsonObject(with: payload)
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_data": stateObject])
        _ = try await send(request)
    }

    // MARK: - nilo Edge Function

    func invokeNilo(route: String, body: [String: Any]) async throws -> Data {
        let token = try await validAccessToken()
        var request = URLRequest(url: baseURL.appendingPathComponent("functions/v1/nilo"))
        request.httpMethod = "POST"
        applyCommonHeaders(&request)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        var payload = body
        payload["route"] = route
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        return try await send(request)
    }

    // MARK: - Internals

    private func validAccessToken() async throws -> String {
        guard let session else { throw ArcSupabaseError.authFailed("Not signed in.") }
        if !session.isExpired { return session.accessToken }
        return try await refreshSession(using: session.refreshToken).accessToken
    }

    @discardableResult
    private func refreshSession(using refreshToken: String) async throws -> ArcAuthSession {
        var request = URLRequest(url: baseURL.appendingPathComponent("auth/v1/token"))
        var components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        request.url = components.url
        request.httpMethod = "POST"
        applyCommonHeaders(&request)
        request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])
        let data = try await send(request)
        return try storeSession(from: data)
    }

    @discardableResult
    private func storeSession(from data: Data) throws -> ArcAuthSession {
        let decoded = try JSONDecoder().decode(ArcAuthSession.self, from: data)
        session = decoded
        if let encoded = try? JSONEncoder().encode(decoded) {
            ArcKeychain.save(encoded, key: sessionKey)
        }
        return decoded
    }

    private func applyCommonHeaders(_ request: inout URLRequest) {
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        if request.value(forHTTPHeaderField: "Authorization") == nil {
            request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        }
    }

    private func send(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
            let message = String(data: data, encoding: .utf8) ?? "Request failed."
            throw ArcSupabaseError.requestFailed(message)
        }
        return data
    }

    private static func authenticate(url: URL, scheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { callbackURL, error in
                if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: error ?? ArcSupabaseError.authFailed("Sign-in was cancelled."))
                }
            }
            session.presentationContextProvider = ArcAuthPresentationProvider.shared
            session.prefersEphemeralWebBrowserSession = true
            session.start()
        }
    }

    private static func randomURLSafeString(length: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func codeChallenge(for verifier: String) -> String {
        let hash = SHA256.hash(data: Data(verifier.utf8))
        return Data(hash).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

private final class ArcAuthPresentationProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = ArcAuthPresentationProvider()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}
