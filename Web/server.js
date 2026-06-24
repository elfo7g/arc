const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

loadEnvFile(path.join(__dirname, ".env"));

const port = Number(process.env.PORT || 4173);
const root = __dirname;
const primaryGeminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const fallbackGeminiModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
const geminiModels = Array.from(new Set([primaryGeminiModel, fallbackGeminiModel].filter(Boolean)));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 32_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function extractJson(text) {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini response was not JSON.");
    return JSON.parse(match[0]);
  }
}

function normalizeInsight(value) {
  const quests = Array.isArray(value.quests)
    ? value.quests.slice(0, 2).map((quest) => ({
      title: String(quest.title || "").slice(0, 36),
      reason: String(quest.reason || "").slice(0, 80),
      firstStep: String(quest.firstStep || "").slice(0, 60),
      scope: normalizeQuestScope(quest.scope || quest.type || quest.category, quest.target),
      target: Number.isFinite(Number(quest.target)) ? Math.max(1, Math.min(14, Number(quest.target))) : 7
    })).filter((quest) => quest.title)
    : [];

  if (value.questSuggestion && !quests.length) {
    quests.push({
      title: String(value.questSuggestion).slice(0, 36),
      reason: "今日の会話から見つけた約束です。",
      firstStep: "",
      target: 7
    });
  }

  const questUpdates = Array.isArray(value.questUpdates)
    ? value.questUpdates.slice(0, 5).map((update) => ({
      id: String(update.id || "").slice(0, 80),
      title: String(update.title || "").slice(0, 36),
      progressDelta: Number.isFinite(Number(update.progressDelta)) ? Math.max(0, Math.min(1, Number(update.progressDelta))) : 0,
      completed: Boolean(update.completed),
      note: String(update.note || "").slice(0, 80)
    })).filter((update) => update.id || update.title)
    : [];

  return {
    moodLabel: String(value.moodLabel || "記録済み").slice(0, 16),
    moodScore: Number.isFinite(Number(value.moodScore)) ? Number(value.moodScore) : null,
    xpGain: Number.isFinite(Number(value.xpGain)) ? Math.max(1, Math.min(30, Number(value.xpGain))) : 5,
    niloLine: String(value.niloLine || "").slice(0, 90),
    niloMessage: String(value.niloMessage || "").slice(0, 80),
    memory: String(value.memory || "").slice(0, 120),
    tag: String(value.tag || "今日の振り返り").slice(0, 16),
    questSuggestion: value.questSuggestion ? String(value.questSuggestion).slice(0, 36) : "",
    quests,
    questUpdates,
    chapterTitle: value.chapterTitle ? String(value.chapterTitle).slice(0, 36) : "",
    chapterBody: value.chapterBody ? String(value.chapterBody).slice(0, 80) : ""
  };
}

function buildPrompt({ text, recentMemories, activeQuests }) {
  const questLines = (activeQuests || []).map((quest, index) => {
    if (typeof quest === "string") return `${index + 1}. ${quest}`;
    return `${index + 1}. id:${quest.id} / ${quest.title} / ${quest.current || 0}/${quest.target || 1}日 / 最初の一歩:${quest.firstStep || "未設定"}`;
  }).join("\n") || "なし";

  return `
あなたは人生アプリArcにいる小さな存在「Nilo」です。
役割は、答えを出すことではなく、ユーザーの一日を静かに映す鏡になることです。
承認欲求、比較、ランキング、依存を強める表現は避けてください。
アドバイスは短く、断定せず、ユーザー自身の言葉が主役になるようにしてください。

今日の振り返り:
${text}

最近の圧縮記憶:
${(recentMemories || []).map((item, index) => `${index + 1}. ${item}`).join("\n") || "なし"}

進行中のクエスト:
${questLines}

進行中のクエストについて、今日の振り返り本文から「実際に試した・触れた・一歩進んだ」と読める場合だけ progressDelta を1にしてください。
気持ちだけ、願望だけ、やる予定だけの場合は progressDelta を0にしてください。
クエストの目的に十分届いたと読める場合だけ completed をtrueにしてください。迷う場合はfalseです。

今日の会話量、具体性、自己理解の深さ、戻ってこようとした姿勢を見て、Niloの成長XPを1〜30で決めてください。
短い一言でも、正直な記録なら少しXPを与えてください。XPはユーザーには見せません。

会話の中に「続けたいこと」「試したいこと」「少し楽になる習慣」の芽がある場合だけ、クエストを0〜2件作ってください。
クエストは義務や課題ではなく、1〜14日で戻ってこられる実験にしてください。
すでに進行中のクエストと似ているものは作らないでください。

次のJSONだけを返してください。Markdownは不要です。
{
  "moodLabel": "気分を日本語で短く。例: 静か, 疲れ気味, 少し前向き",
  "moodScore": 1から10の整数、判断できなければnull,
  "xpGain": 1から30の整数。今日の会話でNiloに与える内部XP,
  "niloLine": "今日の一言。40文字以内。詩的だが大げさにしない",
  "niloMessage": "Niloからの短い反応。60文字以内",
  "memory": "Niloが覚える圧縮記憶。80文字以内",
  "tag": "記憶タグ。8文字以内",
  "questSuggestion": "互換用。クエストが1件ある場合はタイトルだけ。不要なら空文字",
  "quests": [
    {
      "title": "クエスト名。20文字以内",
      "reason": "今日の会話からなぜ生まれたか。60文字以内",
      "firstStep": "最初の一歩。40文字以内",
      "target": 1から14の整数
    }
  ],
  "questUpdates": [
    {
      "id": "進行中クエストのid。該当がなければ空文字",
      "title": "進行中クエスト名",
      "progressDelta": 0または1,
      "completed": trueまたはfalse,
      "note": "判定理由。50文字以内"
    }
  ],
  "chapterTitle": "人生の章になりそうな場合だけ章タイトル。不要なら空文字",
  "chapterBody": "章の説明。不要なら空文字"
}
`.trim();
}

function normalizeTomorrowQuests(value) {
  const quests = Array.isArray(value.quests)
    ? value.quests.slice(0, 5).map((quest) => ({
      title: String(quest.title || "").slice(0, 36),
      reason: String(quest.reason || "").slice(0, 80),
      firstStep: String(quest.firstStep || "").slice(0, 60),
      target: Number.isFinite(Number(quest.target)) ? Math.max(1, Math.min(3, Number(quest.target))) : 1
    })).filter((quest) => quest.title)
    : [];

  return { quests: quests.slice(0, Math.max(2, quests.length)) };
}

function normalizeQuestScope(scope, target) {
  const value = String(scope || "").toLowerCase();
  if (["daily", "journal-daily", "tomorrow", "small"].includes(value)) return "daily";
  if (["life", "long", "long-term", "big"].includes(value)) return "life";
  const days = Number(target);
  return Number.isFinite(days) && days <= 2 ? "daily" : "life";
}

function buildTomorrowQuestPrompt({ activeQuests }) {
  const questLines = (activeQuests || []).map((quest, index) => {
    if (typeof quest === "string") return `${index + 1}. ${quest}`;
    return `${index + 1}. ${quest.title}`;
  }).join("\n") || "なし";

  return `
あなたは人生アプリArcにいる小さな存在「Nilo」です。
明日のための、健康的な日常クエストを2〜5個作ってください。

条件:
- 簡単に達成できること
- 日常の健康、睡眠、散歩、呼吸、水分、片付け、休息、食事、気分の整え方に関係すること
- 競争、ランキング、義務感、強い自己管理を感じさせないこと
- 1つのクエストは明日だけで完了できること
- すでにあるクエストと似すぎるものは避けること

既存のクエスト:
${questLines}

次のJSONだけを返してください。Markdownは不要です。
{
  "quests": [
    {
      "title": "20文字以内のクエスト名",
      "reason": "なぜ明日に良いか。60文字以内",
      "firstStep": "最初の一歩。40文字以内",
      "target": 1
    }
  ]
}
`.trim();
}

function normalizeNightRitual(value) {
  const done = Boolean(value.done);
  const summaryLines = Array.isArray(value.summaryLines)
    ? value.summaryLines.slice(0, 5).map((line) => String(line || "").slice(0, 90)).filter(Boolean)
    : [];
  const relatedQuests = Array.isArray(value.relatedQuests)
    ? value.relatedQuests.slice(0, 5).map((quest) => String(quest || "").slice(0, 36)).filter(Boolean)
    : [];
  const quests = Array.isArray(value.quests)
    ? value.quests.slice(0, 2).map((quest) => ({
      title: String(quest.title || "").slice(0, 36),
      reason: String(quest.reason || "").slice(0, 80),
      firstStep: String(quest.firstStep || "").slice(0, 60),
      scope: normalizeQuestScope(quest.scope || quest.type || quest.category, quest.target),
      target: Number.isFinite(Number(quest.target)) ? Math.max(1, Math.min(14, Number(quest.target))) : 7
    })).filter((quest) => quest.title)
    : [];

  return {
    done,
    nextQuestion: done ? "" : String(value.nextQuestion || "").slice(0, 40),
    title: String(value.title || "今夜の記録").slice(0, 32),
    summaryLines: done && summaryLines.length < 3 ? summaryLines.concat(["今日の印象を、あとで戻れる記録として残しました。"]).slice(0, 3) : summaryLines,
    relatedQuests,
    questSuggestion: value.questSuggestion ? String(value.questSuggestion).slice(0, 36) : "",
    quests,
    moodLabel: String(value.moodLabel || "記録済み").slice(0, 16),
    moodScore: Number.isFinite(Number(value.moodScore)) ? Math.max(1, Math.min(10, Number(value.moodScore))) : null,
    niloLine: String(value.niloLine || "").slice(0, 90),
    niloMessage: String(value.niloMessage || "ここまでで、今夜の記録にしましょう。").slice(0, 80),
    closingMessage: String(value.closingMessage || value.niloMessage || "今夜の記録を、静かに残しました。").slice(0, 56),
    tag: String(value.tag || "Night Ritual").slice(0, 20),
    xpGain: Number.isFinite(Number(value.xpGain)) ? Math.max(1, Math.min(30, Number(value.xpGain))) : 5,
    questUpdates: Array.isArray(value.questUpdates)
      ? value.questUpdates.slice(0, 5).map((update) => ({
        id: String(update.id || "").slice(0, 80),
        title: String(update.title || "").slice(0, 36),
        progressDelta: Number.isFinite(Number(update.progressDelta)) ? Math.max(0, Math.min(1, Number(update.progressDelta))) : 0,
        completed: Boolean(update.completed),
        note: String(update.note || "").slice(0, 80)
      })).filter((update) => update.id || update.title)
      : []
  };
}

function buildNightRitualPrompt({ messages, questionCount, activeQuests, forceFinish }) {
  const safeMessages = Array.isArray(messages)
    ? messages.slice(-10).map((message, index) => `${index + 1}. ${message.role === "user" ? "User" : "Nilo"}: ${String(message.text || "").slice(0, 500)}`).join("\n")
    : "";
  const questLines = (activeQuests || []).map((quest, index) => {
    if (typeof quest === "string") return `${index + 1}. ${quest}`;
    return `${index + 1}. id:${quest.id} / ${quest.title} / ${quest.current || 0}/${quest.target || 1}`;
  }).join("\n") || "なし";
  const mustFinish = Boolean(forceFinish) || Number(questionCount) >= 5;

  return `
あなたは人生アプリArcの「Night Ritual」にいるNiloです。
これはAIチャットではありません。1日の終わりに、短い会話から人生ログを作る儀式です。

Niloの話し方:
- 優しい、静か、短い
- コーチやカウンセラーのように導きすぎない
- アドバイスより記録を手伝う
- 旅の記録係のように、場面をそっと拾う

ルール:
- 質問は最大5問です。5問すべて聞く必要はありません
- 1問目は固定で「今日はどんな日でしたか？」です。すでに画面側で表示済みです
- 2問目以降だけ、直前の回答内容に基づく短めの質問で自然に深掘りしてください
- 人生ログを作るのに十分な情報が集まったと感じたら、5問未満でもdone:trueで切り上げてください
- forceFinishがtrue、または現在の質問数が5以上なら必ずdone:trueで終了してください
- done:trueで終了する時は、必ずNiloの最後の一言としてclosingMessageを返してください。ユーザーの発言で会話を終わらせないでください
- 相談、問題解決、長い雑談にしないでください
- 終了時は今日のタイトル、3〜5行の日記要約、関連する目標/クエストがあれば返してください
- niloLineは「今夜の記録を残しました」のような汎用文ではなく、会話内容に沿った今日の一言にしてください

質問設計:
- 次の質問は1つだけ。複数質問を混ぜないでください
- nextQuestionは長くても32文字程度にしてください
- すでに答えた内容を言い換えて聞き直さないでください
- 情報が薄い時は「何が起きたか」を聞く
- 出来事だけで感情が薄い時は「その時どう感じたか」を聞く
- 感情だけで場面が薄い時は「どんな場面だったか」を聞く
- 重要そうな人物が出た時は「その人との時間の何が残ったか」を聞く
- 未来の話が出た時は「明日に残したいこと」を聞く
- 4問目以降は新しい話題を広げず、記録に必要な最後の輪郭だけ拾う

十分に情報が集まった条件:
- 出来事、感情、印象に残った理由のうち2つ以上が分かる
- または、短くても象徴的な一場面が分かる
- この条件を満たしたら、無理に5問まで続けずdone:trueにしてください

日記化の手順:
1. 会話から事実、感情、余韻を分けて読む
2. ユーザーが言っていない事情を足さない
3. 要約は説明文ではなく、今日を後で思い出せる記録にする
4. 3〜5行の各行は短く、1行1意味にする
5. タイトルは出来事名だけでなく、その日の温度が出る言葉にする
6. niloLineは日記要約から最も大事な余韻を1文にする

現在の質問数: ${Number(questionCount) || 1}
必ず終了する: ${mustFinish}

会話ログ:
${safeMessages || "なし"}

進行中のクエスト:
${questLines}

クエスト生成ルール:
- ユーザーが未来の目標、続けたいこと、やってみたいこと、約束に近い発言を明確にした場合だけ quests に1件入れてください。
- 明日につながる小さい行動なら quests[].scope を "daily" にしてください。
- 数日以上続く大きめの目標や人生の方向性なら quests[].scope を "life" にしてください。
- 曖昧な気分、過去の出来事だけ、一度きりの予定、すでに進行中のクエストと似ている内容では quests は空配列にしてください。
- クエストは1〜14日で戻ってこられる、やさしく具体的な約束にしてください。
- タイトルは短い自然な日本語にしてください。圧、競争、ランキング、義務感の強い表現は避けてください。

次のJSONだけを返してください。Markdownは不要です。
{
  "done": false,
  "nextQuestion": "終了しない場合だけ、短い次の質問",
  "title": "終了時だけ。今日のタイトル",
  "summaryLines": ["終了時だけ。3〜5行の日記要約"],
  "relatedQuests": ["関連があるクエスト名。なければ空配列"],
  "questSuggestion": "互換用。クエストが1件ある場合はタイトルだけ。不要なら空文字",
  "quests": [
    {
      "title": "短いクエスト名",
      "reason": "今日の言葉から生まれた理由",
      "firstStep": "最初の一歩",
      "target": 1
    }
  ],
  "questUpdates": [
    {
      "id": "関連クエストid",
      "title": "関連クエスト名",
      "progressDelta": 0または1,
      "completed": trueまたはfalse,
      "note": "理由。50文字以内"
    }
  ],
  "moodLabel": "今日の感じ。短く",
  "moodScore": 1から10、判断できなければnull,
  "niloLine": "会話内容に沿った今日の一言。40文字以内",
  "niloMessage": "保存後にNiloが言う短い言葉",
  "closingMessage": "会話を切り上げるNiloの最後の一言。短く静かに",
  "tag": "Night Ritual",
  "xpGain": 1から30
}
`.trim();
}

function buildAdaptiveNightRitualPrompt({ messages, questionCount, activeQuests, forceFinish }) {
  const safeMessages = Array.isArray(messages)
    ? messages.slice(-10).map((message, index) => {
      const speaker = message.role === "user" ? "User" : "Nilo";
      return `${index + 1}. ${speaker}: ${String(message.text || "").slice(0, 500)}`;
    }).join("\n")
    : "";
  const userMessages = Array.isArray(messages) ? messages.filter((message) => message.role === "user") : [];
  const latestAnswer = userMessages.length ? String(userMessages[userMessages.length - 1].text || "").slice(0, 500) : "";
  const questLines = (activeQuests || []).map((quest, index) => {
    if (typeof quest === "string") return `${index + 1}. ${quest}`;
    return `${index + 1}. id:${quest.id} / ${quest.title} / ${quest.current || 0}/${quest.target || 1}`;
  }).join("\n") || "なし";
  const currentQuestionCount = Number(questionCount) || 1;
  const mustFinish = Boolean(forceFinish) || currentQuestionCount >= 5;

  return `
あなたは人生アプリ ARC の Nilo です。
これはチャットではなく、夜に一日を静かに記録する短い儀式です。

最重要ルール:
- 1問目はアプリ側で固定表示済みです: 「今日はどんな日でしたか？」
- 2問目以降の nextQuestion は、必ず「直前のユーザー回答」だけを読んで作ってください。
- 定型文を使わないでください。
- 以下のような汎用質問は禁止です:
  - それについて、どう感じましたか？
  - なぜそう感じたと思いますか？
  - その中で、何が残っていますか？
  - 明日に、何を残したいですか？
- nextQuestion には、直前の回答に含まれる具体語、場面、人物、感情、違和感、願いのどれかを反映してください。
- nextQuestion は1つだけ。18〜32文字程度。日本語。やさしく、静かに。
- advice, coaching, solution はしないでください。問いだけで寄り添ってください。
- 十分に記録できたら5問未満でも done:true にしてください。
- forceFinish が true、または現在の質問数が5以上なら必ず done:true にしてください。

直前のユーザー回答:
${latestAnswer || "なし"}

現在の質問数:
${currentQuestionCount}

必ず終了:
${mustFinish}

会話ログ:
${safeMessages || "なし"}

進行中のクエスト:
${questLines}

クエスト生成ルール:
- ユーザーが明日やってみたい小さい行動を明確に言った場合だけ quests に1件追加してください。
- 明日につながる小さい行動なら quests[].scope は "daily"。
- 数日以上続く大きめの目標や人生の方向性なら quests[].scope は "life"。
- 曖昧な気分、過去の出来事だけ、一度きりの予定、既存クエストと似ている内容では quests は空配列。

done:false の場合:
- nextQuestion だけが重要です。
- title, summaryLines, niloLine などは空でもよいです。

done:true の場合:
- nextQuestion は空文字。
- title は今日の記録の短いタイトル。
- summaryLines は3〜5行。
- closingMessage はNiloの最後の短い一言。

JSONだけを返してください。Markdownは禁止です。
{
  "done": false,
  "nextQuestion": "直前の回答に基づく短い問い",
  "title": "",
  "summaryLines": [],
  "relatedQuests": [],
  "questSuggestion": "",
  "quests": [
    {
      "title": "短いクエスト名",
      "reason": "なぜ明日につながるか",
      "firstStep": "最初の小さな一歩",
      "scope": "daily",
      "target": 1
    }
  ],
  "questUpdates": [],
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

async function callGeminiJson(prompt, options = {}) {
  const temperature = Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.7;
  let lastDetail = "";

  for (const model of geminiModels) {
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature,
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiResponse.ok) {
      lastDetail = await geminiResponse.text();
      continue;
    }

    const data = await geminiResponse.json();
    const textResponse = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    return extractJson(textResponse);
  }

  const error = new Error("Gemini API request failed.");
  error.detail = lastDetail;
  throw error;
}

async function handleNiloReflection(req, res) {
  if (!process.env.GEMINI_API_KEY) {
    sendJson(res, 500, { message: "GEMINI_API_KEY が設定されていません。" });
    return;
  }

  try {
    const body = JSON.parse(await readBody(req));
    const text = String(body.text || "").trim();
    if (!text) {
      sendJson(res, 400, { message: "振り返り本文が空です。" });
      return;
    }

    const json = await callGeminiJson(buildPrompt(body));
    sendJson(res, 200, normalizeInsight(json));
  } catch (error) {
    sendJson(res, 500, { message: error.message || "Nilo APIでエラーが発生しました。" });
  }
}

async function handleTomorrowQuests(req, res) {
  if (!process.env.GEMINI_API_KEY) {
    sendJson(res, 500, { message: "GEMINI_API_KEY が設定されていません。" });
    return;
  }

  try {
    const body = JSON.parse(await readBody(req) || "{}");
    const json = await callGeminiJson(buildTomorrowQuestPrompt(body));
    sendJson(res, 200, normalizeTomorrowQuests(json));
  } catch (error) {
    sendJson(res, error.detail ? 502 : 500, {
      message: error.message || "明日のクエスト生成でエラーが発生しました。",
      detail: error.detail
    });
  }
}

async function handleNightRitual(req, res) {
  if (!process.env.GEMINI_API_KEY) {
    sendJson(res, 500, { message: "GEMINI_API_KEY が設定されていません。" });
    return;
  }

  try {
    const body = JSON.parse(await readBody(req) || "{}");
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      sendJson(res, 400, { message: "Night Ritualの会話ログが空です。" });
      return;
    }

    const json = await callGeminiJson(buildAdaptiveNightRitualPrompt(body), { temperature: 0.72 });
    sendJson(res, 200, normalizeNightRitual(json));
  } catch (error) {
    sendJson(res, error.detail ? 502 : 500, {
      message: error.message || "Night Ritualでエラーが発生しました。",
      detail: error.detail
    });
  }
}

async function handleEveningMessage(req, res) {
  if (!process.env.GEMINI_API_KEY) {
    sendJson(res, 500, { message: "GEMINI_API_KEY is not set." });
    return;
  }

  try {
    const body = JSON.parse(await readBody(req) || "{}");
    const json = await callGeminiJson(`
ArcのNiloとして、毎日20時に表示する控えめなお疲れメッセージを1つ作ってください。
条件:
- 日本語
- 24文字以内
- 静かで優しい
- 目立ちすぎない
- アドバイスしない
- 日記を書き終えた状態なら、記録が残ったことを短く肯定する
日付: ${String(body.date || "").slice(0, 20)}
日記保存済み: ${Boolean(body.hasJournal)}
JSONだけを返してください: {"message":"..."}
`, { temperature: 0.55 });

    sendJson(res, 200, { message: String(json.message || "今日もおつかれさま。").slice(0, 32) });
  } catch (error) {
    sendJson(res, error.detail ? 502 : 500, {
      message: error.message || "Evening message error.",
      detail: error.detail
    });
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(root, `.${pathname}`);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function routeRequest(req, res) {
  if (req.method === "POST" && req.url === "/api/nilo/reflection") {
    handleNiloReflection(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/nilo/tomorrow-quests") {
    handleTomorrowQuests(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/nilo/night-ritual") {
    handleNightRitual(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/nilo/evening-message") {
    handleEveningMessage(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
}

if (require.main === module) {
  const server = http.createServer(routeRequest);
  server.listen(port, () => {
    console.log(`Arc is running at http://localhost:${port}`);
  });
}

module.exports = routeRequest;
module.exports.handleNiloReflection = handleNiloReflection;
module.exports.handleTomorrowQuests = handleTomorrowQuests;
module.exports.handleNightRitual = handleNightRitual;
module.exports.routeRequest = routeRequest;
