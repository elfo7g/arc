import Constants from "expo-constants";
import "react-native-url-polyfill/auto";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Linking from "expo-linking";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Line, Path } from "react-native-svg";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import CryptoJS from "crypto-js";
import {
  useFonts,
  CormorantGaramond_300Light,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium
} from "@expo-google-fonts/cormorant-garamond";
import {
  ShipporiMincho_400Regular,
  ShipporiMincho_500Medium
} from "@expo-google-fonts/shippori-mincho";
import { supabase } from "./src/supabase";

WebBrowser.maybeCompleteAuthSession();

// Typography of "time": old serifs for the Latin, Hiragino Mincho for the
// Japanese — never tightened, given room to breathe.
const fontSerifEn = "CormorantGaramond_400Regular";
const fontSerifEnLight = "CormorantGaramond_300Light";
const fontSerifEnMedium = "CormorantGaramond_500Medium";
// Shippori Mincho — the same Mincho the prototype and Web preview use, now
// bundled so the Japanese voice is identical on iOS, Android, and web (no more
// falling back to a platform gothic). Shippori has no 300, so light text lands
// on 400 — which is exactly what the webfont resolves to as well.
const fontSerifJa = "ShipporiMincho_400Regular";
const fontSerifJaMedium = "ShipporiMincho_500Medium";
const fontUi = Platform.select({ ios: "Avenir Next", android: "sans-serif", default: "sans-serif" });
const fontUiMedium = Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" });

const backgroundTexture = require("./assets/textures/arc-night-texture.png");
const grainTexture = require("./assets/textures/grain.png");
const deepGrainTexture = require("./assets/textures/grain-deep.png");
// A pre-rendered soft radial glow — the same diffuse amber orb the prototype and
// Web preview draw with a CSS radial-gradient (which RN can't do natively).
const niloOrbTexture = require("./assets/nilo-orb.png");

const tabs = [
  { id: "home", label: "ホーム" },
  { id: "quests", label: "クエスト" },
  { id: "journal", label: "日記" },
  { id: "story", label: "章" }
];

const termsSections = [
  {
    title: "1. ARCについて",
    body: "ARCは、Niloとの夜の振り返り、日記、クエスト、記憶を通じて日々を記録するためのアプリです。医療、法律、金融、心理療法などの専門的助言を提供するものではありません。"
  },
  {
    title: "2. アカウントと利用",
    body: "ユーザーは、自分の責任でアカウント情報を管理し、第三者になりすました利用、不正アクセス、サービスの妨害、法令や公序良俗に反する利用を行わないものとします。"
  },
  {
    title: "3. 記録内容",
    body: "ユーザーが入力した振り返り、日記、クエスト、プロフィール情報は、ARC内の体験を提供するために利用されます。大切な情報や緊急性のある内容は、必要に応じて信頼できる人や専門機関にも共有してください。"
  },
  {
    title: "4. AI応答について",
    body: "Niloの応答は、ユーザーの入力をもとに生成される補助的な文章です。内容の正確性、完全性、有用性を保証するものではなく、最終的な判断はユーザー自身の責任で行うものとします。"
  },
  {
    title: "5. 変更と停止",
    body: "ARCは、機能改善、保守、仕様変更のため、予告なく一部機能を変更または停止する場合があります。重要な記録は、必要に応じてユーザー自身でも控えを保存してください。"
  }
];

const privacyPolicySections = [
  {
    title: "1. 取得する情報",
    body: "ARCは、メールアドレス、認証情報、名前、生年月日、日記、振り返り回答、クエスト、設定情報など、ユーザーが入力または利用時に生成した情報を扱います。"
  },
  {
    title: "2. 利用目的",
    body: "取得した情報は、ログイン、日数表示、日記保存、Niloの応答生成、クエストや記憶の作成、設定の反映、サービス改善、不正利用の防止のために利用します。"
  },
  {
    title: "3. 外部サービス",
    body: "ARCは、認証やデータ保存のために Supabase を利用します。また、AI応答生成などの機能で外部APIを利用する場合があります。外部サービスには、機能提供に必要な範囲の情報が送信されることがあります。"
  },
  {
    title: "4. ユーザーの選択",
    body: "設定のプライバシー画面から、日記内容をクエスト生成、記憶候補、プロフィール反映に利用するかを切り替えられます。ログアウトや開発モードでは、利用できる同期機能が変わる場合があります。"
  },
  {
    title: "5. 保管と削除",
    body: "保存された情報は、サービス提供に必要な期間保管されます。削除やエクスポートなどの操作は、今後の機能として整備していきます。"
  }
];

const bgmTracks = [
  {
    id: "arc-night",
    title: "Arc Night",
    subtitle: "静かな夜の低い灯り",
    source: require("./assets/audio/arc-night.wav")
  }
];
const uiTapSound = require("./assets/audio/arc-tap.wav");
let optionalAudio = null;
try {
  optionalAudio = require("expo-audio");
} catch {
  optionalAudio = null;
}

const dailyBank = [
  "水を一杯飲む",
  "ストレッチ3分",
  "本を1ページ読む",
  "机を片付ける",
  "日光を10分浴びる",
  "深呼吸20回"
];

const apiBaseUrl = Constants.expoConfig?.extra?.arcApiBaseUrl || "http://localhost:4173";
const arcStartDate = "2026-06-01";
const STORAGE_KEY = "arc.state.v1";
// Chapters only form in the past: the most recent stretch stays "in progress"
// and is never offered as a chapter (the present can't see its own chapters).
const CHAPTER_DELAY_DAYS = 60;
function chapterCutoffKey(days = CHAPTER_DELAY_DAYS) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff.toISOString().slice(0, 10);
}
const DEV_MODE = true;
const DEV_USER = {
  id: "dev-user-001",
  email: "dev@arc.app",
  name: "Explorer"
};
const DEV_SESSION = {
  access_token: "dev-access-token",
  refresh_token: "dev-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: DEV_USER.id,
    email: DEV_USER.email,
    user_metadata: {
      name: DEV_USER.name
    }
  }
};
const DEV_PROFILE = {
  name: DEV_USER.name,
  birthdate: arcStartDate,
  imageUri: ""
};
const reflectionQuestions = [
  "今日はどんな日でしたか？"
];
const maxReflectionQuestions = 5;
const questDust = [
  { x: -28, y: -54, delay: 0, size: 5 },
  { x: -10, y: -72, delay: 60, size: 4 },
  { x: 16, y: -64, delay: 35, size: 6 },
  { x: 34, y: -38, delay: 95, size: 3 },
  { x: -34, y: -24, delay: 120, size: 3 },
  { x: 6, y: -92, delay: 155, size: 4 },
  { x: 28, y: -82, delay: 185, size: 3 },
  { x: -18, y: -98, delay: 210, size: 2 }
];

const dailyQuestPrompts = [
  { title: "三年前の春を、ひとつ思い出して。", category: "記憶" },
  { title: "今日、言えなかった「ありがとう」は？", category: "感謝", nilo: true },
  { title: "いま、いちばん手放したい荷物は？", category: "手放す" }
];

const demoJournalEntries = [
  {
    id: "demo-journal-tonight",
    dateKey: "2026-06-28",
    dateLabel: "6月28日",
    tag: "TONIGHT",
    source: "home",
    title: "夕方、ひとりで長い散歩をした。川沿いの道を、ただ歩いていた。",
    lines: [],
    dialogue: [
      { role: "nilo", text: "今日はどんな日だった？" },
      { role: "user", text: "夕方、ひとりで長い散歩をした。川沿いの道を、ただ歩いていた。" },
      { role: "nilo", text: "ひとりの時間は、あなたにとってどんな意味があった？" },
      { role: "user", text: "誰にも気をつかわなくていい。ようやく、呼吸ができた気がした。" },
      { role: "nilo", text: "その「呼吸ができた」感じを、最近よく探している？" },
      { role: "user", text: "たぶん。少しずつ、自分のペースを取り戻している。" }
    ],
    emotions: ["#静けさ", "#回復", "#ひとり時間"],
    related: [{ date: "5月19日", text: "夜、海まで歩いた。波の音だけが、ずっと残っていた。" }]
  },
  {
    id: "demo-journal-quest",
    dateKey: "2026-06-27",
    dateLabel: "6月27日",
    tag: "QUEST",
    source: "quest",
    questText: "いちばん安心する場所は、どこ？",
    title: "実家の台所の隅。母が料理していた音がする場所。",
    lines: [],
    dialogue: [
      { role: "nilo", text: "いちばん安心する場所は、どこ？" },
      { role: "user", text: "実家の台所の隅。母が料理していた音がする場所。" },
      { role: "nilo", text: "その音は、いまのあなたに何を思い出させる？" },
      { role: "user", text: "守られていた頃のこと。もう戻れないけど、確かにあった時間。" }
    ],
    emotions: ["#安心", "#記憶", "#家族"]
  },
  {
    id: "demo-journal-rain",
    dateKey: "2026-06-25",
    dateLabel: "6月25日",
    source: "home",
    title: "雨の音で目が覚めた。久しぶりに、何も予定のない朝。",
    lines: [],
    dialogue: [
      { role: "nilo", text: "今日はどんな日だった？" },
      { role: "user", text: "雨の音で目が覚めた。久しぶりに、何も予定のない朝。" },
      { role: "nilo", text: "その静けさは、どんな色をしていた？" },
      { role: "user", text: "薄いグレー。でも嫌じゃない、やわらかい色。" }
    ],
    emotions: ["#休息", "#静けさ"]
  },
  {
    id: "demo-journal-call",
    dateKey: "2026-06-21",
    dateLabel: "6月21日",
    source: "home",
    title: "母に電話した。短い会話だったけど、声が聞けてよかった。",
    lines: [],
    dialogue: [
      { role: "nilo", text: "今日はどんな日だった？" },
      { role: "user", text: "母に電話した。短い会話だったけど、声が聞けてよかった。" },
      { role: "nilo", text: "伝えられなかったことは、何かある？" },
      { role: "user", text: "ありがとう、かな。いつも言いそびれてしまう。" }
    ],
    emotions: ["#家族", "#感謝"]
  },
  {
    id: "demo-journal-old",
    dateKey: "2026-06-14",
    dateLabel: "6月14日",
    tag: "QUEST",
    source: "quest",
    questText: "そっと手放したいものは？",
    title: "完璧じゃない自分を、責めてしまう癖。",
    lines: [],
    dialogue: [
      { role: "nilo", text: "そっと手放したいものは？" },
      { role: "user", text: "完璧じゃない自分を責める癖。" },
      { role: "nilo", text: "それを手放せたら、何が変わると思う？" },
      { role: "user", text: "もう少し、自分にやさしくなれる気がする。" }
    ],
    emotions: ["#決意", "#内省"]
  }
];

// Chapters carry no data of their own — each page is diary entries re-read at
// a larger scale (per the Chapter spec: a meta-layer over the diary, never a
// replacement). Numbers appear only as accumulated weight, never as progress.
const demoChapters = [
  {
    id: "demo-chapter-recovery",
    title: "静かな回復",
    ordinal: "第二章",
    period: "2023 — いま",
    summary: "波が引くように、痛みが遠ざかる。",
    current: true,
    tint: "rgba(214,168,106,0.16)",
    recordCount: 34,
    excerpts: [
      { date: "6月28日", text: "夕方、ひとりで長い散歩をした。川沿いの道を、ただ歩いていた。" },
      { date: "6月21日", text: "母に電話した。短い会話だったけど、声が聞けてよかった。" },
      { date: "2月3日", text: "久しぶりに、朝が怖くなかった。" }
    ],
    reunion: {
      fromLabel: "序章 ・ はじまりの場所",
      quote: "何も知らないことが、あんなに強かったなんて。"
    },
    wish: {
      theme: "航空大学校に合格する",
      line: "この章のあいだに、12回この願いに触れてきた。"
    },
    words: [
      { text: "呼吸", weight: 3 },
      { text: "散歩", weight: 2 },
      { text: "母", weight: 3 },
      { text: "雨の音", weight: 1 },
      { text: "ゆっくり", weight: 2 },
      { text: "手放す", weight: 1 }
    ],
    figures: ["母", "川沿いの道", "実家の台所"],
    niloLetter: "この章のあなたは、急がなくなりましたね。遠くを見る代わりに、足元の言葉が増えました。それは戻ることではなく、深くなることだと、私は思っています。",
    stats: { records: "34の記録", span: "1年と6ヶ月", emotion: "中心にあった感情 ・ 安心" }
  },
  {
    id: "demo-chapter-detour",
    title: "遠回りの年",
    ordinal: "第一章",
    period: "2021 — 2023",
    summary: "迷いながら、それでも歩いていた。",
    tint: "rgba(122,140,168,0.14)",
    recordCount: 58,
    excerpts: [
      { date: "2022年11月", text: "また進路を変えた。誰にも言えなかった。" },
      { date: "2022年6月", text: "眠れない夜が続く。でも書くことだけはやめていない。" },
      { date: "2021年9月", text: "全部を疑った日。それでも朝は来た。" }
    ],
    reunion: {
      fromLabel: "第二章 ・ 静かな回復",
      quote: "あの遠回りがなければ、この静けさに気づけなかった。"
    },
    words: [
      { text: "夜", weight: 3 },
      { text: "進路", weight: 2 },
      { text: "ひとり", weight: 2 },
      { text: "それでも", weight: 3 },
      { text: "書く", weight: 1 }
    ],
    figures: ["深夜の机", "駅までの坂道"],
    niloLetter: "遠回りと呼んでいた道を、あなたはいちども止まらずに歩いていました。迷いの言葉の奥に、進み続けた記録だけが残っています。",
    stats: { records: "58の記録", span: "2年", emotion: "中心にあった感情 ・ 揺らぎ" }
  },
  {
    id: "demo-chapter-origin",
    title: "はじまりの場所",
    ordinal: "序章",
    period: "2019 — 2021",
    summary: "何も知らずに、ただ眩しかった。",
    tint: "rgba(196,142,142,0.12)",
    recordCount: 1,
    excerpts: [
      { date: "2019年4月", text: "空を見上げて、パイロットになりたいと思った日。" }
    ],
    wish: {
      theme: "航空大学校に合格する",
      line: "この願いが、はじめて言葉になった章。"
    },
    figures: ["春の空港", "はじめてのノート"],
    niloLetter: "この章に残っている言葉は、ひとつだけ。でもその一行から、いまに続くすべてが始まっています。",
    stats: { records: "1つの記録", span: "2年", emotion: "中心にあった感情 ・ 憧れ" }
  }
];

// The former Life Quest, folded into Quest as a future-facing exploration per
// the integration memo: motivation comes from the visible weight of time and
// words spent (経過時間・言葉の積み重ね), never from completion metrics.
const demoFutureQuest = {
  id: "future-pilot",
  theme: "航空大学校に合格する",
  since: "2024年4月から",
  duration: "2年3ヶ月",
  latestLine: "落ちても、この時間は無駄じゃない。",
  niloLine: "これだけ長く、この夢と一緒にいますね。",
  records: [
    { date: "6月20日", text: "数学の過去問、ようやく7割。少しだけ、光が見えた。" },
    { date: "6月8日", text: "模試の結果に落ち込んだ。でも、やめる気はない。" },
    { date: "5月22日", text: "身体検査の不安を、Niloに話した。" },
    { date: "4月2日", text: "この夢を、はじめてちゃんと言葉にした日。" }
  ]
};

// The diary timeline fades with age across five graded steps (newest → oldest),
// matching the ARC reference: the node shrinks and dims, the date and body cool.
// Each node overrides timelineDot's 7x7 base size, so left/top are recomputed
// per size to keep every dot centered on the timeline (they'd drift off the
// line otherwise, since left/top are measured from the box's corner).
const diaryNodeStyles = [
  { width: 10, height: 10, left: -26.5, top: 20.5, backgroundColor: "rgba(242,200,142,0.98)", shadowColor: "#d9a86c", shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  { width: 7, height: 7, left: -25, top: 22, backgroundColor: "rgba(217,168,108,0.6)", shadowColor: "#d9a86c", shadowOpacity: 0.22, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
  { width: 6, height: 6, left: -24.5, top: 22.5, backgroundColor: "rgba(195,176,148,0.42)" },
  { width: 6, height: 6, left: -24.5, top: 22.5, backgroundColor: "rgba(180,164,138,0.34)" },
  { width: 5, height: 5, left: -24, top: 23, backgroundColor: "rgba(170,156,132,0.3)" }
];
const diaryDateColors = ["rgba(232,200,150,0.88)", "rgba(205,191,168,0.6)", "rgba(205,191,168,0.5)", "rgba(205,191,168,0.4)", "rgba(205,191,168,0.32)"];
const diaryTextColors = ["rgba(236,230,218,0.94)", "rgba(232,226,214,0.7)", "rgba(232,226,214,0.6)", "rgba(232,226,214,0.5)", "rgba(232,226,214,0.42)"];

// Quests per the ARC Quest Spec v1.0: Nilo proposes them from recurring themes
// in the diary ("〜ですね" observation + "〜てみますか" invitation), the user
// keeps the choice. Ongoing quests show only what they explore and how long
// the user has faced them — no badges, progress bars, or clear states.
const demoQuestProposals = [
  {
    id: "proposal-breath",
    theme: "「呼吸ができた」と感じる時間は、どこから来るのか",
    observation: "「呼吸ができた」という言葉が、この一ヶ月で何度か出てきましたね。",
    invitation: "その感じがどこから来ているのか、一緒に辿ってみますか。"
  }
];

const demoOngoingQuests = [
  {
    id: "quest-mother",
    demo: true,
    theme: "母との関係が、どう変わってきたか",
    since: "5月26日から",
    duration: "5週間",
    sessions: 6,
    records: [
      { date: "6月21日", text: "母に電話した。短い会話だったけど、声が聞けてよかった。" },
      { date: "6月8日", text: "母の口癖を、自分も使っていることに気づいた。" },
      { date: "5月26日", text: "実家の台所の隅。母が料理していた音がする場所。" }
    ]
  },
  {
    id: "quest-release",
    demo: true,
    theme: "完璧じゃない自分を責める癖は、どこから来たのか",
    since: "6月14日から",
    duration: "2週間",
    sessions: 3,
    records: [
      { date: "6月25日", text: "できなかったことより、やったことを数えた夜。" },
      { date: "6月14日", text: "完璧じゃない自分を、責めてしまう癖。" }
    ]
  }
];

function getEmailOtpErrorMessage(error) {
  const message = String(error?.message || "");
  const status = error?.status;
  if (status === 403 || /expired|invalid|token|otp|code/i.test(message)) {
    return "コードが無効、または期限切れです。新しい6桁コードを再送して、もう一度お試しください。";
  }
  return message || "コードを確認できませんでした。少し時間をおいてもう一度お試しください。";
}

function AppContent() {
  const { height } = useWindowDimensions();
  const [fontsLoaded] = useFonts({
    CormorantGaramond_300Light,
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    ShipporiMincho_400Regular,
    ShipporiMincho_500Medium
  });
  const [activeTab, setActiveTab] = useState("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState("base");
  // A tapped diary entry / lit question opens its full record. null = closed.
  const [detailEntry, setDetailEntry] = useState(null);
  const [ritualMessages, setRitualMessages] = useState([
    { role: "nilo", text: reflectionQuestions[0] }
  ]);
  const [currentReflectionQuestion, setCurrentReflectionQuestion] = useState(reflectionQuestions[0]);
  const [questionTransitioning, setQuestionTransitioning] = useState(false);
  const [answerPreview, setAnswerPreview] = useState(null);
  const [questionCount, setQuestionCount] = useState(1);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [session, setSession] = useState(() => DEV_MODE ? DEV_SESSION : null);
  const [authLoading, setAuthLoading] = useState(!DEV_MODE);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputMode, setInputMode] = useState(false);
  const [ritualLocked, setRitualLocked] = useState(false);
  const [homePromptVisible, setHomePromptVisible] = useState(false);
  const [unlockNotice, setUnlockNotice] = useState("");
  const [sealActive, setSealActive] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [journal, setJournal] = useState([]);
  const [quests, setQuests] = useState(() => createDailyQuests());
  const [memories, setMemories] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [chaptersBusy, setChaptersBusy] = useState(false);
  const [chapterProposals, setChapterProposals] = useState([]);
  // 章の「あの日の自分へ」— one note per chapter id, kept across sessions.
  const [chapterNotes, setChapterNotes] = useState({});
  // クエスト (explorations): Nilo's pending proposals, the ongoing/closed
  // explorations the user accepted, declined themes Nilo must not re-offer,
  // and the dateKey of the last scan so Nilo looks at most once a day.
  const [questProposals, setQuestProposals] = useState([]);
  const [explorations, setExplorations] = useState([]);
  const [declinedQuestThemes, setDeclinedQuestThemes] = useState([]);
  const [questScanDateKey, setQuestScanDateKey] = useState("");
  const questScanRef = useRef(false);
  const notificationPromptRef = useRef(false);
  // 通知タブ（お知らせ）: Niloの提案などが届いたときの記録。承認/却下の判断はせず、
  // ただ「起きたこと」を静かに並べる場所。
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState(() => DEV_MODE ? DEV_PROFILE : { name: "", birthdate: "" });
  const [settings, setSettings] = useState({
    bgmEnabled: false,
    bgmTrackId: "arc-night",
    bgmVolume: 0.36,
    soundEffectsEnabled: true,
    hapticsEnabled: true,
    backgroundId: "navy-check",
    language: "ja",
    notificationsEnabled: false,
    notificationTime: "22:00",
    lastNotificationDateKey: "",
    ritual: {
      questionCount: 5,
      autoSaveJournal: true,
      confirmExit: true,
      windowStart: "20:00",
      windowEnd: "03:00"
    },
    reflection: {
      frequency: "daily",
      summaryStyle: "narrative",
      compareLastYear: true,
      tone: "quiet"
    },
    niloStyle: "empathetic",
    fontScale: "standard",
    privacy: {
      questLink: true,
      memoryLink: true,
      profileUse: true
    },
    security: {
      lockEnabled: true,
      recoveryKeyIssued: false,
      recoveryKeyIssuedAt: null,
      emergencyContacts: []
    },
    inheritance: {
      contacts: [],
      defaultAction: "delete",
      reservedDisclosures: []
    }
  });

  // 子ツリーが描画される前に styles を差し替える（書体サイズ設定の反映）。
  applyFontScale(settings.fontScale);

  const activeQuests = useMemo(() => quests.filter((quest) => !quest.completed), [quests]);
  const unreadNotificationCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);
  const journalDateKey = getJournalDateKey();
  const reflectionFrequency = normalizeReflectionFrequency(settings.reflection?.frequency);
  // Night Ritual no longer fixed to daily / a nightly time window — the user's
  // chosen cadence decides whether the current period still has a reflection open.
  const journalRecordedThisPeriod = isReflectionRecordedForPeriod(journal, reflectionFrequency);
  const ritualSettings = settings.ritual || {};
  const ritualQuestionTarget = Math.max(1, Math.min(maxReflectionQuestions, Number(ritualSettings.questionCount) || maxReflectionQuestions));
  const ritualAvailable = !journalRecordedThisPeriod;
  const reflectionInputEnabled = ritualLocked || ritualAvailable || DEV_MODE;
  const composerPrompt = journalRecordedThisPeriod ? REFLECTION_DONE_PROMPTS[reflectionFrequency] || "記録済みです" : "短く答える";
  const journalRecordDays = new Set(journal.map((entry) => entry.dateKey || getJournalDateKey())).size;
  const journalStreakDays = useMemo(() => getJournalStreakDays(journal), [journal]);
  const memoryRecordDays = new Set(memories.map((memory) => memory.dateKey || memory.id)).size;
  const tabUnlocks = useMemo(() => ({
    home: true,
    quests: DEV_MODE || journalRecordDays >= 3,
    journal: DEV_MODE || journalRecordDays >= 1,
    story: DEV_MODE || memoryRecordDays >= 10,
    memory: DEV_MODE || memoryRecordDays >= 10
  }), [journalRecordDays, memoryRecordDays]);
  const profileComplete = Boolean(profile.name?.trim() && profile.birthdate?.trim());
  const activeBgmTrack = bgmTracks.find((track) => track.id === settings.bgmTrackId) || bgmTracks[0];
  const [bgmStatus, setBgmStatus] = useState({ playing: false, isLoaded: false });
  const bgmPlayerRef = useRef(null);
  const sfxPlayerRef = useRef(null);
  const tabBarOpacity = useRef(new Animated.Value(1)).current;
  const unlockNoticeOpacity = useRef(new Animated.Value(0)).current;
  // A hard blackout the instant the ritual begins, held briefly, then faded
  // away — so the dialogue arrives out of black rather than cross-fading
  // straight from Home.
  const ritualBlackout = useRef(new Animated.Value(0)).current;
  const unlockNoticeTimer = useRef(null);
  const sealTimer = useRef(null);
  const composerInputRef = useRef(null);
  const ritualLockedRef = useRef(false);
  const ritualFocusTimers = useRef([]);
  const ritualRunIdRef = useRef(0);
  const didShowInitialHomePrompt = useRef(false);
  const redirectUri = Linking.createURL("auth/callback");
  // English month-day label for Nilo's header ("JUNE 28 · 今夜"), like the reference.
  const niloEnDate = useMemo(() => {
    const d = new Date();
    const months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }, []);

  function keepRitualInputFocused() {
    if (!ritualLockedRef.current) return;
    setInputMode(true);
    setHomePromptVisible(true);
    ritualFocusTimers.current.forEach(clearTimeout);
    ritualFocusTimers.current = [];
    requestAnimationFrame(() => composerInputRef.current?.focus());
    [60, 160, 320].forEach((delay) => {
      const timer = setTimeout(() => {
        if (ritualLockedRef.current) composerInputRef.current?.focus();
      }, delay);
      ritualFocusTimers.current.push(timer);
    });
  }

  function exitNightRitual() {
    ritualRunIdRef.current += 1;
    ritualLockedRef.current = false;
    ritualFocusTimers.current.forEach(clearTimeout);
    ritualFocusTimers.current = [];
    if (sealTimer.current) clearTimeout(sealTimer.current);
    setSealActive(false);
    setRitualLocked(false);
    setInputMode(false);
    setHomePromptVisible(false);
    setExitConfirmOpen(false);
    setInput("");
    setIsSending(false);
    setRitualMessages([{ role: "nilo", text: reflectionQuestions[0] }]);
    setCurrentReflectionQuestion(reflectionQuestions[0]);
    setQuestionCount(1);
    setAnswerPreview(null);
    setQuestionTransitioning(false);
    composerInputRef.current?.blur();
    Keyboard.dismiss();
  }

  // Same blackout-then-fade the ritual opens with, played in reverse on the
  // way out — so leaving reads as deliberately as arriving did.
  function exitNightRitualWithBlackout() {
    ritualBlackout.setValue(1);
    exitNightRitual();
    Animated.sequence([
      Animated.delay(140),
      Animated.timing(ritualBlackout, {
        toValue: 0,
        duration: 640,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }

  function requestExitNightRitual() {
    if (settings.ritual?.confirmExit === false) {
      exitNightRitualWithBlackout();
      return;
    }
    setExitConfirmOpen(true);
  }

  function confirmExitNightRitual() {
    exitNightRitualWithBlackout();
  }

  function cancelExitNightRitual() {
    setExitConfirmOpen(false);
    keepRitualInputFocused();
  }

  function openEntryDetail(entry) {
    if (!entry) return;
    playUiSound();
    setDetailEntry(entry);
  }

  function closeEntryDetail() {
    setDetailEntry(null);
  }

  useEffect(() => {
    ritualLockedRef.current = ritualLocked;
    if (ritualLocked) keepRitualInputFocused();
    return undefined;
  }, [ritualLocked]);

  useEffect(() => () => {
    ritualFocusTimers.current.forEach(clearTimeout);
    ritualFocusTimers.current = [];
    if (unlockNoticeTimer.current) clearTimeout(unlockNoticeTimer.current);
    if (sealTimer.current) clearTimeout(sealTimer.current);
  }, []);

  useEffect(() => {
    if (DEV_MODE) {
      setSession(DEV_SESSION);
      setAuthLoading(false);
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(error.message);
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Load any saved life data once on launch, before the save effect can run.
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const saved = JSON.parse(raw);
            if (Array.isArray(saved.journal)) setJournal(saved.journal);
            if (Array.isArray(saved.quests) && saved.quests.length) setQuests(saved.quests);
            if (Array.isArray(saved.memories)) setMemories(saved.memories);
            if (Array.isArray(saved.chapters)) setChapters(saved.chapters);
            if (saved.chapterNotes && typeof saved.chapterNotes === "object") setChapterNotes(saved.chapterNotes);
            if (Array.isArray(saved.questProposals)) setQuestProposals(saved.questProposals);
            if (Array.isArray(saved.explorations)) setExplorations(saved.explorations);
            if (Array.isArray(saved.declinedQuestThemes)) setDeclinedQuestThemes(saved.declinedQuestThemes);
            if (typeof saved.questScanDateKey === "string") setQuestScanDateKey(saved.questScanDateKey);
            if (Array.isArray(saved.notifications)) setNotifications(saved.notifications);
            if (saved.profile) setProfile((current) => ({ ...current, ...saved.profile }));
            if (saved.settings) {
              setSettings((current) => ({
                ...current,
                ...saved.settings,
                ritual: { ...current.ritual, ...(saved.settings.ritual || {}) },
                privacy: { ...current.privacy, ...(saved.settings.privacy || {}) },
                reflection: { ...current.reflection, ...(saved.settings.reflection || {}) },
                security: { ...current.security, ...(saved.settings.security || {}) },
                inheritance: { ...current.inheritance, ...(saved.settings.inheritance || {}) }
              }));
            }
          } catch {
            // Corrupt cache should never block launch; fall back to defaults.
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setHydrated(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Persist only after hydration so initial defaults never overwrite saved data.
    if (!hydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        journal, quests, memories, chapters, chapterNotes, profile, settings,
        questProposals, explorations, declinedQuestThemes, questScanDateKey, notifications
      })
    ).catch(() => undefined);
  }, [hydrated, journal, quests, memories, chapters, chapterNotes, profile, settings, questProposals, explorations, declinedQuestThemes, questScanDateKey, notifications]);

  useEffect(() => {
    // Opening the quest tab is when Nilo glances over the recent records —
    // at most once a day, and only after saved state has loaded.
    if (hydrated && activeTab === "quests") scanForQuestProposals();
  }, [hydrated, activeTab]);

  useEffect(() => {
    if (!hydrated || !profileComplete || !settings.notificationsEnabled) return undefined;

    const checkNightWhisper = () => {
      if (notificationPromptRef.current || settingsOpen || isSending || ritualLockedRef.current) return;
      if (!shouldShowNightWhisper({ settings, journal, frequency: reflectionFrequency })) return;

      notificationPromptRef.current = true;
      const today = getJournalDateKey();
      setSettings((current) => ({ ...current, lastNotificationDateKey: today }));
      confirmDialog(
        "夜のささやき",
        "そろそろ、今夜の問いを灯す時間です。",
        [
          {
            text: "あとで",
            style: "cancel",
            onPress: () => {
              notificationPromptRef.current = false;
            }
          },
          {
            text: "灯す",
            onPress: () => {
              notificationPromptRef.current = false;
              setActiveTab("home");
              requestAnimationFrame(() => beginReflectionInput());
            }
          }
        ]
      );

      if (Platform.OS === "web") notificationPromptRef.current = false;
    };

    const initialTimer = setTimeout(checkNightWhisper, 1200);
    const interval = setInterval(checkNightWhisper, 60000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [hydrated, profileComplete, settings, settingsOpen, isSending, journal, reflectionFrequency]);

  useEffect(() => {
    if (settings.privacy?.questLink === false) setQuestProposals([]);
  }, [settings.privacy?.questLink]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const syncKeyboardMotion = (event) => {
      Keyboard.scheduleLayoutAnimation?.(event);
    };
    const showSub = Keyboard.addListener(showEvent, (event) => {
      syncKeyboardMotion(event);
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, (event) => {
      syncKeyboardMotion(event);
      if (ritualLockedRef.current) keepRitualInputFocused();
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!optionalAudio?.createAudioPlayer) {
      setBgmStatus({ playing: false, isLoaded: false });
      return undefined;
    }

    optionalAudio.setAudioModeAsync?.({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "mixWithOthers"
    }).catch(() => undefined);

    bgmPlayerRef.current = optionalAudio.createAudioPlayer(null);
    sfxPlayerRef.current = optionalAudio.createAudioPlayer(uiTapSound);
    setBgmStatus({ playing: false, isLoaded: true });

    return () => {
      bgmPlayerRef.current?.pause?.();
      bgmPlayerRef.current?.remove?.();
      bgmPlayerRef.current = null;
      sfxPlayerRef.current?.remove?.();
      sfxPlayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const player = bgmPlayerRef.current;
    if (!player) return;

    try {
      player.replace(activeBgmTrack.source);
      player.loop = true;
      player.volume = settings.bgmVolume;
      if (settings.bgmEnabled) player.play();
      setBgmStatus({ playing: Boolean(settings.bgmEnabled), isLoaded: true });
    } catch {
      setBgmStatus({ playing: false, isLoaded: false });
    }
  }, [activeBgmTrack.source]);

  useEffect(() => {
    const player = bgmPlayerRef.current;
    if (!player) return;

    try {
      player.loop = true;
      player.volume = settings.bgmVolume;
      if (settings.bgmEnabled) {
        player.play();
      } else {
        player.pause();
      }
      setBgmStatus({ playing: Boolean(settings.bgmEnabled), isLoaded: true });
    } catch {
      setBgmStatus({ playing: false, isLoaded: false });
    }
  }, [settings.bgmEnabled, settings.bgmVolume]);

  useEffect(() => {
    Animated.timing(tabBarOpacity, {
      toValue: inputMode || keyboardVisible || ritualLocked ? 0 : 1,
      duration: inputMode || keyboardVisible || ritualLocked ? 180 : 260,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [inputMode, keyboardVisible, ritualLocked, tabBarOpacity]);

  useEffect(() => {
    if (ritualLocked) return;
    if (activeTab !== "home") {
      setInputMode(false);
      setHomePromptVisible(false);
      composerInputRef.current?.blur();
      Keyboard.dismiss();
    }
  }, [activeTab, ritualLocked]);

  useEffect(() => {
    if (activeTab !== "home") {
      setHomePromptVisible(false);
      return undefined;
    }

    if (inputMode || ritualLocked || keyboardVisible) {
      setHomePromptVisible(true);
      return undefined;
    }

    if (!didShowInitialHomePrompt.current) {
      didShowInitialHomePrompt.current = true;
      setHomePromptVisible(false);
      const timer = setTimeout(() => setHomePromptVisible(true), 260);
      return () => clearTimeout(timer);
    }

    setHomePromptVisible(false);
    const timer = setTimeout(() => setHomePromptVisible(true), 260);
    return () => clearTimeout(timer);
  }, [activeTab, inputMode, keyboardVisible, ritualLocked]);

  useEffect(() => {
    if (!ritualLocked) return undefined;
    const refocus = setTimeout(() => {
      keepRitualInputFocused();
    }, 80);
    return () => clearTimeout(refocus);
  }, [keyboardVisible, ritualLocked]);

  async function signInWithGoogle() {
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true
        }
      });

      if (error) throw error;
      if (!data?.url) throw new Error("GoogleログインURLを作成できませんでした。");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      if (result.type !== "success") return;

      const parsedUrl = new URL(result.url);
      const code = parsedUrl.searchParams.get("code");
      if (!code) throw new Error("認証コードを取得できませんでした。");

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
    } catch (error) {
      setAuthError(error.message || "Googleログインに失敗しました。");
    } finally {
      setAuthBusy(false);
    }
  }

  async function sendEmailLogin(email) {
    const trimmedEmail = String(email || "").trim();
    if (!trimmedEmail) {
      setAuthError("メールアドレスを入力してください。");
      return false;
    }

    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");

    try {
      const { error } = await supabase.auth.signInWithOtp({ email: trimmedEmail });
      if (error) throw error;
      setAuthNotice("メールに届いた6桁のコードを入力してください。");
      return true;
    } catch (error) {
      setAuthError(error.message || "メールログインの送信に失敗しました。");
      return false;
    } finally {
      setAuthBusy(false);
    }
  }

  async function verifyEmailLogin(email, token) {
    const trimmedEmail = String(email || "").trim();
    const trimmedToken = String(token || "").trim();
    if (!trimmedEmail || !trimmedToken) {
      setAuthError("メールアドレスとコードを入力してください。");
      return;
    }
    if (!/^\d{6}$/.test(trimmedToken)) {
      setAuthError("6桁のコードを入力してください。");
      return;
    }

    setAuthBusy(true);
    setAuthError("");

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedToken,
        type: "email"
      });
      if (error) throw error;
      setAuthNotice("");
    } catch (error) {
      setAuthError(getEmailOtpErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (DEV_MODE) {
      setSession(DEV_SESSION);
      setProfile(DEV_PROFILE);
      setAuthError("");
      setAuthNotice("DEV_MODE is enabled. Supabase auth is bypassed.");
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
    setAuthBusy(false);
  }

  async function pickProfileImage() {
    playUiSound();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("写真を選択できません", "プロフィール写真を変更するには、写真ライブラリへのアクセスを許可してください。");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;
    setProfile((current) => ({ ...current, imageUri: result.assets[0].uri }));
  }

  function playUiSound() {
    if (settings.hapticsEnabled) {
      Haptics.selectionAsync().catch(() => undefined);
    }
    if (!settings.soundEffectsEnabled) return;
    const player = sfxPlayerRef.current;
    if (!player) return;
    try {
      player.volume = 0.28;
      player.seekTo(0);
      player.play();
    } catch {
      // Sound feedback should never block the main interaction.
    }
  }

  function getLockedTabNotice(tabId) {
    if (tabId === "quests") return "3日間の記録で開放";
    if (tabId === "journal") return "1日目の記録で開放";
    if (tabId === "story" || tabId === "memory") return "10日間の記憶で開放";
    return "";
  }

  function showUnlockNotice(tabId) {
    const message = getLockedTabNotice(tabId);
    if (!message) return;
    setUnlockNotice(message);
    if (unlockNoticeTimer.current) clearTimeout(unlockNoticeTimer.current);
    unlockNoticeOpacity.stopAnimation();
    unlockNoticeOpacity.setValue(0);
    Animated.timing(unlockNoticeOpacity, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
    unlockNoticeTimer.current = setTimeout(() => {
      Animated.timing(unlockNoticeOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true
      }).start(() => setUnlockNotice(""));
    }, 1500);
  }

  function goToTab(tabId) {
    if (ritualLocked && tabId !== "home") {
      requestAnimationFrame(() => composerInputRef.current?.focus());
      return;
    }
    if (!tabUnlocks[tabId]) {
      showUnlockNotice(tabId);
      return;
    }
    if (tabId !== activeTab) playUiSound();
    setActiveTab(tabId);
  }

  useEffect(() => {
    if (ritualLocked) setActiveTab("home");
  }, [ritualLocked]);

  function beginReflectionInput() {
    if (!reflectionInputEnabled || isSending) return;
    playUiSound();
    setActiveTab("home");
    setRitualLocked(true);
    setInputMode(true);
    setHomePromptVisible(true);
    ritualLockedRef.current = true;
    ritualRunIdRef.current += 1;
    keepRitualInputFocused();
    ritualBlackout.setValue(1);
    Animated.sequence([
      Animated.delay(140),
      Animated.timing(ritualBlackout, {
        toValue: 0,
        duration: 640,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }

  const pageViews = [
    {
      id: "home",
      node: (
        <HomeScreen
          profile={profile}
          session={session}
          authLoading={authLoading}
          authBusy={authBusy}
          onGoogleSignIn={signInWithGoogle}
          onOpenProfile={() => {
            setSettingsInitialTab("profile");
            setSettingsOpen(true);
          }}
          reflectionQuestion={currentReflectionQuestion}
          questionTransitioning={questionTransitioning}
          answerPreview={answerPreview}
          isSending={isSending}
          keyboardVisible={keyboardVisible}
          inputLocked={ritualLocked}
          sealed={sealActive}
          screenHeight={height}
          onBeginInput={beginReflectionInput}
        />
      )
    },
    {
      id: "quests",
      node: (
        <QuestScreen
          onUiSound={playUiSound}
          active={activeTab === "quests"}
          proposals={questProposals}
          explorations={explorations}
          onAccept={acceptQuestProposal}
          onDecline={declineQuestProposal}
          onCloseExploration={closeExploration}
        />
      )
    },
    {
      id: "journal",
      node: <JournalScreen journal={journal} active={activeTab === "journal"} onOpenDetail={openEntryDetail} />
    },
    {
      id: "story",
      node: (
        <StoryScreen
          active={activeTab === "story"}
          chapters={chapters}
          proposals={chapterProposals}
          eligibleCount={eligibleChapterMemories().length}
          busy={chaptersBusy}
          onPropose={proposeChapters}
          onConfirm={confirmChapterProposal}
          onDefer={deferChapterProposal}
          onSplit={splitChapterProposal}
          chapterNotes={chapterNotes}
          onChangeNote={setChapterNote}
        />
      )
    }
  ];

  async function submitRitual() {
    const text = input.trim().slice(0, 50);
    if (!text || isSending || !reflectionInputEnabled) return;

    playUiSound();
    const nextMessages = [...ritualMessages, { role: "user", text }];
    setRitualMessages(nextMessages);
    setAnswerPreview({ id: createId("answer"), text });
    setInput("");
    setRitualLocked(true);
    setInputMode(true);
    setHomePromptVisible(true);
    ritualLockedRef.current = true;
    keepRitualInputFocused();
    const activeRitualRunId = ritualRunIdRef.current;
    setIsSending(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/nilo/night-ritual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          questionCount,
          forceFinish: questionCount >= ritualQuestionTarget,
          niloStyle: settings.niloStyle || "empathetic",
          frequency: reflectionFrequency,
          activeQuests: activeQuests.map((quest) => ({
            id: quest.id,
            title: quest.title,
            current: 0,
            target: 1
          }))
        })
      });

      if (!response.ok) throw new Error("request failed");
      const result = await response.json();
      if (activeRitualRunId !== ritualRunIdRef.current || !ritualLockedRef.current) return;
      applyNightResult(result, nextMessages);
    } catch {
      if (activeRitualRunId !== ritualRunIdRef.current || !ritualLockedRef.current) return;
      applyReflectionFallback(nextMessages);
    } finally {
      if (activeRitualRunId === ritualRunIdRef.current) setIsSending(false);
    }
  }

  function showReflectionQuestion(question) {
    setQuestionTransitioning(true);
    setTimeout(() => {
      setCurrentReflectionQuestion(question);
      setAnswerPreview(null);
      setQuestionTransitioning(false);
    }, 560);
  }

  // Close the night with a quiet sealed beat instead of snapping back to a button.
  function sealRitual(closing) {
    ritualLockedRef.current = false;
    setRitualLocked(false);
    setInputMode(false);
    composerInputRef.current?.blur();
    Keyboard.dismiss();
    setSealActive(true);
    showReflectionQuestion(closing);
    if (sealTimer.current) clearTimeout(sealTimer.current);
    sealTimer.current = setTimeout(() => {
      setSealActive(false);
      showReflectionQuestion(reflectionQuestions[0]);
    }, 3400);
  }

  function applyNightResult(result, messages) {
    if (result.done) {
      const entryDateKey = getJournalDateKey();
      const closing = getShortClosingComment(result);
      const finalMessages = [...messages, { role: "nilo", text: closing }];
      const journalId = createId("journal");
      setRitualMessages([{ role: "nilo", text: reflectionQuestions[0] }]);
      setQuestionCount(1);
      if (settings.ritual?.autoSaveJournal === false) {
        sealRitual(closing);
        return;
      }
      setJournal((items) => [
        {
          id: journalId,
          dateKey: entryDateKey,
          dateLabel: formatDotDate(entryDateKey),
          title: result.title || "今夜の記録",
          lines: result.summaryLines?.length ? result.summaryLines : ["今日の言葉を短く残しました。"],
          niloLine: result.niloLine || closing,
          messages: finalMessages
        },
        ...items
      ]);
      addRitualMemory({ messages: finalMessages, journalId, entryDateKey, essence: result.niloLine, closing, result });
      touchExplorations({ messages: finalMessages, entryDateKey });
      addGeneratedQuests(result);
      sealRitual(closing);
      return;
    }

    const nextQuestion = result.nextQuestion || createLocalFollowUpQuestion(messages);
    setQuestionCount((value) => Math.min(ritualQuestionTarget, value + 1));
    setRitualMessages([
      ...messages,
      { role: "nilo", text: nextQuestion }
    ]);
    showReflectionQuestion(nextQuestion);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  }

  function applyReflectionFallback(messages) {
    if (questionCount >= ritualQuestionTarget) {
      completeFallback(messages);
      return;
    }

    const nextQuestion = createLocalFollowUpQuestion(messages);
    setQuestionCount((value) => Math.min(ritualQuestionTarget, value + 1));
    setRitualMessages([
      ...messages,
      { role: "nilo", text: nextQuestion }
    ]);
    showReflectionQuestion(nextQuestion);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  }

  function completeFallback(messages) {
    const userLines = messages.filter((message) => message.role === "user").map((message) => message.text);
    const entryDateKey = getJournalDateKey();
    const closing = "今夜の記録を、静かに残しました。";
    const journalId = createId("journal");
    const finalMessages = [...messages, { role: "nilo", text: closing }];
    if (settings.ritual?.autoSaveJournal === false) {
      setRitualMessages([{ role: "nilo", text: reflectionQuestions[0] }]);
      setQuestionCount(1);
      sealRitual(closing);
      return;
    }
    setJournal((items) => [
      {
        id: journalId,
        dateKey: entryDateKey,
        dateLabel: formatDotDate(entryDateKey),
        title: userLines[0] || "今夜の記録",
        lines: userLines.length ? userLines : ["今日の印象を短く残しました。"],
        niloLine: closing,
        messages: finalMessages
      },
      ...items
    ]);
    addRitualMemory({ messages: finalMessages, journalId, entryDateKey, essence: "", closing });
    touchExplorations({ messages: finalMessages, entryDateKey });
    setRitualMessages([{ role: "nilo", text: reflectionQuestions[0] }]);
    setQuestionCount(1);
    sealRitual(closing);
  }

  function createLocalFollowUpQuestion(messages) {
    const latestAnswer = [...messages].reverse().find((message) => message.role === "user")?.text || "";
    const seed = latestAnswer.replace(/[、。,.!?！？\s]/g, "").slice(0, 12);
    if (seed) return `「${seed}」の何が残っていますか？`;
    return "もう少しだけ、残しておきますか？";
  }

  function getShortClosingComment(result) {
    const text = result.closingMessage || result.niloMessage || result.niloLine || "今夜の記録を、静かに残しました。";
    return String(text).replace(/\s+/g, " ").trim().slice(0, 42) || "今夜の記録を、静かに残しました。";
  }

  function addGeneratedQuests(result) {
    if (settings.privacy?.questLink === false) return;

    const generatedQuests = [
      ...(result.quests || []),
      result.questSuggestion ? { title: result.questSuggestion, scope: "life" } : null
    ].filter((quest) => quest?.title);

    setQuests((items) => {
      const additions = generatedQuests
        .filter((generated) => !items.some((quest) => quest.title === generated.title && !quest.completed))
        .map((generated) => {
          const source = getJournalQuestSource(generated);
          return {
            id: createId(source === "journal-daily" ? "journal-daily" : "life"),
            title: generated.title,
            reason: generated.reason || "",
            firstStep: generated.firstStep || "",
            target: generated.target || (source === "journal-daily" ? 1 : 7),
            source,
            completed: false
          };
        });
      return [...additions, ...items];
    });
  }

  function addRitualMemory({ messages, journalId, entryDateKey, essence, closing, result }) {
    // The journal keeps what happened; the memory keeps what it meant.
    // Respect the privacy switch that governs whether reflections feed Nilo's memory.
    if (!settings.privacy.memoryLink) return;

    const userLines = (messages || [])
      .filter((message) => message.role === "user")
      .map((message) => String(message.text || "").trim())
      .filter(Boolean);
    // Keep the single line the user leaned into hardest as their own words.
    const keptPhrase = userLines.slice().sort((a, b) => b.length - a.length)[0] || "";
    const meaning = String(essence || closing || "").trim();

    // Only hold onto a scene when there is something meaningful to keep.
    if (!meaning && !keptPhrase) return;

    const memory = {
      id: createId("memory"),
      dateKey: entryDateKey,
      dateLabel: formatDotDate(entryDateKey),
      essence: meaning || keptPhrase,
      keptPhrase,
      moodLabel: result?.moodLabel || "",
      moodScore: Number.isFinite(Number(result?.moodScore)) ? Number(result.moodScore) : null,
      tag: result?.tag || "振り返り",
      journalId
    };

    setMemories((items) => [memory, ...items]);
  }

  function getJournalQuestSource(quest) {
    const scope = String(quest.scope || quest.type || quest.category || "").toLowerCase();
    if (["daily", "journal-daily", "tomorrow", "small"].includes(scope)) return "journal-daily";
    if (["life", "long", "long-term", "big"].includes(scope)) return "life";
    const target = Number(quest.target);
    return Number.isFinite(target) && target <= 2 ? "journal-daily" : "life";
  }

  function completeQuest(id) {
    setQuests((items) => items.map((quest) => quest.id === id ? { ...quest, completed: true } : quest));
  }

  // Eligible = far enough in the past (not the in-progress window) and not
  // already inside a confirmed chapter.
  function eligibleChapterMemories() {
    const cutoff = chapterCutoffKey();
    const chaptered = new Set(chapters.flatMap((chapter) => chapter.memoryIds || []));
    return memories.filter((memory) => memory.dateKey && memory.dateKey < cutoff && !chaptered.has(memory.id));
  }

  // Nilo proposes candidates; it never declares chapters. splitFrom re-asks
  // Nilo to divide one proposal's memories more finely.
  async function proposeChapters(splitFrom) {
    if (chaptersBusy) return;
    const source = splitFrom
      ? memories.filter((memory) => splitFrom.memoryIds?.includes(memory.id))
      : eligibleChapterMemories();
    if (!source.length) {
      if (!splitFrom) setChapterProposals([]);
      return;
    }
    setChaptersBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/nilo/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          split: Boolean(splitFrom),
          memories: source.map((memory) => ({
            id: memory.id,
            dateKey: memory.dateKey,
            essence: memory.essence,
            keptPhrase: memory.keptPhrase,
            moodLabel: memory.moodLabel
          }))
        })
      });
      if (!response.ok) throw new Error("request failed");
      const result = await response.json();
      const next = (result.proposals || [])
        .filter((proposal) => proposal.memoryIds?.length)
        .map((proposal) => ({ id: createId("proposal"), status: "proposed", ...proposal }));
      setChapterProposals((current) => splitFrom
        ? [...current.filter((item) => item.id !== splitFrom.id), ...next]
        : next);
      if (!splitFrom) {
        addNotifications(next.map((proposal) => ({
          refId: `chapter-${proposal.period}`,
          tag: "STORY",
          title: "Niloから、新しい章の提案があります",
          body: proposal.observation || "",
          tab: "story"
        })));
      }
    } catch {
      // Offline: without the model Nilo can't sense inflection points, and we
      // never declare chapters locally — so no proposal is offered.
      if (!splitFrom) setChapterProposals([]);
    } finally {
      setChaptersBusy(false);
    }
  }

  function confirmChapterProposal(id, title) {
    const proposal = chapterProposals.find((item) => item.id === id);
    if (!proposal) return;
    const clean = (title || "").trim();
    const chapter = {
      ...proposal,
      id: createId("chapter"),
      status: "confirmed",
      title: clean,
      titleHistory: clean ? [{ title: clean, at: Date.now() }] : [],
      confirmedAt: Date.now()
    };
    setChapters((current) => [...current, chapter].sort((a, b) => (b.period || "").localeCompare(a.period || "")));
    setChapterProposals((current) => current.filter((item) => item.id !== id));
  }

  function deferChapterProposal(id) {
    // "Still in progress" — withdraw the offer; those days stay un-chaptered.
    setChapterProposals((current) => current.filter((item) => item.id !== id));
  }

  function splitChapterProposal(id) {
    const proposal = chapterProposals.find((item) => item.id === id);
    if (!proposal) return;
    const episodes = proposal.episodes || [];
    if (episodes.length >= 2) {
      // The AI's episode breakdown is the pre-computed split — promote each
      // episode into its own era-proposal the user can approve and name.
      const promoted = episodes.map((episode) => ({
        id: createId("proposal"),
        status: "proposed",
        period: episode.period,
        observation: episode.observation,
        memoryIds: episode.memoryIds || [],
        emotions: episode.emotions || [],
        people: [],
        questions: [],
        meaningFrom: "",
        meaningTo: "",
        episodes: []
      }));
      setChapterProposals((current) => [...current.filter((item) => item.id !== id), ...promoted]);
    } else {
      proposeChapters(proposal);
    }
  }

  function renameChapter(id, nextTitle) {
    const clean = (nextTitle || "").trim();
    if (!clean) return;
    setChapters((current) => current.map((chapter) => {
      if (chapter.id !== id || chapter.title === clean) return chapter;
      return { ...chapter, title: clean, titleHistory: [...(chapter.titleHistory || []), { title: clean, at: Date.now() }] };
    }));
  }

  function setChapterNote(chapterId, text) {
    setChapterNotes((notes) => ({ ...notes, [chapterId]: text }));
  }

  // --- クエスト (explorations) ---

  // Nilo looks for recurring themes at most once a day, and only when enough
  // recorded life exists for a repetition to be sensed at all. Offline it
  // simply stays quiet — no proposal is ever fabricated locally.
  async function scanForQuestProposals() {
    if (questScanRef.current) return;
    if (settings.privacy?.questLink === false) {
      setQuestProposals([]);
      return;
    }
    const today = getJournalDateKey();
    if (questScanDateKey === today) return;
    if (memories.length < 5) return;
    questScanRef.current = true;
    try {
      const response = await fetch(`${apiBaseUrl}/api/nilo/quest-proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memories: memories.slice(0, 120).map((memory) => ({
            dateKey: memory.dateKey,
            essence: memory.essence,
            keptPhrase: memory.keptPhrase,
            moodLabel: memory.moodLabel
          })),
          declinedThemes: declinedQuestThemes,
          ongoingThemes: explorations.filter((item) => item.status !== "closed").map((item) => item.theme)
        })
      });
      if (!response.ok) throw new Error("request failed");
      const result = await response.json();
      const next = (result.proposals || [])
        .filter((proposal) => proposal.theme && proposal.observation && proposal.invitation)
        .map((proposal) => ({ id: createId("questprop"), ...proposal }));
      setQuestProposals(next);
      setQuestScanDateKey(today);
      addNotifications(next.map((proposal) => ({
        refId: `quest-${proposal.theme}`,
        tag: "QUEST",
        title: "Niloから、探求の提案があります",
        body: proposal.theme,
        tab: "quests"
      })));
    } catch {
      // Keep whatever proposals were already on the table.
    } finally {
      questScanRef.current = false;
    }
  }

  function acceptQuestProposal(proposal) {
    setQuestProposals((items) => items.filter((item) => item.id !== proposal.id));
    setExplorations((items) => [
      {
        id: createId("exploration"),
        theme: proposal.theme,
        keywords: proposal.keywords || [],
        sinceDateKey: getJournalDateKey(),
        status: "ongoing",
        sessions: 0,
        records: []
      },
      ...items
    ]);
  }

  // お知らせ: 新着だけを静かに積む。同じ出来事（refId）は重ねて通知しない。
  function addNotifications(items) {
    if (!items || !items.length) return;
    setNotifications((current) => {
      const existingRefs = new Set(current.map((item) => item.refId).filter(Boolean));
      const additions = items
        .filter((item) => !item.refId || !existingRefs.has(item.refId))
        .map((item) => ({ id: createId("notice"), read: false, createdAt: Date.now(), ...item }));
      if (!additions.length) return current;
      return [...additions, ...current].slice(0, 40);
    });
  }

  function markNotificationRead(id) {
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
  }

  function declineQuestProposal(proposal) {
    setQuestProposals((items) => items.filter((item) => item.id !== proposal.id));
    // Remember the theme so Nilo doesn't offer the same one again.
    setDeclinedQuestThemes((themes) => themes.includes(proposal.theme)
      ? themes
      : [...themes, proposal.theme].slice(-24));
  }

  // 一区切り — never completion: the records and the time spent all remain.
  function closeExploration(id) {
    setExplorations((items) => items.map((item) => item.id === id
      ? { ...item, status: "closed", closedDateKey: getJournalDateKey() }
      : item));
  }

  // When tonight's ritual brushes an ongoing exploration's theme, the night
  // counts as one more question laid on it, and its words join the trail.
  function touchExplorations({ messages, entryDateKey }) {
    const userLines = (messages || [])
      .filter((message) => message.role === "user")
      .map((message) => String(message.text || "").trim())
      .filter(Boolean);
    if (!userLines.length) return;
    const joined = userLines.join("\n");
    setExplorations((items) => items.map((item) => {
      if (item.status === "closed" || !questMatchesText(item, joined)) return item;
      const line = userLines.find((text) => questMatchesText(item, text)) || userLines[0];
      return {
        ...item,
        sessions: (item.sessions || 0) + 1,
        records: [{ date: formatDotDate(entryDateKey), text: line.slice(0, 80) }, ...(item.records || [])].slice(0, 12)
      };
    }));
  }

  if (!fontsLoaded) {
    // Hold on a quiet, textless night until the serifs are ready, so the
    // first thing the eye meets is already in the right voice.
    return (
      <View style={styles.background}>
        <BackgroundTexture />
        <OuterGradient />
        <View style={styles.scrim} />
        <NightGrain />
        <FloatingOrbs />
      </View>
    );
  }

  if (authLoading) {
    return (
      <View style={styles.background}>
        <BackgroundTexture />
        <OuterGradient />
        <View style={styles.scrim} />
        <NightGrain />
        <FloatingOrbs />
        <SafeAreaView style={styles.safe}>
          <AuthGate loading />
          <StatusBar barStyle="light-content" />
        </SafeAreaView>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.background}>
        <BackgroundTexture />
        <OuterGradient />
        <View style={styles.scrim} />
        <NightGrain />
        <FloatingOrbs />
        <SafeAreaView style={styles.safe}>
          <AuthGate
            authBusy={authBusy}
            authError={authError}
            authNotice={authNotice}
            onGoogleSignIn={signInWithGoogle}
            onSendEmailLogin={sendEmailLogin}
            onVerifyEmailLogin={verifyEmailLogin}
          />
          <StatusBar barStyle="light-content" />
        </SafeAreaView>
      </View>
    );
  }

  if (!profileComplete) {
    return (
      <View style={styles.background}>
        <BackgroundTexture />
        <OuterGradient />
        <View style={styles.scrim} />
        <NightGrain />
        <FloatingOrbs />
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.app}>
            <ProfileGate
              profile={profile}
              setProfile={setProfile}
              authBusy={authBusy}
              authError={authError}
              onSignOut={signOut}
            />
          </KeyboardAvoidingView>
          <StatusBar barStyle="light-content" />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.background}>
      <BackgroundTexture />
      <OuterGradient />
      <View style={styles.scrim} />
      <NightGrain />
      <FloatingOrbs />
      <SafeAreaView style={styles.safe}>
        <Header
          profile={profile}
          session={session}
          showTitle={activeTab !== "home"}
          showSettings={activeTab === "home"}
          showNotifications={activeTab === "home"}
          unreadNotifications={unreadNotificationCount}
          onAccount={() => {
            playUiSound();
            setSettingsOpen(true);
          }}
          onNotifications={() => {
            playUiSound();
            setNotificationsOpen(true);
          }}
        />

        <View style={styles.content}>
          <View style={styles.pageFrame}>
            {pageViews.find((page) => page.id === activeTab)?.node}
          </View>
        </View>

        {!ritualLocked && !sealActive && activeTab === "home" && homePromptVisible && (
          <Pressable
            disabled={!reflectionInputEnabled}
            onPress={beginReflectionInput}
            style={styles.ritualTapZone}
          />
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
          style={[styles.composerAvoider, keyboardVisible && styles.composerAvoiderFocused]}
        >
          {!ritualLocked && !sealActive && (
            <NightRitualButton
              enabled={reflectionInputEnabled}
              visible={activeTab === "home" && homePromptVisible && !sealActive}
              streakDays={journalStreakDays}
              onPress={beginReflectionInput}
            />
          )}
        </KeyboardAvoidingView>

        {activeTab !== "home" && (
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.88)", "#000000"]}
            locations={[0, 0.4, 0.75, 1]}
            style={styles.screenBottomFade}
          />
        )}

        <TabBar
          activeTab={activeTab}
          setActiveTab={goToTab}
          hidden={inputMode || keyboardVisible || ritualLocked}
          opacity={tabBarOpacity}
          unlocks={tabUnlocks}
        />

        <NiloDialogScreen
          visible={ritualLocked || sealActive}
          closing={sealActive}
          question={currentReflectionQuestion}
          dimmed={questionTransitioning}
          thinking={isSending}
          dateLabel={niloEnDate}
          inputRef={composerInputRef}
          input={input}
          setInput={setInput}
          enabled={reflectionInputEnabled}
          onSubmit={submitRitual}
          onExit={requestExitNightRitual}
          exitConfirmOpen={exitConfirmOpen}
          onConfirmExit={confirmExitNightRitual}
          onCancelExit={cancelExitNightRitual}
          onBlur={() => {
            if (ritualLockedRef.current) keepRitualInputFocused();
          }}
        />

        <Animated.View
          pointerEvents="none"
          style={[styles.ritualBlackout, { opacity: ritualBlackout }]}
        />

        {!!unlockNotice && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.unlockNotice,
              {
                opacity: unlockNoticeOpacity,
                transform: [{
                  translateY: unlockNoticeOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0]
                  })
                }]
              }
            ]}
          >
            <Text style={styles.unlockNoticeText}>{unlockNotice}</Text>
          </Animated.View>
        )}

        <EntryDetailModal entry={detailEntry} onClose={closeEntryDetail} />

        <SettingsModal
          visible={settingsOpen}
          profile={profile}
          setProfile={setProfile}
          settings={settings}
          setSettings={setSettings}
          bgmTracks={bgmTracks}
          activeBgmTrack={activeBgmTrack}
          bgmStatus={bgmStatus}
          journal={journal}
          setJournal={setJournal}
          quests={quests}
          setQuests={setQuests}
          memories={memories}
          setMemories={setMemories}
          chapters={chapters}
          setChapters={setChapters}
          session={session}
          authLoading={authLoading}
          authBusy={authBusy}
          authError={authError}
          redirectUri={redirectUri}
          initialTab={settingsInitialTab}
          onGoogleSignIn={signInWithGoogle}
          onSignOut={signOut}
          onPickProfileImage={pickProfileImage}
          onUiSound={playUiSound}
          onClose={() => {
            setSettingsOpen(false);
            setSettingsInitialTab("base");
          }}
        />

        <NotificationsModal
          visible={notificationsOpen}
          notifications={notifications}
          onClose={() => setNotificationsOpen(false)}
          onMarkRead={markNotificationRead}
          onNavigate={(tab) => {
            setActiveTab(tab);
            setNotificationsOpen(false);
          }}
          onOpenSettings={() => {
            setNotificationsOpen(false);
            setSettingsInitialTab("notifications");
            setSettingsOpen(true);
          }}
        />
      <StatusBar barStyle="light-content" />
      </SafeAreaView>
    </View>
  );
}

// On web, AppContent lays itself out from useWindowDimensions() (the real
// browser window). A plain CSS box can't shrink that — the content still
// thinks it owns the full window and overflows/clips. An iframe gives it its
// own real `window`, sized to the frame, so layout comes out correct with no
// changes to AppContent. window.self !== window.top means we're already
// inside that iframe, so we render straight through instead of nesting again.
function WebPhoneFrame() {
  const { width: winW, height: winH } = useWindowDimensions();
  const aspect = 9 / 19.5;
  const frameHeight = Math.min(winH, 900);
  const frameWidth = Math.min(frameHeight * aspect, 430, winW);
  return (
    <View style={styles.webPhoneFrameOuter}>
      <iframe
        title="Arc preview"
        src={window.location.href}
        style={{
          width: frameWidth,
          height: frameHeight,
          border: "none",
          borderRadius: 36,
          overflow: "hidden"
        }}
      />
    </View>
  );
}

export default function App() {
  if (Platform.OS === "web") {
    if (window.self === window.top) {
      return <WebPhoneFrame />;
    }
  }
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function Header({ onAccount, onNotifications, showTitle, showSettings = true, showNotifications = true, unreadNotifications = 0 }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide} />
      {showTitle && <Text style={styles.headerTitle}>ARC</Text>}
      {showNotifications && (
        <Pressable
          accessibilityLabel="通知を開く"
          onPress={onNotifications}
          focusable={false}
          style={({ pressed }) => [styles.notificationButton, pressed && styles.touchPressedTight]}
        >
          <NotificationBellGlyph />
          {unreadNotifications > 0 && <View pointerEvents="none" style={styles.notificationBellDot} />}
        </Pressable>
      )}
      {showSettings && (
        <Pressable
          accessibilityLabel="設定を開く"
          onPress={onAccount}
          focusable={false}
          style={({ pressed }) => [styles.settingsSunButton, pressed && styles.touchPressedTight]}
        >
          <SettingsSunGlyph />
        </Pressable>
      )}
    </View>
  );
}

function NotificationBellGlyph() {
  return (
    <View pointerEvents="none" style={styles.notificationBellGlyph}>
      <View style={styles.notificationBellBody} />
      <View style={styles.notificationBellBase} />
      <View style={styles.notificationBellClapper} />
    </View>
  );
}

function SettingsSunGlyph() {
  return (
    <View pointerEvents="none" style={styles.settingsSunGlyph}>
      <View style={styles.settingsSunCore} />
      <View style={[styles.settingsSunRay, styles.settingsSunRayTop]} />
      <View style={[styles.settingsSunRay, styles.settingsSunRayBottom]} />
      <View style={[styles.settingsSunRay, styles.settingsSunRayLeft]} />
      <View style={[styles.settingsSunRay, styles.settingsSunRayRight]} />
      <View style={[styles.settingsSunRay, styles.settingsSunRaySlashA]} />
      <View style={[styles.settingsSunRay, styles.settingsSunRaySlashB]} />
      <View style={[styles.settingsSunRay, styles.settingsSunRaySlashC]} />
      <View style={[styles.settingsSunRay, styles.settingsSunRaySlashD]} />
    </View>
  );
}

function BackgroundTexture() {
  return (
    <Image
      pointerEvents="none"
      source={backgroundTexture}
      resizeMode="cover"
      style={styles.backgroundTexture}
    />
  );
}

function NightGrain() {
  // A near-invisible warm grain tiled over the navy so the screen reads as a
  // material, a night sky — never as a flat fill.
  return (
    <>
      <Image
        pointerEvents="none"
        source={grainTexture}
        resizeMode="repeat"
        style={styles.nightGrain}
      />
      <Image
        pointerEvents="none"
        source={deepGrainTexture}
        resizeMode="repeat"
        style={styles.deepNightGrain}
      />
    </>
  );
}

function OuterGradient() {
  return (
    <View pointerEvents="none" style={styles.outerGradient}>
      <LinearGradient
        colors={["rgba(32,26,20,0.96)", "rgba(22,18,15,0.68)", "rgba(14,11,9,0.92)"]}
        locations={[0, 0.54, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,0.52)"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={["rgba(232,196,138,0.12)", "rgba(224,182,120,0.05)", "rgba(217,168,108,0)"]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.upperGlow}
      />
      <LinearGradient
        colors={["rgba(255,194,96,0)", "rgba(217,168,108,0.06)", "rgba(217,168,108,0.15)"]}
        locations={[0, 0.62, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.lowerGlowBase}
      />
      <LinearGradient
        colors={["rgba(217,168,108,0.15)", "rgba(217,168,108,0.045)", "rgba(217,168,108,0)"]}
        locations={[0, 0.52, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={styles.lowerGlowPool}
      />
    </View>
  );
}

const FLOATING_ORB_SMALL_COUNT = 22;
const FLOATING_ORB_LARGE_COUNT = 8;

function makeFloatingOrbSpec(size, baseOpacity) {
  return {
    left: Math.random() * 100,
    top: Math.random() * 100,
    size,
    baseOpacity,
    driftX: (Math.random() - 0.5) * 240,
    driftY: -(60 + Math.random() * 160),
    duration: 4000 + Math.random() * 6000,
    delay: Math.random() * 3000
  };
}

function makeFloatingOrbSpecs() {
  // 小さな灯を多めに、大きな灯は薄く・ゆっくりめに漂わせて奥行きを出す。
  const small = Array.from({ length: FLOATING_ORB_SMALL_COUNT }, () =>
    makeFloatingOrbSpec(36 + Math.random() * 130, 0.06 + Math.random() * 0.16)
  );
  const large = Array.from({ length: FLOATING_ORB_LARGE_COUNT }, () => {
    const spec = makeFloatingOrbSpec(200 + Math.random() * 200, 0.04 + Math.random() * 0.09);
    spec.duration = 7000 + Math.random() * 7000;
    return spec;
  });
  return [...large, ...small];
}

function FloatingOrb({ spec }) {
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.timing(phase, {
          toValue: 1,
          duration: spec.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: spec.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase, spec]);

  const opacity = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [spec.baseOpacity * 0.1, spec.baseOpacity]
  });
  const translateX = phase.interpolate({ inputRange: [0, 1], outputRange: [0, spec.driftX] });
  const translateY = phase.interpolate({ inputRange: [0, 1], outputRange: [0, spec.driftY] });
  const scale = phase.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.45] });

  return (
    <Animated.Image
      pointerEvents="none"
      source={niloOrbTexture}
      resizeMode="contain"
      style={{
        position: "absolute",
        left: `${spec.left}%`,
        top: `${spec.top}%`,
        width: spec.size,
        height: spec.size,
        marginLeft: -spec.size / 2,
        marginTop: -spec.size / 2,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }]
      }}
    />
  );
}

function FloatingOrbs() {
  // 背景に漂う多数の小さな灯。Niloの光と同じテクスチャを薄く散らし、
  // それぞれがランダムな位置・大きさ・周期でゆっくり明滅しながら流れる。
  const specs = useRef(makeFloatingOrbSpecs()).current;
  return (
    <View pointerEvents="none" style={styles.floatingOrbLayer}>
      {specs.map((spec, i) => (
        <FloatingOrb key={i} spec={spec} />
      ))}
    </View>
  );
}

function NiloLight({ style }) {
  // The one light source on the screen: Nilo's soft glow. It does not move; it
  // only breathes — a diffuse amber radial like the prototype's, drawn from a
  // pre-rendered image so RN matches the Web's CSS radial-gradient exactly.
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  const opacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const coreOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.95] });
  const coreScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.52] });

  return (
    <View pointerEvents="none" style={[styles.niloLightWrap, style]}>
      <Animated.Image
        pointerEvents="none"
        source={niloOrbTexture}
        resizeMode="contain"
        style={[styles.niloOrbImage, { opacity, transform: [{ scale }] }]}
      />
      {/* 背景に灯が増えても Nilo だけは芯を持つ、ひときわ明るい二重の光にする */}
      <Animated.Image
        pointerEvents="none"
        source={niloOrbTexture}
        resizeMode="contain"
        style={[styles.niloOrbImage, { position: "absolute", opacity: coreOpacity, transform: [{ scale: coreScale }] }]}
      />
    </View>
  );
}

function GlassBackdrop({ intensity = 24 }) {
  return (
    <>
      <BlurView pointerEvents="none" intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.glassWash} />
      <View pointerEvents="none" style={styles.glassEdge} />
    </>
  );
}

function GlassView({ children, style, intensity = 24 }) {
  return (
    <View style={style}>
      <GlassBackdrop intensity={intensity} />
      {children}
    </View>
  );
}

function NiloHomeStage({ question, dimmed, thinking, hideQuestion, compact, sealed }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [typed, setTyped] = useState(question);
  const typeTimers = useRef([]);

  // The question fades as it changes (kept from before).
  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: dimmed ? 0 : 1,
      duration: dimmed ? 360 : 820,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [dimmed, opacity, question]);

  // Nilo writes the question, glyph by glyph — the prototype's writeQuestion:
  // a 340ms breath, then a character every 52ms. While the old line fades out
  // (dimmed) we hold it, so the erase reads as a fade rather than a flicker.
  useEffect(() => {
    typeTimers.current.forEach(clearTimeout);
    typeTimers.current = [];
    if (hideQuestion || dimmed) return undefined;
    const chars = Array.from(question || "");
    setTyped("");
    const begin = setTimeout(() => {
      chars.forEach((_, index) => {
        const timer = setTimeout(() => setTyped(chars.slice(0, index + 1).join("")), index * 52);
        typeTimers.current.push(timer);
      });
    }, 340);
    typeTimers.current.push(begin);
    return () => {
      typeTimers.current.forEach(clearTimeout);
      typeTimers.current = [];
    };
  }, [question, dimmed, hideQuestion]);

  return (
    <View style={[styles.niloStage, compact && styles.niloStageCompact]}>
      <View style={[styles.niloStageCopy, compact && styles.niloStageCopyCompact]}>
        {thinking && <NiloThinkingIndicator />}
        {!hideQuestion && (
          <>
            {sealed && <Animated.Text style={[styles.niloSealMark, { opacity }]}>✦ 今夜を綴じました</Animated.Text>}
            <Animated.Text style={[styles.niloStageQuestion, compact && styles.niloStageQuestionCompact, { opacity }]}>
              {typed}
            </Animated.Text>
          </>
        )}
      </View>
    </View>
  );
}

function NiloThinkingIndicator() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.32, 1]
  });

  return (
    <Animated.Text style={[styles.niloThinkingText, { opacity }]}>・・・</Animated.Text>
  );
}

function AnswerPreview({ answer, fading, compact }) {
  const fade = useRef(new Animated.Value(0)).current;
  const [typedText, setTypedText] = useState("");
  const text = answer?.text || "";

  useEffect(() => {
    if (!answer) {
      setTypedText("");
      fade.setValue(0);
      return undefined;
    }

    setTypedText("");
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();

    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      setTypedText(text.slice(0, index));
      if (index >= text.length) clearInterval(interval);
    }, 42);

    return () => clearInterval(interval);
  }, [answer, fade, text]);

  useEffect(() => {
    if (!answer || !fading) return;
    Animated.timing(fade, {
      toValue: 0,
      duration: 340,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [answer, fade, fading]);

  if (!answer) return null;

  return (
    <Animated.View style={[styles.answerPreview, compact && styles.answerPreviewCompact, { opacity: fade }]}>
      <Text style={styles.answerPreviewMark}>あなたの言葉</Text>
      <Text style={styles.answerPreviewText}>{typedText}</Text>
    </Animated.View>
  );
}

// The prototype's screens breathe in: each row fades up from 16px below on a
// soft cubic curve, staggered so a list unfurls rather than snapping in. This
// is the `riseIn` keyframe (delay 0.05 + i*0.07s) made native.
const riseEasing = Easing.bezier(0.2, 0.72, 0.28, 1);

// A token that ticks every time `active` flips true, so a screen replays its
// entrance each time the user lands on it — not only on first mount.
function useEntrancePlay(active) {
  const [token, setToken] = useState(active ? 1 : 0);
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) setToken((value) => value + 1);
    wasActive.current = active;
  }, [active]);
  return token;
}

function RiseIn({ index = 0, playToken = 0, duration = 550, distance = 16, delayBase = 50, style, children }) {
  // Start shown when the screen was already on-screen at mount (playToken 0),
  // hidden when it has an entrance to play — so we never flash a blank screen.
  const progress = useRef(new Animated.Value(playToken ? 0 : 1)).current;

  useEffect(() => {
    if (!playToken) return undefined;
    progress.setValue(0);
    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: riseEasing,
        useNativeDriver: true
      }).start();
    }, delayBase + index * 70);
    return () => clearTimeout(timer);
  }, [playToken, index, duration, delayBase, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function AuthGate({
  loading = false,
  authBusy = false,
  authError = "",
  authNotice = "",
  onGoogleSignIn,
  onSendEmailLogin,
  onVerifyEmailLogin
}) {
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  async function handleSendEmail() {
    const sent = await onSendEmailLogin(email);
    if (sent) {
      setOtpSent(true);
      setEmailCode("");
    }
  }

  return (
    <View style={styles.gateScreen}>
      <View style={styles.gateBrand}>
        <Text style={styles.gateLogo}>Arc</Text>
        <Text style={styles.gateSlogan}>今日を静かに、人生に残す。</Text>
      </View>
      <View style={styles.gateCard}>
        <Text style={styles.gateEyebrow}>Sign in</Text>
        <Text style={styles.gateTitle}>{loading ? "準備しています" : "Arcへようこそ"}</Text>
        <Text style={styles.gateBody}>
          {loading ? "あなたの日々の入口を確認しています。" : "Google、またはメールアドレスでログインしてください。"}
        </Text>
        {!loading && (
          <>
            {!otpSent && (
              <>
                <Pressable disabled={authBusy} onPress={onGoogleSignIn} style={[styles.gateButton, authBusy && styles.disabledButton]}>
                  <Text style={styles.gateButtonText}>{authBusy ? "接続中..." : "Googleでログイン"}</Text>
                </Pressable>
                <View style={styles.gateDivider}>
                  <View style={styles.gateDividerLine} />
                  <Text style={styles.gateDividerText}>または</Text>
                  <View style={styles.gateDividerLine} />
                </View>
              </>
            )}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="メールアドレス"
              placeholderTextColor="rgba(246,239,228,0.42)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!otpSent}
              style={styles.gateInput}
            />
            {!otpSent ? (
              <Pressable disabled={authBusy || !email.trim()} onPress={handleSendEmail} style={[styles.gateGhostButton, (authBusy || !email.trim()) && styles.disabledButton]}>
                <Text style={styles.gateGhostText}>{authBusy ? "送信中..." : "メールでコードを受け取る"}</Text>
              </Pressable>
            ) : (
              <>
                <Text style={styles.gateOtpLead}>メールに届いた6桁コードを入力してください。</Text>
                <TextInput
                  value={emailCode}
                  onChangeText={(value) => setEmailCode(value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6桁コード"
                  placeholderTextColor="rgba(246,239,228,0.42)"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  onSubmitEditing={() => {
                    if (!authBusy && email.trim() && emailCode.length === 6) onVerifyEmailLogin(email, emailCode);
                  }}
                  style={styles.gateInput}
                />
                <Pressable disabled={authBusy || !email.trim() || emailCode.length < 6} onPress={() => onVerifyEmailLogin(email, emailCode)} style={[styles.gateButton, (authBusy || !email.trim() || emailCode.length < 6) && styles.disabledButton]}>
                  <Text style={styles.gateButtonText}>{authBusy ? "確認中..." : "コードでログイン"}</Text>
                </Pressable>
                <Pressable disabled={authBusy} onPress={handleSendEmail} style={styles.gateGhostButton}>
                  <Text style={styles.gateGhostText}>{authBusy ? "再送信中..." : "コードを再送する"}</Text>
                </Pressable>
                <Pressable disabled={authBusy} onPress={() => { setOtpSent(false); setEmailCode(""); }} style={styles.gateTextButton}>
                  <Text style={styles.gateTextButtonText}>メールアドレスを変更する</Text>
                </Pressable>
              </>
            )}
          </>
        )}
        {!!authNotice && <Text style={styles.noticeText}>{authNotice}</Text>}
        {!!authError && <Text style={styles.errorText}>{authError}</Text>}
      </View>
    </View>
  );
}

function ProfileGate({ profile, setProfile, authBusy, authError, onSignOut }) {
  const [name, setName] = useState(profile.name);
  const [birthdate, setBirthdate] = useState(profile.birthdate);
  const canSubmit = name.trim() && birthdate.trim() && daysSince(birthdate) !== null;

  return (
    <ScrollView contentContainerStyle={styles.gateScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.gateBrand}>
        <Text style={styles.gateLogo}>Arc</Text>
        <Text style={styles.gateSlogan}>あなたの日々を始める準備。</Text>
      </View>
      <View style={styles.gateCard}>
        <Text style={styles.gateEyebrow}>Profile</Text>
        <Text style={styles.gateTitle}>プロフィールを送信してください</Text>
        <Text style={styles.gateBody}>
          名前と生年月日がない場合、Arcは日数や記録をあなたに合わせて表示できません。
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="名前"
          placeholderTextColor="rgba(246,239,228,0.42)"
          style={styles.gateInput}
        />
        <TextInput
          value={birthdate}
          onChangeText={setBirthdate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="rgba(246,239,228,0.42)"
          style={styles.gateInput}
        />
        {!!daysSince(birthdate) && <Text style={styles.gateHint}>{daysSince(birthdate)}日目</Text>}
        <Pressable
          disabled={!canSubmit}
          onPress={() => setProfile((current) => ({ ...current, name: name.trim(), birthdate: birthdate.trim() }))}
          style={[styles.gateButton, !canSubmit && styles.disabledButton]}
        >
          <Text style={styles.gateButtonText}>Arcを始める</Text>
        </Pressable>
        <Pressable disabled={authBusy} onPress={onSignOut} style={styles.gateGhostButton}>
          <Text style={styles.gateGhostText}>{authBusy ? "処理中..." : "別のアカウントでログイン"}</Text>
        </Pressable>
        {!!authError && <Text style={styles.errorText}>{authError}</Text>}
      </View>
    </ScrollView>
  );
}

function HomeScreen({
  profile,
  session,
  authLoading,
  authBusy,
  onGoogleSignIn,
  onOpenProfile,
  reflectionQuestion,
  questionTransitioning,
  answerPreview,
  isSending,
  keyboardVisible,
  inputLocked,
  sealed,
  screenHeight,
  onBeginInput
}) {
  const questionLift = useRef(new Animated.Value(0)).current;
  const needsProfile = !profile.name?.trim() || !profile.birthdate?.trim();
  const showFirstRun = !authLoading && (!session || needsProfile);
  const compact = keyboardVisible;
  const liftedY = inputLocked ? 0 : screenHeight < 720 ? -118 : screenHeight < 820 ? -140 : -164;
  const displayQuestion = reflectionQuestion === reflectionQuestions[0]
    ? "今日はどんな日\nだった？"
    : reflectionQuestion;

  useEffect(() => {
    Animated.timing(questionLift, {
      toValue: keyboardVisible ? liftedY : 0,
      duration: keyboardVisible ? 260 : 320,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [keyboardVisible, liftedY, questionLift]);

  // Keep the question a touch above center, then leave a wide silence below it
  // for the light to sit in.
  const questionTopInset = compact ? 28 : Math.round(Math.max(130, (screenHeight - 90 - 192) / 3));

  return (
    <View
      style={[styles.homeReflectionScreen, { paddingTop: questionTopInset }]}
    >
      <Animated.View style={[styles.reflectionTapArea, { transform: [{ translateY: questionLift }] }]}>
        {!answerPreview && (
          <Animated.Text style={[styles.homeLeadText, questionTransitioning && styles.homeLeadTextDimmed]}>
            今日もおつかれさま。
          </Animated.Text>
        )}
        <NiloHomeStage
          question={displayQuestion}
          dimmed={questionTransitioning}
          thinking={questionTransitioning || isSending}
          hideQuestion={Boolean(answerPreview)}
          compact={compact}
          sealed={sealed}
        />
        <AnswerPreview answer={answerPreview} fading={questionTransitioning} compact={compact} />
      </Animated.View>

      {!compact && !inputLocked && (
        <NiloLight style={{ position: "absolute", alignSelf: "center", bottom: Math.round(screenHeight * 0.2) }} />
      )}

      {showFirstRun && (
        <FirstRunCard
          session={session}
          needsProfile={needsProfile}
          authBusy={authBusy}
          onGoogleSignIn={onGoogleSignIn}
          onOpenProfile={onOpenProfile}
        />
      )}
      {inputLocked && (
        <View
          onStartShouldSetResponder={() => true}
          onResponderGrant={onBeginInput}
          onResponderRelease={onBeginInput}
          style={styles.ritualInputShield}
        />
      )}
    </View>
  );
}

function RitualComposer({
  inputRef,
  input,
  setInput,
  submitRitual,
  isSending,
  visible,
  focused,
  locked,
  enabled,
  prompt,
  onFocus,
  onBlur,
  onPress,
  onExit,
  animatedStyle
}) {
  const fade = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const cursorPulse = useRef(new Animated.Value(0)).current;
  const disabled = !enabled || !input.trim() || isSending;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 180,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [fade, visible]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorPulse, {
          toValue: 1,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(cursorPulse, {
          toValue: 0,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [cursorPulse]);

  const cursorOpacity = cursorPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.24, 0.9]
  });

  function handleSubmit() {
    if (!disabled) submitRitual();
  }

  return (
    <Animated.View pointerEvents={visible ? "auto" : "none"} style={[styles.composer, focused && styles.composerFocused, animatedStyle, { opacity: fade }]}>
      {locked && (
        <Pressable onPress={onExit} hitSlop={10} style={styles.ritualExitButton}>
          <Text style={styles.ritualExitText}>×</Text>
        </Pressable>
      )}
      <Pressable onPress={onPress} onPressIn={onPress} style={styles.composerLine}>
        <GlassBackdrop intensity={28} />
        <Text style={styles.composerSparkle}>✦</Text>
        <View style={styles.composerInputWrap}>
          {!input && (
            <View pointerEvents="none" style={styles.composerPlaceholderRow}>
              <Text style={styles.composerPlaceholder}>{prompt}</Text>
              {enabled && <Animated.View style={[styles.composerCursor, { opacity: cursorOpacity }]} />}
            </View>
          )}
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={(value) => setInput(value.replace(/\n/g, "").slice(0, 50))}
            autoCorrect={false}
            blurOnSubmit={!locked}
            caretHidden={!input}
            cursorColor="#FFFEF4"
            editable={enabled}
            multiline={false}
            onBlur={onBlur}
            onFocus={onFocus}
            onSubmitEditing={handleSubmit}
            rejectResponderTermination={locked}
            returnKeyType="send"
            selectionColor="#FFFEF4"
            style={styles.composerInput}
          />
        </View>
        {input.length > 0 && (
          <Text style={[styles.counter, input.length >= 44 && styles.counterNear]}>{input.length}/50</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

function NightRitualButton({ enabled, visible, streakDays, onPress, animatedStyle }) {
  const fade = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 180,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [fade, visible]);

  // A slow breath on the mark — Nilo quietly inviting the ritual.
  useEffect(() => {
    if (!visible || !enabled) {
      breath.stopAnimation();
      breath.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath, enabled, visible]);

  const markOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const markScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <Animated.View pointerEvents={visible ? "box-none" : "none"} style={[styles.ritualButtonWrap, animatedStyle, { opacity: fade }]}>
      <Pressable
        disabled={!enabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.ritualStartButton,
          pressed && enabled && styles.ritualStartButtonPressed,
          !enabled && styles.ritualStartButtonDisabled
        ]}
      >
        <Animated.Text style={[styles.ritualStartIcon, !enabled && styles.ritualStartTextDisabled, enabled && { opacity: markOpacity, transform: [{ scale: markScale }] }]}>·</Animated.Text>
        <Text style={[styles.ritualStartText, !enabled && styles.ritualStartTextDisabled]}>
          {enabled ? "ふれて、今日を書く" : "今夜は記録済み"}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// A slow, looping 0→1→0 value — the same soft breathing rhythm Nilo's mark
// uses, shared by anything else that should glow like Nilo does.
function useBreath(duration = 3500) {
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath, duration]);
  return breath;
}

// Nilo's small breathing mark at the head of the dialogue — a soft amber glow
// (the pre-rendered orb) with a bright core, the prototype's 46px light.
function NiloMark() {
  const breath = useBreath();
  const glowOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] });
  const glowScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  return (
    <View pointerEvents="none" style={styles.niloMarkWrap}>
      <Animated.Image source={niloOrbTexture} resizeMode="contain" style={[styles.niloMarkGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      <View style={styles.niloMarkCore} />
    </View>
  );
}

// The current chapter's dot breathes the same way Nilo's mark does — the
// only timeline entry that's still open, so it's the only one that glows.
// Nilo's question, written glyph by glyph (writeQuestion: 340ms breath, then a
// character every 52ms), fading as it changes between questions.
function NiloDialogQuestion({ question, dimmed, closing }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const caret = useRef(new Animated.Value(0.9)).current;
  const [typed, setTyped] = useState(question || "");
  const timers = useRef([]);

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: dimmed ? 0 : 1, duration: dimmed ? 360 : 820, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
  }, [dimmed, opacity, question]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (dimmed) return undefined;
    const chars = Array.from(question || "");
    setTyped("");
    const begin = setTimeout(() => {
      chars.forEach((_, index) => {
        const timer = setTimeout(() => setTyped(chars.slice(0, index + 1).join("")), index * 52);
        timers.current.push(timer);
      });
    }, 340);
    timers.current.push(begin);
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [question, dimmed]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(caret, { toValue: 0.9, duration: 0, useNativeDriver: true }),
        Animated.delay(560),
        Animated.timing(caret, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(590)
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [caret]);

  return (
    <Animated.Text style={[styles.niloDialogQuestion, { opacity }]}>
      {typed}
      {!closing && <Animated.Text style={[styles.niloDialogCaret, { opacity: caret }]}>▏</Animated.Text>}
    </Animated.Text>
  );
}

// NILO (SCR · two tiers) — Nilo asks above, you answer below. Faithful to the
// reference layout, but the answer is captured with the OS keyboard rather than
// the prototype's mock 五十音 grid. The save / question-advance / seal logic is
// the existing night-ritual flow, unchanged.
function NiloDialogScreen({ visible, closing, question, dimmed, thinking, dateLabel, inputRef, input, setInput, enabled, onSubmit, onExit, exitConfirmOpen, onConfirmExit, onCancelExit, onBlur }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: visible ? 1 : 0, duration: visible ? 520 : 240, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
  }, [fade, visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.niloScreen, { opacity: fade }]}>
      <BackgroundTexture />
      <OuterGradient />
      <View style={styles.scrim} />
      <NightGrain />
      <View style={styles.niloScreenSafe}>
        <View style={styles.niloTopTier}>
          <NiloMark />
          <Text style={styles.niloMarkLabel}>NILO</Text>
          <Text style={styles.niloDateLabel}>{dateLabel} · 今夜</Text>
          <View style={styles.niloQuestionArea}>
            {thinking ? (
              <NiloThinkingIndicator />
            ) : (
              <NiloDialogQuestion question={question} dimmed={dimmed} closing={closing} />
            )}
          </View>
        </View>

        {closing ? (
          <View style={styles.niloClosing}>
            <Text style={styles.niloClosingText}>今夜の言葉は、そのまま{"\n"}日記に綴られます。</Text>
          </View>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.niloBottomTier}>
            <View style={styles.niloYouDivider}>
              <LinearGradient colors={["rgba(217,168,108,0)", "rgba(217,168,108,0.2)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.niloYouLine} />
              <Text style={styles.niloYouLabel}>YOU</Text>
              <LinearGradient colors={["rgba(217,168,108,0.2)", "rgba(217,168,108,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.niloYouLine} />
            </View>
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={(value) => setInput(value.replace(/\n/g, "").slice(0, 120))}
              onKeyPress={(event) => {
                if (event.nativeEvent.key === "Enter") {
                  event.preventDefault?.();
                  onSubmit();
                }
              }}
              placeholder="ここに、こたえを書く"
              placeholderTextColor="rgba(190,180,162,0.32)"
              style={styles.niloDraftInput}
              multiline
              autoFocus
              editable={enabled}
              selectionColor="#F2C88E"
              cursorColor="#F2C88E"
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={onSubmit}
              onBlur={onBlur}
            />
            {input.trim().length > 0 && (
              <Pressable onPress={onSubmit} style={({ pressed }) => [styles.niloSendButton, pressed && styles.touchPressedTight]}>
                <Text style={styles.niloSendText}>送信</Text>
              </Pressable>
            )}
            {exitConfirmOpen ? (
              <View style={styles.niloExitConfirmRow}>
                <Text style={styles.niloExitConfirmText}>本当に終了しますか？</Text>
                <View style={styles.niloExitConfirmActions}>
                  <Pressable onPress={onCancelExit} style={({ pressed }) => [styles.niloExitConfirmGhost, pressed && styles.touchPressedTight]}>
                    <Text style={styles.niloExitConfirmGhostText}>いいえ</Text>
                  </Pressable>
                  <Pressable onPress={onConfirmExit} style={({ pressed }) => [styles.niloExitConfirmPrimary, pressed && styles.touchPressedTight]}>
                    <Text style={styles.niloExitConfirmPrimaryText}>はい</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={onExit} style={styles.niloExitLink}>
                <Text style={styles.niloExitText}>今夜はここまでにする</Text>
              </Pressable>
            )}
          </KeyboardAvoidingView>
        )}
      </View>
    </Animated.View>
  );
}

function FirstRunCard({ session, needsProfile, authBusy, onGoogleSignIn, onOpenProfile }) {
  const signedIn = Boolean(session);
  const title = signedIn ? "プロフィールを完成させましょう" : "Arcを始める準備";
  const body = signedIn && needsProfile
    ? "名前と生年月日を登録すると、日数や記録があなたの情報に沿って表示されます。"
    : "Googleでログインすると、記録をあなたのアカウントに結びつけられます。service_role keyは使いません。";

  return (
    <View style={styles.firstRunCard}>
      <View style={styles.firstRunMark}>
        <Text style={styles.firstRunMarkText}>✦</Text>
      </View>
      <View style={styles.firstRunCopy}>
        <Text style={styles.firstRunTitle}>{title}</Text>
        <Text style={styles.firstRunBody}>{body}</Text>
        <Text style={styles.firstRunHint}>
          {signedIn ? "プロフィールから名前と生年月日を送ってください。" : "ログイン後、プロフィールで名前と生年月日を送ってください。"}
        </Text>
      </View>
      <Pressable
        disabled={authBusy}
        onPress={signedIn ? onOpenProfile : onGoogleSignIn}
        style={[styles.firstRunButton, authBusy && styles.disabledButton]}
      >
        <Text style={styles.firstRunButtonText}>{authBusy ? "接続中..." : signedIn ? "入力する" : "Googleでログイン"}</Text>
      </Pressable>
    </View>
  );
}

// Quest tab per the Quest Spec: only Nilo's proposals and ongoing explorations
// live here. No completion counts, progress bars, or clear states — a quest is
// a weeks-to-months exploration, not a task.
function QuestScreen({ onUiSound, active, proposals, explorations, onAccept, onDecline, onCloseExploration }) {
  const token = useEntrancePlay(active);
  const [futureQuestOpen, setFutureQuestOpen] = useState(false);
  const [openExploration, setOpenExploration] = useState(null);

  // Real explorations wear their computed time-thickness; until any exist,
  // the demo set keeps the screen inhabited (same fallback pattern as the
  // chapter pages).
  const real = explorations || [];
  const ongoing = real.filter((item) => item.status !== "closed").map((item) => ({
    ...item,
    since: formatQuestSince(item.sinceDateKey),
    duration: formatQuestDuration(item.sinceDateKey)
  }));
  const closed = real.filter((item) => item.status === "closed").map((item) => ({
    ...item,
    since: formatQuestSince(item.sinceDateKey),
    duration: formatQuestDuration(item.sinceDateKey, new Date(`${item.closedDateKey}T00:00:00`))
  }));
  const displayProposals = (proposals && proposals.length) ? proposals : (real.length ? [] : demoQuestProposals);
  const displayOngoing = real.length ? ongoing : demoOngoingQuests;

  function acceptProposal(proposal) {
    onUiSound?.();
    onAccept?.(proposal);
  }

  function declineProposal(proposal) {
    onUiSound?.();
    onDecline?.(proposal);
  }

  return (
    <>
    <BackgroundTexture />
    <NightGrain />
    <ScrollView contentContainerStyle={styles.questScrollContent} showsVerticalScrollIndicator={false}>
      <RiseIn index={0} playToken={token} style={styles.questHeader}>
        <Text style={styles.questScreenTitle}>クエスト</Text>
        <Text style={styles.questEyebrow}>QUEST ・ 時間をかけて掘り下げる探求</Text>
        <Text style={styles.questPhilosophy}>日記が点だとすれば、クエストは、{"\n"}その点が集まってできる、一本の線。</Text>
      </RiseIn>

      <RiseIn index={1} playToken={token} style={styles.questGroupHeader}>
        <Text style={styles.questGroupTitle}>Niloからの提案</Text>
        <View style={styles.questGroupRule} />
      </RiseIn>
      {displayProposals.length ? (
        displayProposals.map((proposal, index) => (
          <RiseIn key={proposal.id} index={index + 2} playToken={token} duration={500}>
            <View style={styles.mobileQuestCard}>
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(46,36,26,0.64)", "rgba(22,17,14,0.55)"]}
                locations={[0, 1]}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.92, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={styles.mobileQuestNilo}>NILO</Text>
              <Text style={styles.questProposalObservation}>{proposal.observation}</Text>
              <Text style={styles.questProposalInvitation}>{proposal.invitation}</Text>
              <View style={styles.mobileQuestActions}>
                <Pressable onPress={() => acceptProposal(proposal)} style={({ pressed }) => [styles.mobileQuestAction, styles.mobileQuestActionPrimary, pressed && styles.touchPressedTight]}>
                  <Text style={styles.mobileQuestActionPrimaryText}>一緒に見てみる</Text>
                </Pressable>
                <Pressable onPress={() => declineProposal(proposal)} style={({ pressed }) => [styles.mobileQuestAction, styles.mobileQuestActionSecondary, pressed && styles.touchPressedTight]}>
                  <Text style={styles.mobileQuestActionSecondaryText}>今は、そのままに</Text>
                </Pressable>
              </View>
            </View>
          </RiseIn>
        ))
      ) : (
        <RiseIn index={2} playToken={token}>
          <Text style={styles.questQuietNote}>いまは、静かなときです。{"\n"}日々の記録の中に繰り返し現れるものを見つけたら、{"\n"}Niloがここにそっと差し出します。</Text>
        </RiseIn>
      )}

      <RiseIn index={displayProposals.length + 2} playToken={token} style={[styles.questGroupHeader, styles.questGroupHeaderSpaced]}>
        <Text style={styles.questGroupTitle}>過去を辿る探求</Text>
        <View style={styles.questGroupRule} />
      </RiseIn>
      {displayOngoing.length ? (
        displayOngoing.map((quest, index) => (
          <RiseIn key={quest.id} index={displayProposals.length + 3 + index} playToken={token} duration={500}>
            <Pressable
              onPress={() => {
                onUiSound?.();
                setOpenExploration(quest);
              }}
              style={({ pressed }) => [styles.questOngoingRow, pressed && styles.touchPressedSubtle]}
            >
              <Text style={styles.questOngoingTheme}>{quest.theme}</Text>
              <Text style={styles.questOngoingMeta}>
                {quest.since}　・　{quest.duration}{quest.sessions ? `　・　重ねた問い ${quest.sessions}回` : ""}
              </Text>
            </Pressable>
          </RiseIn>
        ))
      ) : (
        <RiseIn index={displayProposals.length + 3} playToken={token}>
          <Text style={styles.questQuietNote}>いま、続いている探求はありません。</Text>
        </RiseIn>
      )}

      <RiseIn index={displayProposals.length + displayOngoing.length + 3} playToken={token} style={[styles.questGroupHeader, styles.questGroupHeaderSpaced]}>
        <Text style={styles.questGroupTitle}>未来に向かう探求</Text>
        <View style={styles.questGroupRule} />
      </RiseIn>
      <RiseIn index={displayProposals.length + displayOngoing.length + 4} playToken={token} duration={500}>
        <Pressable
          onPress={() => {
            onUiSound?.();
            setFutureQuestOpen(true);
          }}
          style={({ pressed }) => [styles.questOngoingRow, pressed && styles.touchPressedSubtle]}
        >
          <Text style={styles.questOngoingTheme}>{demoFutureQuest.theme}</Text>
          <Text style={styles.questOngoingMeta}>{demoFutureQuest.since}　・　{demoFutureQuest.duration}</Text>
        </Pressable>
      </RiseIn>

      {closed.length > 0 && (
        <>
          <RiseIn index={displayProposals.length + displayOngoing.length + 5} playToken={token} style={[styles.questGroupHeader, styles.questGroupHeaderSpaced]}>
            <Text style={styles.questGroupTitle}>一区切りついた探求</Text>
            <View style={styles.questGroupRule} />
          </RiseIn>
          {closed.map((quest, index) => (
            <RiseIn key={quest.id} index={displayProposals.length + displayOngoing.length + 6 + index} playToken={token} duration={500}>
              <Pressable
                onPress={() => {
                  onUiSound?.();
                  setOpenExploration(quest);
                }}
                style={({ pressed }) => [styles.questOngoingRow, styles.questClosedRow, pressed && styles.touchPressedSubtle]}
              >
                <Text style={[styles.questOngoingTheme, styles.questClosedTheme]}>{quest.theme}</Text>
                <Text style={styles.questOngoingMeta}>{quest.since}　・　{quest.duration}をともに</Text>
              </Pressable>
            </RiseIn>
          ))}
        </>
      )}
    </ScrollView>
    <FutureQuestDetailModal visible={futureQuestOpen} onClose={() => setFutureQuestOpen(false)} quest={demoFutureQuest} />
    <ExplorationDetailModal
      visible={!!openExploration}
      quest={openExploration || {}}
      onClose={() => setOpenExploration(null)}
      onCloseExploration={
        openExploration && !openExploration.demo && openExploration.status !== "closed"
          ? () => {
            onUiSound?.();
            onCloseExploration?.(openExploration.id);
            setOpenExploration(null);
          }
          : null
      }
    />
    </>
  );
}

function QuestSection({ title, quests, completeQuest, onUiSound }) {
  if (!quests.length) return null;
  return (
    <View style={styles.questSection}>
      <Text style={styles.questSectionTitle}>{title}</Text>
      <View style={styles.questGrid}>
        {quests.map((quest) => (
          <QuestTile key={quest.id} quest={quest} onComplete={completeQuest} onUiSound={onUiSound} />
        ))}
      </View>
    </View>
  );
}

function QuestTile({ quest, onComplete, onUiSound }) {
  const collapse = useRef(new Animated.Value(0)).current;
  const dust = useRef(questDust.map(() => new Animated.Value(0))).current;
  const [isCompleting, setIsCompleting] = useState(false);

  function completeWithAnimation() {
    if (isCompleting) return;
    setIsCompleting(true);
    onUiSound?.();

    Animated.parallel([
      Animated.timing(collapse, {
        toValue: 1,
        duration: 640,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false
      }),
      Animated.stagger(
        30,
        dust.map((value) => Animated.timing(value, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }))
      )
    ]).start(() => onComplete(quest.id));
  }

  // A small settle, then the card lifts up and to the right and fades —
  // a quiet "carried away" rather than a busy shatter.
  const tileOpacity = collapse.interpolate({
    inputRange: [0, 0.5, 0.82, 1],
    outputRange: [1, 0.96, 0.5, 0]
  });
  const tileScale = collapse.interpolate({
    inputRange: [0, 0.14, 1],
    outputRange: [1, 1.04, 0.7]
  });
  const tileRotate = collapse.interpolate({
    inputRange: [0, 0.14, 1],
    outputRange: ["0deg", "-1.5deg", "6deg"]
  });
  const tileTranslateX = collapse.interpolate({
    inputRange: [0, 0.14, 1],
    outputRange: [0, -6, 128]
  });
  const tileTranslateY = collapse.interpolate({
    inputRange: [0, 0.14, 1],
    outputRange: [0, 10, -184]
  });
  const tileHeight = collapse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [154, 154, 0]
  });
  const tileWidth = collapse.interpolate({
    inputRange: [0, 0.56, 1],
    outputRange: ["46.5%", "46.5%", "0%"]
  });
  const tileMarginBottom = collapse.interpolate({
    inputRange: [0, 0.48, 1],
    outputRange: [12, 12, 0]
  });
  const tileMarginRight = collapse.interpolate({
    inputRange: [0, 0.56, 1],
    outputRange: [0, 0, 0]
  });

  return (
    <Animated.View style={[styles.questTileShell, { height: tileHeight, marginBottom: tileMarginBottom, marginRight: tileMarginRight, width: tileWidth }]}>
      <Animated.View
        style={[
          styles.questTile,
          {
            opacity: tileOpacity,
            transform: [
              { translateX: tileTranslateX },
              { translateY: tileTranslateY },
              { scale: tileScale },
              { rotate: tileRotate }
            ]
          }
        ]}
      >
        <GlassBackdrop intensity={22} />
        <View style={styles.questTileHead}>
          <View style={styles.questIconMark}>
            <View style={styles.questIconMarkLine} />
            <View style={styles.questIconMarkDot} />
          </View>
          <Pressable
            disabled={isCompleting}
            onPress={completeWithAnimation}
            style={({ pressed }) => [styles.checkButton, pressed && !isCompleting && styles.checkButtonPressed, isCompleting && styles.checkButtonActive]}
          >
            <Text style={styles.checkButtonText}>✓</Text>
          </Pressable>
        </View>
        <Text style={styles.dailyLabel}>{getQuestLabel(quest)}</Text>
        <Text style={styles.questTitle}>{quest.title}</Text>
      </Animated.View>
      <View pointerEvents="none" style={styles.questDustLayer}>
        {questDust.map((particle, index) => {
          const progress = dust[index];
          const opacity = progress.interpolate({
            inputRange: [0, 0.16, 0.74, 1],
            outputRange: [0, 1, 0.64, 0]
          });
          const translateX = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, particle.x]
          });
          const translateY = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, particle.y]
          });
          const scale = progress.interpolate({
            inputRange: [0, 0.35, 1],
            outputRange: [0.35, 1, 0.08]
          });
          return (
            <Animated.View
              key={index}
              style={[
                styles.questDust,
                {
                  height: particle.size,
                  width: particle.size,
                  opacity,
                  transform: [{ translateX }, { translateY }, { scale }]
                }
              ]}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

function JournalScreen({ journal, active, onOpenDetail }) {
  const token = useEntrancePlay(active);
  const entries = getJournalTimelineEntries(journal);

  return (
    <ScrollView contentContainerStyle={styles.journalScrollContent} showsVerticalScrollIndicator={false}>
      <RiseIn index={0} playToken={token} style={styles.journalHeader}>
        <Text style={styles.mobileScreenTitle}>日記</Text>
        <Text style={styles.mobileGoldLabel}>二つの川が、合流する場所</Text>
        <Text style={styles.journalMonth}>JUNE 2026</Text>
        <Text style={styles.journalWatermark}>水無月</Text>
      </RiseIn>
      <View style={styles.timeline}>
        <View pointerEvents="none" style={styles.timelineLine} />
        {entries.map((entry, index) => {
          // The timeline fades with age: the newest node is the brightest and
          // largest, the oldest the faintest — five graded steps, as in ARC.
          const fade = Math.min(index, 4);
          return (
            <RiseIn key={entry.id} index={index + 1} playToken={token} duration={550}>
              <Pressable
                onPress={() => onOpenDetail?.(entry)}
                style={({ pressed }) => [styles.timelineItem, pressed && styles.touchPressedSubtle]}
              >
                <View style={[styles.timelineDot, diaryNodeStyles[fade]]} />
                <View style={styles.timelineCopy}>
                  <View style={styles.timelineMetaRow}>
                    <Text style={[styles.timelineDate, { color: diaryDateColors[fade] }]}>{entry.dateLabel}</Text>
                    {entry.tag === "TONIGHT" && <Text style={styles.timelineTag}>TONIGHT</Text>}
                    {entry.tag === "QUEST" && <Text style={styles.timelineQuestTag}>QUEST</Text>}
                  </View>
                  <Text style={[styles.timelineText, { color: diaryTextColors[fade] }]}>{entry.title}</Text>
                  {(entry.lines || []).map((line, lineIndex) => (
                    <Text key={lineIndex} style={[styles.timelineText, { color: diaryTextColors[fade] }]}>{line}</Text>
                  ))}
                </View>
              </Pressable>
            </RiseIn>
          );
        })}
      </View>
    </ScrollView>
  );
}

// 章タブ (per the Chapter spec): the primary experience is immersion — one
// chapter fills one screen, and scrolling turns pages like the BeReal Recap
// card stack, slowed to match the weight of years: the outgoing chapter
// shrinks, sinks and dims while the next slides over it. A thin thread at the
// right edge keeps the overview alive — each segment's length is the
// chapter's record weight, and the current one glows gold.
function StoryScreen({ chapters, proposals, eligibleCount, busy, onPropose, onConfirm, onDefer, onSplit, chapterNotes, onChangeNote, active }) {
  const token = useEntrancePlay(active);
  const pages = getChapterPages(chapters);
  const [pageH, setPageH] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const pageCount = pages.length + 1;

  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event) => {
        if (!pageH) return;
        const next = Math.max(0, Math.min(pageCount - 1, Math.round(event.nativeEvent.contentOffset.y / pageH)));
        setPageIndex((value) => (value === next ? value : next));
      }
    }
  ), [pageCount, pageH, scrollY]);

  return (
    <View style={styles.chpContainer} onLayout={(event) => setPageH(event.nativeEvent.layout.height)}>
      {pageH > 0 && (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          snapToInterval={pageH}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          scrollEventThrottle={16}
          onScroll={handleScroll}
        >
          {pages.map((chapter, index) => {
            // While scrolling one page forward, this (outgoing) page lags
            // behind the scroll, shrinking and dimming, so the next chapter
            // appears to rise over it from behind.
            const range = [index * pageH, (index + 1) * pageH];
            const sink = scrollY.interpolate({ inputRange: range, outputRange: [0, pageH * 0.42], extrapolate: "clamp" });
            const scale = scrollY.interpolate({ inputRange: range, outputRange: [1, 0.93], extrapolate: "clamp" });
            // Mid-transition the outgoing page lingers dimly behind the
            // incoming one (depth), but it must be fully gone at rest —
            // pages have no opaque background to cover it otherwise.
            const dim = scrollY.interpolate({ inputRange: range, outputRange: [1, 0], extrapolate: "clamp" });
            return (
              <View key={chapter.id} style={{ height: pageH }}>
                <Animated.View style={[styles.chpPage, { opacity: dim, transform: [{ translateY: sink }, { scale }] }]}>
                  <LinearGradient
                    pointerEvents="none"
                    colors={[chapter.tint || "rgba(214,168,106,0.10)", "rgba(0,0,0,0)"]}
                    locations={[0, 0.72]}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.chpPageScroll}
                  >
                    <ChapterPageBody
                      chapter={chapter}
                      playToken={index === 0 ? token : 0}
                      savedNote={chapterNotes?.[chapter.id] || ""}
                      onCommitNote={(text) => onChangeNote?.(chapter.id, text)}
                    />
                  </ScrollView>
                </Animated.View>
              </View>
            );
          })}

          <View style={{ height: pageH }}>
            <View style={styles.chpPage}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={styles.chpPageScroll}>
                <Text style={styles.chpEndLabel}>この先の章</Text>
                <Text style={styles.chpEndNote}>日々の記録の中に意味の変化が見えたら、{"\n"}Niloが次の章の区切りを、そっと差し出します。</Text>
                {eligibleCount > 0 && (
                  <Pressable
                    disabled={busy}
                    onPress={() => onPropose()}
                    style={({ pressed }) => [styles.chapterFindButton, pressed && !busy && styles.touchPressedTight, busy && styles.disabledButton]}
                  >
                    <Text style={styles.chapterFindButtonText}>{busy ? "見つめています…" : proposals?.length ? "もう一度、章を探す" : "章を探す"}</Text>
                  </Pressable>
                )}
                {(proposals || []).map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    busy={busy}
                    onConfirm={onConfirm}
                    onDefer={onDefer}
                    onSplit={onSplit}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        </Animated.ScrollView>
      )}

      <View pointerEvents="none" style={styles.chpThread}>
        {pages.map((chapter, index) => (
          <View
            key={chapter.id}
            style={[
              styles.chpThreadSegment,
              { height: 16 + Math.min(64, Math.round((chapter.recordCount || 1) * 1.2)) },
              index === pageIndex && styles.chpThreadSegmentActive
            ]}
          />
        ))}
        <View style={[styles.chpThreadSegment, styles.chpThreadSegmentEnd, pageIndex === pages.length && styles.chpThreadSegmentActive]} />
      </View>
    </View>
  );
}

// The contents of one chapter page, in the spec's order: title and symbolic
// line, diary excerpts (the lead role), a reunion with another chapter, the
// chapter's wish (times touched, never a percentage), frequent words sized by
// weight alone, recurring people and places, Nilo's letter, the single
// writing field, and stats offered as thickness rather than achievement.
function ChapterPageBody({ chapter, playToken, savedNote, onCommitNote }) {
  // Drafted locally per keystroke; committed to persisted state on blur so
  // AsyncStorage isn't rewritten for every character.
  const [selfNote, setSelfNote] = useState(savedNote || "");
  useEffect(() => {
    setSelfNote(savedNote || "");
  }, [savedNote, chapter.id]);
  const excerpts = chapter.excerpts || [];
  const words = chapter.words || [];
  const figures = chapter.figures || [];

  return (
    <>
      <RiseIn index={0} playToken={playToken}>
        <View style={styles.chpMetaRow}>
          <Text style={styles.chpOrdinal}>{chapter.ordinal}</Text>
          <Text style={styles.chpPeriod}>{chapter.period}</Text>
        </View>
        <Text style={styles.chpTitle}>{chapter.title}</Text>
        <Text style={styles.chpSummary}>{chapter.summary}</Text>
        {chapter.current && <Text style={styles.chpNowNote}>—— いま、この章の中に</Text>}
      </RiseIn>

      {excerpts.length > 0 && (
        <RiseIn index={1} playToken={playToken}>
          <ChpSectionHeader label="この章の記録" note={chapter.recordCount > excerpts.length ? `${chapter.recordCount}の記録から` : ""} />
          {excerpts.map((excerpt, index) => (
            <View key={`${excerpt.date}-${index}`} style={styles.chpExcerpt}>
              <Text style={styles.chpExcerptDate}>{excerpt.date}</Text>
              <Text style={styles.chpExcerptText}>{excerpt.text}</Text>
            </View>
          ))}
        </RiseIn>
      )}

      {!!chapter.reunion && (
        <RiseIn index={2} playToken={playToken}>
          <ChpSectionHeader label="過去との再会" note={chapter.reunion.fromLabel} />
          <Text style={styles.chpReunionQuote}>「{chapter.reunion.quote}」</Text>
        </RiseIn>
      )}

      {!!chapter.wish && (
        <RiseIn index={3} playToken={playToken}>
          <ChpSectionHeader label="この章の願い" />
          <Text style={styles.chpWishTheme}>{chapter.wish.theme}</Text>
          <Text style={styles.chpWishLine}>{chapter.wish.line}</Text>
        </RiseIn>
      )}

      {words.length > 0 && (
        <RiseIn index={4} playToken={playToken}>
          <ChpSectionHeader label="よく現れた言葉" />
          <View style={styles.chpWordsWrap}>
            {words.map((word) => (
              <Text
                key={word.text}
                style={[styles.chpWord, { fontSize: 12 + (word.weight || 1) * 3, opacity: 0.42 + (word.weight || 1) * 0.18 }]}
              >
                {word.text}
              </Text>
            ))}
          </View>
        </RiseIn>
      )}

      {figures.length > 0 && (
        <RiseIn index={5} playToken={playToken}>
          <ChpSectionHeader label="この章の登場" />
          <Text style={styles.chpFigures}>{figures.join("　・　")}</Text>
        </RiseIn>
      )}

      {!!chapter.niloLetter && (
        <RiseIn index={6} playToken={playToken}>
          <ChpSectionHeader label="NILOより" />
          <Text style={styles.chpNiloLetter}>{chapter.niloLetter}</Text>
        </RiseIn>
      )}

      <RiseIn index={7} playToken={playToken}>
        <ChpSectionHeader label="あの日の自分へ" />
        <TextInput
          value={selfNote}
          onChangeText={setSelfNote}
          onBlur={() => onCommitNote?.(selfNote)}
          multiline
          placeholder="いまのあなたから、この頃の自分へ"
          placeholderTextColor="rgba(196,176,148,0.4)"
          style={styles.chpSelfNoteInput}
        />
      </RiseIn>

      {!!chapter.stats && (
        <RiseIn index={8} playToken={playToken}>
          <Text style={styles.chpStats}>{chapter.stats.records}　・　{chapter.stats.span}</Text>
          <Text style={styles.chpStatsEmotion}>{chapter.stats.emotion}</Text>
        </RiseIn>
      )}
    </>
  );
}

function ChpSectionHeader({ label, note }) {
  return (
    <View style={styles.chpSectionHeader}>
      <Text style={styles.chpSectionLabel}>{label}</Text>
      <View style={styles.chpSectionRule} />
      {!!note && <Text style={styles.chpSectionNote}>{note}</Text>}
    </View>
  );
}

// Detail view for a future-facing exploration (the former Life Quest). Per the
// integration memo, what it makes visible is spent heat, not progress: the
// words exchanged over time, the thickness of elapsed time, and Nilo
// reflecting that back in words — never in numbers.
function FutureQuestDetailModal({ visible, onClose, quest }) {
  const token = useEntrancePlay(visible);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.background}>
        <BackgroundTexture />
        <OuterGradient />
        <View style={styles.scrim} />
        <NightGrain />
        <FloatingOrbs />
        <SafeAreaView style={styles.safe}>
          <Pressable focusable={false} onPress={onClose} style={({ pressed }) => [styles.lifeQuestBack, pressed && styles.touchPressedTight]}>
            <Text style={styles.lifeQuestBackText}>‹</Text>
          </Pressable>
          <ScrollView contentContainerStyle={styles.lifeQuestDetailScroll} showsVerticalScrollIndicator={false}>
            <RiseIn index={0} playToken={token}>
              <Text style={styles.lifeQuestDetailLabel}>未来に向かう探求</Text>
              <Text style={styles.lifeQuestDetailTitle}>{quest.theme}</Text>
              <Text style={styles.lifeQuestDetailMeta}>{quest.since}　・　{quest.duration}</Text>
              {!!quest.niloLine && <Text style={styles.futureQuestNiloLine}>{quest.niloLine}</Text>}
            </RiseIn>

            <RiseIn index={1} playToken={token} style={styles.latestWordCard}>
              <Text style={styles.latestWordLabel}>最新の言葉</Text>
              <Text style={styles.latestWordText}>「{quest.latestLine}」</Text>
            </RiseIn>

            <RiseIn index={2} playToken={token} style={styles.recordTrailHeader}>
              <Text style={styles.recordTrailLabel}>言葉の軌跡</Text>
              <View style={styles.recordTrailRule} />
            </RiseIn>
            <View style={styles.lifeQuestRecordTimeline}>
              <View pointerEvents="none" style={styles.lifeQuestRecordLine} />
              {quest.records.map((record, index) => (
                <RiseIn key={`${record.date}-${index}`} index={index + 3} playToken={token} duration={500} style={styles.lifeQuestRecordItem}>
                  <View style={styles.lifeQuestRecordDot} />
                  <View style={styles.lifeQuestRecordCopy}>
                    <Text style={styles.lifeQuestRecordDate}>{record.date}</Text>
                    <Text style={styles.lifeQuestRecordText}>{record.text}</Text>
                  </View>
                </RiseIn>
              ))}
            </View>

            <View style={styles.lifeQuestActions}>
              <Pressable onPress={onClose} style={({ pressed }) => [styles.lifeQuestTalkButton, pressed && styles.touchPressedTight]}>
                <Text style={styles.lifeQuestTalkText}>Niloとこの願いを話す</Text>
              </Pressable>
              <Text style={styles.lifeQuestPhilosophy}>達成より、道のりを残す。{"\n"}願いが叶っても、かたちを変えても、{"\n"}この時間は消えない。</Text>
            </View>
          </ScrollView>
          <StatusBar barStyle="light-content" />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// Detail view for a past-facing exploration. What it shows is the weight of
// the time spent facing the theme — the nights that touched it and the words
// they left. 一区切り is offered quietly, never as completion: everything the
// exploration gathered stays.
function ExplorationDetailModal({ visible, quest, onClose, onCloseExploration }) {
  const token = useEntrancePlay(visible);
  const records = quest.records || [];
  const isClosed = quest.status === "closed";
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.background}>
        <BackgroundTexture />
        <OuterGradient />
        <View style={styles.scrim} />
        <NightGrain />
        <FloatingOrbs />
        <SafeAreaView style={styles.safe}>
          <Pressable focusable={false} onPress={onClose} style={({ pressed }) => [styles.lifeQuestBack, pressed && styles.touchPressedTight]}>
            <Text style={styles.lifeQuestBackText}>‹</Text>
          </Pressable>
          <ScrollView contentContainerStyle={styles.lifeQuestDetailScroll} showsVerticalScrollIndicator={false}>
            <RiseIn index={0} playToken={token}>
              <Text style={styles.lifeQuestDetailLabel}>{isClosed ? "一区切りついた探求" : "過去を辿る探求"}</Text>
              <Text style={styles.lifeQuestDetailTitle}>{quest.theme}</Text>
              <Text style={styles.lifeQuestDetailMeta}>
                {quest.since}　・　{quest.duration}{quest.sessions ? `　・　重ねた問い ${quest.sessions}回` : ""}
              </Text>
            </RiseIn>

            <RiseIn index={1} playToken={token} style={styles.recordTrailHeader}>
              <Text style={styles.recordTrailLabel}>言葉の軌跡</Text>
              <View style={styles.recordTrailRule} />
            </RiseIn>
            {records.length ? (
              <View style={styles.lifeQuestRecordTimeline}>
                <View pointerEvents="none" style={styles.lifeQuestRecordLine} />
                {records.map((record, index) => (
                  <RiseIn key={`${record.date}-${index}`} index={index + 2} playToken={token} duration={500} style={styles.lifeQuestRecordItem}>
                    <View style={styles.lifeQuestRecordDot} />
                    <View style={styles.lifeQuestRecordCopy}>
                      <Text style={styles.lifeQuestRecordDate}>{record.date}</Text>
                      <Text style={styles.lifeQuestRecordText}>{record.text}</Text>
                    </View>
                  </RiseIn>
                ))}
              </View>
            ) : (
              <RiseIn index={2} playToken={token}>
                <Text style={styles.questQuietNote}>まだ言葉は残っていません。{"\n"}夜の対話でこのテーマにふれると、ここに積もっていきます。</Text>
              </RiseIn>
            )}

            <View style={styles.lifeQuestActions}>
              {!!onCloseExploration && (
                <Pressable onPress={onCloseExploration} style={({ pressed }) => [styles.lifeQuestTalkButton, pressed && styles.touchPressedTight]}>
                  <Text style={styles.lifeQuestTalkText}>そっと、一区切りにする</Text>
                </Pressable>
              )}
              <Text style={styles.lifeQuestPhilosophy}>
                {isClosed
                  ? "この探求は一区切りしました。\nここで重ねた問いと言葉は、消えません。"
                  : "急がなくていい。\n問いは、夜ごとに少しずつ深くなる。"}
              </Text>
            </View>
          </ScrollView>
          <StatusBar barStyle="light-content" />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// 通知タブ（お知らせ）: a quiet inbox for what Nilo has noticed — a new quest
// proposal, a chapter ready to be named. No badges to clear, no inbox-zero;
// tapping an item just marks it read and, if it points somewhere, opens it.
function NotificationsModal({ visible, notifications, onClose, onMarkRead, onNavigate, onOpenSettings }) {
  const token = useEntrancePlay(visible);
  if (!visible) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <BackgroundTexture />
        <OuterGradient />
        <View style={styles.scrim} />
        <NightGrain />
        <FloatingOrbs />
        <View style={styles.modalHeader}>
          <Pressable focusable={false} onPress={onClose} style={({ pressed }) => [styles.modalBackButton, pressed && styles.touchPressedTight]}>
            <Text style={styles.modalBackText}>‹</Text>
          </Pressable>
          <View style={styles.modalTitleWrap}>
            <Text style={styles.modalSub}>NOTIFICATIONS</Text>
            <Text style={styles.modalTitle}>お知らせ</Text>
          </View>
        </View>

        <View style={styles.settingsBody}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingSection}>
            {notifications.length ? (
              notifications.map((item, index) => (
                <RiseIn key={item.id} index={index} playToken={token} duration={500}>
                  <Pressable
                    onPress={() => {
                      onMarkRead(item.id);
                      if (item.tab) onNavigate(item.tab);
                    }}
                    style={({ pressed }) => [
                      styles.notificationRow,
                      !item.read && styles.notificationRowUnread,
                      pressed && styles.touchPressedTight
                    ]}
                  >
                    <GlassBackdrop intensity={18} />
                    {!item.read && <View pointerEvents="none" style={styles.notificationRowDot} />}
                    <Text style={styles.notificationRowTag}>{item.tag}</Text>
                    <Text style={styles.notificationRowTitle}>{item.title}</Text>
                    {!!item.body && <Text style={styles.notificationRowBody}>{item.body}</Text>}
                    <Text style={styles.notificationRowDate}>{formatNotificationTimestamp(item.createdAt)}</Text>
                  </Pressable>
                </RiseIn>
              ))
            ) : (
              <RiseIn index={0} playToken={token} style={styles.settingsPage}>
                <SettingsPageTitle icon="notifications" title="お知らせ" body="いまは、届いているお知らせはありません。" />
                <Text style={styles.notificationEmptyNote}>Niloが記録の中に何かを見つけたとき、{"\n"}ここにそっと届きます。</Text>
              </RiseIn>
            )}

            <Pressable onPress={onOpenSettings} style={({ pressed }) => [styles.backToBase, pressed && styles.touchPressedTight]}>
              <Text style={styles.backToBaseText}>通知の時刻を設定する ›</Text>
            </Pressable>
          </ScrollView>
        </View>
        <StatusBar barStyle="light-content" />
      </SafeAreaView>
    </Modal>
  );
}

function formatNotificationTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return `今日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

// ENTRY DETAIL (SCR-05) — a tapped record opens into the full conversation
// with Nilo, the emotions it left, a similar night, and the quiet reminder
// that the record cannot be erased. Opened as a full-screen modal, like the
// life-quest detail.
function EntryDetailModal({ entry, onClose }) {
  const visible = !!entry;
  const token = useEntrancePlay(visible);
  const e = entry || {};
  const dialogue = e.dialogue && e.dialogue.length
    ? e.dialogue
    : [{ role: "user", text: e.title || e.summary || "" }];
  const emotions = e.emotions || [];
  const related = e.related || [];
  const isTonight = e.tag === "TONIGHT" || e.tonight;
  const isQuest = e.tag === "QUEST" || e.source === "quest";

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.background}>
        <BackgroundTexture />
        <OuterGradient />
        <View style={styles.scrim} />
        <NightGrain />
        <FloatingOrbs />
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.entryDetailScroll} showsVerticalScrollIndicator={false}>
            <RiseIn index={0} playToken={token}>
              <View style={styles.entryDetailHeadRow}>
                <Text style={styles.entryDetailDate}>{e.dateLabel || "今夜"}</Text>
                {isTonight && <Text style={styles.entryDetailTonight}>TONIGHT</Text>}
                {isQuest && <Text style={styles.entryDetailQuestTag}>QUEST</Text>}
              </View>
              <View style={styles.entryDetailRule} />
            </RiseIn>

            <View style={styles.entryDetailDialogue}>
              {dialogue.map((message, index) => (
                <RiseIn key={index} index={index + 1} playToken={token} duration={550} style={styles.entryDetailMsg}>
                  {message.role === "nilo" && <Text style={styles.entryDetailNiloLabel}>NILO ねむる</Text>}
                  <Text style={message.role === "nilo" ? styles.entryDetailNiloText : styles.entryDetailUserText}>{message.text}</Text>
                </RiseIn>
              ))}
            </View>

            {emotions.length > 0 && (
              <View style={styles.entryDetailEmotions}>
                {emotions.map((tag) => (
                  <Text key={tag} style={styles.entryDetailEmotionChip}>{tag}</Text>
                ))}
              </View>
            )}

            {related.length > 0 && (
              <View style={styles.entryDetailRelated}>
                <Text style={styles.entryDetailRelatedLabel}>Niloがそっと差し出す、似た夜</Text>
                {related.map((item, index) => (
                  <View key={index} style={styles.entryDetailRelatedItem}>
                    <Text style={styles.entryDetailRelatedDate}>{item.date}</Text>
                    <Text style={styles.entryDetailRelatedText}>{item.text}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.entryDetailFooter}>この記録は、消すことができません。</Text>
          </ScrollView>
          <View pointerEvents="none" style={styles.entryDetailTopFade}>
            <LinearGradient colors={["rgba(16,12,9,0.92)", "rgba(16,12,9,0)"]} style={StyleSheet.absoluteFill} />
          </View>
          <Pressable focusable={false} onPress={onClose} style={({ pressed }) => [styles.lifeQuestBack, pressed && styles.touchPressedTight]}>
            <Text style={styles.lifeQuestBackText}>‹</Text>
          </Pressable>
          <StatusBar barStyle="light-content" />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function ThroughlineRow({ label, items }) {
  return (
    <View style={styles.throughlineRow}>
      <Text style={styles.throughlineLabel}>{label}</Text>
      <Text style={styles.throughlineValue}>{items.join("　·　")}</Text>
    </View>
  );
}

// The throughline of a period — not a summary, but what ran through it.
function ThroughlineBlock({ data }) {
  const emotions = data.emotions || [];
  const people = data.people || [];
  const questions = data.questions || [];
  const hasShift = !!data.meaningFrom || !!data.meaningTo;
  if (!emotions.length && !people.length && !questions.length && !hasShift) return null;
  return (
    <View style={styles.throughline}>
      <View style={styles.ruleGold} />
      {emotions.length > 0 && <ThroughlineRow label="感情" items={emotions} />}
      {people.length > 0 && <ThroughlineRow label="人" items={people} />}
      {questions.length > 0 && <ThroughlineRow label="問い" items={questions} />}
      {hasShift && (
        <View style={styles.meaningShift}>
          {!!data.meaningFrom && <Text style={styles.meaningText}>{data.meaningFrom}</Text>}
          <View style={styles.meaningRule} />
          {!!data.meaningTo && <Text style={styles.meaningTextTo}>{data.meaningTo}</Text>}
        </View>
      )}
    </View>
  );
}

// First date of an episode period, as a slim MM.DD marker for the list.
function episodeShortPeriod(period) {
  const match = String(period || "").match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (match) return `${match[2].padStart(2, "0")}.${match[3].padStart(2, "0")}`;
  return String(period || "").replace(/^\d{4}[.\-/]/, "").slice(0, 8);
}

// A chapter (era) folds its episodes away; the toggle reveals the texture
// inside. Episodes are Nilo's, surfaced — never named or approved on their own.
function EpisodeList({ episodes }) {
  const [open, setOpen] = useState(false);
  if (!episodes || episodes.length === 0) return null;
  return (
    <View style={styles.episodeBlock}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.episodeToggle}>
        <Text style={styles.episodeToggleText}>{`${episodes.length}つの場面　${open ? "▾" : "▸"}`}</Text>
      </Pressable>
      {open && (
        <View style={styles.episodeList}>
          {episodes.map((episode, index) => (
            <View key={index} style={[styles.episodeItem, index > 0 && styles.episodeItemDivided]}>
              <Text style={styles.episodeDate}>{episodeShortPeriod(episode.period)}</Text>
              <Text style={styles.episodeText}>{episode.observation}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ProposalCard({ proposal, busy, onConfirm, onDefer, onSplit }) {
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState("");

  return (
    <View style={styles.proposalCard}>
      <Text style={styles.proposalEyebrow}>NILO が感じた変化点</Text>
      {!!proposal.period && <Text style={styles.proposalPeriod}>{proposal.period}</Text>}
      {!!proposal.observation && <Text style={styles.proposalObservation}>{proposal.observation}</Text>}
      <ThroughlineBlock data={proposal} />
      <EpisodeList episodes={proposal.episodes} />
      {naming ? (
        <View style={styles.proposalNameRow}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="この章に名前をつける（後で変えられます）"
            placeholderTextColor="#777"
            style={styles.settingInput}
          />
          <Pressable onPress={() => onConfirm(proposal.id, title)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>この章を残す</Text>
          </Pressable>
          <Pressable onPress={() => onConfirm(proposal.id, "")}>
            <Text style={styles.proposalSkipName}>名前は後で</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.proposalActions}>
          <Pressable disabled={busy} onPress={() => setNaming(true)} style={styles.proposalAccept}>
            <Text style={styles.proposalAcceptText}>認める</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => onDefer(proposal.id)} style={styles.proposalGhost}>
            <Text style={styles.proposalGhostText}>まだ進行中</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => onSplit(proposal.id)} style={styles.proposalGhost}>
            <Text style={styles.proposalGhostText}>分ける</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ChapterCard({ chapter, index, total, onRename }) {
  // Chapters render newest-first, but the story reads oldest-first — so the
  // earliest memory becomes Chapter I.
  const chapterNo = total - index;
  const history = chapter.titleHistory || [];
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chapter.title || "");

  const past = history.slice(0, -1).map((entry) => entry.title).filter(Boolean);

  return (
    <View style={styles.chapterCard}>
      <View style={styles.chapterMark}>
        <Text style={styles.chapterRoman}>{toRoman(chapterNo)}</Text>
        <View style={styles.chapterMarkCol}>
          <Text style={styles.chapterEyebrowLabel}>CHAPTER</Text>
          {!!chapter.period && <Text style={styles.chapterPeriodRefined}>{chapter.period}</Text>}
        </View>
      </View>
      {editing ? (
        <View style={styles.chapterNameActions}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="章に名前をつける"
            placeholderTextColor="#777"
            style={styles.settingInput}
          />
          <Pressable onPress={() => { onRename(chapter.id, title); setEditing(false); }} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>名前を残す</Text>
          </Pressable>
          <Pressable onPress={() => setEditing(false)}>
            <Text style={styles.proposalSkipName}>やめる</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => { setTitle(chapter.title || ""); setEditing(true); }}>
          <Text style={chapter.title ? styles.chapterCardTitle : styles.chapterCardTitleEmpty}>
            {chapter.title || "名前のない章 — 触れて名づける"}
          </Text>
        </Pressable>
      )}
      {!!chapter.observation && <Text style={styles.chapterEpigraph}>{chapter.observation}</Text>}
      <ThroughlineBlock data={chapter} />
      <EpisodeList episodes={chapter.episodes} />
      {past.length > 0 && (
        <Text style={styles.renameTrail}>かつて — {past.join(" → ")}</Text>
      )}
    </View>
  );
}

// Small roman numerals for chapter headings (I, II, …). Plenty for a life.
function toRoman(n) {
  if (!Number.isFinite(n) || n < 1) return "I";
  const map = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let result = "";
  let value = n;
  for (const [amount, symbol] of map) {
    while (value >= amount) {
      result += symbol;
      value -= amount;
    }
  }
  return result;
}

function MemoryScreen({ memories }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <PageTitle eyebrow="Nilo remembers" title="Niloの記憶" subtitle="日記とは別に、大事な場面だけを残します。" />
      {memories.length === 0 ? (
        <EmptyState title="まだ大事な場面はありません" body="夜の振り返りを終えると、その日の意味がここに灯ります。" />
      ) : memories.map((memory) => <MemoryCard key={memory.id} memory={memory} />)}
    </ScrollView>
  );
}

function MemoryCard({ memory }) {
  const showKept = Boolean(memory.keptPhrase) && memory.keptPhrase !== memory.essence;
  return (
    <View style={styles.memoryCard}>
      <View style={styles.memoryCardHead}>
        <Text style={styles.memoryDate}>{memory.dateLabel || formatDotDate(memory.dateKey)}</Text>
        {!!memory.moodLabel && <Text style={styles.memoryMood}>{memory.moodLabel}</Text>}
      </View>
      <Text style={styles.memoryEssence}>{memory.essence}</Text>
      {showKept && <Text style={styles.memoryKept}>「{memory.keptPhrase}」</Text>}
    </View>
  );
}

function PageTitle({ eyebrow, title, subtitle }) {
  return (
    <View style={styles.pageTitle}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.screenTitle}>{title}</Text>
      <Text style={styles.mutedText}>{subtitle}</Text>
    </View>
  );
}

function EmptyState({ title, body }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.mutedText}>{body}</Text>
    </View>
  );
}

function TabBar({ activeTab, setActiveTab, hidden, opacity, unlocks }) {
  // tabIn: the bar settles up into place once, as the night opens (prototype).
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [entrance]);
  const entranceTranslate = entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const composedOpacity = Animated.multiply(opacity, entrance);

  // Each tab's lift/scale animates in on every tab-button press.
  const tabAnim = useRef(tabs.map((tab) => new Animated.Value(tab.id === activeTab ? 1 : 0))).current;
  useEffect(() => {
    tabs.forEach((tab, index) => {
      const toValue = tab.id === activeTab ? 1 : 0;
      Animated.timing(tabAnim[index], {
        toValue,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
    });
  }, [activeTab, tabAnim]);

  return (
    <Animated.View
      pointerEvents={hidden ? "none" : "auto"}
      style={[styles.tabBar, { opacity: composedOpacity, transform: [{ translateY: entranceTranslate }] }]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(6,4,3,0)", "rgba(4,3,2,0.92)", "#000000"]}
        locations={[0, 0.28, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const isUnlocked = unlocks?.[tab.id] !== false;
        const tabLift = tabAnim[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -2]
        });
        const tabScale = tabAnim[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.98, 1.015]
        });
        return (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            focusable={false}
            style={({ pressed }) => [
              styles.tabItem,
              tab.id === "home" && styles.tabItemHome,
              isActive && tab.id === "home" && styles.tabItemHomeActive,
              !isUnlocked && styles.tabItemLocked,
              pressed && isUnlocked && styles.touchPressedSoft
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.tabItemMotion,
                {
                  transform: [{ translateY: tabLift }, { scale: tabScale }]
                }
              ]}
            >
              <TabIcon id={tab.id} active={isActive} locked={!isUnlocked} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive, !isUnlocked && styles.tabTextLocked]}>{tab.label}</Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

function TabIcon({ id, active, locked }) {
  const stroke = active ? "rgba(255,254,244,0.9)" : "rgba(246,239,228,0.62)";
  const fill = active ? "rgba(232,200,150,0.32)" : "rgba(246,239,228,0.12)";
  const common = {
    stroke,
    strokeWidth: 1.4,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none"
  };

  let glyph;
  if (id === "quests") {
    // 羅針盤 — the direction of an exploration
    glyph = (
      <>
        <Circle cx={12} cy={10.5} r={7.8} {...common} />
        <Path d="M15.6 6.9 L13.3 11.8 L8.4 14.1 L10.7 9.2 Z" {...common} fill={fill} />
        <Circle cx={12} cy={10.5} r={0.9} stroke="none" fill={stroke} />
      </>
    );
  } else if (id === "journal") {
    // 羽ペン — the act of writing itself
    glyph = (
      <>
        <Path d="M5.8 16.8 C7.2 11.9 10.6 7.2 18.4 4.9 C17.4 9.6 14 14.1 8.2 15.9" {...common} />
        <Path d="M6.8 15.8 C9.2 12 12.8 8.4 17 5.9" {...common} strokeWidth={1.1} />
        <Line x1={4.6} y1={19.4} x2={12.2} y2={19.4} {...common} />
      </>
    );
  } else if (id === "home") {
    // 灯 — the light of the night ritual
    glyph = (
      <>
        <Path
          d="M12 3.6 C13.7 5.9 14.9 7.7 14.9 9.5 C14.9 11.4 13.6 12.7 12 12.7 C10.4 12.7 9.1 11.4 9.1 9.5 C9.1 7.7 10.3 5.9 12 3.6 Z"
          {...common}
          fill={fill}
        />
        <Line x1={8.2} y1={15.6} x2={15.8} y2={15.6} {...common} />
        <Path d="M9 15.6 C9.2 17.2 10.4 18.1 12 18.1 C13.6 18.1 14.8 17.2 15 15.6" {...common} />
      </>
    );
  } else if (id === "story") {
    // 開いた本としおりの糸 — a life bound into one book
    glyph = (
      <>
        <Path d="M12 5.9 C10.1 4.5 7.7 4.1 4.8 4.3 V16.4 C7.7 16.2 10.1 16.7 12 18.1" {...common} />
        <Path d="M12 5.9 C13.9 4.5 16.3 4.1 19.2 4.3 V16.4 C16.3 16.2 13.9 16.7 12 18.1" {...common} />
        <Line x1={12} y1={5.9} x2={12} y2={18.1} {...common} strokeWidth={1.1} />
        <Path d="M12 18.1 C12 19.3 11.5 20.2 10.8 20.9" {...common} strokeWidth={1.1} />
      </>
    );
  } else {
    glyph = (
      <>
        <Circle cx={12} cy={10.5} r={7.6} {...common} />
        <Circle cx={12} cy={10.5} r={1.6} stroke="none" fill={stroke} />
        <Circle cx={17.4} cy={5.6} r={1.2} stroke="none" fill={stroke} />
      </>
    );
  }

  return (
    <View style={[styles.tabIconCanvas, locked && styles.tabIconLocked]}>
      <Svg width={24} height={22} viewBox="0 0 24 22">
        {glyph}
      </Svg>
    </View>
  );
}

function getQuestLabel(quest) {
  if (quest.source === "daily") return "Habit Quest";
  if (quest.source === "journal-daily") return "NR Quest";
  return "Life Quest";
}

function SettingsModal({
  visible,
  profile,
  setProfile,
  settings,
  setSettings,
  bgmTracks,
  activeBgmTrack,
  bgmStatus,
  journal,
  setJournal,
  quests,
  setQuests,
  memories,
  setMemories,
  chapters,
  setChapters,
  session,
  authLoading,
  authBusy,
  authError,
  redirectUri,
  initialTab,
  onGoogleSignIn,
  onSignOut,
  onPickProfileImage,
  onUiSound,
  onClose
}) {
  const [activeSettingsTab, setActiveSettingsTab] = useState("base");
  const [name, setName] = useState(profile.name);
  const [birthdate, setBirthdate] = useState(profile.birthdate);
  const [exportFormat, setExportFormat] = useState("json");
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [emergencyEmail, setEmergencyEmail] = useState("");
  const [heirEmail, setHeirEmail] = useState("");
  const [disclosureTarget, setDisclosureTarget] = useState("");
  const [disclosureDate, setDisclosureDate] = useState("");
  const [disclosureRecipient, setDisclosureRecipient] = useState("");
  const [inheritanceStatus, setInheritanceStatus] = useState("");
  const [notificationDraft, setNotificationDraft] = useState(null);
  const [windowStartDraft, setWindowStartDraft] = useState(null);
  const [windowEndDraft, setWindowEndDraft] = useState(null);

  // 開いた時だけでなく、ページ遷移(タブ切替)でも入場を静かに再生する。
  // RiseInのplayTokenはtruthinessとエフェクト依存にしか使われないため文字列で良い。
  const entranceToken = useEntrancePlay(visible);
  const pageToken = entranceToken ? `${entranceToken}:${activeSettingsTab}` : 0;

  useEffect(() => {
    if (visible) {
      setActiveSettingsTab(initialTab || "base");
    }
  }, [visible, initialTab]);

  useEffect(() => {
    setName(profile.name);
    setBirthdate(profile.birthdate);
  }, [profile.name, profile.birthdate]);

  function updateSettings(patch) {
    onUiSound?.();
    setSettings((current) => ({ ...current, ...patch }));
  }

  function updateBgmVolume(delta) {
    onUiSound?.();
    setSettings((current) => ({
      ...current,
      bgmVolume: Math.max(0, Math.min(1, Number((current.bgmVolume + delta).toFixed(2))))
    }));
  }

  function updateRitualSettings(patch) {
    onUiSound?.();
    setSettings((current) => ({
      ...current,
      ritual: { ...(current.ritual || {}), ...patch }
    }));
  }

  function updateReflectionSettings(patch) {
    onUiSound?.();
    setSettings((current) => ({
      ...current,
      reflection: { ...(current.reflection || {}), ...patch }
    }));
  }

  function updateSecurity(patch) {
    setSettings((current) => ({ ...current, security: { ...(current.security || {}), ...patch } }));
  }

  function updateInheritance(patch) {
    setSettings((current) => ({ ...current, inheritance: { ...(current.inheritance || {}), ...patch } }));
  }

  const displayName = name || profile.name || session?.user?.user_metadata?.name || session?.user?.email?.split("@")[0] || "あなた";
  const profileInitial = displayName.slice(0, 1).toUpperCase();
  const profileDay = daysSince(birthdate) || daysSince(profile.birthdate) || daysSince(arcStartDate) + 1;
  const completedQuestCount = quests.filter((quest) => quest.completed).length;
  const syncStatus = authLoading ? "確認中" : session ? "接続済み" : "未接続";
  const accountLabel = authLoading ? "確認中..." : session?.user?.email || "Googleアカウント未接続";
  const ritualConfig = settings.ritual || {};
  const reflectionConfig = settings.reflection || {};
  const securityConfig = settings.security || {};
  const inheritanceConfig = settings.inheritance || {};

  function commitClockValue(raw, fallback, apply) {
    const value = String(raw ?? "").trim();
    if (/^([01]?\d|2[0-3]):[0-5]\d$/.test(value)) {
      apply(value);
      return;
    }
    apply(fallback);
  }

  function confirmClearData(kind) {
    onUiSound?.();
    const actions = {
      journal: {
        title: "日記を削除しますか？",
        body: "保存された日記だけをこの端末から削除します。",
        run: () => setJournal([])
      },
      memories: {
        title: "記憶を削除しますか？",
        body: "保存された記憶と章をこの端末から削除します。",
        run: () => {
          setMemories([]);
          setChapters([]);
        }
      },
      quests: {
        title: "クエストをリセットしますか？",
        body: "現在のクエストを消して、デイリークエストを作り直します。",
        run: () => setQuests(createDailyQuests())
      },
      all: {
        title: "すべての記録を削除しますか？",
        body: "日記、クエスト、記憶、章をこの端末から削除します。この操作は元に戻せません。",
        run: () => {
          setJournal([]);
          setQuests(createDailyQuests());
          setMemories([]);
          setChapters([]);
        }
      }
    };
    const target = actions[kind];
    if (!target) return;
    confirmDialog(target.title, target.body, [
      { text: "キャンセル", style: "cancel" },
      { text: "削除", style: "destructive", onPress: target.run }
    ]);
  }

  async function runExport() {
    onUiSound?.();
    setExportStatus("書き出しています…");
    try {
      const isMarkdown = exportFormat === "markdown";
      const content = isMarkdown
        ? buildExportMarkdown({ journal, memories, chapters })
        : buildExportJson({ journal, memories, quests, chapters, profile, settings });
      const passphrase = exportPassphrase.trim();
      const dateKey = toDateKey(new Date());
      if (passphrase) {
        const encrypted = encryptExportPayload(content, passphrase);
        await saveTextFile(encrypted, `arc-archive-${dateKey}.encrypted.json`, "application/json");
        setExportStatus("暗号化して書き出しました。パスフレーズは大切に保管してください。");
      } else {
        await saveTextFile(
          content,
          `arc-archive-${dateKey}.${isMarkdown ? "md" : "json"}`,
          isMarkdown ? "text/markdown" : "application/json"
        );
        setExportStatus("記録を書き出しました。");
      }
      setExportPassphrase("");
    } catch {
      setExportStatus("うまく書き出せませんでした。もう一度お試しください。");
    }
  }

  function confirmDeleteAll() {
    onUiSound?.();
    confirmDialog(
      "アーカイブを削除しますか？",
      "この端末のすべての記録が消去されます。取り消せません。続ける前に書き出しをおすすめします。",
      [
        { text: "やめておく", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: () => confirmDialog("最終確認", "本当に削除しますか？", [
            { text: "やめておく", style: "cancel" },
            {
              text: "削除する",
              style: "destructive",
              onPress: () => {
                setJournal([]);
                setMemories([]);
                setQuests(createDailyQuests());
                setChapters([]);
              }
            }
          ])
        }
      ]
    );
  }

  async function issueRecoveryKey() {
    onUiSound?.();
    try {
      const key = await generateRecoveryKey();
      setRecoveryKey(key);
      updateSecurity({ recoveryKeyIssued: true, recoveryKeyIssuedAt: new Date().toISOString() });
      setRecoveryStatus("このキーを安全な場所に。画面を離れると、もう一度は表示できません。");
    } catch {
      setRecoveryStatus("キーを発行できませんでした。もう一度お試しください。");
    }
  }

  async function copyRecoveryKey() {
    if (!recoveryKey) return;
    try {
      await Clipboard.setStringAsync(recoveryKey);
      setRecoveryStatus("コピーしました。安全な場所に貼り付けてください。");
    } catch {
      setRecoveryStatus("コピーできませんでした。手で書き写してください。");
    }
  }

  function addEmergencyContact() {
    if (!isEmailLike(emergencyEmail)) {
      setRecoveryStatus("メールアドレスをご確認ください。");
      return;
    }
    updateSecurity({ emergencyContacts: [...(securityConfig.emergencyContacts || []), { id: createId("witness"), email: emergencyEmail.trim() }] });
    setEmergencyEmail("");
    setRecoveryStatus("緊急連絡先を追加しました。");
  }

  function removeEmergencyContact(id) {
    updateSecurity({ emergencyContacts: (securityConfig.emergencyContacts || []).filter((c) => c.id !== id) });
  }

  function addHeir() {
    if (!isEmailLike(heirEmail)) {
      setInheritanceStatus("メールアドレスをご確認ください。");
      return;
    }
    updateInheritance({ contacts: [...(inheritanceConfig.contacts || []), { id: createId("heir"), email: heirEmail.trim() }] });
    setHeirEmail("");
    setInheritanceStatus("継承先を追加しました。");
  }

  function removeHeir(id) {
    updateInheritance({ contacts: (inheritanceConfig.contacts || []).filter((c) => c.id !== id) });
  }

  function setDefaultAction(next) {
    if ((inheritanceConfig.defaultAction || "delete") === next) return;
    onUiSound?.();
    confirmDialog(
      "継承設定を変更しますか？",
      next === "delete" ? "未設定のまま「その日」を迎えた場合、アーカイブは完全に削除されます。" : "未設定のまま「その日」を迎えた場合、アーカイブは継承先へ移管されます。",
      [
        { text: "やめておく", style: "cancel" },
        {
          text: "変更する",
          onPress: () => {
            updateInheritance({ defaultAction: next });
            setInheritanceStatus("継承設定を変更しました。いつでも変えられます。");
          }
        }
      ]
    );
  }

  function addDisclosure() {
    if (!disclosureTarget.trim()) {
      setInheritanceStatus("公開する対象を入力してください。");
      return;
    }
    if (!isEmailLike(disclosureRecipient)) {
      setInheritanceStatus("受取人のメールアドレスをご確認ください。");
      return;
    }
    updateInheritance({
      reservedDisclosures: [...(inheritanceConfig.reservedDisclosures || []), {
        id: createId("disclosure"), target: disclosureTarget.trim(), recipient: disclosureRecipient.trim(), date: disclosureDate.trim()
      }]
    });
    setDisclosureTarget("");
    setDisclosureDate("");
    setDisclosureRecipient("");
    setInheritanceStatus("予約公開を追加しました。いつでも取り消せます。");
  }

  function removeDisclosure(id) {
    updateInheritance({ reservedDisclosures: (inheritanceConfig.reservedDisclosures || []).filter((d) => d.id !== id) });
  }

  function renderEntryRow(id, label, onRemove) {
    return (
      <View key={id} style={styles.entryRow}>
        <Text style={styles.entryRowText}>{label}</Text>
        <Pressable onPress={onRemove} style={({ pressed }) => [styles.entryRemove, pressed && styles.touchPressedTight]}>
          <Text style={styles.entryRemoveText}>×</Text>
        </Pressable>
      </View>
    );
  }

  function confirmSignOut() {
    confirmDialog("ログアウトしますか？", "このデバイスのログイン状態を解除します。記録データは端末内に残ります。", [
      { text: "キャンセル", style: "cancel" },
      { text: "ログアウト", style: "destructive", onPress: onSignOut }
    ]);
  }

  function renderSegmentedRow(options, activeValue, onSelect) {
    return (
      <View style={styles.segmentedRow}>
        {options.map(([value, label]) => (
          <Pressable
            key={String(value)}
            onPress={() => onSelect(value)}
            style={({ pressed }) => [styles.segmentButton, activeValue === value && styles.segmentButtonActive, pressed && styles.touchPressedTight]}
          >
            <Text style={[styles.segmentText, activeValue === value && styles.segmentTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <BackgroundTexture />
        <OuterGradient />
        <View style={styles.scrim} />
        <NightGrain />
        <FloatingOrbs />
        <View style={styles.modalHeader}>
          <Pressable focusable={false} onPress={onClose} style={({ pressed }) => [styles.modalBackButton, pressed && styles.touchPressedTight]}>
            <Text style={styles.modalBackText}>‹</Text>
          </Pressable>
          <View style={styles.modalTitleWrap}>
            <Text style={styles.modalSub}>SETTINGS</Text>
            <Text style={styles.modalTitle}>設定</Text>
          </View>
        </View>

        <View style={styles.settingsBody}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingSection}>
            {activeSettingsTab === "base" && (
              <SettingsBase
                settings={settings}
                session={session}
                authLoading={authLoading}
                updateSettings={updateSettings}
                playToken={pageToken}
                onSelect={(tab) => {
                  onUiSound?.();
                  setActiveSettingsTab(tab);
                }}
              />
            )}

            {activeSettingsTab !== "base" && (
            <RiseIn playToken={pageToken} index={0} distance={12} duration={480} style={styles.settingsDetailStack}>
              <Pressable
                onPress={() => {
                  onUiSound?.();
                  setActiveSettingsTab("base");
                }}
                style={styles.backToBase}
              >
                <Text style={styles.backToBaseText}>‹ 設定へ戻る</Text>
              </Pressable>

            {activeSettingsTab === "ownershipPolicy" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="privacy" title="所有権ポリシー" body="データはあなたのものです。ARCはそれを証明し、守ります。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.ownershipStatement}>このデータは、あなたのものです。</Text>
                  <Text style={styles.mutedText}>ARCはあなたの記録を販売・学習・広告に利用しません。あなたの記録は、あなただけのものです。このポリシーは設定のどこからでも確認できます。</Text>
                </View>
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>いつでも、持ち出せます</Text>
                  <Text style={styles.mutedText}>すべての記録は、意味が損なわれない形でいつでも書き出せます。ARCをやめる日が来ても、あなたの夜はあなたと一緒に出ていけます。</Text>
                </View>
              </View>
            )}

            {activeSettingsTab === "ownershipExport" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="data" title="データエクスポート" body="すべての記録を、構造化フォーマットで書き出します。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>フォーマット</Text>
                  {renderSegmentedRow([["json", "JSON"], ["markdown", "Markdown"]], exportFormat, setExportFormat)}
                  <Text style={styles.settingLabel}>暗号化（任意）</Text>
                  <TextInput
                    value={exportPassphrase}
                    onChangeText={setExportPassphrase}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="パスフレーズを設定するとAES-256で保護"
                    placeholderTextColor="rgba(190,180,162,0.38)"
                    style={styles.settingInput}
                  />
                  <Pressable onPress={runExport} style={({ pressed }) => [styles.secondaryButton, pressed && styles.touchPressedSoft]}>
                    <Text style={styles.secondaryButtonText}>記録を書き出す</Text>
                  </Pressable>
                  {!!exportStatus && <Text style={styles.mutedText}>{exportStatus}</Text>}
                </View>
              </View>
            )}

            {activeSettingsTab === "ownershipDelete" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="data" title="アーカイブの削除" body="端末内の記録を、選んで消去します。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>個別に整理</Text>
                  <Pressable onPress={() => confirmClearData("journal")} style={({ pressed }) => [styles.soundTrackRow, pressed && styles.touchPressedSubtle]}>
                    <Text style={styles.settingValue}>日記を削除</Text>
                    <Text style={styles.baseChevron}>›</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmClearData("memories")} style={({ pressed }) => [styles.soundTrackRow, pressed && styles.touchPressedSubtle]}>
                    <Text style={styles.settingValue}>記憶と章を削除</Text>
                    <Text style={styles.baseChevron}>›</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmClearData("quests")} style={({ pressed }) => [styles.soundTrackRow, pressed && styles.touchPressedSubtle]}>
                    <Text style={styles.settingValue}>クエストをリセット</Text>
                    <Text style={styles.baseChevron}>›</Text>
                  </Pressable>
                </View>
                <View style={styles.dangerCard}>
                  <GlassBackdrop intensity={20} />
                  <Text style={styles.settingLabel}>危険な操作</Text>
                  <Text style={styles.mutedText}>この端末のすべての記録を消去します。取り消せません。続ける前に書き出しをおすすめします。</Text>
                  <Pressable onPress={confirmDeleteAll} style={({ pressed }) => [styles.dangerButton, pressed && styles.touchPressedSoft]}>
                    <Text style={styles.dangerButtonText}>アーカイブを削除する</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {activeSettingsTab === "inheritanceContacts" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="policy" title="継承先の管理" body="いつか訪れる「その日」のために、静かに準備する場所。" />
                <Text style={styles.mutedText}>重要な設定です。落ち着いて操作できる時に行ってください。</Text>
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>継承先（信頼できる連絡先）</Text>
                  <TextInput
                    value={heirEmail}
                    onChangeText={setHeirEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="example@mail.com"
                    placeholderTextColor="rgba(190,180,162,0.38)"
                    style={styles.settingInput}
                  />
                  <Pressable onPress={addHeir} style={({ pressed }) => [styles.secondaryButton, pressed && styles.touchPressedSoft]}>
                    <Text style={styles.secondaryButtonText}>継承先を追加</Text>
                  </Pressable>
                  {(inheritanceConfig.contacts || []).length
                    ? (inheritanceConfig.contacts || []).map((c) => renderEntryRow(c.id, c.email, () => removeHeir(c.id)))
                    : <Text style={styles.mutedText}>継承先はまだ登録されていません。</Text>}
                  {!!inheritanceStatus && <Text style={styles.mutedText}>{inheritanceStatus}</Text>}
                </View>
              </View>
            )}

            {activeSettingsTab === "inheritanceDefault" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="policy" title="未設定時のデフォルト処理" body="継承の意思を残さなかった場合の、アーカイブの行き先。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>デフォルト処理</Text>
                  {renderSegmentedRow(
                    [["delete", "完全削除"], ["transfer", "継承先へ移管"]],
                    inheritanceConfig.defaultAction || "delete",
                    setDefaultAction
                  )}
                  <Text style={styles.mutedText}>継承先が本人確認（公証人証明）を提出し、サービス側の審査を経て移管されます。</Text>
                  {!!inheritanceStatus && <Text style={styles.mutedText}>{inheritanceStatus}</Text>}
                </View>
              </View>
            )}

            {activeSettingsTab === "inheritanceDisclosure" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="policy" title="アクセス権の予約公開" body="時間と相手を指定して、特定の章を段階的に公開します。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>予約公開</Text>
                  <Text style={styles.mutedText}>いつでも取り消せます。</Text>
                  <TextInput value={disclosureTarget} onChangeText={setDisclosureTarget} placeholder="公開対象（例：2024年の章 / 旅行タグ）" placeholderTextColor="rgba(190,180,162,0.38)" style={styles.settingInput} />
                  <TextInput value={disclosureDate} onChangeText={setDisclosureDate} placeholder="公開日（例：2030-05-01）" placeholderTextColor="rgba(190,180,162,0.38)" style={styles.settingInput} />
                  <TextInput value={disclosureRecipient} onChangeText={setDisclosureRecipient} autoCapitalize="none" keyboardType="email-address" placeholder="受取人のメール" placeholderTextColor="rgba(190,180,162,0.38)" style={styles.settingInput} />
                  <Pressable onPress={addDisclosure} style={({ pressed }) => [styles.secondaryButton, pressed && styles.touchPressedSoft]}>
                    <Text style={styles.secondaryButtonText}>予約公開を追加</Text>
                  </Pressable>
                  {(inheritanceConfig.reservedDisclosures || []).length
                    ? (inheritanceConfig.reservedDisclosures || []).map((d) => renderEntryRow(d.id, `${d.target} → ${d.recipient}（${d.date || "日付未定"}）`, () => removeDisclosure(d.id)))
                    : <Text style={styles.mutedText}>予約公開はまだありません。</Text>}
                  {!!inheritanceStatus && <Text style={styles.mutedText}>{inheritanceStatus}</Text>}
                </View>
              </View>
            )}

            {activeSettingsTab === "securityEncryption" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="privacy" title="暗号化ステータス" body="技術的な安全を、人間の言葉で届けます。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>🔒 あなた以外には読めない構造</Text>
                  <Text style={styles.mutedText}>記録の鍵はこの端末で生成・管理されます。ARCのサーバーでも、記録の内容は見えません。あなた以外には読めない形で守られています。</Text>
                </View>
                <SettingToggleRow
                  title="この場所を守る"
                  body="Face IDでロックします。"
                  value={securityConfig.lockEnabled !== false}
                  onPress={() => {
                    onUiSound?.();
                    updateSecurity({ lockEnabled: securityConfig.lockEnabled === false });
                  }}
                />
              </View>
            )}

            {activeSettingsTab === "securityRecovery" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="privacy" title="リカバリーキー" body="緊急時に記録を取り戻すための、24語の鍵。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>緊急時のリカバリー</Text>
                  <Text style={styles.mutedText}>リカバリーキー（24語）は、オフラインの安全な場所に保管してください。これを失うと記録を取り戻せません。</Text>
                  {securityConfig.recoveryKeyIssued && !recoveryKey && (
                    <Text style={styles.mutedText}>リカバリーキーは発行済みです。再発行すると、新しいキーに置き換わります。</Text>
                  )}
                  <Pressable onPress={issueRecoveryKey} style={({ pressed }) => [styles.secondaryButton, pressed && styles.touchPressedSoft]}>
                    <Text style={styles.secondaryButtonText}>{securityConfig.recoveryKeyIssued ? "リカバリーキーを再発行" : "リカバリーキーを発行"}</Text>
                  </Pressable>
                  {!!recoveryKey && <Text style={styles.recoveryKeyText}>{recoveryKey}</Text>}
                  {!!recoveryKey && (
                    <Pressable onPress={copyRecoveryKey} style={({ pressed }) => [styles.secondaryButton, pressed && styles.touchPressedSoft]}>
                      <Text style={styles.secondaryButtonText}>コピー</Text>
                    </Pressable>
                  )}
                  {!!recoveryStatus && <Text style={styles.mutedText}>{recoveryStatus}</Text>}
                </View>
              </View>
            )}

            {activeSettingsTab === "securityWitness" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="privacy" title="緊急連絡先（証人）" body="復旧の際、あなたの証人になってくれる人。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>緊急連絡先（証人）</Text>
                  <Text style={styles.mutedText}>復旧の際、事前登録した連絡先が証人になります。</Text>
                  <TextInput
                    value={emergencyEmail}
                    onChangeText={setEmergencyEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="trusted@mail.com"
                    placeholderTextColor="rgba(190,180,162,0.38)"
                    style={styles.settingInput}
                  />
                  <Pressable onPress={addEmergencyContact} style={({ pressed }) => [styles.secondaryButton, pressed && styles.touchPressedSoft]}>
                    <Text style={styles.secondaryButtonText}>緊急連絡先を追加</Text>
                  </Pressable>
                  {(securityConfig.emergencyContacts || []).length
                    ? (securityConfig.emergencyContacts || []).map((c) => renderEntryRow(c.id, c.email, () => removeEmergencyContact(c.id)))
                    : <Text style={styles.mutedText}>緊急連絡先はまだ登録されていません。</Text>}
                  <Text style={styles.mutedText}>リカバリーには72時間の審査期間があります。「あなたが本当にあなたである」ことを確かめるための時間です。</Text>
                  {!!recoveryStatus && <Text style={styles.mutedText}>{recoveryStatus}</Text>}
                </View>
              </View>
            )}

            {activeSettingsTab === "archiveStyle" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="feedback" title="Niloの対話スタイル" body="夜の対話での、Niloの寄り添い方。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>対話スタイル</Text>
                  {renderSegmentedRow(
                    [["empathetic", "共感型"], ["questioning", "問いかけ型"], ["organizing", "整理型"], ["silent", "沈黙型"]],
                    settings.niloStyle || "empathetic",
                    (value) => updateSettings({ niloStyle: value })
                  )}
                  <Text style={styles.mutedText}>{NILO_STYLE_HINTS[settings.niloStyle || "empathetic"]}</Text>
                </View>
              </View>
            )}

            {activeSettingsTab === "archiveFrequency" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="ritual" title="振り返り頻度" body="毎日から季節ごとまで、あなたのペースで。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>振り返り頻度</Text>
                  {renderSegmentedRow(
                    ["daily", "weekly", "monthly", "seasonal", "off"].map((freq) => [freq, REFLECTION_FREQUENCY_LABELS[freq]]),
                    reflectionConfig.frequency || "daily",
                    (value) => updateReflectionSettings({ frequency: value })
                  )}
                  <Text style={styles.mutedText}>毎日に縛られず、あなたのペースで。時間帯の制限はありません。オフにすると、いつでも書けます。</Text>
                </View>
              </View>
            )}

            {activeSettingsTab === "archiveSummary" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="ritual" title="要約スタイル" body="過去の自分と出会うときの、まとめ方。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>要約スタイル</Text>
                  {renderSegmentedRow(
                    [["narrative", "物語形式"], ["keyword", "キーワード形式"], ["timeline", "年表形式"]],
                    reflectionConfig.summaryStyle || "narrative",
                    (value) => updateReflectionSettings({ summaryStyle: value })
                  )}
                  <Text style={styles.mutedText}>振り返りで過去の自分と出会うときの、まとめ方です。</Text>
                </View>
                <SettingToggleRow
                  title="1年前と比べる"
                  body="価値観・感情・キーワードの変化を、そっと並べて見せます。"
                  value={reflectionConfig.compareLastYear !== false}
                  onPress={() => updateReflectionSettings({ compareLastYear: reflectionConfig.compareLastYear === false })}
                />
              </View>
            )}

            {activeSettingsTab === "archiveTone" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="notifications" title="通知のトーン" body="静かな促しか、積極的なリマインドか。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>通知のトーン</Text>
                  {renderSegmentedRow(
                    [["quiet", "静かな促し"], ["active", "積極的なリマインド"]],
                    reflectionConfig.tone || "quiet",
                    (value) => updateReflectionSettings({ tone: value })
                  )}
                  <Text style={styles.mutedText}>「いつでも来てください」か「待っています」か。促しの温度です。</Text>
                </View>
              </View>
            )}

            {activeSettingsTab === "bgm" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="sound" title="サウンド" body="流す曲と音量を選びます。" />
                <SettingToggleRow
                  title="BGM"
                  body="夜のサウンドトラックを流します。"
                  value={settings.bgmEnabled}
                  onPress={() => updateSettings({ bgmEnabled: !settings.bgmEnabled })}
                />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>現在のBGM</Text>
                  <Text style={styles.settingValue}>{activeBgmTrack.title}</Text>
                  <Text style={styles.mutedText}>{activeBgmTrack.subtitle}</Text>
                  <View style={styles.soundStatusRow}>
                    <Text style={styles.soundStatusText}>
                      {settings.bgmEnabled ? (bgmStatus?.playing ? "再生中" : "読み込み中") : "停止中"}
                    </Text>
                    <Text style={styles.soundStatusText}>{Math.round(settings.bgmVolume * 100)}%</Text>
                  </View>
                  <View style={styles.soundVolumeRow}>
                    <Pressable onPress={() => updateBgmVolume(-0.1)} style={({ pressed }) => [styles.soundStepButton, pressed && styles.touchPressedTight]}>
                      <Text style={styles.soundStepText}>−</Text>
                    </Pressable>
                    <View style={styles.soundVolumeTrack}>
                      <View style={[styles.soundVolumeFill, { width: `${Math.round(settings.bgmVolume * 100)}%` }]} />
                    </View>
                    <Pressable onPress={() => updateBgmVolume(0.1)} style={({ pressed }) => [styles.soundStepButton, pressed && styles.touchPressedTight]}>
                      <Text style={styles.soundStepText}>＋</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>サウンドトラック</Text>
                  {bgmTracks.map((track) => (
                    <Pressable
                      key={track.id}
                      onPress={() => updateSettings({ bgmTrackId: track.id, bgmEnabled: true })}
                      style={({ pressed }) => [styles.soundTrackRow, settings.bgmTrackId === track.id && styles.soundTrackRowActive, pressed && styles.touchPressedSubtle]}
                    >
                      <View>
                        <Text style={styles.settingValue}>{track.title}</Text>
                        <Text style={styles.mutedText}>{track.subtitle}</Text>
                      </View>
                      <Text style={styles.soundTrackMark}>{settings.bgmTrackId === track.id ? "ON" : "選択"}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {activeSettingsTab === "notifications" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="notifications" title="夜のささやき" body="そっと問いが灯る時刻を決めます。" />
                <SettingToggleRow
                  title="通知"
                  body="夜の記録の時間に知らせます。"
                  value={settings.notificationsEnabled}
                  onPress={() => updateSettings({ notificationsEnabled: !settings.notificationsEnabled })}
                />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>合図の時刻</Text>
                  {renderSegmentedRow(
                    [["21:00", "21:00"], ["22:00", "22:00"], ["23:00", "23:00"]],
                    settings.notificationTime,
                    (value) => {
                      setNotificationDraft(null);
                      updateSettings({ notificationTime: value });
                    }
                  )}
                  <Text style={styles.settingTimeCaption}>好きな時刻を直接入力することもできます</Text>
                  <TextInput
                    value={notificationDraft ?? settings.notificationTime}
                    onChangeText={setNotificationDraft}
                    onBlur={() => {
                      commitClockValue(notificationDraft ?? settings.notificationTime, settings.notificationTime, (value) => updateSettings({ notificationTime: value }));
                      setNotificationDraft(null);
                    }}
                    placeholder="22:00"
                    placeholderTextColor="rgba(190,180,162,0.38)"
                    style={[styles.settingInput, styles.settingTimeInput]}
                  />
                  <Text style={styles.mutedText}>時刻はこの端末に保存されます。アプリを開いている間、その日の記録がまだなら一度だけ灯ります。</Text>
                </View>
              </View>
            )}

            {activeSettingsTab === "ritual" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="ritual" title="夜の対話" body="質問の数と、終わり方を整えます。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>質問数</Text>
                  {renderSegmentedRow(
                    [[3, "3問"], [4, "4問"], [5, "5問"]],
                    ritualConfig.questionCount || 5,
                    (value) => updateRitualSettings({ questionCount: value })
                  )}
                  <Text style={styles.mutedText}>短く終えたい時は3問、深く残したい時は5問にできます。</Text>
                </View>
                <SettingToggleRow
                  title="終了後に日記へ保存"
                  body="OFFにすると、会話を閉じても日記・記憶・クエストを作りません。"
                  value={ritualConfig.autoSaveJournal !== false}
                  onPress={() => updateRitualSettings({ autoSaveJournal: ritualConfig.autoSaveJournal === false })}
                />
                <SettingToggleRow
                  title="途中退出の確認"
                  body="振り返り中に×を押したとき、確認を表示します。"
                  value={ritualConfig.confirmExit !== false}
                  onPress={() => updateRitualSettings({ confirmExit: ritualConfig.confirmExit === false })}
                />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>対話の時間帯</Text>
                  <Text style={styles.mutedText}>夜の対話が灯る時間帯です。日付をまたいでもかまいません。</Text>
                  <View style={styles.settingTimeRangeRow}>
                    <TextInput
                      value={windowStartDraft ?? (ritualConfig.windowStart || "20:00")}
                      onChangeText={setWindowStartDraft}
                      onBlur={() => {
                        commitClockValue(windowStartDraft ?? ritualConfig.windowStart, ritualConfig.windowStart || "20:00", (value) => updateRitualSettings({ windowStart: value }));
                        setWindowStartDraft(null);
                      }}
                      placeholder="20:00"
                      placeholderTextColor="rgba(190,180,162,0.38)"
                      style={[styles.settingInput, styles.settingTimeInput]}
                    />
                    <Text style={styles.settingTimeRangeTilde}>〜</Text>
                    <TextInput
                      value={windowEndDraft ?? (ritualConfig.windowEnd || "03:00")}
                      onChangeText={setWindowEndDraft}
                      onBlur={() => {
                        commitClockValue(windowEndDraft ?? ritualConfig.windowEnd, ritualConfig.windowEnd || "03:00", (value) => updateRitualSettings({ windowEnd: value }));
                        setWindowEndDraft(null);
                      }}
                      placeholder="03:00"
                      placeholderTextColor="rgba(190,180,162,0.38)"
                      style={[styles.settingInput, styles.settingTimeInput]}
                    />
                  </View>
                </View>
              </View>
            )}

            {activeSettingsTab === "language" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="language" title="書体と言語" body="読みやすい大きさと、使う言葉を選びます。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>書体の大きさ</Text>
                  {renderSegmentedRow(
                    [["small", "小"], ["standard", "標準"], ["large", "大"]],
                    settings.fontScale || "standard",
                    (value) => updateSettings({ fontScale: value })
                  )}
                  <Text style={styles.mutedText}>アプリ全体の文字の大きさが変わります。</Text>
                </View>
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>言語</Text>
                  {renderSegmentedRow(
                    [["ja", "日本語"], ["en", "English"], ["es", "Español"], ["zh", "中文"]],
                    settings.language || "ja",
                    (value) => updateSettings({ language: value })
                  )}
                  <Text style={styles.mutedText}>選んだ言語はこれから順次、表示に反映されます。</Text>
                </View>
              </View>
            )}

            {activeSettingsTab === "data" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="data" title="記録を書き出す" body="端末内に残る記録を確認・整理します。" />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>端末内データ</Text>
                  <View style={styles.syncSummaryRow}>
                    <BaseStat label="日記" value={`${journal.length}`} />
                    <BaseStat label="クエスト" value={`${quests.length}`} />
                    <BaseStat label="記憶" value={`${memories.length}`} />
                    <BaseStat label="章" value={`${chapters.length}`} />
                  </View>
                </View>
                <ArcSettingRow
                  title="データエクスポート"
                  body="JSON / Markdownで書き出す"
                  onPress={() => {
                    onUiSound?.();
                    setActiveSettingsTab("ownershipExport");
                  }}
                />
                <ArcSettingRow
                  title="アーカイブの削除"
                  body="端末内の記録を消去する"
                  onPress={() => {
                    onUiSound?.();
                    setActiveSettingsTab("ownershipDelete");
                  }}
                />
              </View>
            )}

            {activeSettingsTab === "profile" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="profile" title="プロフィール" body="Arcに表示するあなたの情報を整えます。" />
                <View style={styles.profileEditCard}>
                  <GlassBackdrop intensity={24} />
                  <View style={styles.profileEditTop}>
                    <Pressable onPress={onPickProfileImage} style={({ pressed }) => [styles.profileEditAvatar, pressed && styles.touchPressedTight]}>
                      {profile.imageUri ? (
                        <Image source={{ uri: profile.imageUri }} style={styles.baseAvatarImage} />
                      ) : (
                        <Text style={styles.profileEditAvatarText}>{profileInitial}</Text>
                      )}
                    </Pressable>
                    <View style={styles.profileEditCopy}>
                      <Text style={styles.settingLabel}>表示プロフィール</Text>
                      <Text style={styles.profileEditName}>{displayName}</Text>
                      <Text style={styles.mutedText}>{profileDay}日目の記録者</Text>
                    </View>
                  </View>
                  <Pressable onPress={onPickProfileImage} style={({ pressed }) => [styles.secondaryButton, pressed && styles.touchPressedSoft]}>
                    <Text style={styles.secondaryButtonText}>プロフィール画像を変更</Text>
                  </Pressable>
                </View>
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>基本情報</Text>
                  <TextInput value={name} onChangeText={setName} placeholder="名前" placeholderTextColor="rgba(190,180,162,0.38)" style={styles.settingInput} />
                  <TextInput value={birthdate} onChangeText={setBirthdate} placeholder="YYYY-MM-DD" placeholderTextColor="rgba(190,180,162,0.38)" style={styles.settingInput} />
                  <Text style={styles.mutedText}>生年月日または開始日から、Journey Dayを表示します。</Text>
                  <View style={styles.profileSaveRow}>
                    <Pressable
                      onPress={() => {
                        onUiSound?.();
                        setProfile((current) => ({ ...current, name, birthdate }));
                        setActiveSettingsTab("base");
                      }}
                      style={({ pressed }) => [styles.profileSaveButton, pressed && styles.touchPressedSoft]}
                    >
                      <Text style={styles.profileSaveButtonText}>プロフィールを保存</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.profileDataGrid}>
                  <BaseStat label="日記" value={`${journal.length}`} />
                  <BaseStat label="完了" value={`${completedQuestCount}`} />
                  <BaseStat label="記憶" value={`${memories.length}`} />
                </View>
              </View>
            )}

            {activeSettingsTab === "sync" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="sync" title="データ同期" body="アカウント接続と保存状態を確認します。" />
                <View style={styles.authCard}>
                  <GlassBackdrop intensity={24} />
                  <View style={styles.authCopy}>
                    <Text style={styles.settingLabel}>Googleアカウント</Text>
                    <Text style={styles.settingValue}>{accountLabel}</Text>
                    <Text style={styles.mutedText}>
                      接続すると、この端末の記録をあなたのアカウントに紐づける準備ができます。
                    </Text>
                  </View>
                  {session ? (
                    <View style={styles.syncStatusPill}>
                      <Text style={styles.syncStatusText}>{syncStatus}</Text>
                    </View>
                  ) : (
                    <Pressable disabled={authBusy} onPress={onGoogleSignIn} style={({ pressed }) => [styles.primaryButton, authBusy && styles.disabledButton, pressed && !authBusy && styles.touchPressedSoft]}>
                      <Text style={styles.primaryButtonText}>{authBusy ? "接続中..." : "Googleでログイン"}</Text>
                    </Pressable>
                  )}
                  {!!authError && <Text style={styles.errorText}>{authError}</Text>}
                </View>
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>同期対象</Text>
                  <View style={styles.syncSummaryRow}>
                    <BaseStat label="日記" value={`${journal.length}`} />
                    <BaseStat label="クエスト" value={`${quests.length}`} />
                    <BaseStat label="記憶" value={`${memories.length}`} />
                  </View>
                  <Text style={styles.mutedText}>現在は端末内保存をベースに、アカウント接続状態を先に整えています。</Text>
                </View>
                <View style={styles.redirectBox}>
                  <Text style={styles.settingLabel}>Redirect URI</Text>
                  <Text style={styles.redirectText}>{redirectUri}</Text>
                </View>
              </View>
            )}

            {activeSettingsTab === "logout" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="logout" title="ログアウト" body="このデバイスのログイン状態を解除します。" />
                <View style={styles.dangerCard}>
                  <GlassBackdrop intensity={20} />
                  <Text style={styles.settingLabel}>現在のアカウント</Text>
                  <Text style={styles.settingValue}>{accountLabel}</Text>
                  <Text style={styles.mutedText}>ログアウトしても、端末内に保存された記録は削除されません。</Text>
                  <Pressable
                    disabled={!session || authBusy}
                    onPress={confirmSignOut}
                    style={({ pressed }) => [styles.dangerButton, (!session || authBusy) && styles.disabledButton, pressed && session && !authBusy && styles.touchPressedSoft]}
                  >
                    <Text style={styles.dangerButtonText}>{authBusy ? "処理中..." : "ログアウト"}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {activeSettingsTab === "terms" && (
              <LegalPage
                icon="terms"
                title="ARC について"
                body="ARCを安心して使うための基本ルールです。"
                updatedAt="2026.06.06"
                sections={termsSections}
              />
            )}

            {activeSettingsTab === "privacyPolicy" && (
              <LegalPage
                icon="policy"
                title="プライバシーポリシー"
                body="ARCが扱うデータと、その使い方について。"
                updatedAt="2026.06.06"
                sections={privacyPolicySections}
              />
            )}
            </RiseIn>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function SettingsPageTitle({ icon, title, body }) {
  return (
    <View style={styles.settingsPageTitle}>
      <SettingsIcon id={icon} active />
      <View style={styles.settingsPageCopy}>
        <Text style={styles.settingsPageHeading}>{title}</Text>
        <Text style={styles.mutedText}>{body}</Text>
      </View>
    </View>
  );
}

function LegalPage({ icon, title, body, updatedAt, sections }) {
  return (
    <View style={styles.settingsPage}>
      <SettingsPageTitle icon={icon} title={title} body={body} />
      <View style={styles.legalNoticeCard}>
        <GlassBackdrop intensity={22} />
        <Text style={styles.settingLabel}>最終更新</Text>
        <Text style={styles.settingValue}>{updatedAt}</Text>
        <Text style={styles.mutedText}>
          この文面はアプリ内表示用のドラフトです。公開前には必要に応じて専門家の確認を行ってください。
        </Text>
      </View>
      {sections.map((section) => (
        <View key={section.title} style={styles.legalSectionCard}>
          <GlassBackdrop intensity={20} />
          <Text style={styles.legalSectionTitle}>{section.title}</Text>
          <Text style={styles.legalBody}>{section.body}</Text>
        </View>
      ))}
    </View>
  );
}

function BaseStat({ label, value }) {
  return (
    <View style={styles.baseStat}>
      <Text style={styles.baseStatValue}>{value}</Text>
      <Text style={styles.baseStatLabel}>{label}</Text>
    </View>
  );
}

function SettingsBase({
  settings,
  session,
  authLoading,
  onSelect,
  updateSettings,
  playToken = 0
}) {
  return (
    <View style={styles.simpleSettingsPage}>
      <ArcSettingGroup label="人生の所有権" index={0} playToken={playToken}>
        <ArcSettingRow
          title="所有権ポリシー"
          body="このデータは、あなたのものです"
          onPress={() => onSelect("ownershipPolicy")}
        />
        <ArcSettingRow
          title="データエクスポート"
          body="JSON / Markdownで書き出す"
          onPress={() => onSelect("ownershipExport")}
        />
        <ArcSettingRow
          title="アーカイブの削除"
          body="端末内の記録を消去する"
          onPress={() => onSelect("ownershipDelete")}
        />
      </ArcSettingGroup>

      <ArcSettingGroup label="未来への継承" index={1} playToken={playToken}>
        <ArcSettingRow
          title="継承先の管理"
          body="信頼できる連絡先を登録する"
          onPress={() => onSelect("inheritanceContacts")}
        />
        <ArcSettingRow
          title="未設定時のデフォルト処理"
          body="完全削除、または継承先へ移管"
          onPress={() => onSelect("inheritanceDefault")}
        />
        <ArcSettingRow
          title="アクセス権の予約公開"
          body="時間と相手を指定して公開する"
          onPress={() => onSelect("inheritanceDisclosure")}
        />
      </ArcSettingGroup>

      <ArcSettingGroup label="聖域のセキュリティ" index={2} playToken={playToken}>
        <ArcSettingRow
          title="暗号化ステータス"
          body="あなた以外には読めない構造"
          onPress={() => onSelect("securityEncryption")}
        />
        <ArcSettingRow
          title="リカバリーキー"
          body="緊急時の復旧手段"
          onPress={() => onSelect("securityRecovery")}
        />
        <ArcSettingRow
          title="緊急連絡先（証人）"
          body="復旧の際の証人を登録する"
          onPress={() => onSelect("securityWitness")}
        />
      </ArcSettingGroup>

      <ArcSettingGroup label="アーカイブの質" index={3} playToken={playToken}>
        <ArcSettingRow
          title="Niloの対話スタイル"
          body="寄り添い方のトーン"
          onPress={() => onSelect("archiveStyle")}
        />
        <ArcSettingRow
          title="振り返り頻度"
          body="毎日から季節ごとまで、あなたのペースで"
          onPress={() => onSelect("archiveFrequency")}
        />
        <ArcSettingRow
          title="要約スタイル"
          body="過去の自分と出会うときの、まとめ方"
          onPress={() => onSelect("archiveSummary")}
        />
        <ArcSettingRow
          title="通知のトーン"
          body="静かな促しか、積極的なリマインドか"
          onPress={() => onSelect("archiveTone")}
        />
      </ArcSettingGroup>

      <ArcSettingGroup label="アプリ設定" index={4} playToken={playToken}>
        <ArcSettingRow
          title="ニロの灯り"
          body="そばにいる、ひとつの光"
          toggle={!!settings.bgmEnabled}
          onPress={() => updateSettings({ bgmEnabled: !settings.bgmEnabled })}
        />
        <ArcSettingRow
          title="夜のささやき"
          body="そっと問いが灯る時刻"
          value={settings.notificationTime || "23:00"}
          onPress={() => onSelect("notifications")}
        />
        <ArcSettingRow
          title="夜の対話"
          body="質問の数と、終わり方"
          onPress={() => onSelect("ritual")}
        />
        <ArcSettingRow
          title="サウンド"
          body="曲の選択と音量"
          onPress={() => onSelect("bgm")}
        />
        <ArcSettingRow
          title="この場所を守る"
          body="Face IDでロックする"
          toggle={settings.security?.lockEnabled !== false}
          onPress={() => updateSettings({ security: { ...(settings.security || {}), lockEnabled: settings.security?.lockEnabled === false } })}
        />
        <ArcSettingRow
          title="書体の大きさ"
          value={{ small: "小", standard: "標準", large: "大" }[settings.fontScale || "standard"]}
          onPress={() => onSelect("language")}
        />
        <ArcSettingRow
          title="記録を書き出す"
          onPress={() => onSelect("data")}
        />
        <ArcSettingRow
          title="ARC について"
          onPress={() => onSelect("terms")}
        />
        <ArcSettingRow
          title="プライバシーポリシー"
          onPress={() => onSelect("privacyPolicy")}
        />
      </ArcSettingGroup>

      <ArcSettingGroup label="アカウント" index={5} playToken={playToken}>
        <ArcSettingRow
          title="プロフィール"
          body="名前と、始まりの日"
          onPress={() => onSelect("profile")}
        />
        <ArcSettingRow
          title="データ同期"
          body={authLoading ? "確認中" : session ? "接続済み" : "未接続"}
          onPress={() => onSelect("sync")}
        />
        {!!session && (
          <ArcSettingRow
            title="ログアウト"
            body="記録は端末に残ります"
            onPress={() => onSelect("logout")}
          />
        )}
      </ArcSettingGroup>

      <View style={styles.settingsWordmark}>
        <Text style={styles.settingsWordmarkText}>A R C</Text>
        <Text style={styles.settingsVersion}>VERSION 1.0 ・ 過ぎゆく日々に、消えない意味を。</Text>
      </View>
    </View>
  );

}

// ルート一覧のひとまとまり。ラベル+淡い面のカードで束ね、グループ単位で静かに入場する。
function ArcSettingGroup({ label, index = 0, playToken = 0, children }) {
  const items = React.Children.toArray(children);
  return (
    <RiseIn index={index} playToken={playToken} duration={500} style={styles.arcSettingGroup}>
      <Text style={styles.arcGroupLabel}>{label}</Text>
      <View style={styles.arcSettingGroupCard}>
        {items.map((child, i) => React.cloneElement(child, { last: i === items.length - 1 }))}
      </View>
    </RiseIn>
  );
}

function ArcSettingRow({ title, body, value, toggle, onPress, last = false }) {
  const hasToggle = typeof toggle === "boolean";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.arcSettingRow, last && styles.arcSettingRowLast, pressed && styles.touchPressedSubtle]}>
      <View style={styles.arcSettingCopy}>
        <Text style={styles.arcSettingTitle}>{title}</Text>
        {!!body && <Text style={styles.arcSettingBody}>{body}</Text>}
      </View>
      {hasToggle ? (
        <View style={[styles.arcSwitch, toggle && styles.arcSwitchOn]}>
          <View style={[styles.arcSwitchKnob, toggle && styles.arcSwitchKnobOn]} />
        </View>
      ) : (
        <View style={styles.arcSettingValueWrap}>
          {!!value && <Text style={styles.arcSettingValue}>{value}</Text>}
          <Text style={styles.arcSettingChevron}>›</Text>
        </View>
      )}
    </Pressable>
  );
}

function SettingsIcon({ id, active = false, locked = false }) {
  const lineStyle = [styles.settingsIconLine, active && styles.settingsIconLineActive, locked && styles.settingsIconLocked];
  const dotStyle = [styles.settingsIconDot, active && styles.settingsIconDotActive, locked && styles.settingsIconLocked];
  const boxStyle = [styles.settingsIconBox, active && styles.settingsIconBoxActive, locked && styles.settingsIconLocked];

  if (id === "settings") {
    return (
      <View style={styles.settingsIconCanvas}>
        <View style={[boxStyle, styles.settingsIconRing]} />
        <View style={[dotStyle, styles.settingsIconCenter]} />
        <View style={[lineStyle, styles.settingsIconTickA]} />
        <View style={[lineStyle, styles.settingsIconTickB]} />
      </View>
    );
  }

  if (id === "notifications") {
    return (
      <View style={styles.settingsIconCanvas}>
        <View style={[boxStyle, styles.settingsIconBell]} />
        <View style={[lineStyle, styles.settingsIconBellBase]} />
        <View style={[dotStyle, styles.settingsIconBellDot]} />
      </View>
    );
  }

  if (id === "sound") {
    return (
      <View style={styles.settingsIconCanvas}>
        <View style={[boxStyle, styles.settingsIconSpeaker]} />
        <View style={[lineStyle, styles.settingsIconWaveA]} />
        <View style={[lineStyle, styles.settingsIconWaveB]} />
      </View>
    );
  }

  if (id === "language") {
    return (
      <View style={styles.settingsIconCanvas}>
        <View style={[boxStyle, styles.settingsIconGlobe]} />
        <View style={[lineStyle, styles.settingsIconGlobeH]} />
        <View style={[lineStyle, styles.settingsIconGlobeV]} />
      </View>
    );
  }

  if (id === "profile") {
    return (
      <View style={styles.settingsIconCanvas}>
        <View style={[dotStyle, styles.settingsIconProfileHead]} />
        <View style={[boxStyle, styles.settingsIconProfileBody]} />
      </View>
    );
  }

  if (id === "sync") {
    return (
      <View style={styles.settingsIconCanvas}>
        <View style={[lineStyle, styles.settingsIconSyncTop]} />
        <View style={[lineStyle, styles.settingsIconSyncBottom]} />
        <View style={[dotStyle, styles.settingsIconSyncDotA]} />
        <View style={[dotStyle, styles.settingsIconSyncDotB]} />
      </View>
    );
  }

  if (id === "ritual") {
    return (
      <View style={styles.settingsIconCanvas}>
        <View style={[lineStyle, styles.settingsIconRitualA]} />
        <View style={[lineStyle, styles.settingsIconRitualB]} />
        <View style={[dotStyle, styles.settingsIconRitualDot]} />
      </View>
    );
  }

  if (id === "data") {
    return (
      <View style={styles.settingsIconCanvas}>
        <View style={[boxStyle, styles.settingsIconDataTop]} />
        <View style={[lineStyle, styles.settingsIconDataMid]} />
        <View style={[lineStyle, styles.settingsIconDataBase]} />
      </View>
    );
  }

  if (id === "privacy") {
    return (
      <View style={styles.settingsIconCanvas}>
        <View style={[boxStyle, styles.settingsIconShield]} />
        <View style={[lineStyle, styles.settingsIconShieldLine]} />
      </View>
    );
  }

  if (id === "logout") {
    return (
      <View style={styles.settingsIconCanvas}>
        <View style={[boxStyle, styles.settingsIconLogoutDoor]} />
        <View style={[lineStyle, styles.settingsIconLogoutArrow]} />
        <View style={[dotStyle, styles.settingsIconLogoutDot]} />
      </View>
    );
  }

  if (id === "feedback" || id === "contact") {
    return (
      <View style={styles.settingsIconCanvas}>
        <View style={[boxStyle, styles.settingsIconMessage]} />
        <View style={[lineStyle, styles.settingsIconMessageLine]} />
      </View>
    );
  }

  if (id === "policy") {
    // 封をした手紙: 継承やポリシーなど「託す約束」を表す。
    return (
      <View style={styles.settingsIconCanvas}>
        <View style={[boxStyle, styles.settingsIconPolicyBox]} />
        <View style={[lineStyle, styles.settingsIconPolicyFoldL]} />
        <View style={[lineStyle, styles.settingsIconPolicyFoldR]} />
        <View style={[dotStyle, styles.settingsIconPolicyDot]} />
      </View>
    );
  }

  return (
    <View style={styles.settingsIconCanvas}>
      <View style={[boxStyle, styles.settingsIconDocument]} />
      <View style={[lineStyle, styles.settingsIconDocumentLineA]} />
      <View style={[lineStyle, styles.settingsIconDocumentLineB]} />
    </View>
  );
}

function SettingToggleRow({ title, body, value, onPress }) {
  return (
    <View style={styles.settingsCard}>
      <GlassBackdrop intensity={24} />
      <View style={styles.toggleRow}>
        <View style={styles.toggleCopy}>
          <Text style={styles.settingValue}>{title}</Text>
          <Text style={styles.mutedText}>{body}</Text>
        </View>
        <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.touchPressedTight]}>
          <View style={[styles.arcSwitch, value && styles.arcSwitchOn]}>
            <View style={[styles.arcSwitchKnob, value && styles.arcSwitchKnobOn]} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function getQuestCategory(quest) {
  if (quest.category) return quest.category;
  if (quest.source === "journal-daily") return "記憶";
  if (quest.source === "daily") return "手放す";
  return "LIFE";
}

function getJournalTimelineEntries(journal) {
  if (!journal?.length) return demoJournalEntries;
  return [...journal]
    .sort((a, b) => String(b.dateKey || "").localeCompare(String(a.dateKey || "")))
    .map((entry, index) => ({
      id: entry.id || `journal-${index}`,
      dateKey: entry.dateKey,
      dateLabel: toJapaneseMonthDay(entry.dateKey) || entry.dateLabel || "今日",
      tag: index === 0 ? "TONIGHT" : entry.source === "quest" ? "QUEST" : "",
      title: entry.title || entry.summary || (entry.lines || []).join("。") || "静かな記録",
      lines: entry.title ? (entry.lines || []) : [],
      // Carry the conversational record through so a tapped entry can open into
      // its full detail (dialogue / emotions / a similar night).
      source: entry.source,
      questText: entry.questText,
      dialogue: entry.dialogue,
      emotions: entry.emotions,
      related: entry.related
    }));
}

// Chapters become full pages (1章＝1画面). Confirmed chapters from Nilo carry
// only period/observation/people/emotions — every richer element renders only
// when its data exists, so a sparse chapter stays quiet instead of empty.
function getChapterPages(chapters) {
  if (!chapters?.length) return [...demoChapters].reverse();
  const total = chapters.length;
  return chapters.map((chapter, index) => ({
    id: chapter.id || `chapter-${index}`,
    title: chapter.title || "名前のない章",
    ordinal: `第${toJapaneseNumber(total - index)}章`,
    period: chapter.period || "いま",
    summary: chapter.observation || chapter.summary || "過ぎた時間の輪郭が、少しずつ見えてくる。",
    current: index === 0,
    tint: chapter.tint || "rgba(214,168,106,0.10)",
    recordCount: chapter.recordCount || chapter.memoryIds?.length || 1,
    excerpts: chapter.excerpts || (chapter.episodes || []).slice(0, 3).map((episode) => ({
      date: episode.period || "",
      text: episode.observation || ""
    })).filter((item) => item.text),
    reunion: chapter.reunion,
    wish: chapter.wish,
    words: chapter.words || (chapter.emotions || []).map((emotion) => ({ text: String(emotion).replace(/^#/, ""), weight: 2 })),
    figures: chapter.figures || chapter.people || [],
    niloLetter: chapter.niloLetter || "",
    stats: chapter.stats
  })).reverse();
}

function toJapaneseMonthDay(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function toJapaneseNumber(value) {
  const labels = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  return labels[value] || String(value);
}

function createDailyQuests() {
  return dailyQuestPrompts.map((quest) => ({
    id: createId("daily"),
    source: "daily",
    completed: false,
    ...quest
  }));
}

function formatMonthLabel(month) {
  const [year, mon] = String(month).split("-");
  if (!year || !mon) return "いつかの章";
  return `${year}年${Number(mon)}月`;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(date);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getJournalDateKey(date = new Date()) {
  const target = new Date(date);
  if (target.getHours() < 3) target.setDate(target.getDate() - 1);
  return toDateKey(target);
}

function getJournalStreakDays(entries, date = new Date()) {
  const recorded = new Set((entries || []).map((entry) => entry.dateKey).filter(Boolean));
  let streak = 0;
  const cursor = new Date(`${getJournalDateKey(date)}T00:00:00`);

  while (recorded.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function isRitualWindow(date = new Date(), ritualSettings = {}) {
  const startMinutes = parseClockMinutes(ritualSettings.windowStart || "20:00", 20 * 60);
  const endMinutes = parseClockMinutes(ritualSettings.windowEnd || "03:00", 3 * 60);
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function parseClockMinutes(value, fallback) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return fallback;
  }
  return hour * 60 + minute;
}

function isNightWhisperDue(date = new Date(), notificationTime = "22:00") {
  const minutes = parseClockMinutes(notificationTime, 22 * 60);
  const scheduled = new Date(`${getJournalDateKey(date)}T00:00:00`);
  scheduled.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (minutes < 3 * 60) scheduled.setDate(scheduled.getDate() + 1);
  return date >= scheduled;
}

function shouldShowNightWhisper({ settings, journal, frequency, date = new Date() }) {
  if (!settings?.notificationsEnabled) return false;
  const journalDay = getJournalDateKey(date);
  if (settings.lastNotificationDateKey === journalDay) return false;
  if (isReflectionRecordedForPeriod(journal, frequency, date)) return false;
  return isNightWhisperDue(date, settings.notificationTime);
}

const REFLECTION_FREQUENCY_LABELS = {
  daily: "毎日",
  weekly: "毎週",
  monthly: "毎月",
  seasonal: "季節ごと",
  off: "オフ"
};

const REFLECTION_DONE_PROMPTS = {
  daily: "今日は記録済みです",
  weekly: "今週は記録済みです",
  monthly: "今月は記録済みです",
  seasonal: "今季は記録済みです"
};

const NILO_STYLE_HINTS = {
  empathetic: "「それは辛かったですね」と、感情に寄り添い受け止めます。",
  questioning: "「その決断の奥に、何があったと思いますか」と、静かに問いかけます。",
  organizing: "「3つのことが起きていたようです」と、論理的に整理します。",
  silent: "解釈はせず、記録を促す問いだけを置きます。"
};

function normalizeReflectionFrequency(value) {
  return REFLECTION_FREQUENCY_LABELS[value] ? value : "daily";
}

function dateFromDateKey(key) {
  const [year, month, day] = String(key || "").split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function isoWeekKey(date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  const week = 1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function seasonKey(date) {
  const month = date.getMonth();
  const season = month <= 1 || month === 11 ? "winter"
    : month <= 4 ? "spring"
    : month <= 7 ? "summer"
    : "autumn";
  const year = season === "winter" && month === 11 ? date.getFullYear() + 1 : date.getFullYear();
  return `${year}-${season}`;
}

// The "period" a reflection belongs to, given the user's chosen cadence.
// Recording one reflection fills the current period; the next opens when it rolls over.
function reflectionPeriodKey(frequency = "daily", date = new Date()) {
  const journalDay = getJournalDateKey(date);
  switch (normalizeReflectionFrequency(frequency)) {
    case "weekly": return `w:${isoWeekKey(dateFromDateKey(journalDay))}`;
    case "monthly": return `m:${journalDay.slice(0, 7)}`;
    case "seasonal": return `s:${seasonKey(dateFromDateKey(journalDay))}`;
    default: return `d:${journalDay}`;
  }
}

// "off" never locks the composer; otherwise a period is "done" once any journal
// entry falls within the current period.
function isReflectionRecordedForPeriod(journal, frequency, date = new Date()) {
  if (normalizeReflectionFrequency(frequency) === "off") return false;
  const currentKey = reflectionPeriodKey(frequency, date);
  return (journal || []).some((entry) => {
    const entryDate = dateFromDateKey(entry.dateKey || getJournalDateKey(date));
    return reflectionPeriodKey(frequency, entryDate) === currentKey;
  });
}

// ---- Account / sovereignty helpers ----

const RECOVERY_WORDLIST = ("river,stone,quiet,ember,maple,harbor,lantern,willow,meadow,cedar,pebble,thunder,velvet,orchid,copper,marble,silent,gather,anchor,beacon,canyon,drift,echo,feather,glimmer,hollow,ivory,jasmine,kindle,linen,mellow,nectar,opal,prairie,ripple,saffron,timber,umber,violet,whisper,amber,basil,clover,dahlia,elder,fennel,ginger,hazel,indigo,juniper,kelp,lotus,mint,nettle,olive,poppy,quince,rosemary,sage,thyme,verbena,yarrow,zinnia,brook,cliff,dawn,dusk,fern,grove,heath,isle,knoll,lake,moss,north,ocean,peak,reef,shore,tide,vale,wave,acorn,birch,cone,frost,glade,hush,leaf,nest,petal,root,seed,sprout,trail,bloom,cove,fjord,marsh").split(",");

async function generateRecoveryKey() {
  const bytes = await Crypto.getRandomBytesAsync(24);
  return Array.from(bytes).map((byte) => RECOVERY_WORDLIST[byte % RECOVERY_WORDLIST.length]).join(" ");
}

function buildExportJson({ journal, memories, quests, chapters, profile, settings }) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    app: "ARC",
    journal,
    memories,
    quests,
    chapters,
    profile,
    settings
  }, null, 2);
}

function buildExportMarkdown({ journal, memories, chapters }) {
  const lines = ["# ARC アーカイブ", "", `書き出し日時: ${new Date().toLocaleString("ja-JP")}`, "", "## 日記", ""];
  (journal || []).forEach((entry) => {
    lines.push(`### ${entry.dateLabel || entry.dateKey || ""}${entry.tag ? `  ·  ${entry.tag}` : ""}`);
    const body = entry.text || entry.summary || "";
    if (body) lines.push("", body);
    lines.push("");
  });
  if ((memories || []).length) {
    lines.push("## 記憶", "");
    memories.forEach((memory) => {
      lines.push(`- ${memory.dateLabel || memory.dateKey || ""}：${memory.essence || memory.keptPhrase || ""}`);
    });
    lines.push("");
  }
  if ((chapters || []).length) {
    lines.push("## 人生の章", "");
    chapters.forEach((chapter) => lines.push(`### ${chapter.title || "無題の章"}`, chapter.summary || "", ""));
  }
  return lines.join("\n");
}

// Real AES-256 (CBC) with a PBKDF2-derived key — runs in pure JS, so the file is
// genuinely encrypted on both web and native before it ever leaves the device.
function encryptExportPayload(plaintext, passphrase) {
  const salt = CryptoJS.lib.WordArray.random(128 / 8);
  const key = CryptoJS.PBKDF2(passphrase, salt, { keySize: 256 / 32, iterations: 150000 });
  const iv = CryptoJS.lib.WordArray.random(128 / 8);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv });
  return JSON.stringify({
    format: "arc-encrypted-export",
    algorithm: "AES-256-CBC",
    kdf: "PBKDF2-SHA256",
    iterations: 150000,
    salt: salt.toString(CryptoJS.enc.Hex),
    iv: iv.toString(CryptoJS.enc.Hex),
    ciphertext: encrypted.ciphertext.toString(CryptoJS.enc.Base64)
  }, null, 2);
}

async function saveTextFile(content, filename, mimeType) {
  if (Platform.OS === "web") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new FileSystem.File(FileSystem.Paths.cache, filename);
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
  }
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

// react-native-web の Alert.alert は何もしないため、web では window.confirm /
// window.alert に振り分ける。actions は Alert.alert と同じ配列形式。
function confirmDialog(title, body, actions) {
  if (Platform.OS === "web") {
    const primary =
      actions.find((action) => action.style === "destructive") ||
      actions.find((action) => action.style !== "cancel");
    if (actions.length <= 1) {
      window.alert(`${title}\n\n${body}`);
      primary?.onPress?.();
      return;
    }
    if (window.confirm(`${title}\n\n${body}`)) {
      primary?.onPress?.();
    }
    return;
  }
  Alert.alert(title, body, actions);
}

function getJournalCalendarDays(date = new Date()) {
  const base = new Date(`${getJournalDateKey(date)}T00:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(base);
    day.setDate(base.getDate() - 3 + index);
    return {
      key: toDateKey(day),
      weekday: new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(day),
      day: String(day.getDate())
    };
  });
}

function formatDotDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

// The passage of time on an exploration, spoken as thickness — never progress.
function formatQuestSince(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}月${date.getDate()}日から`;
}

function formatQuestDuration(dateKey, now = new Date()) {
  const start = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "";
  const days = Math.max(0, Math.floor((now - start) / 86400000));
  if (days < 7) return "はじまったばかり";
  if (days < 60) return `${Math.floor(days / 7)}週間`;
  if (days < 365) return `${Math.floor(days / 30)}ヶ月`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return months ? `${years}年${months}ヶ月` : `${years}年`;
}

// A night touches an exploration when the theme's keywords surface in the
// user's own words. Keywords come from Nilo's proposal; the theme text itself
// is the fallback source.
function questMatchesText(exploration, text) {
  const hay = String(text || "");
  if (!hay) return false;
  const keys = (exploration.keywords && exploration.keywords.length)
    ? exploration.keywords
    : String(exploration.theme || "").split(/[、。,\s「」]/).filter((part) => part.length >= 2);
  return keys.some((key) => key && hay.includes(key));
}

function languageLabel(value) {
  const labels = {
    ja: "日本語",
    en: "English",
    es: "Español",
    zh: "中文"
  };
  return labels[value] || value;
}

function privacySummary(privacy) {
  const enabled = [
    privacy.questLink && "クエスト生成",
    privacy.memoryLink && "記憶候補",
    privacy.profileUse && "プロフィール反映"
  ].filter(Boolean);
  return enabled.length ? enabled.join(" / ") : "すべてオフ";
}

function daysSince(value) {
  if (!value) return null;
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  const start = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate());
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((current - start) / 86400000));
}

const baseStyleDefs = ({
  background: {
    flex: 1,
    backgroundColor: "#03050b"
  },
  backgroundTexture: {
    ...StyleSheet.absoluteFillObject,
    height: "100%",
    opacity: 0.92,
    width: "100%"
  },
  floatingOrbLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden"
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,5,11,0.18)"
  },
  outerGradient: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden"
  },
  lowerGlowBase: {
    bottom: 0,
    height: "44%",
    left: 0,
    position: "absolute",
    right: 0
  },
  lowerGlowPool: {
    bottom: -96,
    height: 320,
    left: "-12%",
    opacity: 0.72,
    position: "absolute",
    right: "-12%"
  },
  nightGrain: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.055
  },
  deepNightGrain: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.055
  },
  niloLightWrap: {
    alignItems: "center",
    height: 180,
    justifyContent: "center",
    width: 180
  },
  niloLightHalo: {
    borderRadius: 90,
    height: 180,
    overflow: "hidden",
    position: "absolute",
    width: 180
  },
  niloLightGlowMid: {
    borderRadius: 50,
    height: 100,
    overflow: "hidden",
    position: "absolute",
    width: 100
  },
  niloLightGlowInner: {
    borderRadius: 23,
    height: 46,
    overflow: "hidden",
    position: "absolute",
    width: 46
  },
  niloLightCore: {
    borderRadius: 4,
    height: 8,
    overflow: "hidden",
    shadowColor: "#f4fbff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    width: 8
  },
  niloLightFill: {
    ...StyleSheet.absoluteFillObject
  },
  safe: {
    flex: 1
  },
  app: {
    flex: 1
  },
  touchPressedSubtle: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }]
  },
  touchPressedSoft: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }]
  },
  touchPressedTight: {
    opacity: 0.88,
    transform: [{ scale: 0.94 }]
  },
  keyboardArea: {
    flex: 1
  },
  keyboardAreaContent: {
    flex: 1
  },
  composerAvoider: {
    bottom: 74,
    left: 0,
    position: "absolute",
    right: 0
  },
  composerAvoiderFocused: {
    bottom: 0
  },
  ritualTapZone: {
    bottom: 0,
    height: "50%",
    left: 0,
    position: "absolute",
    right: 0
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10
  },
  brand: {
    color: "#f6efe4",
    fontFamily: fontSerifEnLight,
    fontSize: 38,
    fontWeight: "300",
    letterSpacing: 1.5
  },
  brandSub: {
    color: "rgba(246,239,228,0.6)",
    fontSize: 12,
    letterSpacing: 0.6,
    marginTop: 2
  },
  accountButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,254,244,0.08)",
    borderColor: "rgba(255,254,244,0.22)",
    borderRadius: 999,
    borderWidth: 1.5,
    height: 44,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#ffffff",
    shadowOffset: { width: -7, height: -9 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    width: 44
  },
  accountButtonImage: {
    height: "100%",
    width: "100%"
  },
  accountButtonInitial: {
    color: "#fbfbfb",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 17,
    fontWeight: "700"
  },
  accountButtonStatus: {
    backgroundColor: "rgba(160,160,160,0.85)",
    borderColor: "#03050b",
    borderRadius: 999,
    borderWidth: 2,
    bottom: 1,
    height: 12,
    position: "absolute",
    right: 1,
    width: 12
  },
  accountButtonStatusConnected: {
    backgroundColor: "#d9b36a"
  },
  symbolButtonText: {
    color: "#f6efe4",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22
  },
  gateScreen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24
  },
  gateScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 34
  },
  gateBrand: {
    alignItems: "center",
    marginBottom: 28
  },
  gateLogo: {
    color: "#f6efe4",
    fontFamily: fontSerifEnLight,
    fontSize: 56,
    fontWeight: "300",
    letterSpacing: 2
  },
  gateSlogan: {
    color: "rgba(246,239,228,0.7)",
    fontSize: 13,
    marginTop: 8
  },
  gateCard: {
    backgroundColor: "rgba(255,254,244,0.095)",
    borderColor: "rgba(255,254,244,0.22)",
    borderRadius: 26,
    borderWidth: 1,
    gap: 12,
    padding: 20,
    shadowColor: "#fff7df",
    shadowOpacity: 0.12,
    shadowRadius: 34,
    shadowOffset: { width: -10, height: -14 }
  },
  gateEyebrow: {
    color: "#d9b36a",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  gateTitle: {
    color: "#f6efe4",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 26,
    fontWeight: "700"
  },
  gateBody: {
    color: "#c2bbb0",
    fontSize: 14,
    lineHeight: 22
  },
  gateButton: {
    alignItems: "center",
    backgroundColor: "rgba(217,179,106,0.94)",
    borderRadius: 999,
    justifyContent: "center",
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: 18
  },
  gateButtonText: {
    color: "#10131a",
    fontSize: 14,
    fontWeight: "800"
  },
  gateGhostButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,254,244,0.035)",
    borderColor: "rgba(255,254,244,0.13)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 16
  },
  gateGhostText: {
    color: "#f6efe4",
    fontSize: 13,
    fontWeight: "700"
  },
  gateDivider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginVertical: 2
  },
  gateDividerLine: {
    backgroundColor: "rgba(234,204,145,0.18)",
    flex: 1,
    height: 1
  },
  gateDividerText: {
    color: "rgba(246,239,228,0.52)",
    fontSize: 11,
    fontWeight: "700"
  },
  gateInput: {
    backgroundColor: "rgba(255,254,244,0.055)",
    borderColor: "rgba(255,254,244,0.14)",
    borderRadius: 12,
    borderWidth: 1,
    color: "#f6efe4",
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 14
  },
  gateHint: {
    color: "#d9b36a",
    fontSize: 12,
    fontWeight: "700"
  },
  gateOtpLead: {
    color: "#c2bbb0",
    fontSize: 12,
    lineHeight: 18
  },
  gateTextButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30
  },
  gateTextButtonText: {
    color: "rgba(217,179,106,0.86)",
    fontSize: 12,
    fontWeight: "700"
  },
  content: {
    flex: 1
  },
  pageRail: {
    alignItems: "stretch"
  },
  pageFrame: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 18
  },
  homeReflectionScreen: {
    flex: 1,
    justifyContent: "flex-start",
    paddingBottom: 118,
    paddingHorizontal: 20,
    paddingTop: 44
  },
  reflectionTapArea: {
    flex: 0,
    justifyContent: "flex-start"
  },
  ritualInputShield: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20
  },
  niloStage: {
    marginBottom: 6,
    overflow: "visible",
    paddingHorizontal: 8,
    paddingVertical: 0
  },
  niloStageCompact: {
    marginBottom: 0
  },
  niloStageCopy: {
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingTop: 4
  },
  niloStageCopyCompact: {
    gap: 2,
    paddingTop: 0
  },
  niloStageEyebrow: {
    color: "#d9b36a",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 2,
    textTransform: "uppercase"
  },
  niloStageEyebrowCompact: {
    marginTop: 0
  },
  niloThinkingText: {
    color: "rgba(217,179,106,0.78)",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 4,
    marginTop: 8
  },
  niloStageTitle: {
    color: "#f6efe4",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26
  },
  niloSealMark: {
    color: "rgba(217,179,106,0.82)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: "center"
  },
  niloStageQuestion: {
    color: "rgba(246,239,228,0.94)",
    fontFamily: fontSerifJa,
    fontSize: 23,
    fontWeight: "300",
    letterSpacing: 0.8,
    lineHeight: 36,
    marginTop: 10,
    textAlign: "center"
  },
  niloStageQuestionCompact: {
    fontSize: 21,
    letterSpacing: 0.6,
    lineHeight: 32,
    marginTop: 6
  },
  answerPreview: {
    alignSelf: "center",
    borderColor: "rgba(255,254,244,0.12)",
    borderTopWidth: 1,
    marginTop: 18,
    maxWidth: "86%",
    paddingTop: 12
  },
  answerPreviewCompact: {
    marginTop: 10,
    paddingTop: 9
  },
  answerPreviewMark: {
    color: "rgba(217,179,106,0.72)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 5,
    textAlign: "center"
  },
  answerPreviewText: {
    color: "rgba(255,254,244,0.78)",
    fontFamily: fontSerifJa,
    fontSize: 18,
    fontWeight: "300",
    letterSpacing: 1.4,
    lineHeight: 28,
    textAlign: "center"
  },
  niloStageText: {
    color: "#c2bbb0",
    fontSize: 12,
    lineHeight: 18
  },
  firstRunCard: {
    backgroundColor: "rgba(255,254,244,0.085)",
    borderColor: "rgba(255,254,244,0.2)",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    padding: 14
  },
  firstRunMark: {
    alignItems: "center",
    backgroundColor: "rgba(255,254,244,0.06)",
    borderColor: "rgba(255,254,244,0.16)",
    borderRadius: 12,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  firstRunMarkText: {
    color: "#f0bd76",
    fontSize: 18,
    lineHeight: 20
  },
  firstRunCopy: {
    flex: 1,
    gap: 4
  },
  firstRunTitle: {
    color: "#f6efe4",
    fontSize: 15,
    fontWeight: "800"
  },
  firstRunBody: {
    color: "#c2bbb0",
    fontSize: 12,
    lineHeight: 18
  },
  firstRunHint: {
    color: "rgba(217,179,106,0.78)",
    fontSize: 11,
    lineHeight: 16
  },
  firstRunButton: {
    alignSelf: "center",
    backgroundColor: "rgba(217,179,106,0.92)",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12
  },
  firstRunButtonText: {
    color: "#10131a",
    fontSize: 12,
    fontWeight: "800"
  },
  ritualCard: {
    gap: 18,
    marginBottom: 18,
    paddingVertical: 4
  },
  eyebrow: {
    color: "#d9b36a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  inputCard: {
    backgroundColor: "rgba(255,254,244,0.085)",
    borderColor: "rgba(255,254,244,0.2)",
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14
  },
  input: {
    color: "#f6efe4",
    fontSize: 16,
    minHeight: 74,
    textAlignVertical: "top"
  },
  inputFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8
  },
  ritualButtonWrap: {
    marginHorizontal: 78,
    paddingBottom: 78
  },
  ritualStartButton: {
    alignItems: "center",
    backgroundColor: "rgba(12,10,12,0.88)",
    borderColor: "rgba(217,179,106,0.28)",
    borderTopColor: "rgba(240,209,138,0.32)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 54,
    overflow: "hidden",
    paddingHorizontal: 19,
    paddingVertical: 8,
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.26,
    shadowRadius: 18
  },
  ritualButtonGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.82
  },
  ritualButtonMatte: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,5,11,0.18)",
    position: "absolute",
  },
  ritualStartButtonPressed: {
    transform: [{ scale: 0.97 }]
  },
  ritualStartButtonDisabled: {
    backgroundColor: "rgba(12,10,12,0.74)",
    borderColor: "rgba(217,179,106,0.1)",
    opacity: 0.46,
    shadowOpacity: 0
  },
  ritualStartIcon: {
    color: "#f1cc79",
    fontSize: 14,
    marginRight: 10,
    textShadowColor: "rgba(217,179,106,0.22)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8
  },
  ritualStartCopy: {
    alignItems: "center",
    zIndex: 1
  },
  ritualStartText: {
    color: "#fff4dc",
    fontFamily: Platform.select({ ios: "Didot", android: "serif", default: "serif" }),
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  ritualStreakText: {
    color: "rgba(240,209,138,0.74)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginTop: 2
  },
  ritualStartTextDisabled: {
    color: "rgba(255,254,244,0.72)"
  },
  composer: {
    marginHorizontal: 28,
    paddingBottom: 8,
    position: "relative"
  },
  composerFocused: {
    paddingBottom: 10
  },
  ritualExitButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,254,244,0.075)",
    borderColor: "rgba(255,254,244,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 2,
    top: -34,
    width: 28,
    zIndex: 4
  },
  ritualExitText: {
    color: "rgba(255,254,244,0.78)",
    fontFamily: Platform.select({ ios: "Avenir Next", android: "sans-serif", default: "sans-serif" }),
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 22
  },
  composerLine: {
    alignItems: "center",
    backgroundColor: "rgba(255,254,244,0.115)",
    borderColor: "rgba(255,254,244,0.24)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 48,
    paddingHorizontal: 16,
    shadowColor: "#fff7df",
    shadowOpacity: 0.13,
    shadowRadius: 28,
    shadowOffset: { width: -8, height: -10 }
  },
  composerSparkle: {
    color: "rgba(255,254,244,0.84)",
    fontSize: 17,
    marginRight: 11
  },
  composerInputWrap: {
    flex: 1,
    height: 28,
    justifyContent: "center"
  },
  composerInput: {
    color: "#FFFEF4",
    fontSize: 16,
    height: 28,
    lineHeight: 20,
    padding: 0
  },
  composerPlaceholderRow: {
    alignItems: "center",
    flexDirection: "row",
    left: 0,
    position: "absolute"
  },
  composerPlaceholder: {
    color: "rgba(255,254,244,0.48)",
    fontSize: 16,
    lineHeight: 20
  },
  composerCursor: {
    backgroundColor: "#FFFEF4",
    borderRadius: 999,
    height: 20,
    marginLeft: 7,
    width: 1.5
  },
  counter: {
    color: "rgba(255,254,244,0.46)",
    fontSize: 12,
    marginLeft: 12,
    minWidth: 34,
    textAlign: "right"
  },
  counterNear: {
    color: "rgba(217,179,106,0.92)"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(236,190,128,0.9)",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 18,
    shadowColor: "#d9a86c",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 14
  },
  disabledButton: {
    opacity: 0.46
  },
  primaryButtonText: {
    color: "#2a1d10",
    fontFamily: fontSerifJa,
    fontSize: 14,
    letterSpacing: 0.7
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(217,168,108,0.07)",
    borderColor: "rgba(217,168,108,0.24)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 18
  },
  secondaryButtonText: {
    color: "rgba(228,184,124,0.9)",
    fontFamily: fontSerifJa,
    fontSize: 14,
    letterSpacing: 0.7
  },
  panel: {
    backgroundColor: "rgba(255,254,244,0.075)",
    borderColor: "rgba(255,254,244,0.18)",
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    padding: 16,
    shadowColor: "#fff7df",
    shadowOffset: { width: -7, height: -9 },
    shadowOpacity: 0.08,
    shadowRadius: 24
  },
  memoryCard: {
    backgroundColor: "rgba(255,254,244,0.06)",
    borderColor: "rgba(217,179,106,0.28)",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    marginBottom: 12,
    padding: 20
  },
  memoryCardHead: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  memoryDate: {
    color: "#d9b36a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1
  },
  memoryMood: {
    color: "#c2bbb0",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5
  },
  memoryEssence: {
    color: "#f6efe4",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 19,
    fontWeight: "600",
    lineHeight: 28
  },
  memoryKept: {
    color: "#9d978c",
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 20
  },
  chapterButton: {
    alignItems: "center",
    backgroundColor: "rgba(217,179,106,0.16)",
    borderColor: "rgba(217,179,106,0.4)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 16,
    paddingHorizontal: 18,
    paddingVertical: 13
  },
  chapterButtonPressed: {
    backgroundColor: "rgba(217,179,106,0.26)"
  },
  chapterButtonIcon: {
    color: "#d9b36a",
    fontSize: 14
  },
  chapterButtonText: {
    color: "#f6efe4",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  chapterCard: {
    backgroundColor: "rgba(255,254,244,0.035)",
    borderRadius: 24,
    gap: 16,
    marginBottom: 16,
    paddingHorizontal: 24,
    paddingVertical: 26
  },
  chapterMark: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 15
  },
  chapterRoman: {
    color: "#d9b36a",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 42,
    lineHeight: 40
  },
  chapterMarkCol: {
    gap: 3,
    paddingTop: 5
  },
  chapterEyebrowLabel: {
    color: "#d9b36a",
    fontSize: 10,
    letterSpacing: 3
  },
  chapterPeriodRefined: {
    color: "#8f9bb0",
    fontSize: 11,
    letterSpacing: 1.5
  },
  chapterEpigraph: {
    color: "#b3ada2",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 15,
    fontStyle: "italic",
    lineHeight: 26
  },
  ruleGold: {
    backgroundColor: "rgba(217,179,106,0.22)",
    height: 1
  },
  proposalPeriod: {
    color: "rgba(217,179,106,0.85)",
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 7
  },
  chapterAccent: {
    backgroundColor: "rgba(217,179,106,0.5)",
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 3
  },
  chapterEyebrowRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chapterOrdinal: {
    color: "#d9b36a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5
  },
  chapterDot: {
    color: "rgba(217,179,106,0.55)",
    fontSize: 11
  },
  chapterPeriod: {
    color: "#d9b36a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5
  },
  chapterCardTitle: {
    color: "#f6efe4",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 27,
    lineHeight: 35
  },
  chapterSummary: {
    color: "#c2bbb0",
    fontSize: 14,
    lineHeight: 22
  },
  chapterFooter: {
    alignItems: "center",
    borderTopColor: "rgba(255,254,244,0.1)",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 7,
    marginTop: 2,
    paddingTop: 13
  },
  chapterCountDot: {
    backgroundColor: "#d9b36a",
    borderRadius: 2,
    height: 4,
    width: 4
  },
  chapterCount: {
    color: "rgba(246,239,228,0.5)",
    fontSize: 11,
    letterSpacing: 0.5
  },
  chapterCardTitleEmpty: {
    color: "rgba(246,239,228,0.45)",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 20,
    fontStyle: "italic",
    lineHeight: 28
  },
  chapterNameActions: {
    gap: 8
  },
  renameTrail: {
    color: "#857e73",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4
  },
  inProgressPanel: {
    backgroundColor: "rgba(255,254,244,0.04)",
    borderColor: "rgba(255,254,244,0.12)",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16
  },
  inProgressText: {
    color: "#9d978c",
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 21
  },
  proposalCard: {
    backgroundColor: "rgba(217,179,106,0.07)",
    borderColor: "rgba(217,179,106,0.32)",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    marginBottom: 12,
    padding: 20
  },
  proposalEyebrow: {
    color: "#d9b36a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5
  },
  proposalObservation: {
    color: "#f6efe4",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 18,
    lineHeight: 27
  },
  proposalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2
  },
  proposalAccept: {
    backgroundColor: "rgba(217,179,106,0.18)",
    borderColor: "rgba(217,179,106,0.45)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 9
  },
  proposalAcceptText: {
    color: "#f6efe4",
    fontSize: 13,
    fontWeight: "700"
  },
  proposalGhost: {
    borderColor: "rgba(255,254,244,0.18)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9
  },
  proposalGhostText: {
    color: "#c2bbb0",
    fontSize: 13
  },
  proposalNameRow: {
    gap: 8,
    marginTop: 2
  },
  proposalSkipName: {
    color: "#9d978c",
    fontSize: 12,
    paddingVertical: 6,
    textAlign: "center"
  },
  throughline: {
    gap: 10,
    marginTop: 2
  },
  throughlineRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 14
  },
  throughlineLabel: {
    color: "#9d978c",
    fontSize: 10,
    letterSpacing: 2,
    width: 32
  },
  throughlineValue: {
    color: "#cfc8bc",
    flex: 1,
    fontSize: 14,
    letterSpacing: 1,
    lineHeight: 22
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  chip: {
    backgroundColor: "rgba(255,254,244,0.07)",
    borderColor: "rgba(255,254,244,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    color: "#e7e0d4",
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: 11,
    paddingVertical: 4
  },
  meaningShift: {
    marginTop: 6
  },
  meaningText: {
    color: "#9d978c",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 14,
    fontStyle: "italic",
    lineHeight: 22
  },
  meaningTextTo: {
    color: "#d8d1c4",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 14,
    fontStyle: "italic",
    lineHeight: 22
  },
  meaningRule: {
    backgroundColor: "#d9b36a",
    height: 1,
    marginVertical: 9,
    width: 26
  },
  meaningArrow: {
    color: "#d9b36a",
    fontSize: 12
  },
  episodeBlock: {
    marginTop: 4
  },
  episodeToggle: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    paddingVertical: 6
  },
  episodeToggleChevron: {
    color: "#d9b36a",
    fontSize: 11
  },
  episodeToggleText: {
    color: "#9d978c",
    fontSize: 10,
    letterSpacing: 2
  },
  episodeList: {
    marginTop: 4
  },
  episodeItem: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 14
  },
  episodeItemDivided: {
    borderTopColor: "rgba(255,254,244,0.06)",
    borderTopWidth: 1
  },
  episodeDate: {
    color: "#d9b36a",
    fontSize: 11,
    letterSpacing: 1,
    paddingTop: 1,
    width: 50
  },
  episodeText: {
    color: "#c2bbb0",
    flex: 1,
    fontSize: 14,
    lineHeight: 22
  },
  chipSmall: {
    backgroundColor: "rgba(255,254,244,0.06)",
    borderColor: "rgba(255,254,244,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    color: "#c2bbb0",
    fontSize: 11,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 3
  },
  panelTitle: {
    color: "#f6efe4",
    fontSize: 17,
    fontWeight: "700"
  },
  entryTitle: {
    color: "#f6efe4",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 22,
    fontWeight: "600"
  },
  entryDate: {
    color: "#d9b36a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1
  },
  mutedText: {
    color: "rgba(222,206,180,0.58)",
    fontFamily: fontSerifJa,
    fontSize: 14,
    letterSpacing: 0.35,
    lineHeight: 24
  },
  pageTitle: {
    gap: 7,
    marginBottom: 18
  },
  screenTitle: {
    color: "#f6efe4",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 38,
    fontWeight: "600"
  },
  questGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  questSection: {
    marginBottom: 16
  },
  questSectionTitle: {
    color: "rgba(246,239,228,0.72)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: 9
  },
  questSwitch: {
    backgroundColor: "rgba(255,254,244,0.085)",
    borderColor: "rgba(255,254,244,0.18)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    overflow: "hidden",
    padding: 5
  },
  questSwitchHighlight: {
    backgroundColor: "rgba(255,254,244,0.18)",
    borderRadius: 14,
    bottom: 5,
    left: 5,
    position: "absolute",
    top: 5
  },
  questSwitchButton: {
    alignItems: "center",
    borderRadius: 9,
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    minHeight: 36,
    zIndex: 1
  },
  questSwitchText: {
    color: "#aaa6af",
    fontSize: 12,
    fontWeight: "800"
  },
  questSwitchTextActive: {
    color: "#f0bd76"
  },
  questSwitchCount: {
    color: "#aaa6af",
    fontSize: 11,
    fontWeight: "700"
  },
  questTileShell: {
    overflow: "visible",
    position: "relative",
    width: "46.5%"
  },
  questTile: {
    aspectRatio: 1,
    backgroundColor: "rgba(255,254,244,0.09)",
    borderColor: "rgba(255,254,244,0.2)",
    borderRadius: 22,
    borderWidth: 1,
    height: "100%",
    padding: 12,
    shadowColor: "#fff7df",
    shadowOffset: { width: -8, height: -10 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    width: "100%"
  },
  questTileHead: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  questIconMark: {
    alignItems: "center",
    borderColor: "rgba(255,254,244,0.14)",
    borderRadius: 9,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    position: "relative",
    width: 26
  },
  questIconMarkLine: {
    backgroundColor: "rgba(255,254,244,0.72)",
    borderRadius: 999,
    height: 1.5,
    width: 10
  },
  questIconMarkDot: {
    backgroundColor: "rgba(255,254,244,0.72)",
    borderRadius: 999,
    height: 4,
    position: "absolute",
    right: 6,
    top: 7,
    width: 4
  },
  checkButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,254,244,0.055)",
    borderColor: "rgba(255,254,244,0.14)",
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  checkButtonActive: {
    backgroundColor: "rgba(217,179,106,0.22)",
    borderColor: "rgba(239,212,154,0.72)"
  },
  checkButtonPressed: {
    backgroundColor: "rgba(217,179,106,0.3)",
    borderColor: "rgba(239,212,154,0.85)",
    transform: [{ scale: 0.88 }]
  },
  checkButtonText: {
    color: "#f6efe4",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 18
  },
  dailyLabel: {
    color: "#d9b36a",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginTop: 11,
    textTransform: "uppercase"
  },
  questTitle: {
    color: "#f6efe4",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    marginTop: 5
  },
  calendarSectionLabel: {
    color: "#d9b36a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: "uppercase"
  },
  calendarStrip: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14
  },
  pastSection: {
    marginTop: 8
  },
  pastToggle: {
    alignItems: "center",
    backgroundColor: "rgba(255,254,244,0.05)",
    borderColor: "rgba(255,254,244,0.14)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  pastToggleLabel: {
    color: "#f6efe4",
    fontSize: 15,
    fontWeight: "700"
  },
  pastToggleMeta: {
    color: "rgba(246,239,228,0.5)",
    fontSize: 12,
    marginTop: 2
  },
  pastToggleChevron: {
    color: "#d9b36a",
    fontSize: 12
  },
  pastRow: {
    alignItems: "center",
    borderColor: "rgba(255,254,244,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  pastRowActive: {
    backgroundColor: "rgba(217,179,106,0.12)",
    borderColor: "rgba(217,179,106,0.32)"
  },
  pastRowDate: {
    color: "#d9b36a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    width: 84
  },
  pastRowTitle: {
    color: "#f6efe4",
    flex: 1,
    fontSize: 14
  },
  calendarDay: {
    alignItems: "center",
    backgroundColor: "rgba(255,254,244,0.085)",
    borderColor: "rgba(255,254,244,0.18)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 64,
    paddingVertical: 8
  },
  calendarDayActive: {
    backgroundColor: "rgba(255,254,244,0.18)",
    borderColor: "rgba(255,254,244,0.34)"
  },
  calendarWeek: {
    color: "#aaa6af",
    fontSize: 10,
    fontWeight: "700"
  },
  calendarDate: {
    color: "#f6efe4",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2
  },
  calendarTextActive: {
    color: "#f0bd76"
  },
  calendarDot: {
    backgroundColor: "transparent",
    borderRadius: 999,
    height: 4,
    marginTop: 5,
    width: 4
  },
  calendarDotActive: {
    backgroundColor: "#d9b36a"
  },
  questDustLayer: {
    alignItems: "center",
    bottom: 38,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  questDust: {
    backgroundColor: "rgba(240,189,118,0.92)",
    borderRadius: 999,
    position: "absolute",
    shadowColor: "#f0bd76",
    shadowOpacity: 0.55,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 }
  },
  tabBar: {
    alignSelf: "center",
    backgroundColor: "rgba(255,254,244,0.105)",
    borderColor: "rgba(255,254,244,0.22)",
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    gap: 2,
    left: 0,
    overflow: "hidden",
    paddingBottom: 9,
    paddingHorizontal: 16,
    paddingTop: 7,
    position: "absolute",
    right: 0,
    shadowColor: "#fff7df",
    shadowOffset: { width: -8, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    zIndex: 30
  },
  tabItem: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    gap: 4,
    minHeight: 54,
    justifyContent: "center",
    zIndex: 1
  },
  tabItemMotion: {
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 54,
    position: "relative"
  },
  tabItemHome: {
    backgroundColor: "transparent",
    borderRadius: 0,
    marginHorizontal: 0,
    minHeight: 52,
    shadowOpacity: 0,
    shadowRadius: 0
  },
  tabItemHomeActive: {
    backgroundColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0
  },
  tabItemActive: {
    backgroundColor: "rgba(217,179,106,0.12)"
  },
  tabItemLocked: {
    opacity: 0.34
  },
  tabIconCanvas: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
    width: 24
  },
  tabIconLocked: {
    opacity: 0.56
  },
  tabText: {
    color: "#aaa6af",
    fontSize: 9,
    fontWeight: "700"
  },
  tabTextActive: {
    color: "#d9b36a"
  },
  tabTextLocked: {
    color: "rgba(170,166,175,0.58)"
  },
  unlockNotice: {
    alignSelf: "center",
    backgroundColor: "rgba(255,254,244,0.11)",
    borderColor: "rgba(255,254,244,0.18)",
    borderRadius: 999,
    borderWidth: 1,
    bottom: 78,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: "absolute",
    shadowColor: "#fff7df",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18
  },
  unlockNoticeText: {
    color: "#f6efe4",
    fontSize: 12,
    fontWeight: "700"
  },
  modal: {
    backgroundColor: "#030406",
    flex: 1
  },
  modalHeader: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.018)",
    borderBottomColor: "rgba(255,255,255,0.075)",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 16
  },
  accountHeader: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 13,
    minWidth: 0
  },
  accountHeaderAvatar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    borderWidth: 1,
    height: 54,
    justifyContent: "center",
    overflow: "hidden",
    width: 54
  },
  accountHeaderInitial: {
    color: "#fbfbfb",
    fontFamily: fontUiMedium,
    fontSize: 21,
    fontWeight: "700"
  },
  modalTitleWrap: {
    alignItems: "flex-start",
    flex: 1,
    minWidth: 0
  },
  modalTitle: {
    color: "#fafafa",
    fontFamily: fontUiMedium,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.4
  },
  modalDivider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 8,
    width: 150
  },
  modalDividerLine: {
    backgroundColor: "rgba(240,189,118,0.45)",
    flex: 1,
    height: 1
  },
  modalDividerMark: {
    color: "#f0bd76",
    fontSize: 16,
    lineHeight: 18
  },
  modalSub: {
    color: "rgba(255,255,255,0.42)",
    fontFamily: fontUi,
    fontSize: 11,
    marginTop: 3
  },
  accountHeaderMeta: {
    color: "rgba(255,255,255,0.52)",
    fontFamily: fontUi,
    fontSize: 11,
    marginTop: 3
  },
  modalCompass: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.055)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  modalCompassText: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: fontUi,
    fontSize: 24,
    fontWeight: "300",
    lineHeight: 26
  },
  settingsBody: {
    flex: 1
  },
  accountRootTabs: {
    backgroundColor: "rgba(255,254,244,0.052)",
    borderColor: "rgba(255,254,244,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    padding: 4
  },
  accountRootTab: {
    alignItems: "center",
    borderRadius: 999,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  accountRootTabActive: {
    backgroundColor: "rgba(255,254,244,0.13)",
    shadowColor: "#fff6dc",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12
  },
  accountRootTabLabel: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fontUiMedium,
    fontSize: 13,
    fontWeight: "700"
  },
  accountRootTabLabelActive: {
    color: "#fff9eb"
  },
  accountRootTabSub: {
    color: "rgba(255,255,255,0.34)",
    fontFamily: fontUi,
    fontSize: 10,
    marginTop: 2
  },
  accountRootTabSubActive: {
    color: "rgba(255,249,235,0.62)"
  },
  settingsTabList: {
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 8
  },
  settingsTab: {
    backgroundColor: "rgba(255,254,244,0.055)",
    borderColor: "rgba(255,254,244,0.12)",
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
    minHeight: 76,
    paddingHorizontal: 13,
    paddingVertical: 10,
    width: 126
  },
  settingsTabActive: {
    backgroundColor: "rgba(255,254,244,0.115)",
    borderColor: "rgba(255,254,244,0.24)"
  },
  settingsTabIcon: {
    color: "#c2bbb0",
    fontFamily: fontUiMedium,
    fontSize: 18,
    fontWeight: "700"
  },
  settingsTabTitle: {
    color: "#f6efe4",
    fontFamily: fontUiMedium,
    fontSize: 14,
    fontWeight: "700"
  },
  settingsTabSub: {
    color: "#aaa6af",
    fontFamily: fontUi,
    fontSize: 10,
    lineHeight: 13
  },
  settingSection: {
    gap: 20,
    padding: 20,
    paddingBottom: 54
  },
  settingsPage: {
    gap: 18,
    paddingHorizontal: 42
  },
  basePage: {
    gap: 22
  },
  baseProfileCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.16)",
    borderTopColor: "rgba(255,255,255,0.34)",
    borderRadius: 28,
    borderWidth: 1,
    minHeight: 260,
    overflow: "hidden",
    padding: 22,
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.32,
    shadowRadius: 30
  },
  baseProfileSheen: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: "46%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  baseProfileGlow: {
    backgroundColor: "rgba(236,193,112,0.16)",
    borderRadius: 999,
    height: 150,
    position: "absolute",
    right: -46,
    top: -52,
    width: 150
  },
  baseProfileTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 20,
    zIndex: 1
  },
  baseAvatar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.22)",
    borderTopColor: "rgba(255,255,255,0.5)",
    borderRadius: 999,
    borderWidth: 2,
    height: 104,
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    overflow: "hidden",
    width: 104
  },
  baseAvatarImage: {
    ...StyleSheet.absoluteFillObject,
    height: "100%",
    width: "100%"
  },
  baseAvatarText: {
    color: "#fbfbfb",
    fontFamily: fontUiMedium,
    fontSize: 34,
    fontWeight: "700"
  },
  baseProfileInfo: {
    flex: 1,
    gap: 7
  },
  baseName: {
    color: "#fbfbfb",
    fontFamily: fontUiMedium,
    fontSize: 25,
    fontWeight: "700"
  },
  baseLevel: {
    color: "rgba(236,193,112,0.86)",
    fontFamily: fontUiMedium,
    fontSize: 14,
    fontWeight: "700"
  },
  baseLevelBar: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    height: 6,
    overflow: "hidden",
    width: "84%"
  },
  baseLevelFill: {
    backgroundColor: "rgba(236,193,112,0.9)",
    borderRadius: 999,
    height: "100%",
    shadowColor: "#ecc170",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    width: "36%"
  },
  baseXpText: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fontUi,
    fontSize: 12
  },
  baseMetaRow: {
    borderColor: "rgba(255,255,255,0.075)",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 16,
    marginTop: 22,
    paddingTop: 18,
    zIndex: 1
  },
  baseMetaItem: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12
  },
  baseMetaItemStart: {
    marginLeft: -8
  },
  baseMetaIcon: {
    color: "rgba(255,255,255,0.52)",
    fontFamily: fontUi,
    fontSize: 20,
    width: 30
  },
  baseMetaLabel: {
    color: "rgba(255,255,255,0.52)",
    fontFamily: fontUi,
    fontSize: 12
  },
  baseMetaValue: {
    color: "#fbfbfb",
    fontFamily: fontUiMedium,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 2
  },
  baseMetaDivider: {
    backgroundColor: "rgba(255,255,255,0.09)",
    width: 1
  },
  baseStatGrid: {
    borderColor: "rgba(255,255,255,0.075)",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    paddingTop: 16,
    zIndex: 1
  },
  baseStat: {
    alignItems: "center",
    backgroundColor: "rgba(46,36,26,0.34)",
    borderColor: "rgba(217,168,108,0.14)",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10
  },
  baseStatValue: {
    color: "#F3E6D0",
    fontFamily: fontSerifEnMedium,
    fontSize: 18,
    letterSpacing: 0.8
  },
  baseStatLabel: {
    color: "rgba(190,180,162,0.46)",
    fontFamily: fontSerifJa,
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: 2
  },
  baseSection: {
    gap: 10
  },
  baseSectionTitle: {
    color: "rgba(255,255,255,0.48)",
    fontFamily: fontUiMedium,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    paddingLeft: 2
  },
  baseList: {
    backgroundColor: "rgba(255,255,255,0.048)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#ffffff",
    shadowOpacity: 0.045,
    shadowRadius: 24,
    shadowOffset: { width: -8, height: -10 }
  },
  baseRow: {
    alignItems: "center",
    borderBottomColor: "rgba(255,255,255,0.065)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  baseRowDisabled: {
    opacity: 0.52
  },
  baseRowIcon: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 32
  },
  baseRowIconDisabled: {
    backgroundColor: "rgba(255,255,255,0.035)",
    borderColor: "rgba(255,255,255,0.055)"
  },
  baseRowIconText: {
    color: "rgba(240,189,118,0.68)",
    fontSize: 18,
    lineHeight: 24
  },
  settingsIconCanvas: {
    height: 24,
    position: "relative",
    width: 24
  },
  settingsIconLine: {
    backgroundColor: "rgba(217,168,108,0.46)",
    borderRadius: 999,
    position: "absolute"
  },
  settingsIconLineActive: {
    backgroundColor: "rgba(232,200,150,0.9)"
  },
  settingsIconLocked: {
    opacity: 0.48
  },
  settingsIconDot: {
    backgroundColor: "rgba(217,168,108,0.46)",
    borderRadius: 999,
    position: "absolute"
  },
  settingsIconDotActive: {
    backgroundColor: "rgba(232,200,150,0.9)"
  },
  settingsIconBox: {
    borderColor: "rgba(217,168,108,0.46)",
    borderRadius: 5,
    borderWidth: 1.5,
    position: "absolute"
  },
  settingsIconBoxActive: {
    borderColor: "rgba(232,200,150,0.9)"
  },
  settingsIconRing: {
    borderRadius: 999,
    height: 16,
    left: 4,
    top: 4,
    width: 16
  },
  settingsIconCenter: {
    height: 4,
    left: 10,
    top: 10,
    width: 4
  },
  settingsIconTickA: {
    height: 1.5,
    left: 11,
    top: 1,
    width: 2
  },
  settingsIconTickB: {
    height: 1.5,
    left: 11,
    top: 21,
    width: 2
  },
  settingsIconBell: {
    borderBottomWidth: 0,
    borderRadius: 8,
    height: 13,
    left: 6,
    top: 4,
    width: 12
  },
  settingsIconBellBase: {
    height: 1.5,
    left: 7,
    top: 17,
    width: 10
  },
  settingsIconBellDot: {
    height: 3,
    left: 10.5,
    top: 19,
    width: 3
  },
  settingsIconSpeaker: {
    borderRadius: 3,
    height: 10,
    left: 4,
    top: 7,
    width: 8
  },
  settingsIconWaveA: {
    height: 1.5,
    left: 14,
    top: 9,
    transform: [{ rotate: "28deg" }],
    width: 6
  },
  settingsIconWaveB: {
    height: 1.5,
    left: 14,
    top: 14,
    transform: [{ rotate: "-28deg" }],
    width: 6
  },
  settingsIconGlobe: {
    borderRadius: 999,
    height: 17,
    left: 3.5,
    top: 3.5,
    width: 17
  },
  settingsIconGlobeH: {
    height: 1.5,
    left: 5,
    top: 11,
    width: 14
  },
  settingsIconGlobeV: {
    height: 14,
    left: 11,
    top: 5,
    width: 1.5
  },
  settingsIconProfileHead: {
    height: 7,
    left: 8.5,
    top: 4,
    width: 7
  },
  settingsIconProfileBody: {
    borderRadius: 8,
    height: 9,
    left: 5,
    top: 13,
    width: 14
  },
  settingsIconSyncTop: {
    height: 1.5,
    left: 5,
    top: 7,
    transform: [{ rotate: "-22deg" }],
    width: 12
  },
  settingsIconSyncBottom: {
    height: 1.5,
    left: 7,
    top: 16,
    transform: [{ rotate: "-22deg" }],
    width: 12
  },
  settingsIconSyncDotA: {
    height: 4,
    left: 16,
    top: 5,
    width: 4
  },
  settingsIconSyncDotB: {
    height: 4,
    left: 4,
    top: 15,
    width: 4
  },
  settingsIconRitualA: {
    height: 1.5,
    left: 5,
    top: 11,
    width: 14
  },
  settingsIconRitualB: {
    height: 14,
    left: 11,
    top: 5,
    width: 1.5
  },
  settingsIconRitualDot: {
    height: 4,
    left: 10,
    top: 10,
    width: 4
  },
  settingsIconDataTop: {
    borderRadius: 4,
    height: 8,
    left: 5,
    top: 4,
    width: 14
  },
  settingsIconDataMid: {
    height: 1.5,
    left: 6,
    top: 14,
    width: 12
  },
  settingsIconDataBase: {
    height: 1.5,
    left: 7,
    top: 19,
    width: 10
  },
  settingsIconShield: {
    borderRadius: 7,
    height: 17,
    left: 5,
    top: 3,
    width: 14
  },
  settingsIconShieldLine: {
    height: 8,
    left: 11,
    top: 8,
    width: 1.5
  },
  settingsIconLogoutDoor: {
    borderRadius: 4,
    height: 16,
    left: 4,
    top: 4,
    width: 10
  },
  settingsIconLogoutArrow: {
    height: 1.5,
    left: 10,
    top: 11,
    width: 10
  },
  settingsIconLogoutDot: {
    height: 4,
    left: 17,
    top: 9.5,
    width: 4
  },
  settingsIconMessage: {
    borderRadius: 5,
    height: 14,
    left: 4,
    top: 5,
    width: 16
  },
  settingsIconMessageLine: {
    height: 1.5,
    left: 8,
    top: 11,
    width: 8
  },
  settingsIconDocument: {
    borderRadius: 4,
    height: 17,
    left: 6,
    top: 3,
    width: 12
  },
  settingsIconDocumentLineA: {
    height: 1.5,
    left: 9,
    top: 9,
    width: 6
  },
  settingsIconDocumentLineB: {
    height: 1.5,
    left: 9,
    top: 13,
    width: 5
  },
  settingsIconPolicyBox: {
    borderRadius: 4,
    height: 12,
    left: 4,
    top: 6,
    width: 16
  },
  settingsIconPolicyFoldL: {
    height: 1.5,
    left: 4.5,
    top: 9.5,
    transform: [{ rotate: "24deg" }],
    width: 8
  },
  settingsIconPolicyFoldR: {
    height: 1.5,
    left: 11.5,
    top: 9.5,
    transform: [{ rotate: "-24deg" }],
    width: 8
  },
  settingsIconPolicyDot: {
    height: 3,
    left: 10.5,
    top: 12.5,
    width: 3
  },
  baseTextDisabled: {
    color: "rgba(255,255,255,0.34)"
  },
  baseRowCopy: {
    flex: 1,
    gap: 3
  },
  baseRowTitle: {
    color: "#f7f7f7",
    fontFamily: fontUiMedium,
    fontSize: 15,
    fontWeight: "700"
  },
  baseRowBody: {
    color: "rgba(255,255,255,0.43)",
    fontFamily: fontUi,
    fontSize: 12
  },
  baseRowValue: {
    color: "rgba(255,255,255,0.62)",
    fontFamily: fontUiMedium,
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 74,
    textAlign: "right"
  },
  baseBadge: {
    backgroundColor: "rgba(236,193,112,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  baseBadgeText: {
    color: "#ecc170",
    fontFamily: fontUiMedium,
    fontSize: 12,
    fontWeight: "700"
  },
  baseChevron: {
    color: "rgba(238,224,202,0.24)",
    fontSize: 26,
    lineHeight: 28
  },
  backToBase: {
    alignSelf: "flex-start",
    borderColor: "rgba(217,168,108,0.18)",
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 40,
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  backToBaseText: {
    color: "rgba(221,180,111,0.82)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 0.8
  },
  settingsPageTitle: {
    gap: 9,
    marginBottom: 10,
    paddingBottom: 4
  },
  settingsPageIcon: {
    color: "rgba(240,189,118,0.72)",
    fontFamily: fontUiMedium,
    fontSize: 20,
    fontWeight: "700",
    width: 34
  },
  settingsPageCopy: {
    gap: 5
  },
  settingsPageHeading: {
    color: "#F3E6D0",
    fontFamily: fontSerifJa,
    fontSize: 24,
    letterSpacing: 1.2,
    lineHeight: 34
  },
  settingsCard: {
    backgroundColor: "rgba(46,36,26,0.42)",
    borderColor: "rgba(217,168,108,0.16)",
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 17,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 30
  },
  profileEditCard: {
    backgroundColor: "rgba(46,36,26,0.42)",
    borderColor: "rgba(217,168,108,0.16)",
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
    overflow: "hidden",
    padding: 18
  },
  profileEditTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16
  },
  profileEditAvatar: {
    alignItems: "center",
    backgroundColor: "rgba(24,18,13,0.64)",
    borderColor: "rgba(217,168,108,0.2)",
    borderRadius: 999,
    borderWidth: 1,
    height: 78,
    justifyContent: "center",
    overflow: "hidden",
    width: 78
  },
  profileEditAvatarText: {
    color: "#F3E6D0",
    fontFamily: fontSerifEnMedium,
    fontSize: 28,
    letterSpacing: 0.8
  },
  profileEditCopy: {
    flex: 1,
    gap: 4
  },
  profileEditName: {
    color: "#F3E6D0",
    fontFamily: fontSerifJa,
    fontSize: 24,
    letterSpacing: 0.8,
    lineHeight: 33
  },
  profileDataGrid: {
    flexDirection: "row",
    gap: 8
  },
  profileSaveRow: {
    alignItems: "flex-end",
    borderColor: "rgba(232,226,214,0.07)",
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 12
  },
  profileSaveButton: {
    alignItems: "center",
    backgroundColor: "rgba(217,168,108,0.08)",
    borderColor: "rgba(217,168,108,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 16
  },
  profileSaveButtonText: {
    color: "rgba(228,184,124,0.92)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 0.7
  },
  authCard: {
    backgroundColor: "rgba(46,36,26,0.42)",
    borderColor: "rgba(217,168,108,0.16)",
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    overflow: "hidden",
    padding: 18
  },
  authCopy: {
    gap: 5
  },
  syncStatusPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(217,168,108,0.1)",
    borderColor: "rgba(217,168,108,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  syncStatusText: {
    color: "rgba(228,184,124,0.92)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 0.8
  },
  syncSummaryRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 6
  },
  dangerCard: {
    backgroundColor: "rgba(58,32,26,0.36)",
    borderColor: "rgba(255,121,94,0.22)",
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    overflow: "hidden",
    padding: 18
  },
  dangerButton: {
    alignItems: "center",
    backgroundColor: "rgba(166,70,54,0.82)",
    borderColor: "rgba(255,151,118,0.24)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 18
  },
  dangerButtonText: {
    color: "#fff2ea",
    fontFamily: fontSerifJa,
    fontSize: 14,
    letterSpacing: 0.7
  },
  errorText: {
    color: "#ffb4a7",
    fontFamily: fontUi,
    fontSize: 12,
    lineHeight: 18
  },
  noticeText: {
    color: "#d9b36a",
    fontFamily: fontUi,
    fontSize: 12,
    lineHeight: 18
  },
  redirectBox: {
    borderColor: "rgba(255,255,255,0.075)",
    borderTopWidth: 1,
    gap: 5,
    paddingTop: 10
  },
  redirectText: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fontUi,
    fontSize: 11,
    lineHeight: 16
  },
  settingLabel: {
    color: "rgba(217,168,108,0.58)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 2.2
  },
  settingValue: {
    color: "rgba(236,230,218,0.92)",
    fontFamily: fontSerifJa,
    fontSize: 16,
    letterSpacing: 0.7,
    lineHeight: 24
  },
  soundStatusRow: {
    alignItems: "center",
    borderColor: "rgba(232,226,214,0.07)",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 10
  },
  soundStatusText: {
    color: "rgba(190,180,162,0.58)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 0.7
  },
  soundVolumeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 4
  },
  soundStepButton: {
    alignItems: "center",
    backgroundColor: "rgba(24,18,13,0.45)",
    borderColor: "rgba(217,168,108,0.18)",
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  soundStepText: {
    color: "rgba(232,200,150,0.78)",
    fontFamily: fontSerifJa,
    fontSize: 19,
    lineHeight: 21
  },
  soundVolumeTrack: {
    backgroundColor: "rgba(232,226,214,0.08)",
    borderRadius: 999,
    flex: 1,
    height: 7,
    overflow: "hidden"
  },
  soundVolumeFill: {
    backgroundColor: "rgba(232,189,120,0.82)",
    borderRadius: 999,
    height: "100%",
    shadowColor: "#d9a86c",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8
  },
  soundTrackRow: {
    alignItems: "center",
    borderBottomColor: "rgba(232,226,214,0.07)",
    borderBottomWidth: 1,
    borderWidth: 1,
    borderColor: "transparent",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 13
  },
  soundTrackRowActive: {
    backgroundColor: "rgba(217,168,108,0.07)",
    borderColor: "rgba(217,168,108,0.16)",
    borderRadius: 10,
    paddingHorizontal: 12
  },
  soundTrackMark: {
    color: "rgba(232,200,150,0.86)",
    fontFamily: fontSerifEnMedium,
    fontSize: 11,
    letterSpacing: 1.4
  },
  legalNoticeCard: {
    backgroundColor: "rgba(46,36,26,0.38)",
    borderColor: "rgba(217,168,108,0.14)",
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    overflow: "hidden",
    padding: 18
  },
  legalSectionCard: {
    backgroundColor: "rgba(46,36,26,0.3)",
    borderColor: "rgba(232,226,214,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    overflow: "hidden",
    padding: 18
  },
  legalSectionTitle: {
    color: "#F3E6D0",
    fontFamily: fontSerifJa,
    fontSize: 15,
    letterSpacing: 0.7,
    lineHeight: 23
  },
  legalBody: {
    color: "rgba(222,206,180,0.64)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 0.4,
    lineHeight: 24
  },
  settingInput: {
    backgroundColor: "rgba(20,14,10,0.56)",
    borderColor: "rgba(217,168,108,0.14)",
    borderRadius: 12,
    borderWidth: 1,
    color: "#F3E6D0",
    fontFamily: fontSerifJa,
    fontSize: 15,
    letterSpacing: 0.5,
    lineHeight: 22,
    minHeight: 46,
    paddingHorizontal: 14
  },
  ownershipStatement: {
    color: "#F3E6D0",
    fontFamily: fontSerifJa,
    fontSize: 18,
    letterSpacing: 0.8,
    lineHeight: 28,
    marginBottom: 2
  },
  recoveryKeyText: {
    backgroundColor: "rgba(20,14,10,0.72)",
    borderColor: "rgba(217,168,108,0.24)",
    borderRadius: 12,
    borderWidth: 1,
    color: "rgba(232,200,150,0.92)",
    fontFamily: fontSerifJa,
    fontSize: 15,
    letterSpacing: 0.7,
    lineHeight: 28,
    padding: 14
  },
  entryRow: {
    alignItems: "center",
    backgroundColor: "rgba(20,14,10,0.36)",
    borderColor: "rgba(232,226,214,0.08)",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  entryRowText: {
    color: "rgba(232,226,214,0.78)",
    flex: 1,
    fontFamily: fontSerifJa,
    fontSize: 14,
    lineHeight: 22
  },
  entryRemove: {
    alignItems: "center",
    borderColor: "rgba(217,168,108,0.22)",
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  entryRemoveText: {
    color: "rgba(225,190,140,0.72)",
    fontFamily: fontSerifJa,
    fontSize: 16,
    lineHeight: 18
  },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between"
  },
  toggleCopy: {
    flex: 1,
    gap: 4
  },
  togglePill: {
    alignItems: "center",
    backgroundColor: "rgba(20,14,10,0.56)",
    borderColor: "rgba(217,168,108,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 58,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  togglePillOn: {
    backgroundColor: "rgba(221,180,111,0.24)",
    borderColor: "rgba(232,200,150,0.4)",
    shadowColor: "#d9a86c",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 14
  },
  toggleText: {
    color: "rgba(190,180,162,0.58)",
    fontFamily: fontSerifEnMedium,
    fontSize: 12,
    letterSpacing: 1.2
  },
  toggleTextOn: {
    color: "#F3E6D0"
  },
  segmentedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  segmentButton: {
    backgroundColor: "rgba(20,14,10,0.5)",
    borderColor: "rgba(217,168,108,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  segmentButtonActive: {
    backgroundColor: "rgba(221,180,111,0.24)",
    borderColor: "rgba(232,200,150,0.42)",
    shadowColor: "#d9a86c",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 14
  },
  segmentText: {
    color: "rgba(190,180,162,0.58)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 0.7
  },
  segmentTextActive: {
    color: "#F3E6D0"
  },

  background: {
    flex: 1,
    backgroundColor: "#100C0A"
  },
  backgroundTexture: {
    ...StyleSheet.absoluteFillObject,
    height: "100%",
    opacity: 0.1,
    width: "100%"
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,6,4,0.22)"
  },
  lowerGlowBase: {
    bottom: 0,
    height: "42%",
    left: 0,
    opacity: 0.64,
    position: "absolute",
    right: 0
  },
  lowerGlowPool: {
    bottom: -118,
    height: 360,
    left: "-18%",
    opacity: 0.58,
    position: "absolute",
    right: "-18%"
  },
  upperGlow: {
    height: "30%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    height: 82,
    justifyContent: "space-between",
    left: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 40
  },
  headerSide: {
    display: "none"
  },
  headerTitle: {
    color: "rgba(217,168,108,0.3)",
    fontFamily: fontSerifEnLight,
    fontSize: 26,
    left: 0,
    letterSpacing: 11,
    position: "absolute",
    right: 0,
    textAlign: "center",
    top: 20
  },
  settingsSunButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,254,244,0.06)",
    borderColor: "rgba(255,254,244,0.14)",
    borderRadius: 12,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    outlineStyle: "none",
    position: "absolute",
    right: 28,
    top: 52,
    width: 34
  },
  notificationButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,254,244,0.06)",
    borderColor: "rgba(255,254,244,0.14)",
    borderRadius: 12,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    outlineStyle: "none",
    position: "absolute",
    right: 72,
    top: 52,
    width: 34
  },
  notificationBellGlyph: {
    height: 19,
    position: "relative",
    width: 19
  },
  notificationBellBody: {
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    borderColor: "rgba(225,205,170,0.5)",
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderWidth: 1.3,
    height: 10,
    left: 4.5,
    position: "absolute",
    top: 3,
    width: 10
  },
  notificationBellBase: {
    backgroundColor: "rgba(225,205,170,0.5)",
    borderRadius: 999,
    height: 1.3,
    left: 3,
    position: "absolute",
    top: 13,
    width: 13
  },
  notificationBellClapper: {
    backgroundColor: "rgba(225,205,170,0.5)",
    borderRadius: 999,
    height: 2.6,
    left: 8.2,
    position: "absolute",
    top: 15,
    width: 2.6
  },
  notificationBellDot: {
    backgroundColor: "#E8B25E",
    borderRadius: 999,
    height: 7,
    position: "absolute",
    right: 6,
    shadowColor: "#E8B25E",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
    top: 6,
    width: 7
  },
  notificationRow: {
    backgroundColor: "rgba(46,36,26,0.42)",
    borderColor: "rgba(217,168,108,0.14)",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingVertical: 18,
    position: "relative"
  },
  notificationRowUnread: {
    borderColor: "rgba(217,168,108,0.34)"
  },
  notificationRowDot: {
    backgroundColor: "#E8B25E",
    borderRadius: 999,
    height: 6,
    position: "absolute",
    right: 18,
    top: 20,
    width: 6
  },
  notificationRowTag: {
    color: "rgba(232,200,150,0.7)",
    fontFamily: fontSerifEnMedium,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 8
  },
  notificationRowTitle: {
    color: "#E8E2D6",
    fontFamily: fontSerifJa,
    fontSize: 15,
    letterSpacing: 0.3,
    lineHeight: 24
  },
  notificationRowBody: {
    color: "rgba(232,226,214,0.6)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 0.2,
    lineHeight: 21,
    marginTop: 6
  },
  notificationRowDate: {
    color: "rgba(205,176,134,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 0.4,
    marginTop: 10
  },
  notificationEmptyNote: {
    color: "rgba(190,180,162,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 14,
    letterSpacing: 0.3,
    lineHeight: 24,
    marginTop: 8,
    textAlign: "center"
  },
  settingsSunGlyph: {
    height: 19,
    position: "relative",
    width: 19
  },
  settingsSunCore: {
    borderColor: "rgba(225,205,170,0.5)",
    borderRadius: 999,
    borderWidth: 1.3,
    height: 7,
    left: 6,
    position: "absolute",
    top: 6,
    width: 7
  },
  settingsSunRay: {
    backgroundColor: "rgba(225,205,170,0.5)",
    borderRadius: 999,
    height: 3.1,
    position: "absolute",
    width: 1.3
  },
  settingsSunRayTop: {
    left: 8.85,
    top: 0
  },
  settingsSunRayBottom: {
    bottom: 0,
    left: 8.85
  },
  settingsSunRayLeft: {
    height: 1.3,
    left: 0,
    top: 8.85,
    width: 3.1
  },
  settingsSunRayRight: {
    height: 1.3,
    right: 0,
    top: 8.85,
    width: 3.1
  },
  settingsSunRaySlashA: {
    height: 1.3,
    left: 3,
    top: 3,
    transform: [{ rotate: "45deg" }],
    width: 3.1
  },
  settingsSunRaySlashB: {
    bottom: 3,
    height: 1.3,
    right: 3,
    transform: [{ rotate: "45deg" }],
    width: 3.1
  },
  settingsSunRaySlashC: {
    height: 1.3,
    right: 3,
    top: 3,
    transform: [{ rotate: "-45deg" }],
    width: 3.1
  },
  settingsSunRaySlashD: {
    bottom: 3,
    height: 1.3,
    left: 3,
    transform: [{ rotate: "-45deg" }],
    width: 3.1
  },
  content: {
    flex: 1
  },
  pageRail: {
    alignItems: "stretch"
  },
  pageFrame: {
    flex: 1
  },
  composerAvoider: {
    bottom: 92,
    left: 0,
    position: "absolute",
    right: 0
  },
  homeReflectionScreen: {
    flex: 1,
    justifyContent: "flex-start",
    paddingBottom: 122,
    paddingHorizontal: 46
  },
  reflectionTapArea: {
    alignItems: "center",
    flex: 0,
    justifyContent: "flex-start"
  },
  homeLeadText: {
    color: "rgba(190,180,162,0.72)",
    fontFamily: fontSerifJa,
    fontSize: 18,
    letterSpacing: 1.1,
    lineHeight: 32,
    marginBottom: 30,
    textAlign: "center"
  },
  homeLeadTextDimmed: {
    opacity: 0.28
  },
  niloStage: {
    alignItems: "center",
    marginBottom: 6,
    overflow: "visible",
    paddingHorizontal: 0,
    paddingVertical: 0
  },
  niloStageCopy: {
    alignItems: "center",
    gap: 0,
    paddingHorizontal: 0,
    paddingTop: 0
  },
  niloStageQuestion: {
    color: "#E8E2D6",
    fontFamily: fontSerifJa,
    fontSize: 33,
    fontWeight: "400",
    letterSpacing: 1.65,
    lineHeight: 64,
    marginTop: 0,
    textAlign: "center"
  },
  niloStageQuestionCompact: {
    fontSize: 26,
    lineHeight: 40,
    marginTop: 0
  },
  niloStageCaret: {
    color: "rgba(242,200,142,0.92)",
    fontSize: 30,
    fontWeight: "300"
  },
  niloStageCaretCompact: {
    fontSize: 24
  },
  niloLightWrap: {
    alignItems: "center",
    height: 210,
    justifyContent: "center",
    width: 210
  },
  niloOrbImage: {
    height: 340,
    width: 340
  },
  niloLightHalo: {
    borderRadius: 105,
    height: 210,
    overflow: "hidden",
    position: "absolute",
    width: 210
  },
  niloLightGlowMid: {
    borderRadius: 70,
    height: 140,
    overflow: "hidden",
    position: "absolute",
    width: 140
  },
  niloLightGlowInner: {
    borderRadius: 38,
    height: 76,
    overflow: "hidden",
    position: "absolute",
    width: 76
  },
  niloLightCore: {
    backgroundColor: "#f1c17a",
    borderRadius: 999,
    height: 10,
    overflow: "hidden",
    shadowColor: "#e4a95f",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.94,
    shadowRadius: 30,
    width: 10
  },
  ritualButtonWrap: {
    alignItems: "center",
    paddingBottom: 14
  },
  ritualStartButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderWidth: 0,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 52,
    minWidth: 220,
    outlineStyle: "none",
    paddingHorizontal: 28,
    paddingVertical: 16
  },
  ritualStartButtonDisabled: {
    opacity: 0.34
  },
  ritualStartIcon: {
    color: "#e8bd78",
    fontFamily: fontSerifEn,
    fontSize: 30,
    lineHeight: 28,
    marginRight: 15,
    textShadowColor: "rgba(232,189,120,0.64)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18
  },
  ritualStartText: {
    color: "rgba(238,224,202,0.36)",
    fontFamily: fontSerifJa,
    fontSize: 14,
    letterSpacing: 1.8
  },
  composerLine: {
    alignItems: "center",
    backgroundColor: "rgba(20,14,10,0.9)",
    borderColor: "rgba(221,180,111,0.22)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 48,
    paddingHorizontal: 16,
    shadowColor: "#e8bd78",
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 }
  },
  questScrollContent: {
    paddingBottom: 118,
    paddingHorizontal: 30,
    paddingTop: 58
  },
  questHeader: {
    marginBottom: 28
  },
  questScreenTitle: {
    color: "#E8E2D6",
    fontFamily: fontSerifJa,
    fontSize: 22,
    letterSpacing: 1.8,
    lineHeight: 30
  },
  questEyebrow: {
    color: "rgba(217,168,108,0.6)",
    fontFamily: fontSerifEnMedium,
    fontSize: 10,
    letterSpacing: 2.8,
    lineHeight: 12,
    marginTop: 7
  },
  questPhilosophy: {
    color: "rgba(190,180,162,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 0.8,
    lineHeight: 21,
    marginTop: 14
  },
  questGroupHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginBottom: 16
  },
  questGroupHeaderSpaced: {
    marginTop: 34
  },
  questGroupTitle: {
    color: "rgba(190,180,162,0.45)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 3.3
  },
  questGroupRule: {
    backgroundColor: "rgba(217,168,108,0.22)",
    flex: 1,
    height: 1
  },
  questProposalObservation: {
    color: "#E8E2D6",
    fontFamily: fontSerifJa,
    fontSize: 17,
    letterSpacing: 0.5,
    lineHeight: 29,
    marginTop: 4,
    paddingRight: 52
  },
  questProposalInvitation: {
    color: "rgba(228,196,142,0.85)",
    fontFamily: fontSerifJa,
    fontSize: 14,
    letterSpacing: 0.4,
    lineHeight: 24,
    marginBottom: 20,
    marginTop: 10
  },
  questQuietNote: {
    color: "rgba(190,180,162,0.45)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 0.6,
    lineHeight: 23,
    paddingVertical: 8
  },
  questOngoingRow: {
    borderBottomColor: "rgba(232,226,214,0.07)",
    borderBottomWidth: 1,
    paddingVertical: 17
  },
  questOngoingTheme: {
    color: "rgba(232,226,214,0.9)",
    fontFamily: fontSerifJa,
    fontSize: 16,
    letterSpacing: 0.4,
    lineHeight: 27
  },
  questOngoingMeta: {
    color: "rgba(205,176,134,0.55)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 0.6,
    marginTop: 7
  },
  questClosedRow: {
    opacity: 0.62
  },
  questClosedTheme: {
    color: "rgba(232,226,214,0.62)"
  },
  mobileQuestCard: {
    backgroundColor: "rgba(46,36,26,0.54)",
    borderColor: "rgba(217,168,108,0.18)",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingVertical: 20,
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.38,
    shadowRadius: 38
  },
  mobileQuestCategory: {
    color: "rgba(225,190,140,0.85)",
    fontFamily: fontSerifEnMedium,
    fontSize: 10,
    letterSpacing: 2.2,
    marginBottom: 0
  },
  mobileQuestNilo: {
    borderColor: "rgba(217,168,108,0.32)",
    borderRadius: 999,
    borderWidth: 1,
    color: "rgba(232,200,150,0.78)",
    fontFamily: fontSerifEnMedium,
    fontSize: 9,
    letterSpacing: 2,
    paddingHorizontal: 9,
    paddingVertical: 3,
    position: "absolute",
    right: 22,
    top: 20
  },
  mobileQuestTitle: {
    color: "#E8E2D6",
    fontFamily: fontSerifJa,
    fontSize: 20,
    letterSpacing: 0.6,
    lineHeight: 32,
    marginBottom: 18,
    marginTop: 13
  },
  mobileQuestComplete: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginTop: "auto",
    outlineStyle: "none"
  },
  mobileQuestCheck: {
    alignItems: "center",
    backgroundColor: "rgba(221,180,111,0.48)",
    borderRadius: 999,
    height: 23,
    justifyContent: "center",
    shadowColor: "#e8bd78",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    width: 23
  },
  mobileQuestCheckText: {
    color: "#1b130d",
    fontFamily: fontUiMedium,
    fontSize: 13,
    lineHeight: 15
  },
  mobileQuestCompleteText: {
    color: "rgba(221,180,111,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 0.9
  },
  mobileQuestActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 0
  },
  mobileQuestAction: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
    outlineStyle: "none",
    paddingVertical: 11
  },
  mobileQuestActionPrimary: {
    backgroundColor: "rgba(217,168,108,0.07)",
    borderColor: "rgba(217,168,108,0.3)"
  },
  mobileQuestActionSecondary: {
    backgroundColor: "rgba(232,226,214,0.03)",
    borderColor: "rgba(232,226,214,0.12)"
  },
  mobileQuestActionPrimaryText: {
    color: "rgba(228,184,124,0.9)",
    fontFamily: fontSerifJa,
    fontSize: 13
  },
  mobileQuestActionSecondaryText: {
    color: "rgba(225,218,205,0.78)",
    fontFamily: fontSerifJa,
    fontSize: 13
  },
  journalScrollContent: {
    paddingBottom: 118,
    paddingHorizontal: 30,
    paddingTop: 58
  },
  journalHeader: {
    minHeight: 80,
    position: "relative"
  },
  mobileScreenTitle: {
    color: "#E8E2D6",
    fontFamily: fontSerifJa,
    fontSize: 22,
    letterSpacing: 2.2,
    lineHeight: 30
  },
  mobileGoldLabel: {
    color: "rgba(217,168,108,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 10,
    letterSpacing: 2.6,
    lineHeight: 12,
    marginTop: 7
  },
  journalMonth: {
    color: "rgba(190,180,162,0.5)",
    fontFamily: fontSerifEnMedium,
    fontSize: 12,
    letterSpacing: 2.4,
    position: "absolute",
    right: 0,
    top: 32
  },
  journalWatermark: {
    color: "rgba(221,180,111,0.055)",
    fontFamily: fontSerifJa,
    fontSize: 56,
    lineHeight: 56,
    position: "absolute",
    right: 0,
    top: 38
  },
  chapterWatermark: {
    bottom: 60,
    color: "rgba(217,168,108,0.035)",
    fontFamily: fontSerifJaMedium,
    fontSize: 180,
    lineHeight: 126,
    position: "absolute",
    right: -8
  },
  timeline: {
    paddingLeft: 26,
    position: "relative"
  },
  timelineLine: {
    backgroundColor: "rgba(217,168,108,0.32)",
    bottom: 20,
    left: 4,
    position: "absolute",
    top: 14,
    width: 1
  },
  timelineItem: {
    flexDirection: "row",
    gap: 0,
    marginBottom: 0,
    minHeight: 0,
    paddingVertical: 16,
    position: "relative"
  },
  timelineDot: {
    backgroundColor: "rgba(217,168,108,0.6)",
    borderRadius: 999,
    height: 7,
    left: -25,
    position: "absolute",
    top: 22,
    width: 7
  },
  timelineDotActive: {
    backgroundColor: "rgba(242,200,142,0.98)",
    height: 10,
    left: -26,
    shadowColor: "#d9a86c",
    shadowOpacity: 0.55,
    shadowRadius: 14,
    width: 10
  },
  timelineCopy: {
    flex: 1
  },
  timelineMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    marginBottom: 9
  },
  timelineDate: {
    color: "rgba(205,191,168,0.6)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 1.3
  },
  timelineDateActive: {
    color: "rgba(232,200,150,0.88)"
  },
  timelineTag: {
    color: "rgba(232,200,150,0.78)",
    fontFamily: fontSerifEn,
    fontSize: 9,
    letterSpacing: 2.16
  },
  timelineQuestTag: {
    borderColor: "rgba(190,180,162,0.22)",
    borderRadius: 18,
    borderWidth: 1,
    color: "rgba(190,180,162,0.45)",
    fontFamily: fontSerifEn,
    fontSize: 9,
    letterSpacing: 1.8,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  timelineText: {
    color: "rgba(236,230,218,0.94)",
    fontFamily: fontSerifJa,
    fontSize: 17,
    fontWeight: "300",
    letterSpacing: 0.3,
    lineHeight: 30
  },
  timelineTextMuted: {
    color: "rgba(232,226,214,0.6)",
    fontFamily: fontSerifJa,
    fontSize: 17,
    fontWeight: "300",
    letterSpacing: 0.3,
    lineHeight: 30
  },
  storyScrollContent: {
    paddingBottom: 118,
    paddingHorizontal: 30,
    paddingTop: 58
  },
  storyHeader: {
    marginBottom: 23
  },
  chapterTimeline: {
    paddingLeft: 26,
    position: "relative"
  },
  chapterTimelineLine: {
    backgroundColor: "rgba(221,180,111,0.34)",
    bottom: 20,
    left: 1,
    position: "absolute",
    top: 8,
    width: 1
  },
  chapterTimelineItem: {
    flexDirection: "row",
    gap: 0,
    marginBottom: 30,
    position: "relative"
  },
  chapterTimelineDot: {
    backgroundColor: "rgba(238,224,202,0.22)",
    borderRadius: 999,
    height: 8,
    left: -28.6,
    position: "absolute",
    top: 11,
    width: 8
  },
  chapterTimelineDotActive: {
    backgroundColor: "#e8bd78",
    height: 14,
    left: -31.6,
    top: 8,
    shadowColor: "#e8bd78",
    shadowOpacity: 0.68,
    shadowRadius: 20,
    width: 14
  },
  chapterTimelineCopy: {
    flex: 1
  },
  chapterMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  },
  chapterOrdinalText: {
    color: "rgba(232,200,150,0.9)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 3.6
  },
  chapterPeriodText: {
    color: "rgba(221,180,111,0.62)",
    fontFamily: fontSerifEnMedium,
    fontSize: 11,
    letterSpacing: 2.4
  },
  chapterTimelineTitle: {
    color: "#F3E6D0",
    fontFamily: fontSerifJa,
    fontSize: 26,
    letterSpacing: 0.8,
    lineHeight: 35
  },
  chapterPastTitle: {
    color: "rgba(246,239,228,0.46)"
  },
  chapterTimelineSummary: {
    color: "rgba(222,206,180,0.62)",
    fontFamily: fontSerifJa,
    fontSize: 14,
    fontWeight: "300",
    letterSpacing: 0.6,
    lineHeight: 24,
    marginTop: 11
  },
  chapterPastSummary: {
    color: "rgba(238,224,202,0.32)"
  },
  chapterNowNote: {
    color: "rgba(232,200,150,0.7)",
    fontFamily: fontSerifEnMedium,
    fontSize: 10,
    letterSpacing: 2.2,
    marginTop: 13
  },
  chapterNewItem: {
    paddingBottom: 8,
    paddingTop: 18,
    position: "relative"
  },
  chapterNewDot: {
    borderColor: "rgba(190,180,162,0.4)",
    borderRadius: 999,
    borderStyle: "dashed",
    borderWidth: 1,
    height: 9,
    left: -29,
    position: "absolute",
    top: 24,
    width: 9
  },
  chapterNewCard: {
    alignItems: "center",
    borderColor: "rgba(190,180,162,0.22)",
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 16
  },
  chapterNewText: {
    color: "rgba(190,180,162,0.55)",
    fontFamily: fontSerifJa,
    fontSize: 14,
    letterSpacing: 0.8
  },
  chapterFindButton: {
    alignSelf: "flex-start",
    borderColor: "rgba(221,180,111,0.24)",
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 28,
    paddingHorizontal: 15,
    paddingVertical: 8
  },
  chapterFindButtonText: {
    color: "rgba(221,180,111,0.7)",
    fontFamily: fontSerifJa,
    fontSize: 12
  },
  lifeQuestDetailScroll: {
    paddingBottom: 40,
    paddingHorizontal: 34,
    paddingTop: 92
  },
  lifeQuestBack: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    outlineStyle: "none",
    position: "absolute",
    left: 22,
    top: 46,
    width: 40,
    zIndex: 10
  },
  lifeQuestBackText: {
    color: "rgba(221,180,111,0.82)",
    fontSize: 30,
    lineHeight: 32
  },
  lifeQuestDetailLabel: {
    color: "rgba(225,190,140,0.85)",
    fontFamily: fontSerifEnMedium,
    fontSize: 9,
    letterSpacing: 3,
    marginBottom: 0
  },
  lifeQuestDetailTitle: {
    color: "#F1E8DA",
    fontFamily: fontSerifJa,
    fontSize: 28,
    letterSpacing: 0.8,
    lineHeight: 39,
    marginTop: 12
  },
  lifeQuestDetailMeta: {
    color: "rgba(190,180,162,0.55)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 0.7,
    marginTop: 14
  },
  futureQuestNiloLine: {
    color: "rgba(228,196,142,0.7)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 0.5,
    lineHeight: 23,
    marginTop: 18
  },
  latestWordCard: {
    backgroundColor: "rgba(255,243,225,0.07)",
    borderColor: "rgba(240,224,198,0.18)",
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    shadowColor: "#d9a86c",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 40
  },
  latestWordLabel: {
    color: "rgba(225,190,140,0.7)",
    fontFamily: fontSerifEnMedium,
    fontSize: 9,
    letterSpacing: 2.4,
    marginBottom: 12
  },
  latestWordText: {
    color: "#F3E6D0",
    fontFamily: fontSerifJa,
    fontSize: 19,
    letterSpacing: 0.6,
    lineHeight: 36
  },
  recordTrailHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginTop: 34
  },
  recordTrailLabel: {
    color: "rgba(190,180,162,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 3.1
  },
  recordTrailRule: {
    backgroundColor: "rgba(221,180,111,0.16)",
    flex: 1,
    height: 1
  },
  lifeQuestActions: {
    gap: 12,
    marginTop: 36
  },
  lifeQuestTalkButton: {
    alignItems: "center",
    backgroundColor: "rgba(217,168,108,0.08)",
    borderColor: "rgba(217,168,108,0.34)",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 15
  },
  lifeQuestTalkText: {
    color: "rgba(228,184,124,0.92)",
    fontFamily: fontSerifJa,
    fontSize: 14,
    letterSpacing: 0.6
  },
  lifeQuestPhilosophy: {
    color: "rgba(190,180,162,0.4)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    lineHeight: 19,
    marginTop: 6,
    textAlign: "center"
  },
  lifeQuestRecordTimeline: {
    marginTop: 18,
    paddingLeft: 22,
    position: "relative"
  },
  lifeQuestRecordLine: {
    backgroundColor: "rgba(217,168,108,0.24)",
    bottom: 8,
    left: 3,
    position: "absolute",
    top: 8,
    width: 1
  },
  lifeQuestRecordItem: {
    flexDirection: "row",
    marginBottom: 0,
    paddingVertical: 13,
    position: "relative"
  },
  lifeQuestRecordDot: {
    backgroundColor: "rgba(217,168,108,0.7)",
    borderRadius: 999,
    height: 7,
    left: -22,
    position: "absolute",
    shadowColor: "#d9a86c",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 14,
    top: 19,
    width: 7
  },
  lifeQuestRecordCopy: {
    flex: 1
  },
  lifeQuestRecordDate: {
    color: "rgba(205,176,134,0.65)",
    fontFamily: fontSerifEnMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 6
  },
  lifeQuestRecordText: {
    color: "rgba(228,222,210,0.78)",
    fontFamily: fontSerifJa,
    fontSize: 15,
    lineHeight: 26
  },
  entryDetailScroll: {
    paddingBottom: 70,
    paddingHorizontal: 40,
    paddingTop: 96
  },
  entryDetailTopFade: {
    height: 96,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  entryDetailHeadRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 12
  },
  entryDetailDate: {
    color: "#E8E2D6",
    fontFamily: fontSerifJa,
    fontSize: 17,
    letterSpacing: 1.02
  },
  entryDetailTonight: {
    color: "rgba(232,200,150,0.78)",
    fontFamily: fontSerifEn,
    fontSize: 9,
    letterSpacing: 2.16
  },
  entryDetailQuestTag: {
    borderColor: "rgba(190,180,162,0.24)",
    borderRadius: 18,
    borderWidth: 1,
    color: "rgba(190,180,162,0.5)",
    fontFamily: fontSerifEn,
    fontSize: 9,
    letterSpacing: 1.8,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  entryDetailRule: {
    backgroundColor: "rgba(217,168,108,0.4)",
    height: 1,
    marginTop: 8,
    width: 46
  },
  entryDetailDialogue: {
    marginTop: 34
  },
  entryDetailMsg: {
    marginBottom: 30
  },
  entryDetailNiloLabel: {
    color: "rgba(225,190,140,0.78)",
    fontFamily: fontSerifEn,
    fontSize: 9,
    letterSpacing: 2.34,
    marginBottom: 11
  },
  entryDetailNiloText: {
    color: "rgba(208,198,182,0.66)",
    fontFamily: fontSerifJa,
    fontSize: 18,
    fontWeight: "300",
    letterSpacing: 0.54,
    lineHeight: 36
  },
  entryDetailUserText: {
    color: "#ECE6DA",
    fontFamily: fontSerifJa,
    fontSize: 20,
    letterSpacing: 0.6,
    lineHeight: 40
  },
  entryDetailEmotions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14
  },
  entryDetailEmotionChip: {
    borderColor: "rgba(217,168,108,0.28)",
    borderRadius: 20,
    borderWidth: 1,
    color: "rgba(228,196,150,0.82)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 0.48,
    paddingHorizontal: 14,
    paddingVertical: 6
  },
  entryDetailRelated: {
    marginTop: 44
  },
  entryDetailRelatedLabel: {
    color: "rgba(190,180,162,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 2.42
  },
  entryDetailRelatedItem: {
    borderLeftColor: "rgba(217,168,108,0.3)",
    borderLeftWidth: 1,
    marginTop: 16,
    paddingBottom: 4,
    paddingLeft: 18,
    paddingTop: 4
  },
  entryDetailRelatedDate: {
    color: "rgba(205,176,134,0.6)",
    fontFamily: fontSerifEn,
    fontSize: 10,
    letterSpacing: 1.8
  },
  entryDetailRelatedText: {
    color: "rgba(220,210,195,0.62)",
    fontFamily: fontSerifJa,
    fontSize: 16,
    fontWeight: "300",
    letterSpacing: 0.3,
    lineHeight: 29,
    marginTop: 6
  },
  entryDetailFooter: {
    color: "rgba(190,180,162,0.3)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    fontWeight: "300",
    letterSpacing: 1.76,
    marginTop: 50,
    textAlign: "center"
  },
  niloScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#100C0A",
    elevation: 50,
    zIndex: 50
  },
  niloScreenSafe: {
    flex: 1
  },
  niloTopTier: {
    alignItems: "center",
    flex: 1,
    paddingTop: 34
  },
  niloMarkWrap: {
    alignItems: "center",
    height: 46,
    justifyContent: "center",
    marginTop: 10,
    width: 46
  },
  niloMarkGlow: {
    height: 74,
    position: "absolute",
    width: 74
  },
  niloMarkCore: {
    backgroundColor: "#FBEAD0",
    borderRadius: 999,
    height: 11,
    shadowColor: "#d9a86c",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    width: 11
  },
  niloMarkLabel: {
    color: "rgba(225,190,140,0.82)",
    fontFamily: fontSerifEn,
    fontSize: 10,
    letterSpacing: 3.6,
    marginTop: 13
  },
  niloDateLabel: {
    color: "rgba(190,180,162,0.4)",
    fontFamily: fontSerifEn,
    fontSize: 10,
    letterSpacing: 2.4,
    marginTop: 6
  },
  niloQuestionArea: {
    alignItems: "center",
    alignSelf: "stretch",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 40
  },
  niloDialogQuestion: {
    color: "rgba(233,196,140,0.92)",
    fontFamily: fontSerifJa,
    fontSize: 27,
    letterSpacing: 1.35,
    lineHeight: 53,
    textAlign: "center",
    textShadowColor: "rgba(217,168,108,0.22)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 26
  },
  niloDialogCaret: {
    color: "rgba(242,200,142,0.92)",
    fontFamily: fontSerifJa,
    fontSize: 27
  },
  niloClosing: {
    alignItems: "center",
    paddingBottom: 40,
    paddingHorizontal: 26,
    paddingTop: 4
  },
  niloClosingText: {
    color: "rgba(190,180,162,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 0.96,
    lineHeight: 23,
    textAlign: "center"
  },
  niloBottomTier: {
    paddingBottom: 18
  },
  niloYouDivider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
    marginBottom: 2,
    paddingHorizontal: 30
  },
  niloYouLine: {
    flex: 1,
    height: 1
  },
  niloYouLabel: {
    color: "rgba(205,180,140,0.6)",
    fontFamily: fontSerifEn,
    fontSize: 9,
    letterSpacing: 3.06
  },
  niloDraftInput: {
    color: "#F3EDE1",
    fontFamily: fontSerifJa,
    fontSize: 23,
    letterSpacing: 0.69,
    lineHeight: 44,
    maxHeight: 150,
    minHeight: 64,
    outlineStyle: "none",
    paddingBottom: 13,
    paddingHorizontal: 32,
    paddingTop: 15,
    textAlign: "center"
  },
  niloSendButton: {
    alignSelf: "center",
    backgroundColor: "rgba(236,190,128,0.95)",
    borderRadius: 999,
    marginTop: 4,
    paddingHorizontal: 28,
    paddingVertical: 9,
    shadowColor: "#d9a86c",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 16
  },
  niloSendText: {
    color: "#2a1d10",
    fontFamily: fontSerifJa,
    fontSize: 14,
    letterSpacing: 0.7
  },
  niloExitLink: {
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 8
  },
  niloExitText: {
    color: "rgba(190,180,162,0.4)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 1.44
  },
  niloExitConfirmRow: {
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    paddingVertical: 8
  },
  niloExitConfirmText: {
    color: "rgba(238,224,202,0.6)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 1.2
  },
  niloExitConfirmActions: {
    flexDirection: "row",
    gap: 10
  },
  niloExitConfirmGhost: {
    borderColor: "rgba(255,254,244,0.2)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 9
  },
  niloExitConfirmGhostText: {
    color: "rgba(238,224,202,0.7)",
    fontFamily: fontSerifJa,
    fontSize: 13
  },
  niloExitConfirmPrimary: {
    backgroundColor: "rgba(236,190,128,0.95)",
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 9,
    shadowColor: "#d9a86c",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 16
  },
  niloExitConfirmPrimaryText: {
    color: "#2a1d10",
    fontFamily: fontSerifJa,
    fontSize: 13,
    fontWeight: "600"
  },
  screenBottomFade: {
    bottom: 60,
    height: 160,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 20
  },
  ritualBlackout: {
    backgroundColor: "#000000",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 100
  },
  tabBar: {
    alignSelf: "center",
    alignItems: "flex-start",
    backgroundColor: "transparent",
    bottom: 0,
    flexDirection: "row",
    gap: 2,
    height: 90,
    justifyContent: "space-around",
    left: 0,
    overflow: "hidden",
    paddingBottom: 0,
    paddingHorizontal: 12,
    paddingTop: 18,
    position: "absolute",
    right: 0,
    zIndex: 30
  },
  tabItem: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
    outlineStyle: "none"
  },
  tabItemMotion: {
    alignItems: "center",
    gap: 7,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 54,
    position: "relative"
  },
  tabText: {
    color: "rgba(190,180,162,0.4)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 1.04
  },
  tabTextActive: {
    color: "rgba(232,200,150,0.92)",
    fontFamily: fontSerifJaMedium,
    fontWeight: "500"
  },
  modal: {
    backgroundColor: "#100C0A",
    flex: 1
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    height: 132,
    justifyContent: "space-between",
    paddingBottom: 0,
    paddingHorizontal: 0,
    paddingTop: 58,
    zIndex: 2
  },
  modalBackButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    outlineStyle: "none",
    position: "absolute",
    left: 22,
    top: 54,
    width: 38
  },
  modalBackText: {
    color: "rgba(221,180,111,0.82)",
    fontSize: 32,
    lineHeight: 34
  },
  modalTitleWrap: {
    alignItems: "center",
    flex: 1
  },
  modalTitle: {
    color: "rgba(232,226,214,0.9)",
    fontFamily: fontSerifJa,
    fontSize: 22,
    letterSpacing: 2.2,
    lineHeight: 30,
    marginTop: 9
  },
  modalSub: {
    color: "rgba(190,180,162,0.45)",
    fontFamily: fontSerifEnMedium,
    fontSize: 11,
    letterSpacing: 3.7
  },
  settingSection: {
    gap: 24,
    paddingHorizontal: 0,
    paddingTop: 14,
    paddingBottom: 64
  },
  simpleSettingsPage: {
    paddingHorizontal: 42
  },
  arcSettingRow: {
    alignItems: "center",
    borderBottomColor: "rgba(232,226,214,0.06)",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 72,
    outlineStyle: "none",
    paddingVertical: 18
  },
  arcSettingRowLast: {
    borderBottomWidth: 0
  },
  arcSettingCopy: {
    flex: 1,
    gap: 8,
    paddingRight: 18
  },
  arcSettingTitle: {
    color: "rgba(236,230,218,0.9)",
    fontFamily: fontSerifJa,
    fontSize: 17,
    letterSpacing: 0.7,
    lineHeight: 24
  },
  arcSettingBody: {
    color: "rgba(190,180,162,0.45)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    fontWeight: "300",
    lineHeight: 18
  },
  arcSettingValueWrap: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 10
  },
  arcSettingValue: {
    color: "rgba(225,200,160,0.7)",
    fontFamily: fontSerifEn,
    fontSize: 15
  },
  arcSettingChevron: {
    color: "rgba(238,224,202,0.22)",
    fontSize: 20,
    lineHeight: 20,
    marginTop: -2
  },
  arcSwitch: {
    alignItems: "center",
    backgroundColor: "rgba(217,168,108,0.28)",
    borderColor: "rgba(217,168,108,0.26)",
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 4,
    width: 58
  },
  arcSwitchOn: {
    backgroundColor: "rgba(221,180,111,0.48)",
    shadowColor: "#e8bd78",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 14
  },
  arcSwitchKnob: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(238,224,202,0.5)",
    borderRadius: 999,
    height: 22,
    width: 22
  },
  arcSwitchKnobOn: {
    alignSelf: "flex-end",
    backgroundColor: "#ffd08a"
  },
  arcGroupLabel: {
    color: "rgba(217,168,108,0.42)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 2.6,
    marginBottom: 2,
    marginTop: 6
  },
  arcGroupLabelSpaced: {
    marginTop: 44
  },
  arcSectionIndex: {
    color: "rgba(217,168,108,0.5)",
    fontFamily: fontSerifEnLight,
    fontSize: 15,
    letterSpacing: 1.6,
    marginRight: 16
  },
  inlineConfirmBlock: {
    borderColor: "rgba(255,254,244,0.1)",
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginTop: 12,
    padding: 14
  },
  dangerConfirmRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4
  },
  dangerConfirmButton: {
    flex: 1
  },
  settingsWordmark: {
    alignItems: "center",
    marginTop: 92
  },
  settingsWordmarkText: {
    color: "rgba(217,168,108,0.3)",
    fontFamily: fontSerifEnLight,
    fontSize: 26,
    letterSpacing: 11
  },
  settingsVersion: {
    color: "rgba(190,180,162,0.28)",
    fontFamily: fontSerifEn,
    fontSize: 10,
    letterSpacing: 2.2,
    marginTop: 8
  },
  settingsDetailStack: {
    gap: 24
  },
  arcSettingGroup: {
    gap: 10,
    marginBottom: 30
  },
  arcSettingGroupCard: {
    backgroundColor: "rgba(255,254,244,0.028)",
    borderColor: "rgba(217,168,108,0.10)",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 18
  },
  settingTimeCaption: {
    color: "rgba(190,180,162,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 0.4,
    lineHeight: 18,
    marginTop: 2
  },
  settingTimeInput: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,254,244,0.045)",
    borderColor: "rgba(217,168,108,0.22)",
    color: "#F6ECDB",
    fontFamily: fontSerifEnMedium,
    fontSize: 17,
    letterSpacing: 3,
    maxWidth: 140,
    minWidth: 108,
    textAlign: "center"
  },
  settingTimeRangeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  settingTimeRangeTilde: {
    color: "rgba(222,206,180,0.45)",
    fontFamily: fontSerifJa,
    fontSize: 14
  },
  webPhoneFrameOuter: {
    alignItems: "center",
    backgroundColor: "#0a0806",
    flex: 1,
    justifyContent: "center",
    minHeight: "100vh",
    width: "100%"
  },
  chpContainer: {
    flex: 1
  },
  chpPage: {
    borderRadius: 22,
    flex: 1,
    overflow: "hidden"
  },
  chpPageScroll: {
    paddingBottom: 120,
    paddingHorizontal: 26,
    paddingTop: 64
  },
  chpMetaRow: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  chpOrdinal: {
    color: "#c9a86c",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 4
  },
  chpPeriod: {
    color: "rgba(196,176,148,0.55)",
    fontFamily: fontSerifEn,
    fontSize: 10,
    letterSpacing: 2.4
  },
  chpTitle: {
    color: "#f4ead8",
    fontFamily: fontSerifJa,
    fontSize: 30,
    letterSpacing: 3,
    lineHeight: 44,
    marginTop: 14
  },
  chpSummary: {
    color: "rgba(216,202,178,0.72)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 1.4,
    lineHeight: 24,
    marginTop: 8
  },
  chpNowNote: {
    color: "rgba(217,168,108,0.66)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 10
  },
  chpSectionHeader: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    marginTop: 34
  },
  chpSectionLabel: {
    color: "rgba(201,168,108,0.8)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 3
  },
  chpSectionRule: {
    backgroundColor: "rgba(217,168,108,0.16)",
    flex: 1,
    height: 1
  },
  chpSectionNote: {
    color: "rgba(196,176,148,0.42)",
    fontFamily: fontSerifJa,
    fontSize: 10,
    letterSpacing: 1.6
  },
  chpExcerpt: {
    borderLeftColor: "rgba(217,168,108,0.22)",
    borderLeftWidth: 1,
    marginBottom: 14,
    paddingLeft: 14
  },
  chpExcerptDate: {
    color: "rgba(196,176,148,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 10,
    letterSpacing: 1.8,
    marginBottom: 4
  },
  chpExcerptText: {
    color: "rgba(233,222,202,0.88)",
    fontFamily: fontSerifJa,
    fontSize: 14,
    letterSpacing: 0.8,
    lineHeight: 25
  },
  chpReunionQuote: {
    color: "rgba(224,210,188,0.8)",
    fontFamily: fontSerifJa,
    fontSize: 14,
    letterSpacing: 1,
    lineHeight: 26
  },
  chpWishTheme: {
    color: "rgba(238,226,204,0.9)",
    fontFamily: fontSerifJa,
    fontSize: 16,
    letterSpacing: 1.4,
    lineHeight: 27
  },
  chpWishLine: {
    color: "rgba(201,168,108,0.7)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 1,
    lineHeight: 21,
    marginTop: 6
  },
  chpWordsWrap: {
    alignItems: "baseline",
    columnGap: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10
  },
  chpWord: {
    color: "#e6d8bc",
    fontFamily: fontSerifJa,
    letterSpacing: 1.6
  },
  chpFigures: {
    color: "rgba(224,210,188,0.72)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 1.4,
    lineHeight: 24
  },
  chpNiloLetter: {
    color: "rgba(216,202,178,0.78)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 1,
    lineHeight: 26
  },
  chpSelfNoteInput: {
    backgroundColor: "rgba(255,254,244,0.03)",
    borderColor: "rgba(217,168,108,0.18)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#efe6d4",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 0.8,
    lineHeight: 22,
    minHeight: 88,
    padding: 14,
    textAlignVertical: "top"
  },
  chpStats: {
    color: "rgba(196,176,148,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 40,
    textAlign: "center"
  },
  chpStatsEmotion: {
    color: "rgba(196,176,148,0.38)",
    fontFamily: fontSerifJa,
    fontSize: 10,
    letterSpacing: 1.8,
    marginTop: 6,
    textAlign: "center"
  },
  chpEndLabel: {
    color: "rgba(201,168,108,0.8)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 3.4,
    marginTop: 46,
    textAlign: "center"
  },
  chpEndNote: {
    color: "rgba(196,176,148,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 1.2,
    lineHeight: 24,
    marginBottom: 26,
    marginTop: 16,
    textAlign: "center"
  },
  chpThread: {
    alignItems: "flex-end",
    bottom: 0,
    gap: 5,
    justifyContent: "center",
    position: "absolute",
    right: 7,
    top: 0
  },
  chpThreadSegment: {
    backgroundColor: "rgba(196,176,148,0.22)",
    borderRadius: 1,
    width: 2
  },
  chpThreadSegmentEnd: {
    backgroundColor: "rgba(196,176,148,0.14)",
    height: 12
  },
  chpThreadSegmentActive: {
    backgroundColor: "#d9a86c",
    shadowColor: "#d9a86c",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    width: 3
  }
});

const FONT_SCALE_VALUES = { small: 0.92, standard: 1, large: 1.12 };

function buildStyles(scale) {
  if (scale === 1) return StyleSheet.create(baseStyleDefs);
  const scaled = {};
  for (const key of Object.keys(baseStyleDefs)) {
    const def = baseStyleDefs[key];
    const next = { ...def };
    if (typeof next.fontSize === "number") next.fontSize = Math.round(next.fontSize * scale);
    if (typeof next.lineHeight === "number") next.lineHeight = Math.round(next.lineHeight * scale);
    scaled[key] = next;
  }
  return StyleSheet.create(scaled);
}

// 書体サイズ設定はモジュール変数 styles を差し替えて全体に反映する。
// 全コンポーネントがレンダー時に styles.x を読む前提なので、React.memo で
// レンダーを飛ばすコンポーネントを追加するとスタイルが古いままになる点に注意。
let styles = buildStyles(1);
let appliedFontScale = 1;

function applyFontScale(mode) {
  const scale = FONT_SCALE_VALUES[mode] || 1;
  if (scale === appliedFontScale) return;
  appliedFontScale = scale;
  styles = buildStyles(scale);
}
