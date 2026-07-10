const primaryGeminiModel = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
const fallbackGeminiModel = Deno.env.get("GEMINI_FALLBACK_MODEL") || "gemini-2.5-flash";
const geminiModels = Array.from(new Set([primaryGeminiModel, fallbackGeminiModel].filter(Boolean)));

// ARCがサポートする7言語（mobile/src/i18n.js の LANGUAGES と揃える）。
// Nilo自身の対話生成もユーザーの選択言語に合わせる。
const SUPPORTED_LANGUAGES = ["ja", "en", "es", "fr", "de", "zh", "ko"] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

function normalizeLanguage(value: unknown): SupportedLanguage {
  const lang = String(value || "ja");
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang) ? (lang as SupportedLanguage) : "ja";
}

// Geminiへの出力言語指示に使うフルネーム(モデルが指示を誤解しないよう英語表記で渡す)。
const LANGUAGE_NAMES_FOR_PROMPT: Record<SupportedLanguage, string> = {
  ja: "Japanese (日本語)",
  en: "English",
  es: "Spanish (Español)",
  fr: "French (Français)",
  de: "German (Deutsch)",
  zh: "Simplified Chinese (简体中文)",
  ko: "Korean (한국어)"
};

// ユーザーに見えるフォールバック文言・エラーメッセージのみを言語ごとに用意する。
// Gemini自体へのメタ指示(日本語)は翻訳しない — LLMは指示言語に関わらず出力言語を切り替えられるため。
const STRINGS: Record<SupportedLanguage, Record<string, string>> = {
  ja: {
    defaultTitle: "今夜の記録",
    defaultSummaryLine: "今日の言葉を短く残しました。",
    defaultMoodLabel: "記録済み",
    defaultNiloMessage: "ここまでで、今夜の記録にしましょう。",
    defaultClosingMessage: "今夜の記録を、静かに残しました。",
    defaultTag: "Night Ritual",
    emptyRitualLog: "Night Ritualの会話ログが空です。",
    emptyChapterMemories: "章にする記憶がまだありません。",
    emptyLifeChat: "たずねる対話のメッセージが空です。",
    unknownRoute: "Unknown Nilo route.",
    geminiKeyMissing: "GEMINI_API_KEY is not set.",
    geminiNotJson: "Gemini response was not JSON.",
    geminiRequestFailed: "Gemini API request failed.",
    functionError: "Nilo function error."
  },
  en: {
    defaultTitle: "Tonight's record",
    defaultSummaryLine: "Kept a short trace of today's words.",
    defaultMoodLabel: "Recorded",
    defaultNiloMessage: "Let's make this tonight's record, then.",
    defaultClosingMessage: "Tonight's record has been quietly kept.",
    defaultTag: "Night Ritual",
    emptyRitualLog: "The Night Ritual conversation log is empty.",
    emptyChapterMemories: "There are no memories yet to form a chapter.",
    emptyLifeChat: "The life chat message is empty.",
    unknownRoute: "Unknown Nilo route.",
    geminiKeyMissing: "GEMINI_API_KEY is not set.",
    geminiNotJson: "Gemini response was not JSON.",
    geminiRequestFailed: "Gemini API request failed.",
    functionError: "Nilo function error."
  },
  es: {
    defaultTitle: "El registro de esta noche",
    defaultSummaryLine: "Se guardó una breve huella de las palabras de hoy.",
    defaultMoodLabel: "Registrado",
    defaultNiloMessage: "Dejemos esto como el registro de esta noche.",
    defaultClosingMessage: "El registro de esta noche se ha guardado, en silencio.",
    defaultTag: "Night Ritual",
    emptyRitualLog: "El registro de conversación del Night Ritual está vacío.",
    emptyChapterMemories: "Aún no hay recuerdos para formar un capítulo.",
    emptyLifeChat: "El mensaje del chat está vacío.",
    unknownRoute: "Unknown Nilo route.",
    geminiKeyMissing: "GEMINI_API_KEY is not set.",
    geminiNotJson: "Gemini response was not JSON.",
    geminiRequestFailed: "Gemini API request failed.",
    functionError: "Nilo function error."
  },
  fr: {
    defaultTitle: "L'enregistrement de ce soir",
    defaultSummaryLine: "Une courte trace des mots d'aujourd'hui a été gardée.",
    defaultMoodLabel: "Enregistré",
    defaultNiloMessage: "Faisons de ceci l'enregistrement de ce soir.",
    defaultClosingMessage: "L'enregistrement de ce soir a été gardé, tranquillement.",
    defaultTag: "Night Ritual",
    emptyRitualLog: "Le journal de conversation du Night Ritual est vide.",
    emptyChapterMemories: "Il n'y a pas encore de souvenirs pour former un chapitre.",
    emptyLifeChat: "Le message du chat est vide.",
    unknownRoute: "Unknown Nilo route.",
    geminiKeyMissing: "GEMINI_API_KEY is not set.",
    geminiNotJson: "Gemini response was not JSON.",
    geminiRequestFailed: "Gemini API request failed.",
    functionError: "Nilo function error."
  },
  de: {
    defaultTitle: "Die Aufzeichnung von heute Nacht",
    defaultSummaryLine: "Eine kurze Spur der heutigen Worte wurde bewahrt.",
    defaultMoodLabel: "Festgehalten",
    defaultNiloMessage: "Lass uns das zur heutigen Aufzeichnung machen.",
    defaultClosingMessage: "Die Aufzeichnung von heute Nacht wurde still bewahrt.",
    defaultTag: "Night Ritual",
    emptyRitualLog: "Das Gesprächsprotokoll des Night Ritual ist leer.",
    emptyChapterMemories: "Es gibt noch keine Erinnerungen für ein Kapitel.",
    emptyLifeChat: "Die Chat-Nachricht ist leer.",
    unknownRoute: "Unknown Nilo route.",
    geminiKeyMissing: "GEMINI_API_KEY is not set.",
    geminiNotJson: "Gemini response was not JSON.",
    geminiRequestFailed: "Gemini API request failed.",
    functionError: "Nilo function error."
  },
  zh: {
    defaultTitle: "今晚的记录",
    defaultSummaryLine: "简短地留下了今天的话语。",
    defaultMoodLabel: "已记录",
    defaultNiloMessage: "就把这里当作今晚的记录吧。",
    defaultClosingMessage: "今晚的记录，已静静保存。",
    defaultTag: "Night Ritual",
    emptyRitualLog: "Night Ritual的对话记录为空。",
    emptyChapterMemories: "还没有可以组成章节的记忆。",
    emptyLifeChat: "对话消息为空。",
    unknownRoute: "Unknown Nilo route.",
    geminiKeyMissing: "GEMINI_API_KEY is not set.",
    geminiNotJson: "Gemini response was not JSON.",
    geminiRequestFailed: "Gemini API request failed.",
    functionError: "Nilo function error."
  },
  ko: {
    defaultTitle: "오늘 밤의 기록",
    defaultSummaryLine: "오늘의 말을 짧게 남겼습니다.",
    defaultMoodLabel: "기록됨",
    defaultNiloMessage: "여기까지로 오늘 밤의 기록으로 할게요.",
    defaultClosingMessage: "오늘 밤의 기록을, 조용히 남겼습니다.",
    defaultTag: "Night Ritual",
    emptyRitualLog: "Night Ritual의 대화 기록이 비어 있습니다.",
    emptyChapterMemories: "아직 챕터로 만들 기억이 없습니다.",
    emptyLifeChat: "대화 메시지가 비어 있습니다.",
    unknownRoute: "Unknown Nilo route.",
    geminiKeyMissing: "GEMINI_API_KEY is not set.",
    geminiNotJson: "Gemini response was not JSON.",
    geminiRequestFailed: "Gemini API request failed.",
    functionError: "Nilo function error."
  }
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type JsonRecord = Record<string, unknown>;

function jsonResponse(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function toStrList(value: unknown, max: number, len: number) {
  return Array.isArray(value)
    ? value.slice(0, max).map((item) => String(item || "").slice(0, len)).filter(Boolean)
    : [];
}

function extractJson(text: string) {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini response was not JSON.");
    return JSON.parse(match[0]);
  }
}

// --- Vertex AI (EUリージョン) 対応 -----------------------------------------
// GDPR対応: VERTEX_* シークレットが揃っている場合、Gemini呼び出しを Vertex AI の
// EUリージョン(既定: europe-west3 = フランクフルト)に向ける。日記の内容が
// リージョン保証のない AI Studio API を通らなくなる。未設定なら従来どおり
// GEMINI_API_KEY で AI Studio API にフォールバックするので、GCP側の準備が
// 済むまでは何も壊れない。generateContent のリクエスト/レスポンス形は両者共通。
const vertexProjectId = Deno.env.get("VERTEX_PROJECT_ID") || "";
const vertexLocation = Deno.env.get("VERTEX_LOCATION") || "europe-west3";
const vertexSaEmail = Deno.env.get("VERTEX_SA_EMAIL") || "";
const vertexSaKeyPem = Deno.env.get("VERTEX_SA_PRIVATE_KEY") || "";
const vertexEnabled = Boolean(vertexProjectId && vertexSaEmail && vertexSaKeyPem);

let cachedVertexToken: { token: string; expiresAt: number } | null = null;

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importServiceAccountKey(pem: string): Promise<CryptoKey> {
  // supabase secrets は改行を \n リテラルで持つことがあるので戻してから剥がす。
  const normalized = pem.replace(/\\n/g, "\n");
  const body = normalized.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const raw = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

// サービスアカウントの署名付きJWTをOAuth2アクセストークンに交換する。
// トークンは約1時間有効なので、失効60秒前までモジュールスコープで使い回す。
async function getVertexAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedVertexToken && cachedVertexToken.expiresAt - 60 > now) return cachedVertexToken.token;

  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: vertexSaEmail,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const key = await importServiceAccountKey(vertexSaKeyPem);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`)
  );
  const assertion = `${header}.${claims}.${base64UrlEncode(new Uint8Array(signature))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  if (!response.ok) {
    throw new Error(`Vertex AI auth failed: ${await response.text()}`);
  }
  const data = await response.json();
  cachedVertexToken = { token: String(data.access_token), expiresAt: now + Number(data.expires_in || 3600) };
  return cachedVertexToken.token;
}

async function callGeminiJson(prompt: string, options: { temperature?: number } = {}) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!vertexEnabled && !apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const temperature = Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.7;
  let lastDetail = "";

  // 一時的な失敗（429/5xx/ネットワーク断）に限り、全モデル失敗後に一度だけ
  // 短く置いて再試行する（対話品質仕様 P4）。恒久的な失敗は即フォールバックへ。
  for (let attempt = 0; attempt < 2; attempt++) {
    let retryable = false;

    for (const model of geminiModels) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let endpoint: string;
      let response: Response;
      try {
        if (vertexEnabled) {
          endpoint = `https://${vertexLocation}-aiplatform.googleapis.com/v1/projects/${vertexProjectId}/locations/${vertexLocation}/publishers/google/models/${model}:generateContent`;
          headers["Authorization"] = `Bearer ${await getVertexAccessToken()}`;
        } else {
          endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
          headers["x-goog-api-key"] = apiKey!;
        }

        response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              responseMimeType: "application/json"
            }
          })
        });
      } catch (err) {
        lastDetail = String((err as Error)?.message || err);
        retryable = true;
        continue;
      }

      if (!response.ok) {
        lastDetail = await response.text();
        if (response.status === 429 || response.status >= 500) retryable = true;
        continue;
      }

      const data = await response.json();
      const textResponse = data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
      return extractJson(textResponse);
    }

    if (attempt === 0 && retryable) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      continue;
    }
    break;
  }

  const error = new Error("Gemini API request failed.");
  (error as Error & { detail?: string }).detail = lastDetail;
  throw error;
}

// ユーザーに見えるすべての出力を選択言語で返すよう、各プロンプトの末尾に付ける共通指示。
function buildLanguageInstruction(lang: SupportedLanguage) {
  return [
    "出力言語:",
    `- JSON内のユーザーに見えるすべてのテキストは、必ず ${LANGUAGE_NAMES_FOR_PROMPT[lang]} で書いてください。`,
    "- ユーザーの発言が別の言語で書かれていても、この言語で返してください。",
    lang === "ja"
      ? ""
      : "- このプロンプト内の日本語の言い回し例（「〜ですね」「〜てみますか」など）は機能の例です。出力言語で同じ静かな役割を果たす自然な言い回しに置き換えてください。"
  ].filter(Boolean).join("\n");
}

function normalizeNightRitual(value: JsonRecord, strings: Record<string, string>) {
  const done = Boolean(value.done);
  const summaryLines = toStrList(value.summaryLines, 5, 90);
  const relatedQuests = toStrList(value.relatedQuests, 5, 36);
  const quests = Array.isArray(value.quests)
    ? value.quests.slice(0, 2).map((quest: any) => ({
      title: String(quest.title || "").slice(0, 36),
      reason: String(quest.reason || "").slice(0, 80),
      firstStep: String(quest.firstStep || "").slice(0, 60),
      scope: "life",
      target: Number.isFinite(Number(quest.target)) ? Math.max(1, Math.min(14, Number(quest.target))) : 7
    })).filter((quest) => quest.title)
    : [];

  const unintelligible = Boolean(value.unintelligible);

  return {
    done,
    unintelligible,
    nextQuestion: done ? "" : String(value.nextQuestion || "").slice(0, 40),
    acknowledgment: done ? "" : String(value.acknowledgment || "").slice(0, 120),
    title: String(value.title || strings.defaultTitle).slice(0, 32),
    summaryLines: done && summaryLines.length < 3
      ? summaryLines.concat([strings.defaultSummaryLine]).slice(0, 3)
      : summaryLines,
    relatedQuests,
    questSuggestion: value.questSuggestion ? String(value.questSuggestion).slice(0, 36) : "",
    quests,
    moodLabel: String(value.moodLabel || strings.defaultMoodLabel).slice(0, 16),
    moodScore: Number.isFinite(Number(value.moodScore)) ? Math.max(1, Math.min(10, Number(value.moodScore))) : null,
    niloLine: String(value.niloLine || "").slice(0, 90),
    niloMessage: String(value.niloMessage || strings.defaultNiloMessage).slice(0, 80),
    closingMessage: String(value.closingMessage || value.niloMessage || strings.defaultClosingMessage).slice(0, 56),
    tag: String(value.tag || strings.defaultTag).slice(0, 20),
    xpGain: Number.isFinite(Number(value.xpGain)) ? Math.max(1, Math.min(30, Number(value.xpGain))) : 5,
    questUpdates: Array.isArray(value.questUpdates)
      ? value.questUpdates.slice(0, 5).map((update: any) => ({
        id: String(update.id || "").slice(0, 80),
        title: String(update.title || "").slice(0, 36),
        progressDelta: Number.isFinite(Number(update.progressDelta)) ? Math.max(0, Math.min(1, Number(update.progressDelta))) : 0,
        completed: Boolean(update.completed),
        note: String(update.note || "").slice(0, 80)
      })).filter((update) => update.id || update.title)
      : []
  };
}

// ゆらぎ機能 v1.0 の対話スタイル（Account Settings由来）。表現は都度変えてよいので、
// ここでは口調そのものではなく「何を優先するか」という機能レベルの指針だけを渡す。
const NILO_DIALOGUE_STYLES: Record<string, string> = {
  empathetic: "感情に寄り添い、静かに受け止めることを優先する。問いよりも、まず気持ちを言葉にして返す。",
  questioning: "出来事の背景や経緯を一歩だけ尋ねることを優先する。「何があったか」「いつから」「誰と」のような具体の深掘りに留め、意味・象徴・人生観の階層へこちらから持ち上げない。",
  organizing: "論理的に構造化することを優先する。起きたことを要素に分けて静かに整理してから、次を尋ねる。",
  silent: "最小限の介入に留める。解釈や共感の言葉を足さず、記録を促す短い問いだけを返す。"
};

// 視点のゆらぎ（Nilo Variation Spec 02）。骨格（出来事・感情・理由・明日）は変えず、
// 「どの角度から聞くか」だけを時々ずらす。常には発火させない（呼び出し側で確率制御）。
const NILO_PERSPECTIVE_SHIFTS: Record<string, string> = {
  intensity: "感情の強度そのものを言葉にしてもらう視点。「10段階で言うと」のような数値化はせず、強さの質感を尋ねる。",
  body: "身体感覚に焦点を当てる視点。その気持ちが身体のどこにあったかを尋ね、感情を感覚として捉え直す。",
  otherPerspective: "他者ならどう言うかを尋ねる視点。親しい人が同じ状況だったら何と声をかけるかを尋ね、距離を作る。",
  metaphor: "出来事を比喩に置き換える視点。その一日や気持ちを、一枚の絵やひとつの色などに例えてもらう。",
  naming: "感情に名前をつけてもらう視点。既存の感情語彙に頼らず、その感じ方をどう呼ぶか尋ねる。"
};

// 「短い発話」の判定は文字数の意味密度が言語で違う（漢字20字は一段落、ラテン文字
// 20字は4単語）。儀式の入力上限（日中韓150/その他250）と同じ思想で言語連動させる。
const SHORT_ANSWER_THRESHOLD: Record<string, number> = { ja: 20, zh: 20, ko: 20 };
const SHORT_ANSWER_THRESHOLD_DEFAULT = 40;

function pickVariationGuidance({ currentQuestionCount, activeQuests, pastMemories, chapterEchoes, latestAnswer, lang }: {
  currentQuestionCount: number;
  activeQuests: JsonRecord[];
  pastMemories: JsonRecord[];
  chapterEchoes: JsonRecord[];
  latestAnswer: string;
  lang: SupportedLanguage;
}) {
  const blocks: string[] = [];

  // 視点のゆらぎ: 毎回は発火させない。1問目・最終問には触れない。
  // 直前の発話が短い夜（「今日は疲れた」等）は拾える具体語がなく、ゆらぎを適用すると
  // 問いが抽象・詩的方向に飛ぶため、発火自体を止める。
  const hasEnoughMaterial = latestAnswer.trim().length >= (SHORT_ANSWER_THRESHOLD[lang] ?? SHORT_ANSWER_THRESHOLD_DEFAULT);
  if (hasEnoughMaterial && currentQuestionCount >= 2 && currentQuestionCount <= 4 && Math.random() < 0.45) {
    const keys = Object.keys(NILO_PERSPECTIVE_SHIFTS);
    const chosen = keys[Math.floor(Math.random() * keys.length)];
    blocks.push(`視点のゆらぎ（今回だけ採用）:\n${NILO_PERSPECTIVE_SHIFTS[chosen]}\nこの視点を使う場合も、直前のユーザーの発言にある具体的な言葉・固有名詞・比喩を優先して拾い、その言葉を通してこの視点の問いを組み立てること。拾える言葉がなければ無理にこの視点を使わなくてよい。`);
  }

  // クエスト発火接続: 進行中のクエストが十分な回数(目安5回)繰り返し現れている時だけ、
  // ステップ3→4の間に観察の共有を一度だけ挟む。毎回は行わない。
  const recurringQuest = activeQuests.find((quest) => typeof quest === "object" && Number((quest as any).current || 0) >= 5) as any;
  if (currentQuestionCount === 3 && recurringQuest && Math.random() < 0.4) {
    blocks.push(`クエスト接続（今回だけ、任意）:\n進行中の探求「${recurringQuest.title}」というテーマが、この対話の中で繰り返し現れているように見える場合だけ、次の問いの前に一度だけ、その反復の事実を「〜ですね」で静かに共有してから、「〜てみますか」の形で問いを続けてよい。新しい意味づけや評価は加えず、反復の事実だけを鏡のように返すこと。無理に繋げなくてよい。`);
  }

  // Echo: 過去の記録との偶発的な再会。見つかっても毎回は出さない。
  const safePastMemories = pastMemories.slice(0, 60);
  let echoFired = false;
  if (currentQuestionCount >= 2 && safePastMemories.length && Math.random() < 0.25) {
    echoFired = true;
    const memoryLines = safePastMemories.map((memory, index) => {
      const date = String(memory.dateKey || memory.dateLabel || "").slice(0, 10);
      const essence = String(memory.essence || memory.keptPhrase || "").slice(0, 100);
      return `${index + 1}. ${date || "日付不明"} / ${essence}`;
    }).join("\n");
    blocks.push(`過去との再会（今回だけ、任意）:\n直前のユーザーの発言のテーマと、意味的に近い過去の記録が下にあれば、そっと一度だけ「〇〇のエントリーで、近いことに触れていましたね」のように事実だけを差し出してよい。解釈や意味づけはこちらから結論として渡さず、話を広げるかどうかはユーザーに委ねる。近いものが本当に見当たらなければ、無理に触れなくてよい。\n過去の記録:\n${memoryLines}`);
  }

  // 章との再会: 確定した章の中の、ユーザー自身の言葉が儀式に一度だけ帰ってくる。
  // 過去との再会と同時には発火させない（再会が二重になると儀式が重くなる）。
  const safeChapterEchoes = chapterEchoes.slice(0, 3);
  if (!echoFired && currentQuestionCount >= 2 && safeChapterEchoes.length && Math.random() < 0.2) {
    const chapterLines = safeChapterEchoes.map((echo, index) => {
      const title = String((echo as any).title || "").slice(0, 40);
      const quote = String((echo as any).quote || "").slice(0, 100);
      return `${index + 1}. 章「${title}」 / 「${quote}」`;
    }).join("\n");
    blocks.push(`章との再会（今回だけ、任意）:\n直前のユーザーの発言のテーマと響き合うものが下の章の言葉にあれば、そっと一度だけ「章『〇〇』のころ、あなたはこう書いていました——「…」」のように、ユーザー自身の言葉を逐語で差し出してよい。引用は必ず下の言葉をそのまま使い、書き換えないこと。解釈や比較（成長した・変わった等の評価）は加えない。響き合うものが本当に見当たらなければ、無理に触れなくてよい。\n章の言葉:\n${chapterLines}`);
  }

  return blocks.join("\n\n");
}

function buildAdaptiveNightRitualPrompt(body: JsonRecord, lang: SupportedLanguage) {
  const messages = Array.isArray(body.messages) ? body.messages as JsonRecord[] : [];
  const safeMessages = messages.slice(-10).map((message, index) => {
    const speaker = message.role === "user" ? "User" : "Nilo";
    return `${index + 1}. ${speaker}: ${String(message.text || "").slice(0, 500)}`;
  }).join("\n");
  const userMessages = messages.filter((message) => message.role === "user");
  const latestAnswer = userMessages.length ? String(userMessages[userMessages.length - 1].text || "").slice(0, 500) : "";
  const activeQuests = Array.isArray(body.activeQuests) ? body.activeQuests as JsonRecord[] : [];
  const questLines = activeQuests.map((quest, index) => {
    if (typeof quest === "string") return `${index + 1}. ${quest}`;
    return `${index + 1}. id:${quest.id} / ${quest.title} / ${quest.current || 0}/${quest.target || 1}`;
  }).join("\n") || "なし";
  const currentQuestionCount = Number(body.questionCount) || 1;
  const mustFinish = Boolean(body.forceFinish) || currentQuestionCount >= 5;
  const niloStyle = String(body.niloStyle || "empathetic");
  const styleGuidance = NILO_DIALOGUE_STYLES[niloStyle] || NILO_DIALOGUE_STYLES.empathetic;
  const pastMemories = Array.isArray(body.pastMemories) ? body.pastMemories as JsonRecord[] : [];
  const chapterEchoes = Array.isArray(body.chapterEchoes) ? body.chapterEchoes as JsonRecord[] : [];
  const variationGuidance = mustFinish ? "" : pickVariationGuidance({ currentQuestionCount, activeQuests, pastMemories, chapterEchoes, latestAnswer, lang });

  return `
あなたは人生アプリ ARC の Nilo です。
これはチャットではなく、夜に一日を静かに記録する短い儀式です。

Niloの話し方:
- 優しい、静か、短い
- コーチやカウンセラーのように導きすぎない
- アドバイスより記録を手伝う
- 旅の記録係のように、場面をそっと拾う

${buildLanguageInstruction(lang)}

会話ルール:
- 質問は最大5問です。5問すべて聞く必要はありません。
- 直前の回答内容に基づく短い質問で自然に深掘りしてください。
- 問いの抽象度はユーザーの発話の抽象度を超えないでください。ユーザーが事実や状態を短く話したら（例:「今日は疲れた」）、事実の側を一歩だけ深掘りします（何があったか・いつから・誰と）。こちらから意味・象徴・比喩・人生観の階層に持ち上げないでください。「その疲れは何を語り掛けているのか」のような詩的・哲学的な問いは、Niloの役割（記録係）を超えています。
- 質問は1つだけ。複数質問を混ぜないでください。
- 十分に記録できたら5問未満でも done:true にしてください。
- forceFinish が true、または現在の質問数が5以上なら必ず done:true にしてください。
- 直前のユーザー回答が、言葉として意味を受け取れないもの（ランダムな文字列、キーボードの打鍵、記号の羅列、どの言語としても成立していない断片など）だったときだけ、unintelligible を true にし、nextQuestion は空文字、done は false にしてください。この場合は他のフィールドを埋めなくてよいです。これは forceFinish よりも優先します（意味を受け取れない回答では締めない）。
- 「短い」「曖昧」「感情だけ」「話題がそれている」「一語だけ」は unintelligible ではありません。『疲れた』『わからない』『特にない』『うん』のように短くても言葉として意味が取れるものは、通常どおり扱ってください（unintelligible にしない）。迷ったら unintelligible にしないでください。

相槌（受け止めの一言・任意 = acknowledgment）:
- 次の問いの前に、直前のユーザー回答を受け止める短い一言を acknowledgment に入れてよいです。毎回は入れないでください（機械的な相槌の連発は避ける）。1〜2文で短く。
- 聞き上手な人のように、言外の文脈や経緯を一歩だけ読んで差し出してよいです。ただし言い当てる（断定する）のではなく、差し出す形にしてください（「〜かもしれませんね」「〜のようにも聞こえます」など）。真偽の判断はユーザーに残します。
- 推論は「横」（出来事の文脈・経緯・状況）に限ります。「上」（意味・象徴・価値・人生観）へ持ち上げないでください。これは上の抽象度の天井と同じ原則です。
- 評価や太鼓判を打たないでください（「いい」「面白い」「楽しそう」「素敵」「すごい」「えらい」などを足さない）。ユーザーが口にしていない感情は、断定せず、仮説として一度だけ差し出すに留めてください（「さびしかったんですね」ではなく「さびしさも、あったのかもしれませんね」）。
- done:true（締め）のときは acknowledgment は空文字にしてください（締めは closingMessage が担います）。

今日の対話スタイル:
${styleGuidance}
このスタイルはNiloの人格を変えるものではない。「断定しない」「評価しない」という原則は、どのスタイルでも一貫して保つこと。

${variationGuidance ? `ゆらぎ（今回の対話にだけ、任意で適用してよい変化）:\n${variationGuidance}\n\nこれらは「起きるかもしれないし、起きないかもしれない」ものとして渡している。無理に使わず、直前のユーザーの発言に自然に合う場合だけ採用すること。語尾や言い回しを毎回同じ形に固定しないこと（「〜ですね」「〜てみますか」はあくまで機能の例であり、表現そのものは都度変えてよい）。\n\n` : ""}直前のユーザー回答:
${latestAnswer || "なし"}

現在の質問数:
${currentQuestionCount}

必ず終了:
${mustFinish}

会話ログ:
${safeMessages || "なし"}

進行中のクエスト:
${questLines}

進行中クエストのクリア判定ルール:
- activeQuests は日次チェックリストではなく、Niloが見つけた長期的な探求です。
- 新しい日次クエストは作らないでください。quests は空配列にしてください。
- 進行中クエストに対して、ユーザーの実際の言葉から「このテーマを十分に生きた・受け入れた・統合した・一区切りついた」と読める場合だけ questUpdates に入れてください。
- completed は、クリアを認めてよい場合だけ true にしてください。迷う場合、触れただけの場合、まだ願望や予定の段階の場合は false または省略してください。
- questUpdates[].id には必ず activeQuest の id を入れてください。

done:false の場合:
- nextQuestion が主役です。acknowledgment は任意で添えてよいです（毎回は不要）。
- title, summaryLines, niloLine などは空でもよいです。

done:true の場合:
- nextQuestion は空文字。
- title は今日の記録の短いタイトル。
- summaryLines は3〜5行。
- closingMessage はNiloの最後の短い一言。

JSONだけを返してください。Markdownは禁止です。
{
  "done": false,
  "unintelligible": false,
  "acknowledgment": "",
  "nextQuestion": "直前の回答に基づく短い問い",
  "title": "",
  "summaryLines": [],
  "relatedQuests": [],
  "questSuggestion": "",
  "quests": [],
  "questUpdates": [
    {
      "id": "activeQuest id",
      "title": "activeQuest title",
      "progressDelta": 0,
      "completed": false,
      "note": "判定理由。50文字以内"
    }
  ],
  "moodLabel": "",
  "moodScore": null,
  "niloLine": "",
  "niloMessage": "",
  "closingMessage": "",
  "tag": "Night Ritual",
  "xpGain": 5
}
`.trim();
}

function normalizeChapters(value: JsonRecord) {
  const proposals = Array.isArray(value?.proposals)
    ? value.proposals.slice(0, 6).map((p: any) => ({
      period: String(p.period || "").slice(0, 40),
      observation: String(p.observation || "").slice(0, 200),
      memoryIds: Array.isArray(p.memoryIds)
        ? p.memoryIds.slice(0, 120).map((id) => String(id || "").slice(0, 80)).filter(Boolean)
        : [],
      emotions: toStrList(p.emotions, 5, 24),
      people: toStrList(p.people, 6, 24),
      questions: toStrList(p.questions, 4, 80),
      meaningFrom: String(p.meaningFrom || "").slice(0, 120),
      meaningTo: String(p.meaningTo || "").slice(0, 120),
      episodes: Array.isArray(p.episodes)
        ? p.episodes.slice(0, 6).map((ep: any) => ({
          period: String(ep.period || "").slice(0, 40),
          observation: String(ep.observation || "").slice(0, 160),
          emotions: toStrList(ep.emotions, 4, 24),
          memoryIds: Array.isArray(ep.memoryIds)
            ? ep.memoryIds.slice(0, 60).map((id) => String(id || "").slice(0, 80)).filter(Boolean)
            : []
        })).filter((ep) => ep.observation || ep.memoryIds.length)
        : []
    })).filter((p) => p.memoryIds.length)
    : [];
  return { proposals };
}

function buildChapterPrompt(body: JsonRecord, lang: SupportedLanguage) {
  const memories = Array.isArray(body.memories) ? body.memories as JsonRecord[] : [];
  const split = Boolean(body.split);
  const safeMemories = memories.slice(0, 160).map((memory, index) => {
    const date = String(memory.dateKey || memory.dateLabel || "").slice(0, 10);
    const essence = String(memory.essence || "").slice(0, 120);
    const kept = String(memory.keptPhrase || "").slice(0, 80);
    const mood = String(memory.moodLabel || "").slice(0, 16);
    return `- id:${String(memory.id || index)} / ${date || "日付不明"} / 意味:${essence}${kept ? ` / 言葉:「${kept}」` : ""}${mood ? ` / 気分:${mood}` : ""}`;
  }).join("\n");

  return `
あなたは人生アプリ ARC の Nilo です。
ユーザーが夜ごとに残してきた「記憶」を読み、人生の章の"候補"をそっと差し出します。

あなたは章を断定しません。命名もしません（名前はユーザーがつけます）。
あなたの仕事は、意味づけの変化点を見つけ、「この時期、何かが変わったように見えます」と候補を差し出すことだけです。

渡された記憶は、すでに十分に時間が経った「過去」のものだけです。
章は数週間ではなく、数ヶ月から数年にわたる大きなまとまりであるべきです。
本当に新しい時代が始まったと感じるときだけ章を分け、迷ったらひとつにまとめてください。${split ? "\nただし今回は、提示された記憶群が一つの章には大きすぎると感じられたため、より細かい変化点で必ず2つ以上の候補に分けてください。" : ""}

${buildLanguageInstruction(lang)}

記憶一覧（古い順）:
${safeMemories || "なし"}

各候補について:
- period: その候補が含む時期。
- observation: 変化点をそっと指し示す静かな一文。断定・評価・励まし・助言はしない。
- memoryIds: その候補に含む記憶id。与えられたid以外は作らない。
- emotions, people, questions, meaningFrom, meaningTo を必要に応じて返す。
- episodes: 章の中の短い場面。なければ空でよい。

次のJSONだけを返してください。Markdownは不要です。
{
  "proposals": [
    {
      "period": "時期",
      "observation": "変化点を指す静かな一文",
      "memoryIds": ["id"],
      "emotions": ["感情"],
      "people": ["人"],
      "questions": ["問い"],
      "meaningFrom": "始まりの意味づけ",
      "meaningTo": "終わりの意味づけ",
      "episodes": [
        { "period": "場面の時期", "observation": "短い一文", "emotions": ["感情"], "memoryIds": ["id"] }
      ]
    }
  ]
}
`.trim();
}

// 章の封(chapter-seal): 章の確定時に一度だけ、Niloの手紙・願い・章同士の再会・
// 特徴語を生成する。再会のquoteは、クライアントが渡した他章の言葉(ユーザー自身の
// keptPhrase)からの逐語引用のみを許す — 捏造された「あなたの言葉」を作らせない。
function normalizeChapterSeal(value: JsonRecord, allowedQuotes: string[]) {
  const letter = String(value?.letter || "").slice(0, 400);

  const rawWish = (value?.wish && typeof value.wish === "object") ? value.wish as JsonRecord : null;
  const wish = rawWish && rawWish.theme
    ? { theme: String(rawWish.theme || "").slice(0, 60), line: String(rawWish.line || "").slice(0, 120) }
    : null;

  const rawReunion = (value?.reunion && typeof value.reunion === "object") ? value.reunion as JsonRecord : null;
  let reunion: { chapterId: string; quote: string } | null = null;
  if (rawReunion && rawReunion.quote) {
    const quote = String(rawReunion.quote || "").slice(0, 120);
    // 逐語一致のみ許可。前後の鉤括弧や空白の差だけは吸収する。
    const clean = (text: string) => text.replace(/^[「『\s]+|[」』\s]+$/g, "");
    if (allowedQuotes.some((allowed) => clean(allowed) === clean(quote))) {
      reunion = { chapterId: String(rawReunion.chapterId || "").slice(0, 80), quote };
    }
  }

  const words = Array.isArray(value?.words)
    ? value.words.slice(0, 10).map((word: any) => ({
      text: String(word?.text || "").slice(0, 16),
      weight: Number.isFinite(Number(word?.weight)) ? Math.max(1, Math.min(3, Math.round(Number(word.weight)))) : 2
    })).filter((word) => word.text)
    : [];

  return { letter, wish, reunion, words };
}

function buildChapterSealPrompt(body: JsonRecord, lang: SupportedLanguage) {
  const chapter = (body.chapter && typeof body.chapter === "object") ? body.chapter as JsonRecord : {};
  const memories = Array.isArray(body.memories) ? body.memories as JsonRecord[] : [];
  const otherChapters = Array.isArray(body.otherChapters) ? body.otherChapters as JsonRecord[] : [];

  const safeMemories = memories.slice(0, 160).map((memory, index) => {
    const date = String(memory.dateKey || memory.dateLabel || "").slice(0, 10);
    const essence = String(memory.essence || "").slice(0, 120);
    const kept = String(memory.keptPhrase || "").slice(0, 100);
    const mood = String(memory.moodLabel || "").slice(0, 16);
    return `- id:${String(memory.id || index)} / ${date || "日付不明"} / 意味:${essence}${kept ? ` / 言葉:「${kept}」` : ""}${mood ? ` / 気分:${mood}` : ""}`;
  }).join("\n");

  const otherChapterLines = otherChapters.slice(0, 8).map((other) => {
    const quotes = toStrList((other as any).quotes, 3, 100);
    return `- chapterId:${String((other as any).id || "").slice(0, 80)} / ${String((other as any).title || "").slice(0, 40)}（${String((other as any).period || "").slice(0, 40)}）\n${quotes.map((quote) => `  言葉:「${quote}」`).join("\n")}`;
  }).join("\n");

  const title = String(chapter.title || "").slice(0, 40);
  const period = String(chapter.period || "").slice(0, 40);
  const observation = String(chapter.observation || "").slice(0, 200);
  const meaningFrom = String(chapter.meaningFrom || "").slice(0, 120);
  const meaningTo = String(chapter.meaningTo || "").slice(0, 120);

  return `
あなたは人生アプリ ARC の Nilo です。
ユーザーがひとつの「章」を確定し、名前をつけました。あなたはこの章を一度だけ「封」します。
封とは、章に手紙を添え、章の中に流れていた願いと言葉をそっと拾い上げることです。

Niloの原則（この作業でも一貫して守る）:
- 断定しない、評価しない、励まさない、助言しない
- 成長・改善・達成のような物差しを当てない
- ユーザー自身の言葉を何より尊重する

${buildLanguageInstruction(lang)}

確定した章:
- 名前: ${title || "（まだ名前がない）"}
- 時期: ${period || "不明"}
- 変化点の観察: ${observation || "なし"}
${meaningFrom || meaningTo ? `- 意味づけの流れ: ${meaningFrom || "?"} → ${meaningTo || "?"}` : ""}

この章に含まれる記録（古い順）:
${safeMemories || "なし"}

${otherChapterLines ? `他の章とその中の言葉:\n${otherChapterLines}\n` : ""}
生成するもの:
- letter: この章へのNiloからの短い手紙。旅の記録係として、この章のあいだ隣で見ていたことを静かに書く。3〜5文。記録にある具体的な言葉を1つは引用してよい。
- wish: この章の記録に繰り返し現れていた「願い」がもしあれば { "theme": 願いの短い名前, "line": その願いについての静かな一文 }。回数や統計などの数値は絶対に作らないこと。本当に見当たらなければ null。
- reunion: 他の章が渡されている場合のみ。この章と静かに響き合う言葉が他の章にあれば { "chapterId": その章のid, "quote": その言葉 }。quoteは渡された「言葉:」を一字も変えずそのまま引用すること。見当たらなければ null。他の章が渡されていなければ必ず null。
- words: この章の記録の「言葉:」によく現れていた特徴的な語（名詞や短い言い回し）を3〜10個。{ "text": 語, "weight": 1〜3 }。weightは現れた頻度の体感（3=章を象徴する）。記録にない語を作らないこと。

次のJSONだけを返してください。Markdownは不要です。
{
  "letter": "Niloからの手紙",
  "wish": { "theme": "願いの名前", "line": "静かな一文" },
  "reunion": { "chapterId": "id", "quote": "他の章の言葉の逐語引用" },
  "words": [ { "text": "語", "weight": 2 } ]
}
`.trim();
}

function normalizeQuestProposals(value: JsonRecord) {
  const proposals = Array.isArray(value?.proposals)
    ? value.proposals.slice(0, 3).map((p: any) => ({
      theme: String(p.theme || "").slice(0, 80),
      observation: String(p.observation || "").slice(0, 160),
      invitation: String(p.invitation || "").slice(0, 120),
      keywords: toStrList(p.keywords, 6, 16)
    })).filter((p) => p.theme && p.observation && p.invitation)
    : [];
  return { proposals };
}

function buildQuestProposalPrompt(body: JsonRecord, lang: SupportedLanguage) {
  const memories = Array.isArray(body.memories) ? body.memories as JsonRecord[] : [];
  const safeMemories = memories.slice(0, 120).map((memory) => {
    const date = String(memory.dateKey || memory.dateLabel || "").slice(0, 10);
    const essence = String(memory.essence || "").slice(0, 120);
    const kept = String(memory.keptPhrase || "").slice(0, 80);
    const mood = String(memory.moodLabel || "").slice(0, 16);
    return `- ${date || "日付不明"} / 意味:${essence}${kept ? ` / 言葉:「${kept}」` : ""}${mood ? ` / 気分:${mood}` : ""}`;
  }).join("\n");
  const avoid = [
    ...toStrList(body.declinedThemes, 12, 80),
    ...toStrList(body.ongoingThemes, 12, 80)
  ];

  return `
あなたは人生アプリ ARC の Nilo です。
ユーザーが夜ごとに残してきた記録を読み、「クエスト」——数週間から数ヶ月かけて掘り下げる探求——の候補をそっと差し出します。

クエストはタスクでも日次チェックリストでもありません。
記録の中に繰り返し現れているもの——同じ悩み、揺れる人間関係、問い直されている価値観、静かな成長の兆し——だけを見ます。
同じテーマがおよそ5回以上、違う夜に現れているときだけ候補にしてください。

文法は固定です:
- observation: 気づきの共有。「〜ですね」で終わる静かな一文。断定・評価・助言はしない。
- invitation: 誘い。「〜てみますか。」で終わる一文。命令やタスク化はしない。

${buildLanguageInstruction(lang)}

記録一覧（古い順）:
${safeMemories || "なし"}
${avoid.length ? `\n次のテーマは既に差し出したか、いま探求の途中です。重複する候補は出さないでください:\n${avoid.map((theme) => `- ${theme}`).join("\n")}` : ""}

繰り返しが弱ければ候補は0個でかまいません。多くても2個までにしてください。
次のJSONだけを返してください。Markdownは不要です。
{ "proposals": [ { "theme": "主題", "observation": "〜ですね", "invitation": "〜てみますか。", "keywords": ["語"] } ] }
`.trim();
}

// 「たずねる」(life-chat): ホーム画面の、記録に係留されたチャット
// (cpo/specs/arc_nilo_life_access.md)。Niloは司書として本人の記録の引用で応える。
// 送られてくるのは memory抜粋と章メタのみ(既存routeと同カテゴリ)。履歴はサーバーに残らない。
function normalizeLifeChat(value: JsonRecord) {
  return { reply: String(value?.reply || "").slice(0, 400) };
}

function buildLifeChatPrompt(body: JsonRecord, lang: SupportedLanguage) {
  const messages = Array.isArray(body.messages) ? body.messages as JsonRecord[] : [];
  const safeMessages = messages.slice(-12).map((message, index) => {
    const speaker = message.role === "user" ? "User" : "Nilo";
    return `${index + 1}. ${speaker}: ${String(message.text || "").slice(0, 300)}`;
  }).join("\n");
  const memories = Array.isArray(body.memories) ? body.memories as JsonRecord[] : [];
  const safeMemories = memories.slice(0, 120).map((memory) => {
    const date = String(memory.dateKey || memory.dateLabel || "").slice(0, 10);
    const essence = String(memory.essence || "").slice(0, 120);
    const kept = String(memory.keptPhrase || "").slice(0, 80);
    const mood = String(memory.moodLabel || "").slice(0, 16);
    return `- ${date || "日付不明"} / 意味:${essence}${kept ? ` / 言葉:「${kept}」` : ""}${mood ? ` / 気分:${mood}` : ""}`;
  }).join("\n");
  const chapters = Array.isArray(body.chapters) ? body.chapters as JsonRecord[] : [];
  const chapterLines = chapters.slice(0, 12).map((chapter) => {
    const title = String((chapter as any).title || "").slice(0, 40);
    const period = String((chapter as any).period || "").slice(0, 40);
    const observation = String((chapter as any).observation || "").slice(0, 160);
    return `- 章「${title}」（${period}）: ${observation}`;
  }).join("\n");

  return `
あなたは人生アプリ ARC の Nilo です。
これは夜の儀式ではありません。ユーザーが自分の過去の記録について、あなたに尋ねる短い時間です。
あなたの役割は「司書」です。ユーザー自身が残してきた記録のなかから探し、そっと差し出します。

Niloの原則（この対話でも一貫して守る）:
- コーチしない・アドバイスしない・導かない。応答の中心は、常にユーザー自身の記録の引用。
- 評価しない・断定しない（「いい」「すごい」「成長した」などの物差しを当てない）。
- 記録にないことを推測で語らない。尋ねられたことに近い記録が見当たらなければ、正直に「記録のなかには見つけられませんでした」と伝える。記録の捏造は最悪の裏切りです。
- 推論は「横」（記録同士の時期・言葉の並び・繰り返し）に限る。「上」（意味・象徴・人生観）へ持ち上げない。差し出すときは断定せず「〜のようにも見えます」の形で。
- 短く。1〜3文。記録の「言葉:」を引用するときは一字も変えない。
- 人生相談・悩み相談には踏み込まない。相談の形の問いにも、関係する記録を差し出すところまでで止まる。

${buildLanguageInstruction(lang)}

ユーザーの記録（古い順・抜粋）:
${safeMemories || "なし"}

${chapterLines ? `確定している章:\n${chapterLines}\n` : ""}
ここまでの対話:
${safeMessages || "なし"}

次のJSONだけを返してください。Markdownは禁止です。
{ "reply": "記録から差し出す短い応答" }
`.trim();
}

async function handleRoute(route: string, body: JsonRecord) {
  const lang = normalizeLanguage(body.language);
  const strings = STRINGS[lang];

  if (route === "night-ritual") {
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return jsonResponse(400, { message: strings.emptyRitualLog });
    const json = await callGeminiJson(buildAdaptiveNightRitualPrompt(body, lang), { temperature: 0.82 });
    return jsonResponse(200, normalizeNightRitual(json, strings));
  }

  if (route === "chapters") {
    const memories = Array.isArray(body.memories) ? body.memories : [];
    if (!memories.length) return jsonResponse(400, { message: strings.emptyChapterMemories });
    const json = await callGeminiJson(buildChapterPrompt(body, lang), { temperature: 0.7 });
    return jsonResponse(200, normalizeChapters(json));
  }

  if (route === "chapter-seal") {
    const memories = Array.isArray(body.memories) ? body.memories : [];
    if (!memories.length) return jsonResponse(400, { message: strings.emptyChapterMemories });
    const otherChapters = Array.isArray(body.otherChapters) ? body.otherChapters as JsonRecord[] : [];
    const allowedQuotes = otherChapters.flatMap((other) => toStrList((other as any).quotes, 3, 100));
    const json = await callGeminiJson(buildChapterSealPrompt(body, lang), { temperature: 0.7 });
    return jsonResponse(200, normalizeChapterSeal(json, allowedQuotes));
  }

  if (route === "life-chat") {
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return jsonResponse(400, { message: strings.emptyLifeChat });
    const json = await callGeminiJson(buildLifeChatPrompt(body, lang), { temperature: 0.6 });
    return jsonResponse(200, normalizeLifeChat(json));
  }

  if (route === "quest-proposals") {
    const memories = Array.isArray(body.memories) ? body.memories : [];
    if (memories.length < 5) return jsonResponse(200, { proposals: [] });
    const json = await callGeminiJson(buildQuestProposalPrompt(body, lang), { temperature: 0.7 });
    return jsonResponse(200, normalizeQuestProposals(json));
  }

  return jsonResponse(404, { message: strings.unknownRoute });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { message: "Method not allowed." });

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({})) as JsonRecord;
    const pathRoute = url.pathname.split("/nilo/")[1]?.split("/")[0] || "";
    const route = String(body.route || pathRoute || "").replace(/^\/+/, "");
    const payload = { ...body };
    delete payload.route;
    return await handleRoute(route, payload);
  } catch (error) {
    const detail = (error as Error & { detail?: string }).detail;
    return jsonResponse(detail ? 502 : 500, {
      message: error instanceof Error ? error.message : "Nilo function error.",
      detail
    });
  }
});
