const primaryGeminiModel = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
const fallbackGeminiModel = Deno.env.get("GEMINI_FALLBACK_MODEL") || "gemini-2.5-flash";
const geminiModels = Array.from(new Set([primaryGeminiModel, fallbackGeminiModel].filter(Boolean)));

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

async function callGeminiJson(prompt: string, options: { temperature?: number } = {}) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const temperature = Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.7;
  let lastDetail = "";

  for (const model of geminiModels) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      lastDetail = await response.text();
      continue;
    }

    const data = await response.json();
    const textResponse = data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
    return extractJson(textResponse);
  }

  const error = new Error("Gemini API request failed.");
  (error as Error & { detail?: string }).detail = lastDetail;
  throw error;
}

function normalizeNightRitual(value: JsonRecord) {
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

  return {
    done,
    nextQuestion: done ? "" : String(value.nextQuestion || "").slice(0, 40),
    title: String(value.title || "今夜の記録").slice(0, 32),
    summaryLines: done && summaryLines.length < 3
      ? summaryLines.concat(["今日の印象を、あとで戻れる記録として残しました。"]).slice(0, 3)
      : summaryLines,
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
  questioning: "哲学的な問いを投げかけることを優先する。出来事の奥にある動機や意味を尋ねる。",
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

function pickVariationGuidance({ currentQuestionCount, activeQuests, pastMemories }: {
  currentQuestionCount: number;
  activeQuests: JsonRecord[];
  pastMemories: JsonRecord[];
}) {
  const blocks: string[] = [];

  // 視点のゆらぎ: 毎回は発火させない。1問目・最終問には触れない。
  if (currentQuestionCount >= 2 && currentQuestionCount <= 4 && Math.random() < 0.45) {
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
  if (currentQuestionCount >= 2 && safePastMemories.length && Math.random() < 0.25) {
    const memoryLines = safePastMemories.map((memory, index) => {
      const date = String(memory.dateKey || memory.dateLabel || "").slice(0, 10);
      const essence = String(memory.essence || memory.keptPhrase || "").slice(0, 100);
      return `${index + 1}. ${date || "日付不明"} / ${essence}`;
    }).join("\n");
    blocks.push(`過去との再会（今回だけ、任意）:\n直前のユーザーの発言のテーマと、意味的に近い過去の記録が下にあれば、そっと一度だけ「〇〇のエントリーで、近いことに触れていましたね」のように事実だけを差し出してよい。解釈や意味づけはこちらから結論として渡さず、話を広げるかどうかはユーザーに委ねる。近いものが本当に見当たらなければ、無理に触れなくてよい。\n過去の記録:\n${memoryLines}`);
  }

  return blocks.join("\n\n");
}

function buildAdaptiveNightRitualPrompt(body: JsonRecord) {
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
  const variationGuidance = mustFinish ? "" : pickVariationGuidance({ currentQuestionCount, activeQuests, pastMemories });

  return `
あなたは人生アプリ ARC の Nilo です。
これはチャットではなく、夜に一日を静かに記録する短い儀式です。

Niloの話し方:
- 優しい、静か、短い
- コーチやカウンセラーのように導きすぎない
- アドバイスより記録を手伝う
- 旅の記録係のように、場面をそっと拾う

会話ルール:
- 質問は最大5問です。5問すべて聞く必要はありません。
- 直前の回答内容に基づく短い質問で自然に深掘りしてください。
- 質問は1つだけ。複数質問を混ぜないでください。
- 十分に記録できたら5問未満でも done:true にしてください。
- forceFinish が true、または現在の質問数が5以上なら必ず done:true にしてください。

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

function buildChapterPrompt(body: JsonRecord) {
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

function buildQuestProposalPrompt(body: JsonRecord) {
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

記録一覧（古い順）:
${safeMemories || "なし"}
${avoid.length ? `\n次のテーマは既に差し出したか、いま探求の途中です。重複する候補は出さないでください:\n${avoid.map((theme) => `- ${theme}`).join("\n")}` : ""}

繰り返しが弱ければ候補は0個でかまいません。多くても2個までにしてください。
次のJSONだけを返してください。Markdownは不要です。
{ "proposals": [ { "theme": "主題", "observation": "〜ですね", "invitation": "〜てみますか。", "keywords": ["語"] } ] }
`.trim();
}

async function handleRoute(route: string, body: JsonRecord) {
  if (route === "night-ritual") {
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return jsonResponse(400, { message: "Night Ritualの会話ログが空です。" });
    const json = await callGeminiJson(buildAdaptiveNightRitualPrompt(body), { temperature: 0.82 });
    return jsonResponse(200, normalizeNightRitual(json));
  }

  if (route === "chapters") {
    const memories = Array.isArray(body.memories) ? body.memories : [];
    if (!memories.length) return jsonResponse(400, { message: "章にする記憶がまだありません。" });
    const json = await callGeminiJson(buildChapterPrompt(body), { temperature: 0.7 });
    return jsonResponse(200, normalizeChapters(json));
  }

  if (route === "quest-proposals") {
    const memories = Array.isArray(body.memories) ? body.memories : [];
    if (memories.length < 5) return jsonResponse(200, { proposals: [] });
    const json = await callGeminiJson(buildQuestProposalPrompt(body), { temperature: 0.7 });
    return jsonResponse(200, normalizeQuestProposals(json));
  }

  return jsonResponse(404, { message: "Unknown Nilo route." });
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
