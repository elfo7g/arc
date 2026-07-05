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
import { collectSyncedState, fetchRemoteUserState, saveRemoteUserState } from "./src/userState";
import {
  LANGUAGES,
  LOCALE_TAGS,
  LanguageContext,
  useT,
  useLang,
  translate,
  formatMonthDay,
  formatWeekday,
  formatQuestSince as formatLocalizedQuestSince,
  formatQuestDuration as formatLocalizedQuestDuration,
  formatNotificationTimestamp,
  CRISIS_STRONG_SIGNALS_ALL,
  CRISIS_SOFT_SIGNALS_ALL
} from "./src/i18n";

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

const DEFAULT_LANGUAGE = "ja";
const SUPPORTED_LANGUAGE_CODES = new Set(LANGUAGES.map(([value]) => value));

function normalizeLanguageCode(value) {
  return SUPPORTED_LANGUAGE_CODES.has(value) ? value : DEFAULT_LANGUAGE;
}

function migrateSavedSettings(current, savedSettings) {
  const safeSaved = savedSettings && typeof savedSettings === "object" ? savedSettings : {};
  const next = {
    ...(current || {}),
    ...safeSaved,
    ritual: { ...((current || {}).ritual || {}), ...(safeSaved.ritual || {}) },
    privacy: { ...((current || {}).privacy || {}), ...(safeSaved.privacy || {}) },
    reflection: { ...((current || {}).reflection || {}), ...(safeSaved.reflection || {}) },
    security: { ...((current || {}).security || {}), ...(safeSaved.security || {}) },
    inheritance: { ...((current || {}).inheritance || {}), ...(safeSaved.inheritance || {}) }
  };
  next.language = normalizeLanguageCode(next.language);

  // A language picker was added after existing dev data already existed.
  // If that older local state accidentally saved Chinese, keep the app in its
  // Japanese source voice until the user explicitly changes the language again.
  if (DEV_MODE && safeSaved.language === "zh" && safeSaved.languageExplicitlySelected !== true) {
    next.language = DEFAULT_LANGUAGE;
  }

  return next;
}

function getTabs(lang) {
  const safeLang = normalizeLanguageCode(lang);
  return [
    { id: "home", label: translate(safeLang, "tabs.home") },
    { id: "quests", label: translate(safeLang, "tabs.quests") },
    { id: "journal", label: translate(safeLang, "tabs.journal") },
    { id: "story", label: translate(safeLang, "tabs.story") }
  ];
}

function getTermsSections(lang) {
  return translate(lang, "terms.sections");
}

function getPrivacyPolicySections(lang) {
  return translate(lang, "privacy.sections");
}

function getBgmTracks(lang) {
  return [
    {
      id: "arc-night",
      title: "Arc Night",
      subtitle: translate(lang, "bgm.arcNightSubtitle"),
      source: require("./assets/audio/arc-night.wav")
    }
  ];
}
const uiTapSound = require("./assets/audio/arc-tap.wav");
let optionalAudio = null;
try {
  optionalAudio = require("expo-audio");
} catch {
  optionalAudio = null;
}

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
// 初回起動フロー（Onboarding Spec v1.0）をDEV_MODEでも通しで確認したいときだけ true。
const DEV_SHOW_ONBOARDING = false;
// 日記STEP1の問い。初回起動の「はじめての記録」はここへ接続する。
function getFirstRecordQuestion(lang) {
  return translate(lang, "onboarding.firstRecordQuestion");
}
// 同意画面の導線。正式な文書URLが決まるまでは空のまま（行は表示するが開かない）。
const ONBOARDING_TERMS_URL = "";
const ONBOARDING_PRIVACY_URL = "";
// 深刻なつらさが続くとき(離脱防止方針書 §03)、評価も励ましもせず静かに差し出す
// 相談先。個別の電話番号は変わりうるため、公的なポータルへ一本化し、詳細はここで
// 一元管理する（掲載窓口の最新情報は各機関で要確認）。
const SUPPORT_RESOURCE_URL = "https://www.mhlw.go.jp/mamorouyokokoro/";
// つらさの判定は端末内で完結させ、記録を外部に送らない。強い信号は一度でも、
// 弱い信号は複数の回答にまたがって現れたときだけ導線を灯す（＝「続く場合」）。
// UI言語に関わらず、ユーザーがどの言語で書いても検知できるよう全言語のキーワードを
// 常時マージしてチェックする（安全機能のため、表示言語には依存させない）。
function detectPersistentDistress(messages) {
  const userTexts = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && m.role === "user" && m.text)
    .map((m) => String(m.text).toLowerCase());
  if (!userTexts.length) return false;
  if (userTexts.some((text) => CRISIS_STRONG_SIGNALS_ALL.some((sig) => text.includes(sig.toLowerCase())))) return true;
  const withSoft = userTexts.filter((text) => CRISIS_SOFT_SIGNALS_ALL.some((sig) => text.includes(sig.toLowerCase())));
  return withSoft.length >= 2;
}
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
function getReflectionQuestions(lang) {
  return [translate(lang, "ritual.sentinelQuestion")];
}
const maxReflectionQuestions = 5;

async function invokeNilo(route, body) {
  const { data, error } = await supabase.functions.invoke("nilo", {
    body: { route, ...body }
  });
  if (error) throw error;
  return data;
}

// Demo entries use relative dates so the preview always exercises the recent
// window, the monthly bands, and the chapter guidance card, whatever today is.
// (getJournalDateKey/toDateKey are hoisted declarations, callable here.)
function demoDaysAgoKey(days) {
  const date = new Date(`${getJournalDateKey()}T00:00:00`);
  date.setDate(date.getDate() - days);
  return toDateKey(date);
}

const demoJournalEntries = [
  {
    id: "demo-journal-walk",
    dateKey: demoDaysAgoKey(0),
    source: "home",
    event: "夕方、ひとりで川沿いの道を長く歩いた。",
    meaning: "何も考えないでいい時間が、ずっと欲しかったのかもしれない。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "夕方、ひとりで川沿いの道を長く歩いた。" },
      { role: "nilo", text: "ひとりの時間は、あなたにとってどんな意味があった？" },
      { role: "user", text: "誰にも気をつかわなくていい。ようやく、呼吸ができた気がした。" },
      { role: "nilo", text: "その「呼吸ができた」感じを、最近よく探している？" },
      { role: "user", text: "何も考えないでいい時間が、ずっと欲しかったのかもしれない。" }
    ],
    emotions: ["#静けさ", "#回復", "#ひとり時間"],
    related: [{ date: "5月19日", text: "夜、海まで歩いた。波の音だけが、ずっと残っていた。" }]
  },
  {
    id: "demo-journal-quest",
    dateKey: demoDaysAgoKey(2),
    source: "quest",
    questText: "いちばん安心する場所は、どこ？",
    event: "実家の台所の隅を、ふいに思い出した。",
    meaning: "守られていた頃の時間は、もう戻れないけど、確かにあった。",
    dialogue: [
      { role: "nilo", text: "いちばん安心する場所は、どこ？" },
      { role: "user", text: "実家の台所の隅。母が料理していた音がする場所。" },
      { role: "nilo", text: "その音は、いまのあなたに何を思い出させる？" },
      { role: "user", text: "守られていた頃の時間は、もう戻れないけど、確かにあった。" }
    ],
    emotions: ["#安心", "#記憶", "#家族"]
  },
  {
    id: "demo-journal-rain",
    dateKey: demoDaysAgoKey(5),
    source: "home",
    meaning: "雨の音で目が覚めた。久しぶりに、何も予定のない朝。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "雨の音で目が覚めた。久しぶりに、何も予定のない朝。" }
    ],
    emotions: ["#休息", "#静けさ"]
  },
  {
    id: "demo-journal-call",
    dateKey: demoDaysAgoKey(9),
    source: "home",
    event: "母に電話した。短い会話だった。",
    meaning: "「ありがとう」は、いつも言いそびれてしまう。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "母に電話した。短い会話だったけど、声が聞けてよかった。" },
      { role: "nilo", text: "伝えられなかったことは、何かある？" },
      { role: "user", text: "「ありがとう」は、いつも言いそびれてしまう。" }
    ],
    emotions: ["#家族", "#感謝"]
  },
  {
    id: "demo-journal-release",
    dateKey: demoDaysAgoKey(13),
    source: "quest",
    questText: "そっと手放したいものは？",
    event: "完璧じゃない自分を、責めてしまう癖のこと。",
    meaning: "手放せたら、もう少し自分にやさしくなれる気がする。",
    dialogue: [
      { role: "nilo", text: "そっと手放したいものは？" },
      { role: "user", text: "完璧じゃない自分を責める癖。" },
      { role: "nilo", text: "それを手放せたら、何が変わると思う？" },
      { role: "user", text: "手放せたら、もう少し自分にやさしくなれる気がする。" }
    ],
    emotions: ["#決意", "#内省"]
  },
  {
    id: "demo-journal-evening-light",
    dateKey: demoDaysAgoKey(1),
    source: "home",
    event: "帰り道、ビルの窓に夕焼けが反射していた。",
    meaning: "同じ街なのに、今日は少しだけやわらかく見えた。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "帰り道、ビルの窓に夕焼けが反射していた。" },
      { role: "nilo", text: "その光は、どんな気持ちを連れてきた？" },
      { role: "user", text: "同じ街なのに、今日は少しだけやわらかく見えた。" }
    ],
    emotions: ["#夕方", "#安堵"]
  },
  {
    id: "demo-journal-library",
    dateKey: demoDaysAgoKey(3),
    source: "home",
    meaning: "ページをめくる音だけで、少し落ち着いた。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "図書館の隅で、しばらく本を読んでいた。" },
      { role: "user", text: "ページをめくる音だけで、少し落ち着いた。" }
    ],
    emotions: ["#静けさ", "#集中"]
  },
  {
    id: "demo-journal-small-win",
    dateKey: demoDaysAgoKey(4),
    source: "quest",
    questText: "今日の小さな勝ちは？",
    event: "先延ばしにしていた返信を、ひとつ送れた。",
    meaning: "大きく進んでいなくても、止まってはいなかった。",
    dialogue: [
      { role: "nilo", text: "今日の小さな勝ちは？" },
      { role: "user", text: "先延ばしにしていた返信を、ひとつ送れた。" },
      { role: "nilo", text: "それを終えたあと、体はどう変わった？" },
      { role: "user", text: "大きく進んでいなくても、止まってはいなかった。" }
    ],
    emotions: ["#前進", "#軽さ"]
  },
  {
    id: "demo-journal-coffee",
    dateKey: demoDaysAgoKey(7),
    source: "home",
    event: "朝のコーヒーが、いつもより苦く感じた。",
    meaning: "疲れは、気分より先に舌に出るのかもしれない。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "朝のコーヒーが、いつもより苦く感じた。" },
      { role: "nilo", text: "その違和感は、何を知らせていた？" },
      { role: "user", text: "疲れは、気分より先に舌に出るのかもしれない。" }
    ],
    emotions: ["#疲れ", "#気づき"]
  },
  {
    id: "demo-journal-train",
    dateKey: demoDaysAgoKey(11),
    source: "home",
    meaning: "知らない駅で降りただけで、一日の輪郭が変わった。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "いつもと違う駅で降りて、遠回りして帰った。" },
      { role: "user", text: "知らない駅で降りただけで、一日の輪郭が変わった。" }
    ],
    emotions: ["#寄り道", "#変化"]
  },
  {
    id: "demo-journal-cleanup",
    dateKey: demoDaysAgoKey(17),
    source: "quest",
    questText: "いま一番軽くしたい場所は？",
    event: "机の上を片づけた。古いメモをいくつか捨てた。",
    meaning: "場所が空くと、考えにも少し余白が戻ってくる。",
    dialogue: [
      { role: "nilo", text: "いま一番軽くしたい場所は？" },
      { role: "user", text: "机の上を片づけた。古いメモをいくつか捨てた。" },
      { role: "nilo", text: "捨てたあと、何が残った？" },
      { role: "user", text: "場所が空くと、考えにも少し余白が戻ってくる。" }
    ],
    emotions: ["#整理", "#余白"]
  },
  {
    id: "demo-journal-letter",
    dateKey: demoDaysAgoKey(21),
    source: "home",
    event: "昔の自分に向けて、短い手紙を書いた。",
    meaning: "あの頃の不安を、いまなら少しだけ抱え直せる。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "昔の自分に向けて、短い手紙を書いた。" },
      { role: "nilo", text: "いまのあなたなら、何を渡してあげたい？" },
      { role: "user", text: "あの頃の不安を、いまなら少しだけ抱え直せる。" }
    ],
    emotions: ["#過去", "#やさしさ"]
  },
  {
    id: "demo-journal-morning-stretch",
    dateKey: demoDaysAgoKey(27),
    source: "home",
    meaning: "肩の力を抜いたら、予定も少しだけ小さく見えた。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "朝、窓を開けて少しだけ体を伸ばした。" },
      { role: "user", text: "肩の力を抜いたら、予定も少しだけ小さく見えた。" }
    ],
    emotions: ["#身体", "#朝"]
  },
  {
    id: "demo-journal-m1a",
    dateKey: demoDaysAgoKey(35),
    source: "home",
    meaning: "急がない一日も、ちゃんと一日だった。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "急がない一日も、ちゃんと一日だった。" }
    ],
    emotions: ["#休息"]
  },
  {
    id: "demo-journal-m1b",
    dateKey: demoDaysAgoKey(40),
    source: "home",
    meaning: "古い友人の声は、時間を一瞬で巻き戻す。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "古い友人の声は、時間を一瞬で巻き戻す。" }
    ],
    emotions: ["#友情", "#記憶"]
  },
  {
    id: "demo-journal-m1c",
    dateKey: demoDaysAgoKey(44),
    source: "home",
    meaning: "夜の台所で飲むお茶が、一日の句点になっている。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "夜の台所で飲むお茶が、一日の句点になっている。" }
    ],
    emotions: ["#習慣", "#静けさ"]
  },
  {
    id: "demo-journal-m1d",
    dateKey: demoDaysAgoKey(49),
    source: "quest",
    questText: "最近、何度も戻ってくる言葉は？",
    event: "ノートの端に「急がなくていい」と書いていた。",
    meaning: "自分に言い聞かせている言葉ほど、必要な言葉なのかもしれない。",
    dialogue: [
      { role: "nilo", text: "最近、何度も戻ってくる言葉は？" },
      { role: "user", text: "急がなくていい、かな。ノートの端にも書いていた。" },
      { role: "user", text: "自分に言い聞かせている言葉ほど、必要な言葉なのかもしれない。" }
    ],
    emotions: ["#言葉", "#焦り"]
  },
  {
    id: "demo-journal-m1e",
    dateKey: demoDaysAgoKey(54),
    source: "home",
    meaning: "誰かの笑い声に、思ったより救われていた。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "コンビニの前で、知らない人たちが楽しそうに笑っていた。" },
      { role: "user", text: "誰かの笑い声に、思ったより救われていた。" }
    ],
    emotions: ["#人", "#ぬくもり"]
  },
  {
    id: "demo-journal-m1f",
    dateKey: demoDaysAgoKey(59),
    source: "home",
    event: "夜、部屋の明かりを少し暗くした。",
    meaning: "暗さは怖いだけじゃなくて、休むための場所にもなる。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "夜、部屋の明かりを少し暗くした。" },
      { role: "nilo", text: "その暗さは、どんな感じがした？" },
      { role: "user", text: "暗さは怖いだけじゃなくて、休むための場所にもなる。" }
    ],
    emotions: ["#夜", "#休息"]
  },
  {
    id: "demo-journal-m2a",
    dateKey: demoDaysAgoKey(66),
    source: "home",
    meaning: "うまく言えなかった悔しさも、残しておきたい。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "うまく言えなかった悔しさも、残しておきたい。" }
    ],
    emotions: ["#葛藤"]
  },
  {
    id: "demo-journal-m2b",
    dateKey: demoDaysAgoKey(71),
    source: "home",
    meaning: "季節の変わり目の匂いに、少しだけ背中を押された。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "季節の変わり目の匂いに、少しだけ背中を押された。" }
    ],
    emotions: ["#季節", "#前進"]
  },
  {
    id: "demo-journal-m2c",
    dateKey: demoDaysAgoKey(78),
    source: "home",
    meaning: "待つことにも、ちゃんと体力がいる。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "返事を待っている時間が、思ったより長く感じた。" },
      { role: "user", text: "待つことにも、ちゃんと体力がいる。" }
    ],
    emotions: ["#待つ", "#緊張"]
  },
  {
    id: "demo-journal-m2d",
    dateKey: demoDaysAgoKey(86),
    source: "quest",
    questText: "最近、守りたいものは？",
    event: "朝の静かな時間だけは、予定を入れずに残した。",
    meaning: "小さな領域を守ることが、自分を守ることにつながる。",
    dialogue: [
      { role: "nilo", text: "最近、守りたいものは？" },
      { role: "user", text: "朝の静かな時間だけは、予定を入れずに残した。" },
      { role: "user", text: "小さな領域を守ることが、自分を守ることにつながる。" }
    ],
    emotions: ["#境界線", "#静けさ"]
  },
  {
    id: "demo-journal-m2e",
    dateKey: demoDaysAgoKey(94),
    source: "home",
    meaning: "思い出せない名前より、覚えている空気のほうが濃かった。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "古い写真を見つけた。名前は思い出せない人もいた。" },
      { role: "user", text: "思い出せない名前より、覚えている空気のほうが濃かった。" }
    ],
    emotions: ["#写真", "#記憶"]
  },
  {
    id: "demo-journal-m3a",
    dateKey: demoDaysAgoKey(100),
    source: "home",
    meaning: "始まりの日の緊張を、忘れたくない。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "始まりの日の緊張を、忘れたくない。" }
    ],
    emotions: ["#緊張", "#始まり"]
  },
  {
    id: "demo-journal-m3b",
    dateKey: demoDaysAgoKey(112),
    source: "home",
    meaning: "言葉にする前から、答えは少し体に出ていた。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "予定を断る前、胸が少し軽くなっていた。" },
      { role: "user", text: "言葉にする前から、答えは少し体に出ていた。" }
    ],
    emotions: ["#身体", "#選択"]
  },
  {
    id: "demo-journal-m3c",
    dateKey: demoDaysAgoKey(132),
    source: "quest",
    questText: "いまの自分に足りないやさしさは？",
    event: "眠る前に、明日の自分へ水を一杯置いた。",
    meaning: "未来の自分を少し信じている行動だった。",
    dialogue: [
      { role: "nilo", text: "いまの自分に足りないやさしさは？" },
      { role: "user", text: "眠る前に、明日の自分へ水を一杯置いた。" },
      { role: "user", text: "未来の自分を少し信じている行動だった。" }
    ],
    emotions: ["#未来", "#やさしさ"]
  },
  {
    id: "demo-journal-m4a",
    dateKey: demoDaysAgoKey(155),
    source: "home",
    meaning: "遠くの灯りを見ていると、急がなくても帰れる気がした。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "バスの窓から、遠くの灯りをずっと見ていた。" },
      { role: "user", text: "遠くの灯りを見ていると、急がなくても帰れる気がした。" }
    ],
    emotions: ["#帰り道", "#安心"]
  },
  {
    id: "demo-journal-m4b",
    dateKey: demoDaysAgoKey(181),
    source: "home",
    event: "久しぶりに、誰にも見せない絵を描いた。",
    meaning: "評価されない場所でだけ、戻ってくる自分がいる。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "久しぶりに、誰にも見せない絵を描いた。" },
      { role: "user", text: "評価されない場所でだけ、戻ってくる自分がいる。" }
    ],
    emotions: ["#創作", "#自由"]
  },
  {
    id: "demo-journal-old-a",
    dateKey: demoDaysAgoKey(215),
    source: "home",
    meaning: "遠い日の決心。ここから、すべてが動き出した。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "遠い日の決心。ここから、すべてが動き出した。" }
    ],
    emotions: ["#決意"]
  },
  {
    id: "demo-journal-old-b",
    dateKey: demoDaysAgoKey(240),
    source: "home",
    meaning: "冬の朝の光は、静かに公平だった。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "冬の朝の光は、静かに公平だった。" }
    ],
    emotions: ["#静けさ"]
  },
  {
    id: "demo-journal-old-c",
    dateKey: demoDaysAgoKey(270),
    source: "home",
    meaning: "あのときの沈黙は、拒絶ではなく保留だったのかもしれない。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "昔の会話をふと思い出した。言えなかった言葉ばかりだった。" },
      { role: "user", text: "あのときの沈黙は、拒絶ではなく保留だったのかもしれない。" }
    ],
    emotions: ["#沈黙", "#理解"]
  },
  {
    id: "demo-journal-old-d",
    dateKey: demoDaysAgoKey(330),
    source: "quest",
    questText: "一年前の自分に、今なら何を言う？",
    event: "焦っていた頃のメモを読み返した。",
    meaning: "遅れているんじゃなくて、まだ育っている途中だった。",
    dialogue: [
      { role: "nilo", text: "一年前の自分に、今なら何を言う？" },
      { role: "user", text: "焦っていた頃のメモを読み返した。" },
      { role: "user", text: "遅れているんじゃなくて、まだ育っている途中だった。" }
    ],
    emotions: ["#一年", "#成長"]
  },
  {
    id: "demo-journal-lastyear",
    dateKey: demoDaysAgoKey(366),
    source: "home",
    event: "去年の今ごろ、同じ川沿いを歩いていた。",
    meaning: "あの頃はまだ、この静けさが怖かった。",
    dialogue: [
      { role: "nilo", text: "今日、一番心が動いたことは？" },
      { role: "user", text: "去年の今ごろ、同じ川沿いを歩いていた。" },
      { role: "nilo", text: "その頃と、いまで何が変わった？" },
      { role: "user", text: "あの頃はまだ、この静けさが怖かった。" }
    ],
    emotions: ["#季節", "#変化"]
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

// Diary spec v1.0: the diary carries only "now". Entries inside the recent
// window show in full two-layer detail; older ones fold into monthly bands;
// beyond the archive horizon the diary defers to the chapter tab entirely.
const DIARY_RECENT_DAYS = 14;
const DIARY_ARCHIVE_MONTHS = 6;
const englishMonthNames = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];
const japaneseMonthNames = [
  "睦月", "如月", "弥生", "卯月", "皐月", "水無月",
  "文月", "葉月", "長月", "神無月", "霜月", "師走"
];

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

function getEmailOtpErrorMessage(error, lang) {
  const message = String(error?.message || "");
  const status = error?.status;
  if (status === 403 || /expired|invalid|token|otp|code/i.test(message)) {
    return translate(lang, "auth.otpInvalid");
  }
  return message || translate(lang, "auth.otpGeneric");
}

function AppContent() {
  const { height } = useWindowDimensions();
  const initialReflectionQuestion = getReflectionQuestions("ja")[0];
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
    { role: "nilo", text: initialReflectionQuestion }
  ]);
  const [currentReflectionQuestion, setCurrentReflectionQuestion] = useState(initialReflectionQuestion);
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
  // 夜の対話で深刻なつらさが続いたとき(§03)だけ静かに灯る相談導線。判定は端末内。
  const [supportVisible, setSupportVisible] = useState(false);
  const [journal, setJournal] = useState([]);
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
  const [remoteHydrated, setRemoteHydrated] = useState(false);
  const remoteSyncedUserIdRef = useRef(null);
  const [profile, setProfile] = useState(() => DEV_MODE ? DEV_PROFILE : { name: "", birthdate: "" });
  // 初回起動フロー（Onboarding Spec v1.0）。完了フラグは保存データに含め、
  // 再インストール・別デバイスでもリモート復元後に再表示されないようにする。
  const [onboardingComplete, setOnboardingComplete] = useState(() => DEV_MODE && !DEV_SHOW_ONBOARDING);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [firstRecordPending, setFirstRecordPending] = useState(false);
  // はじめての記録の封時だけ、鍵アイコンと暗号化の一文を灯す。
  const firstRecordSealRef = useRef(false);
  const [encryptionNoticeVisible, setEncryptionNoticeVisible] = useState(false);
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

  const lang = normalizeLanguageCode(settings.language);
  const t = (key, ...args) => translate(lang, key, ...args);
  const tabs = getTabs(lang);
  const bgmTracks = getBgmTracks(lang);
  const reflectionQuestions = getReflectionQuestions(lang);
  const FIRST_RECORD_QUESTION = getFirstRecordQuestion(lang);

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
  const composerPrompt = journalRecordedThisPeriod
    ? t(`ritual.reflectionDonePrompts.${reflectionFrequency}`)
    : t("ritual.answerShortPrompt");
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

  // Dip the screen to black, swap what's on screen at peak black, then lift the
  // blackout to reveal the new state. The blackout still fully masks the swap
  // as before — the only change is that arriving at black is now a short fade
  // rather than an instant cut, so both entering and leaving read as a smooth
  // cross-dissolve instead of a hard jump.
  function dipToBlack(onBlack) {
    ritualBlackout.stopAnimation();
    Animated.timing(ritualBlackout, {
      toValue: 1,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (!finished) return;
      onBlack?.();
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(ritualBlackout, {
          toValue: 0,
          duration: 640,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]).start();
    });
  }

  // Same blackout-then-fade the ritual opens with, played in reverse on the
  // way out — so leaving reads as deliberately as arriving did.
  function exitNightRitualWithBlackout() {
    dipToBlack(exitNightRitual);
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

  function applySavedState(saved) {
    if (!saved || typeof saved !== "object") return;
    if (Array.isArray(saved.journal)) setJournal(saved.journal);
    if (Array.isArray(saved.memories)) setMemories(saved.memories);
    if (Array.isArray(saved.chapters)) setChapters(saved.chapters);
    if (saved.chapterNotes && typeof saved.chapterNotes === "object") setChapterNotes(saved.chapterNotes);
    if (Array.isArray(saved.questProposals)) setQuestProposals(saved.questProposals);
    if (Array.isArray(saved.explorations)) setExplorations(saved.explorations);
    if (Array.isArray(saved.declinedQuestThemes)) setDeclinedQuestThemes(saved.declinedQuestThemes);
    if (typeof saved.questScanDateKey === "string") setQuestScanDateKey(saved.questScanDateKey);
    if (Array.isArray(saved.notifications)) setNotifications(saved.notifications);
    if (saved.profile && typeof saved.profile === "object") {
      setProfile((current) => ({ ...(current || {}), ...saved.profile }));
    }
    // 明示フラグ、またはプロフィール完了済みの既存データなら初回フローは終わっている。
    if (!(DEV_MODE && DEV_SHOW_ONBOARDING)) {
      if (saved.onboardingComplete === true || (saved.profile?.name?.trim() && saved.profile?.birthdate?.trim())) {
        setOnboardingComplete(true);
      }
    }
    if (saved.settings && typeof saved.settings === "object") {
      setSettings((current) => migrateSavedSettings(current, saved.settings));
    }
  }

  useEffect(() => {
    // Load any saved life data once on launch, before the save effect can run.
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            applySavedState(JSON.parse(raw));
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
    // The ritual's opening question is seeded in Japanese before the saved
    // language preference loads from AsyncStorage. Re-sync it once hydration
    // completes, but only if the user hasn't already started answering.
    if (!hydrated || questionCount !== 1 || ritualLocked) return;
    const question = getReflectionQuestions(lang)[0];
    setCurrentReflectionQuestion(question);
    setRitualMessages([{ role: "nilo", text: question }]);
  }, [hydrated, lang]);

  useEffect(() => {
    // Persist only after hydration so initial defaults never overwrite saved data.
    if (!hydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(collectSyncedState({
        journal, memories, chapters, chapterNotes, profile, settings,
        questProposals, explorations, declinedQuestThemes, questScanDateKey, notifications,
        onboardingComplete
      }))
    ).catch(() => undefined);
  }, [hydrated, journal, memories, chapters, chapterNotes, profile, settings, questProposals, explorations, declinedQuestThemes, questScanDateKey, notifications, onboardingComplete]);

  // Once signed in with a real session (not the local DEV_MODE bypass), pull
  // the authoritative copy from Supabase — this is what lets a reinstall or a
  // second device pick up where the user left off instead of starting from
  // the AsyncStorage cache alone.
  useEffect(() => {
    if (DEV_MODE || !hydrated) return undefined;
    const userId = session?.user?.id;
    if (!userId) {
      remoteSyncedUserIdRef.current = null;
      setRemoteHydrated(false);
      return undefined;
    }
    if (remoteSyncedUserIdRef.current === userId) return undefined;
    remoteSyncedUserIdRef.current = userId;
    let cancelled = false;
    fetchRemoteUserState(userId)
      .then((saved) => {
        if (!cancelled) applySavedState(saved);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setRemoteHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, session]);

  // Mirror the same state to Supabase once the remote pull above has settled,
  // so we never race a stale local default over data that just arrived from
  // another device. Debounced since several fields can change in one save
  // effect run (e.g. finishing a ritual touches both journal and settings).
  useEffect(() => {
    if (DEV_MODE || !hydrated || !remoteHydrated) return undefined;
    const userId = session?.user?.id;
    if (!userId) return undefined;
    const state = collectSyncedState({
      journal, memories, chapters, chapterNotes, profile, settings,
      questProposals, explorations, declinedQuestThemes, questScanDateKey, notifications,
      onboardingComplete
    });
    const timer = setTimeout(() => {
      saveRemoteUserState(userId, state).catch(() => undefined);
    }, 800);
    return () => clearTimeout(timer);
  }, [hydrated, remoteHydrated, session, journal, memories, chapters, chapterNotes, profile, settings, questProposals, explorations, declinedQuestThemes, questScanDateKey, notifications, onboardingComplete]);

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
        t("notifications.whisperPrompt.title"),
        t("notifications.whisperPrompt.body"),
        [
          {
            text: t("notifications.whisperPrompt.later"),
            style: "cancel",
            onPress: () => {
              notificationPromptRef.current = false;
            }
          },
          {
            text: t("notifications.whisperPrompt.light"),
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
      if (!data?.url) throw new Error(t("auth.googleUrlError"));

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      if (result.type !== "success") return;

      const parsedUrl = new URL(result.url);
      const code = parsedUrl.searchParams.get("code");
      if (!code) throw new Error(t("auth.authCodeError"));

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
    } catch (error) {
      setAuthError(error.message || t("auth.googleLoginFailed"));
    } finally {
      setAuthBusy(false);
    }
  }

  async function sendEmailLogin(email) {
    const trimmedEmail = String(email || "").trim();
    if (!trimmedEmail) {
      setAuthError(t("auth.emailRequired"));
      return false;
    }

    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");

    try {
      const { error } = await supabase.auth.signInWithOtp({ email: trimmedEmail });
      if (error) throw error;
      setAuthNotice(t("auth.emailCodeSent"));
      return true;
    } catch (error) {
      setAuthError(error.message || t("auth.emailLoginFailed"));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }

  async function verifyEmailLogin(email, token) {
    const trimmedEmail = String(email || "").trim();
    const trimmedToken = String(token || "").trim();
    if (!trimmedEmail || !trimmedToken) {
      setAuthError(t("auth.emailAndCodeRequired"));
      return;
    }
    if (!/^\d{6}$/.test(trimmedToken)) {
      setAuthError(t("auth.codeSixDigitsRequired"));
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
      setAuthError(getEmailOtpErrorMessage(error, lang));
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (DEV_MODE) {
      setSession(DEV_SESSION);
      setProfile(DEV_PROFILE);
      setAuthError("");
      setAuthNotice(t("auth.devModeBypass"));
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
      Alert.alert(t("auth.photoPermissionTitle"), t("auth.photoPermissionBody"));
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
    if (tabId === "quests") return t("lockedTab.quests");
    if (tabId === "journal") return t("lockedTab.journal");
    if (tabId === "story" || tabId === "memory") return t("lockedTab.story");
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

  // 画面03「はじまりの言葉」の「はじめる」から呼ばれ、日記STEP1の問いを
  // 携えて本編へ渡す。遷移そのものは beginReflectionInput の dipToBlack に任せる。
  function completeOnboarding() {
    firstRecordSealRef.current = true;
    setRitualMessages([{ role: "nilo", text: FIRST_RECORD_QUESTION }]);
    setCurrentReflectionQuestion(FIRST_RECORD_QUESTION);
    setOnboardingComplete(true);
    setFirstRecordPending(true);
  }

  useEffect(() => {
    // メイン画面が描画されてから最初の記録を開く（onboarding画面上では
    // NiloDialogScreen がまだ存在しないため、1フレーム待つ）。
    if (!firstRecordPending || !onboardingComplete) return;
    setFirstRecordPending(false);
    requestAnimationFrame(() => beginReflectionInput());
  }, [firstRecordPending, onboardingComplete]);

  function beginReflectionInput() {
    if (!reflectionInputEnabled || isSending) return;
    playUiSound();
    setSupportVisible(false);
    dipToBlack(() => {
      setActiveTab("home");
      setRitualLocked(true);
      setInputMode(true);
      setHomePromptVisible(true);
      ritualLockedRef.current = true;
      ritualRunIdRef.current += 1;
      keepRitualInputFocused();
    });
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
      node: (
        <JournalScreen
          journal={journal}
          active={activeTab === "journal"}
          onOpenDetail={openEntryDetail}
          onGoToStory={() => setActiveTab("story")}
          compareLastYear={settings.reflection?.compareLastYear !== false}
        />
      )
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
    // つらさが続く兆しを端末内で見て、あれば相談導線を灯す(§03)。一度灯したら消さない。
    if (!supportVisible && detectPersistentDistress(nextMessages)) setSupportVisible(true);
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
      const result = await invokeNilo("night-ritual", {
        messages: nextMessages,
        questionCount,
        forceFinish: questionCount >= ritualQuestionTarget,
        niloStyle: settings.niloStyle || "empathetic",
        frequency: reflectionFrequency,
        pastMemories: memories.slice(0, 40).map((memory) => ({
          dateKey: memory.dateKey,
          essence: memory.essence,
          keptPhrase: memory.keptPhrase,
          moodLabel: memory.moodLabel
        })),
        activeQuests: explorations
          .filter((item) => item.status !== "closed")
          .map((item) => ({
            id: item.id,
            title: item.theme,
            current: item.sessions || 0,
            target: Math.max(1, item.clearTarget || 3),
            firstStep: (item.keywords || []).slice(0, 4).join(" / ")
          }))
      });
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
    // はじめての記録に限り、封の間だけ鍵と「あなた以外には読めない構造に
    // なっています」を灯す（Onboarding Spec: 暗号化可視化の最小版）。
    if (firstRecordSealRef.current) {
      firstRecordSealRef.current = false;
      setEncryptionNoticeVisible(true);
    }
    if (sealTimer.current) clearTimeout(sealTimer.current);
    sealTimer.current = setTimeout(() => {
      setSealActive(false);
      setEncryptionNoticeVisible(false);
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
      const userAnswers = messages.filter((message) => message.role === "user").map((message) => message.text);
      setJournal((items) => [
        {
          id: journalId,
          dateKey: entryDateKey,
          dateLabel: formatDotDate(entryDateKey),
          title: result.title || t("ritual.defaultTitle"),
          lines: result.summaryLines?.length ? result.summaryLines : [t("ritual.defaultSummaryLine")],
          // 二層構造: 出来事=最初の回答、意味=対話の最後に立ち上がった言葉。
          event: userAnswers[0] || "",
          meaning: userAnswers[userAnswers.length - 1] || result.title || "",
          source: "home",
          dialogue: finalMessages,
          niloLine: result.niloLine || closing,
          messages: finalMessages
        },
        ...items
      ]);
      addRitualMemory({ messages: finalMessages, journalId, entryDateKey, essence: result.niloLine, closing, result });
      touchExplorations({ messages: finalMessages, entryDateKey });
      applyExplorationClearJudgements(result, entryDateKey);
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
    const closing = t("ritual.closingDefault");
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
        title: userLines[0] || t("ritual.defaultTitle"),
        lines: userLines.length ? userLines : [t("ritual.defaultSummaryLineFallback")],
        event: userLines[0] || "",
        meaning: userLines[userLines.length - 1] || "",
        source: "home",
        dialogue: finalMessages,
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
    if (seed) return t("ritual.followUpQuestion", seed);
    return t("ritual.followUpFallback");
  }

  function getShortClosingComment(result) {
    const text = result.closingMessage || result.niloMessage || result.niloLine || t("ritual.closingDefault");
    return String(text).replace(/\s+/g, " ").trim().slice(0, 42) || t("ritual.closingDefault");
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
      tag: result?.tag || t("ritual.tag"),
      journalId
    };

    setMemories((items) => [memory, ...items]);
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
      const result = await invokeNilo("chapters", {
        split: Boolean(splitFrom),
        memories: source.map((memory) => ({
          id: memory.id,
          dateKey: memory.dateKey,
          essence: memory.essence,
          keptPhrase: memory.keptPhrase,
          moodLabel: memory.moodLabel
        }))
      });
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
          title: t("notifications.newChapterProposal"),
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
      const result = await invokeNilo("quest-proposals", {
        memories: memories.slice(0, 120).map((memory) => ({
          dateKey: memory.dateKey,
          essence: memory.essence,
          keptPhrase: memory.keptPhrase,
          moodLabel: memory.moodLabel
        })),
        declinedThemes: declinedQuestThemes,
        ongoingThemes: explorations.filter((item) => item.status !== "closed").map((item) => item.theme)
      });
      const next = (result.proposals || [])
        .filter((proposal) => proposal.theme && proposal.observation && proposal.invitation)
        .map((proposal) => ({ id: createId("questprop"), ...proposal }));
      setQuestProposals(next);
      setQuestScanDateKey(today);
      addNotifications(next.map((proposal) => ({
        refId: `quest-${proposal.theme}`,
        tag: "QUEST",
        title: t("notifications.newQuestProposal"),
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
        clearable: false,
        clearTarget: 3,
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
      ? { ...item, status: "closed", closedDateKey: getJournalDateKey(), clearable: false }
      : item));
  }

  function applyExplorationClearJudgements(result, entryDateKey) {
    const updates = Array.isArray(result?.questUpdates) ? result.questUpdates : [];
    if (!updates.length) return;

    setExplorations((items) => items.map((item) => {
      if (item.status === "closed") return item;
      const update = updates.find((candidate) => {
        if (candidate.id && candidate.id === item.id) return true;
        return candidate.title && candidate.title === item.theme;
      });
      if (!update || !update.completed) return item;

      return {
        ...item,
        clearable: true,
        clearJudgedAt: entryDateKey,
        clearNote: update.note || item.clearNote || ""
      };
    }));
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
      <LanguageContext.Provider value={lang}>
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
      </LanguageContext.Provider>
    );
  }

  if (!session) {
    return (
      <LanguageContext.Provider value={lang}>
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
      </LanguageContext.Provider>
    );
  }

  if (!onboardingComplete) {
    // ログイン済みでも、リモートの保存データが「既存ユーザー」だと判るまでは
    // 同意画面を出さない（再ログインしたユーザーに初回フローを誤表示しない）。
    const waitingForState = !hydrated || (!DEV_MODE && !remoteHydrated);
    return (
      <LanguageContext.Provider value={lang}>
        <View style={styles.background}>
          <BackgroundTexture />
          <OuterGradient />
          <View style={styles.scrim} />
          <NightGrain />
          <FloatingOrbs />
          <SafeAreaView style={styles.safe}>
            {!waitingForState && (
              <OnboardingFlow
                step={onboardingStep}
                setStep={setOnboardingStep}
                setProfile={setProfile}
                onComplete={completeOnboarding}
              />
            )}
            <StatusBar barStyle="light-content" />
          </SafeAreaView>
        </View>
      </LanguageContext.Provider>
    );
  }

  if (!profileComplete) {
    return (
      <LanguageContext.Provider value={lang}>
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
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={lang}>
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
          support={supportVisible}
          onSubmit={submitRitual}
          onExit={requestExitNightRitual}
          exitConfirmOpen={exitConfirmOpen}
          onConfirmExit={confirmExitNightRitual}
          onCancelExit={cancelExitNightRitual}
          onBlur={() => {
            if (ritualLockedRef.current) keepRitualInputFocused();
          }}
        />

        <EncryptionSealNotice visible={encryptionNoticeVisible && sealActive} />

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
    </LanguageContext.Provider>
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
  // 実機の画面はデスクトップより暗く沈むので、下限をやや高めに取る。
  const small = Array.from({ length: FLOATING_ORB_SMALL_COUNT }, () =>
    makeFloatingOrbSpec(36 + Math.random() * 130, 0.12 + Math.random() * 0.22)
  );
  const large = Array.from({ length: FLOATING_ORB_LARGE_COUNT }, () => {
    const spec = makeFloatingOrbSpec(200 + Math.random() * 200, 0.07 + Math.random() * 0.12);
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
    outputRange: [spec.baseOpacity * 0.3, spec.baseOpacity]
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

function AnswerMote({ spec, playToken }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!playToken) return undefined;
    progress.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(spec.delay),
      Animated.timing(progress, {
        toValue: 1,
        duration: spec.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]);
    animation.start();
    return () => animation.stop();
  }, [playToken, progress, spec]);

  const opacity = progress.interpolate({
    inputRange: [0, 0.14, 0.66, 1],
    outputRange: [0, spec.peakOpacity, spec.peakOpacity * 0.55, 0]
  });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -spec.rise] });
  // まっすぐ昇るのではなく、蝋燭の煙のようにゆるく左右へ振れながら昇る。
  const translateX = progress.interpolate({
    inputRange: [0, 0.28, 0.55, 0.8, 1],
    outputRange: [
      0,
      spec.driftX * 0.35 + spec.sway,
      spec.driftX * 0.6 - spec.sway * 0.7,
      spec.driftX * 0.85 + spec.sway * 0.4,
      spec.driftX
    ]
  });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.15] });

  return (
    <Animated.Image
      pointerEvents="none"
      source={niloOrbTexture}
      resizeMode="contain"
      style={{
        position: "absolute",
        left: `${spec.left}%`,
        bottom: 0,
        width: spec.size,
        height: spec.size,
        marginLeft: -spec.size / 2,
        opacity,
        transform: [{ translateY }, { translateX }, { scale }]
      }}
    />
  );
}

// 答えを送った瞬間、画面の下からNiloの光へ向かって小さな粒が立ちのぼる。
// 言葉が届いた、という手応えを光で返す。playTokenが進むたび一度だけ再生。
function AnswerMotes({ playToken, style }) {
  const specs = useMemo(
    () => Array.from({ length: 7 }, () => ({
      left: 28 + Math.random() * 44,
      size: 24 + Math.random() * 36,
      rise: 150 + Math.random() * 170,
      driftX: -32 + Math.random() * 64,
      sway: 8 + Math.random() * 16,
      delay: Math.random() * 360,
      duration: 1600 + Math.random() * 1100,
      peakOpacity: 0.3 + Math.random() * 0.4
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playToken]
  );

  if (!playToken) return null;
  return (
    <View pointerEvents="none" style={style}>
      {specs.map((spec, index) => (
        <AnswerMote key={`${playToken}-${index}`} spec={spec} playToken={playToken} />
      ))}
    </View>
  );
}

function NiloLight({ style, thinking, subdued }) {
  // The one light source on the screen: Nilo's soft glow. It does not move; it
  // only breathes — a diffuse amber radial like the prototype's, drawn from a
  // pre-rendered image so RN matches the Web's CSS radial-gradient exactly.
  // While Nilo is thinking the breath quickens and the core burns brighter,
  // so the light itself tells the user their words are being held.
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = thinking ? 1500 : 4000;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath, thinking]);

  const opacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, thinking ? 1.07 : 1.12] });
  const coreOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: thinking ? [0.68, 1] : [0.5, 0.95] });
  const coreScale = breath.interpolate({ inputRange: [0, 1], outputRange: thinking ? [0.46, 0.56] : [0.42, 0.52] });

  return (
    <View
      pointerEvents="none"
      style={[styles.niloLightWrap, style, subdued && { opacity: 0.55, transform: [{ scale: 0.76 }] }]}
    >
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
  const drift = useRef(new Animated.Value(0)).current;
  const sealBloom = useRef(new Animated.Value(0)).current;
  const [shownQuestion, setShownQuestion] = useState(question);

  // 「今夜を綴じました」は咲くように現れる — わずかに下から、ゆっくり開いて。
  // 同時に、印の周りをひとつの光輪が広がって消えていく。
  useEffect(() => {
    if (!sealed) {
      sealBloom.setValue(0);
      return;
    }
    Animated.timing(sealBloom, {
      toValue: 1,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [sealed, sealBloom]);

  // 古い問いはただ消えるのではなく、煙のようにわずかに立ちのぼりながら溶ける。
  // 新しい問いが来たら位置を戻し、文字それぞれの開花に任せる。
  useEffect(() => {
    if (dimmed) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 420,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(drift, {
          toValue: -14,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]).start();
      return;
    }
    drift.setValue(0);
    opacity.setValue(1);
    setShownQuestion(question);
  }, [dimmed, opacity, drift, question]);

  return (
    <View style={[styles.niloStage, compact && styles.niloStageCompact]}>
      <View style={[styles.niloStageCopy, compact && styles.niloStageCopyCompact]}>
        {thinking && <NiloThinkingIndicator />}
        {!hideQuestion && (
          <Animated.View style={{ alignItems: "center", opacity, transform: [{ translateY: drift }] }}>
            {sealed && (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.niloSealHalo, {
                    opacity: sealBloom.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.5, 0] }),
                    transform: [{ scale: sealBloom.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.75] }) }]
                  }]}
                />
                <Animated.Text
                  style={[styles.niloSealMark, {
                    opacity: sealBloom,
                    transform: [
                      { translateY: sealBloom.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                      { scale: sealBloom.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }
                    ]
                  }]}
                >
                  ✦ 今夜を綴じました
                </Animated.Text>
              </View>
            )}
            <GlyphBloomText
              text={shownQuestion}
              textStyle={[styles.niloStageQuestion, compact && styles.niloStageQuestionCompact]}
              initialDelay={340}
              charDelay={48}
              duration={700}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function ThinkingDot({ delay }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 440,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 440,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.delay(280)
      ])
    );
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [pulse, delay]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.95]
  });
  const translateY = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5]
  });
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.78, 1.12]
  });

  return (
    <Animated.Image
      source={niloOrbTexture}
      resizeMode="contain"
      style={{ width: 24, height: 24, marginHorizontal: 1, opacity, transform: [{ translateY }, { scale }] }}
    />
  );
}

// Niloと同じ光の粒が三つ、波のように順に浮かぶ。文字ではなく光そのもので
// 「言葉を選んでいる」time を伝える。
function NiloThinkingIndicator() {
  return (
    <View style={styles.niloThinkingRow}>
      {[0, 170, 340].map((delay) => (
        <ThinkingDot key={delay} delay={delay} />
      ))}
    </View>
  );
}

// 文字がひとつずつ、にじむように浮かび上がる。タイプライタの機械的な追記では
// なく、それぞれの文字が自分の呼吸で開く「開花」。行ごとに折り返しにも耐える。
function GlyphBloomText({ text, textStyle, charDelay = 44, duration = 640, initialDelay = 0, rise = 8 }) {
  // 禁則処理: 句読点や閉じ括弧が行頭に落ちないよう、前の文字と同じ粒にまとめる。
  const glyphLines = useMemo(
    () => String(text || "").split("\n").map((line) => {
      const units = [];
      for (const char of Array.from(line)) {
        if (units.length && "、。！？…‥」』）〉》”’ゝゞ々ー".includes(char)) {
          units[units.length - 1] += char;
        } else {
          units.push(char);
        }
      }
      return units;
    }),
    [text]
  );
  const glyphCount = glyphLines.reduce((sum, line) => sum + line.length, 0);
  const values = useRef([]);
  if (values.current.length !== glyphCount) {
    values.current = Array.from({ length: glyphCount }, () => new Animated.Value(0));
  }

  useEffect(() => {
    values.current.forEach((value) => value.setValue(0));
    const animation = Animated.sequence([
      Animated.delay(initialDelay),
      Animated.stagger(
        charDelay,
        values.current.map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: riseEasing,
            useNativeDriver: true
          })
        )
      )
    ]);
    animation.start();
    return () => animation.stop();
  }, [text, charDelay, duration, initialDelay]);

  let cursor = 0;
  return (
    <View style={{ alignItems: "center" }}>
      {glyphLines.map((line, lineIndex) => (
        <View key={lineIndex} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
          {line.map((glyph, glyphIndex) => {
            const value = values.current[cursor];
            cursor += 1;
            return (
              <Animated.Text
                key={glyphIndex}
                style={[textStyle, {
                  opacity: value,
                  transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }]
                }]}
              >
                {glyph}
              </Animated.Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function AnswerPreview({ answer, fading, compact }) {
  const t = useT();
  const fade = useRef(new Animated.Value(0)).current;
  const text = answer?.text || "";

  useEffect(() => {
    if (!answer) {
      fade.setValue(0);
      return;
    }
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [answer, fade]);

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
      <Text style={styles.answerPreviewMark}>{t("ritual.yourWordsLabel")}</Text>
      <GlyphBloomText text={text} textStyle={styles.answerPreviewText} charDelay={26} duration={520} rise={5} />
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
  const t = useT();
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
        <Text style={styles.gateSlogan}>{t("gate.slogan")}</Text>
      </View>
      <View style={styles.gateCard}>
        <Text style={styles.gateEyebrow}>{t("gate.signIn")}</Text>
        <Text style={styles.gateTitle}>{loading ? t("gate.preparing") : t("gate.welcome")}</Text>
        <Text style={styles.gateBody}>
          {loading ? t("gate.loadingBody") : t("gate.readyBody")}
        </Text>
        {!loading && (
          <>
            {!otpSent && (
              <>
                <Pressable disabled={authBusy} onPress={onGoogleSignIn} style={[styles.gateButton, authBusy && styles.disabledButton]}>
                  <Text style={styles.gateButtonText}>{authBusy ? t("gate.connecting") : t("gate.googleLogin")}</Text>
                </Pressable>
                <View style={styles.gateDivider}>
                  <View style={styles.gateDividerLine} />
                  <Text style={styles.gateDividerText}>{t("gate.or")}</Text>
                  <View style={styles.gateDividerLine} />
                </View>
              </>
            )}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t("gate.emailPlaceholder")}
              placeholderTextColor="rgba(246,239,228,0.42)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!otpSent}
              style={styles.gateInput}
            />
            {!otpSent ? (
              <Pressable disabled={authBusy || !email.trim()} onPress={handleSendEmail} style={[styles.gateGhostButton, (authBusy || !email.trim()) && styles.disabledButton]}>
                <Text style={styles.gateGhostText}>{authBusy ? t("gate.sendingCode") : t("gate.receiveCodeByEmail")}</Text>
              </Pressable>
            ) : (
              <>
                <Text style={styles.gateOtpLead}>{t("gate.otpLead")}</Text>
                <TextInput
                  value={emailCode}
                  onChangeText={(value) => setEmailCode(value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={t("gate.codePlaceholder")}
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
                  <Text style={styles.gateButtonText}>{authBusy ? t("gate.verifying") : t("gate.loginWithCode")}</Text>
                </Pressable>
                <Pressable disabled={authBusy} onPress={handleSendEmail} style={styles.gateGhostButton}>
                  <Text style={styles.gateGhostText}>{authBusy ? t("gate.resending") : t("gate.resendCode")}</Text>
                </Pressable>
                <Pressable disabled={authBusy} onPress={() => { setOtpSent(false); setEmailCode(""); }} style={styles.gateTextButton}>
                  <Text style={styles.gateTextButtonText}>{t("gate.changeEmail")}</Text>
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
  const t = useT();
  const [name, setName] = useState(profile.name);
  const [birthdate, setBirthdate] = useState(profile.birthdate);
  const canSubmit = name.trim() && birthdate.trim() && daysSince(birthdate) !== null;

  return (
    <ScrollView contentContainerStyle={styles.gateScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.gateBrand}>
        <Text style={styles.gateLogo}>Arc</Text>
        <Text style={styles.gateSlogan}>{t("gate.profileSlogan")}</Text>
      </View>
      <View style={styles.gateCard}>
        <Text style={styles.gateEyebrow}>Profile</Text>
        <Text style={styles.gateTitle}>{t("gate.profileTitle")}</Text>
        <Text style={styles.gateBody}>
          {t("gate.profileBody")}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("gate.namePlaceholder")}
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
        {!!daysSince(birthdate) && <Text style={styles.gateHint}>{daysSince(birthdate)}{t("gate.dayCountSuffix")}</Text>}
        <Pressable
          disabled={!canSubmit}
          onPress={() => setProfile((current) => ({ ...current, name: name.trim(), birthdate: birthdate.trim() }))}
          style={[styles.gateButton, !canSubmit && styles.disabledButton]}
        >
          <Text style={styles.gateButtonText}>{t("gate.startArc")}</Text>
        </Pressable>
        <Pressable disabled={authBusy} onPress={onSignOut} style={styles.gateGhostButton}>
          <Text style={styles.gateGhostText}>{authBusy ? t("gate.processing") : t("gate.loginOtherAccount")}</Text>
        </Pressable>
        {!!authError && <Text style={styles.errorText}>{authError}</Text>}
      </View>
    </ScrollView>
  );
}

// ─── 初回起動体験（Onboarding Spec v1.0）──────────────────────────────
// 00ログイン / 01同意 / 02ニロとの対話 / 03はじまりの言葉 / 04はじめての記録。
// 00ログインは事務的な画面として糸を出さない。糸は01〜04の4区切りのみ。
// 04は日記STEP1（本編のNight Ritual）へ接続するため、ここには01〜03のみ置く。

// 進捗インジケーター（糸）。章仕様の糸を横向きに転用: 現在地だけゴールドに
// 発光し、通過済みは淡いゴールド、未到達は暗いラインのまま。
function OnboardingThread({ step }) {
  return (
    <View style={styles.onboardThread}>
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          style={[
            styles.onboardThreadSeg,
            index < step && styles.onboardThreadSegPast,
            index === step && styles.onboardThreadSegCurrent
          ]}
        />
      ))}
    </View>
  );
}

// 各画面をゆっくり浮かび上がらせる共通の入り。章のトランジションと同じく
// 重みのある速度感に寄せる。
function OnboardStepFade({ children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [opacity]);
  return <Animated.View style={[{ flex: 1, opacity }, style]}>{children}</Animated.View>;
}

function OnboardingFlow({ step, setStep, setProfile, onComplete }) {
  return (
    <View style={styles.onboardScreen}>
      <OnboardingThread step={step} />
      {step === 0 && (
        <OnboardStepFade key="consent">
          <OnboardConsentStep onAgree={() => setStep(1)} />
        </OnboardStepFade>
      )}
      {step === 1 && (
        <OnboardStepFade key="dialogue">
          <OnboardNiloIntroStep
            onDone={({ name, birthdate }) => {
              setProfile((current) => ({ ...current, name, birthdate }));
              setStep(2);
            }}
          />
        </OnboardStepFade>
      )}
      {step === 2 && (
        <OnboardStepFade key="words">
          <OnboardOpeningWordsStep onBegin={onComplete} />
        </OnboardStepFade>
      )}
    </View>
  );
}

// 01｜同意。法的に必須な画面として事務的に完結させつつ、主権の一文だけは
// 規約と別の声で置く。
function OnboardConsentStep({ onAgree }) {
  const t = useT();
  function openDocument(url) {
    if (!url) return;
    Linking.openURL(url).catch(() => undefined);
  }
  return (
    <View style={styles.gateScreen}>
      <View style={styles.gateCard}>
        <Text style={styles.gateEyebrow}>Consent</Text>
        <Text style={styles.gateTitle}>{t("onboarding.consentTitle")}</Text>
        <Pressable onPress={() => openDocument(ONBOARDING_TERMS_URL)} style={styles.onboardConsentRow}>
          <Text style={styles.onboardConsentRowText}>{t("onboarding.consentTerms")}</Text>
          <Text style={styles.onboardConsentRowChevron}>›</Text>
        </Pressable>
        <Pressable onPress={() => openDocument(ONBOARDING_PRIVACY_URL)} style={styles.onboardConsentRow}>
          <Text style={styles.onboardConsentRowText}>{t("onboarding.consentPrivacy")}</Text>
          <Text style={styles.onboardConsentRowChevron}>›</Text>
        </Pressable>
        <View style={styles.onboardSovereignty}>
          <Text style={styles.onboardSovereigntyText}>{t("onboarding.sovereigntyLine")}</Text>
        </View>
        <Pressable onPress={onAgree} style={styles.gateButton}>
          <Text style={styles.gateButtonText}>{t("onboarding.consentAgree")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// 対話の行。一行ずつフェードで現れ、既出になると縮小・減光して奥に沈む。
// バブルUIは使わない。
function OnboardDialogueLine({ text, role, isLatest }) {
  const enter = useRef(new Animated.Value(0)).current;
  const depth = useRef(new Animated.Value(isLatest ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 760,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [enter]);
  useEffect(() => {
    Animated.timing(depth, {
      toValue: isLatest ? 0 : 1,
      duration: 620,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [depth, isLatest]);
  const opacity = Animated.multiply(
    enter,
    depth.interpolate({ inputRange: [0, 1], outputRange: [1, 0.36] })
  );
  const scale = depth.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <Text style={role === "user" ? styles.onboardUserLine : styles.onboardNiloLine}>{text}</Text>
    </Animated.View>
  );
}

// 02｜ニロとの対話。名前と生年月日を、フォームではなく会話として受け取る
// 唯一の例外的ステップ。年齢は生年月日から自動算出し、別途は尋ねない。
function OnboardNiloIntroStep({ onDone }) {
  const t = useT();
  const [lines, setLines] = useState([]);
  const [phase, setPhase] = useState("opening"); // opening → name → between → birth → closing
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [birthError, setBirthError] = useState("");
  const timers = useRef([]);

  function schedule(fn, delay) {
    const timer = setTimeout(fn, delay);
    timers.current.push(timer);
    return timer;
  }

  // 文の性質（長さ）に応じて1.4〜2.2秒の間を置いて一行ずつ差し出す。
  function speak(texts, onFinished) {
    let delay = 0;
    texts.forEach((text, index) => {
      schedule(() => {
        setLines((current) => [...current, { id: `nilo-${Date.now()}-${index}`, role: "nilo", text }]);
      }, delay);
      delay += Math.min(2200, 1400 + text.length * 24);
    });
    if (onFinished) schedule(onFinished, delay);
  }

  useEffect(() => {
    speak(
      t("onboarding.greetingLines"),
      () => setPhase("name")
    );
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  function submitName() {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    setLines((current) => [...current, { id: `user-name-${Date.now()}`, role: "user", text: trimmed }]);
    setName(trimmed);
    setPhase("between");
    speak(
      t("onboarding.nameAcceptedLines", trimmed),
      () => setPhase("birth")
    );
  }

  function submitBirthdate() {
    const trimmed = birthdate.trim();
    // daysSince は 0 で下限クランプされるため、未来日は自前で弾く。
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || daysSince(trimmed) === null || new Date(`${trimmed}T00:00:00`) > new Date()) {
      setBirthError(t("onboarding.birthError"));
      return;
    }
    setBirthError("");
    setLines((current) => [...current, { id: `user-birth-${Date.now()}`, role: "user", text: trimmed }]);
    setPhase("closing");
    speak(
      [t("onboarding.birthAcceptedLine", name.trim())],
      () => schedule(() => onDone({ name: name.trim(), birthdate: trimmed }), 1800)
    );
  }

  const inputVisible = phase === "name" || phase === "birth";
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.onboardDialogueScreen}>
      <View style={styles.onboardDialogueLines}>
        {lines.map((line, index) => (
          <OnboardDialogueLine
            key={line.id}
            text={line.text}
            role={line.role}
            isLatest={index === lines.length - 1}
          />
        ))}
      </View>
      {inputVisible && (
        <View style={styles.onboardDialogueComposer}>
          {phase === "name" ? (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("onboarding.namePlaceholder")}
              placeholderTextColor="rgba(246,239,228,0.36)"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitName}
              style={styles.onboardDialogueInput}
            />
          ) : (
            <TextInput
              value={birthdate}
              onChangeText={(value) => {
                setBirthdate(value);
                if (birthError) setBirthError("");
              }}
              placeholder={t("onboarding.birthPlaceholder")}
              placeholderTextColor="rgba(246,239,228,0.36)"
              autoFocus
              keyboardType={Platform.OS === "web" ? undefined : "numbers-and-punctuation"}
              returnKeyType="done"
              onSubmitEditing={submitBirthdate}
              style={styles.onboardDialogueInput}
            />
          )}
          {!!birthError && <Text style={styles.onboardDialogueError}>{birthError}</Text>}
          <Pressable
            onPress={phase === "name" ? submitName : submitBirthdate}
            style={styles.onboardDialogueSend}
          >
            <Text style={styles.onboardDialogueSendText}>{t("onboarding.dialogueSend")}</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// 03｜はじまりの言葉。Overview冒頭の一文を1フレーズずつ、間を置いて灯す。
// 全文が出そろってから、遅れて「はじめる」だけがフェードインする。
function OnboardOpeningWordsStep({ onBegin }) {
  const t = useT();
  const openingPhrases = t("onboarding.openingPhrases");
  const phraseAnims = useRef(openingPhrases.map(() => new Animated.Value(0))).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const [buttonReady, setButtonReady] = useState(false);

  useEffect(() => {
    const fades = phraseAnims.map((anim) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    );
    Animated.sequence([
      Animated.delay(600),
      Animated.stagger(1500, fades),
      Animated.delay(1100),
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (finished) setButtonReady(true);
    });
  }, []);

  return (
    <View style={styles.onboardWordsScreen}>
      <View style={styles.onboardWordsBlock}>
        {openingPhrases.map((phrase, index) => (
          <Animated.Text
            key={phrase}
            style={[
              styles.onboardWordsPhrase,
              { opacity: phraseAnims[index] }
            ]}
          >
            {phrase}
          </Animated.Text>
        ))}
      </View>
      <Animated.View style={{ opacity: buttonAnim }}>
        <Pressable disabled={!buttonReady} onPress={onBegin} style={styles.onboardBeginButton}>
          <Text style={styles.onboardBeginButtonText}>{t("onboarding.beginButton")}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// 04の暗号化可視化（最小版）: はじめての記録が封じられる間だけ、鍵の点と
// 「あなた以外には読めない構造になっています」の一文を灯す。
function EncryptionSealNotice({ visible }) {
  const t = useT();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 900 : 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [opacity, visible]);
  return (
    <Animated.View pointerEvents="none" style={[styles.encryptionNotice, { opacity }]}>
      <Svg width={16} height={16} viewBox="0 0 16 16">
        <Path
          d="M5 7 L5 5.4 A3 3 0 0 1 11 5.4 L11 7"
          stroke="rgba(217,168,108,0.9)"
          strokeWidth={1.2}
          fill="none"
        />
        <Path
          d="M4 7 H12 V13 H4 Z"
          stroke="rgba(217,168,108,0.9)"
          strokeWidth={1.2}
          fill="rgba(217,168,108,0.16)"
        />
      </Svg>
      <Text style={styles.encryptionNoticeText}>{t("encryption.notice")}</Text>
    </Animated.View>
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
  const t = useT();
  const lang = useLang();
  const questionLift = useRef(new Animated.Value(0)).current;
  const idleFloat = useRef(new Animated.Value(0)).current;
  const [moteToken, setMoteToken] = useState(0);
  const hadPreview = useRef(false);
  const needsProfile = !profile.name?.trim() || !profile.birthdate?.trim();
  const showFirstRun = !authLoading && (!session || needsProfile);
  const compact = keyboardVisible;
  const liftedY = inputLocked ? 0 : screenHeight < 720 ? -118 : screenHeight < 820 ? -140 : -164;
  const displayQuestion = reflectionQuestion === getFirstRecordQuestion(lang)
    ? t("home.defaultQuestion")
    : reflectionQuestion;

  useEffect(() => {
    Animated.timing(questionLift, {
      toValue: keyboardVisible ? liftedY : 0,
      duration: keyboardVisible ? 260 : 320,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [keyboardVisible, liftedY, questionLift]);

  // 問いの一角が、Niloの光と同じ8秒周期でわずかに上下する。
  // 画面が「止まっている」のではなく「息をしている」と感じさせるための揺らぎ。
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idleFloat, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(idleFloat, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [idleFloat]);

  // 答えが送られた瞬間だけ、光の粒をひと束立ちのぼらせる。
  useEffect(() => {
    const has = Boolean(answerPreview);
    if (has && !hadPreview.current) setMoteToken((value) => value + 1);
    hadPreview.current = has;
  }, [answerPreview]);

  // Keep the question a touch above center, then leave a wide silence below it
  // for the light to sit in.
  const questionTopInset = compact ? 28 : Math.round(Math.max(130, (screenHeight - 90 - 192) / 3));

  return (
    <View
      style={[styles.homeReflectionScreen, { paddingTop: questionTopInset }]}
    >
      <Animated.View
        style={[styles.reflectionTapArea, {
          transform: [
            { translateY: Animated.add(
              questionLift,
              idleFloat.interpolate({ inputRange: [0, 1], outputRange: [0, compact ? 0 : -5] })
            ) }
          ]
        }]}
      >
        {!answerPreview && (
          <Animated.Text style={[styles.homeLeadText, questionTransitioning && styles.homeLeadTextDimmed]}>
            {t("home.leadText")}
          </Animated.Text>
        )}
        <View pointerEvents="none" style={[styles.homeQuestionFrame, compact && styles.homeQuestionFrameCompact]}>
          <NiloHomeStage
            question={displayQuestion}
            dimmed={questionTransitioning}
            thinking={questionTransitioning || isSending}
            hideQuestion={Boolean(answerPreview)}
            compact={compact}
            sealed={sealed}
          />
        </View>
        <AnswerPreview answer={answerPreview} fading={questionTransitioning} compact={compact} />
      </Animated.View>

      {/* 入力中も対話中も、Niloの灯は消えない。キーボードが上がっている間は
          少し身を引いて(小さく・淡く)、問いの下でそっと呼吸を続ける。 */}
      <NiloLight
        thinking={isSending || questionTransitioning}
        subdued={compact || inputLocked}
        style={{
          position: "absolute",
          alignSelf: "center",
          bottom: compact ? Math.round(screenHeight * 0.34) : Math.round(screenHeight * 0.2)
        }}
      />

      {/* キーボードが上がっている間は、粒の生まれる場所もキーボードより上へ。 */}
      <AnswerMotes
        playToken={moteToken}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: Math.round(screenHeight * (compact ? 0.46 : 0.16)),
          height: 280
        }}
      />

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
        <Animated.Text style={[styles.composerSparkle, { opacity: cursorPulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }]}>✦</Animated.Text>
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
  const t = useT();
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
          {enabled ? t("ritual.startEnabled") : t("ritual.startDisabled")}
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
// While Nilo is thinking, the breath quickens and the glow leans brighter,
// the same language as the home screen's large light.
function NiloMark({ thinking }) {
  const breath = useBreath(thinking ? 1400 : 3500);
  const glowOpacity = breath.interpolate({
    inputRange: [0, 1],
    outputRange: thinking ? [0.72, 1] : [0.55, 0.95]
  });
  const glowScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: thinking ? [1.02, 1.1] : [1, 1.06]
  });
  return (
    <View pointerEvents="none" style={styles.niloMarkWrap}>
      <Animated.Image source={niloOrbTexture} resizeMode="contain" style={[styles.niloMarkGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      <View style={styles.niloMarkCore} />
    </View>
  );
}

// Nilo's question in the night dialogue. Each glyph blooms into place —
// the same breath as the home stage — and the old line lifts away like smoke
// while it fades, so question-to-question feels like turning a page of air.
function NiloDialogQuestion({ question, dimmed, closing }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const [shownQuestion, setShownQuestion] = useState(question || "");

  useEffect(() => {
    if (dimmed) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 420,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(drift, {
          toValue: -14,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]).start();
      return;
    }
    drift.setValue(0);
    opacity.setValue(1);
    setShownQuestion(question || "");
  }, [dimmed, opacity, drift, question]);

  return (
    <Animated.View style={{ alignItems: "center", opacity, transform: [{ translateY: drift }] }}>
      <GlyphBloomText
        text={shownQuestion}
        textStyle={styles.niloDialogQuestion}
        initialDelay={340}
        charDelay={48}
        duration={700}
      />
    </Animated.View>
  );
}

// NILO (SCR · two tiers) — Nilo asks above, you answer below. Faithful to the
// reference layout, but the answer is captured with the OS keyboard rather than
// the prototype's mock 五十音 grid. The save / question-advance / seal logic is
// the existing night-ritual flow, unchanged.
function NiloDialogScreen({ visible, closing, question, dimmed, thinking, dateLabel, inputRef, input, setInput, enabled, support, onSubmit, onExit, exitConfirmOpen, onConfirmExit, onCancelExit, onBlur }) {
  const t = useT();
  const fade = useRef(new Animated.Value(0)).current;
  const [moteToken, setMoteToken] = useState(0);
  const wasThinking = useRef(false);

  useEffect(() => {
    Animated.timing(fade, { toValue: visible ? 1 : 0, duration: visible ? 520 : 240, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
  }, [fade, visible]);

  // 答えを送った瞬間(thinkingが立った瞬間)、入力欄のあたりからNiloの灯へ
  // 向かって光の粒が立ちのぼる。ホームと同じ「言葉が届いた」合図。
  useEffect(() => {
    if (thinking && !wasThinking.current) setMoteToken((value) => value + 1);
    wasThinking.current = thinking;
  }, [thinking]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.niloScreen, { opacity: fade }]}>
      <BackgroundTexture />
      <OuterGradient />
      <View style={styles.scrim} />
      <NightGrain />
      <FloatingOrbs />
      <View style={styles.niloScreenSafe}>
        <View style={styles.niloTopTier}>
          <NiloMark thinking={thinking} />
          <Text style={styles.niloMarkLabel}>NILO</Text>
          <Text style={styles.niloDateLabel}>{dateLabel} · {t("ritual.tonightSuffix")}</Text>
          <View style={styles.niloQuestionArea}>
            {thinking ? (
              <NiloThinkingIndicator />
            ) : (
              <NiloDialogQuestion question={question} dimmed={dimmed} closing={closing} />
            )}
          </View>
        </View>

        {/* 実機ではOSキーボードが下半分を覆うので、粒はキーボードより上
            (画面の中ほど)から問いへ向かって立ちのぼらせる。 */}
        <AnswerMotes
          playToken={moteToken}
          style={{ position: "absolute", left: 0, right: 0, bottom: "42%", height: 320 }}
        />

        {closing ? (
          <View style={styles.niloClosing}>
            <Text style={styles.niloClosingText}>{t("ritual.closingText")}</Text>
          </View>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.niloBottomTier}>
            {support && <SupportResourceCard />}
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
              placeholder={t("ritual.placeholder")}
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
                <Text style={styles.niloSendText}>{t("ritual.send")}</Text>
              </Pressable>
            )}
            {exitConfirmOpen ? (
              <View style={styles.niloExitConfirmRow}>
                <Text style={styles.niloExitConfirmText}>{t("ritual.exitConfirmQuestion")}</Text>
                <View style={styles.niloExitConfirmActions}>
                  <Pressable onPress={onCancelExit} style={({ pressed }) => [styles.niloExitConfirmGhost, pressed && styles.touchPressedTight]}>
                    <Text style={styles.niloExitConfirmGhostText}>{t("ritual.exitConfirmNo")}</Text>
                  </Pressable>
                  <Pressable onPress={onConfirmExit} style={({ pressed }) => [styles.niloExitConfirmPrimary, pressed && styles.touchPressedTight]}>
                    <Text style={styles.niloExitConfirmPrimaryText}>{t("ritual.exitConfirmYes")}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={onExit} style={styles.niloExitLink}>
                <Text style={styles.niloExitText}>{t("ritual.exitLink")}</Text>
              </Pressable>
            )}
          </KeyboardAvoidingView>
        )}
      </View>
    </Animated.View>
  );
}

// 深刻なつらさが続く回答を見たときだけ、評価も励ましもせず、静かに相談先を差し出す
// (離脱防止方針書 §03)。Niloは判定を口にせず、導線は主張せずただそこに在る。
function SupportResourceCard() {
  const t = useT();
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [fade]);
  return (
    <Animated.View style={[styles.supportCard, { opacity: fade }]}>
      <Text style={styles.supportCardBody}>{t("support.body")}</Text>
      <Pressable
        onPress={() => {
          if (SUPPORT_RESOURCE_URL) Linking.openURL(SUPPORT_RESOURCE_URL).catch(() => {});
        }}
        style={({ pressed }) => [styles.supportCardLink, pressed && styles.touchPressedSubtle]}
      >
        <Text style={styles.supportCardLinkText}>{t("support.linkLabel")}</Text>
      </Pressable>
    </Animated.View>
  );
}

function FirstRunCard({ session, needsProfile, authBusy, onGoogleSignIn, onOpenProfile }) {
  const t = useT();
  const signedIn = Boolean(session);
  const title = signedIn ? t("home.firstRunProfileTitle") : t("home.firstRunStartTitle");
  const body = signedIn && needsProfile
    ? t("home.firstRunProfileBody")
    : t("home.firstRunLoginBody");

  return (
    <View style={styles.firstRunCard}>
      <View style={styles.firstRunMark}>
        <Text style={styles.firstRunMarkText}>✦</Text>
      </View>
      <View style={styles.firstRunCopy}>
        <Text style={styles.firstRunTitle}>{title}</Text>
        <Text style={styles.firstRunBody}>{body}</Text>
        <Text style={styles.firstRunHint}>
          {signedIn ? t("home.firstRunProfileHint") : t("home.firstRunLoginHint")}
        </Text>
      </View>
      <Pressable
        disabled={authBusy}
        onPress={signedIn ? onOpenProfile : onGoogleSignIn}
        style={[styles.firstRunButton, authBusy && styles.disabledButton]}
      >
        <Text style={styles.firstRunButtonText}>{authBusy ? t("gate.connecting") : signedIn ? t("home.firstRunEnterButton") : t("gate.googleLogin")}</Text>
      </Pressable>
    </View>
  );
}

// Quest tab per the Quest Spec: only Nilo's proposals and ongoing explorations
// live here. No completion counts, progress bars, or clear states — a quest is
// a weeks-to-months exploration, not a task.
function QuestHeaderShimmer() {
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 7800, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(1900)
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);
  const opacity = sweep.interpolate({ inputRange: [0, 0.18, 0.52, 1], outputRange: [0, 0.2, 0.12, 0] });
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-86, 310] });
  return (
    <Animated.View pointerEvents="none" style={[styles.questHeaderShimmer, { opacity, transform: [{ translateX }, { rotate: "-12deg" }] }]}>
      <LinearGradient
        colors={["rgba(246,239,228,0)", "rgba(196,218,207,0.34)", "rgba(217,168,108,0.1)", "rgba(246,239,228,0)"]}
        locations={[0, 0.42, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.questHeaderShimmerFill}
      />
    </Animated.View>
  );
}

function QuestCardSheen() {
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(sweep, { toValue: 1, duration: 5400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(2600)
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);
  const opacity = sweep.interpolate({ inputRange: [0, 0.2, 0.48, 1], outputRange: [0, 0.18, 0.08, 0] });
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-92, 280] });
  return (
    <Animated.View pointerEvents="none" style={[styles.questCardSheen, { opacity, transform: [{ translateX }, { rotate: "-14deg" }] }]}>
      <LinearGradient
        colors={["rgba(246,239,228,0)", "rgba(246,239,228,0.3)", "rgba(119,149,143,0.12)", "rgba(246,239,228,0)"]}
        locations={[0, 0.46, 0.58, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.questCardSheenFill}
      />
    </Animated.View>
  );
}

function QuestRowNode({ muted = false }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: muted ? [0.1, 0.22] : [0.18, 0.46] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.4] });
  return (
    <View pointerEvents="none" style={styles.questRowNodeFrame}>
      <Animated.View style={[styles.questRowNodeHalo, muted && styles.questRowNodeHaloMuted, { opacity, transform: [{ scale }] }]} />
      <View style={[styles.questRowNodeCore, muted && styles.questRowNodeCoreMuted]} />
    </View>
  );
}

function QuestScreen({ onUiSound, active, proposals, explorations, onAccept, onDecline, onCloseExploration }) {
  const token = useEntrancePlay(active);
  const t = useT();
  const lang = useLang();
  const [futureQuestOpen, setFutureQuestOpen] = useState(false);
  const [openExploration, setOpenExploration] = useState(null);

  // Real explorations wear their computed time-thickness; until any exist,
  // the demo set keeps the screen inhabited (same fallback pattern as the
  // chapter pages).
  const real = explorations || [];
  const ongoing = real.filter((item) => item.status !== "closed").map((item) => ({
    ...item,
    since: formatLocalizedQuestSince(item.sinceDateKey, lang),
    duration: formatLocalizedQuestDuration(item.sinceDateKey, lang)
  }));
  const closed = real.filter((item) => item.status === "closed").map((item) => ({
    ...item,
    since: formatLocalizedQuestSince(item.sinceDateKey, lang),
    duration: formatLocalizedQuestDuration(item.sinceDateKey, lang, new Date(`${item.closedDateKey}T00:00:00`))
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
        <QuestHeaderShimmer />
        <View style={styles.questHeaderTop}>
          <View style={styles.questTitleBlock}>
            <Text style={styles.questScreenTitle}>{t("quest.screenTitle")}</Text>
            <Text style={styles.questEyebrow}>{t("quest.eyebrow")}</Text>
          </View>
          <View style={styles.questFieldPill}>
            <Text style={styles.questFieldPillText}>NILO FIELD</Text>
          </View>
        </View>
        <Text style={styles.questWatermark}>QUEST</Text>
        <Text style={styles.questPhilosophy}>{t("quest.philosophy")}</Text>
      </RiseIn>

      <RiseIn index={1} playToken={token} style={styles.questGroupHeader}>
        <Text style={styles.questGroupTitle}>{t("quest.proposalsGroup")}</Text>
        <View style={styles.questGroupRule} />
      </RiseIn>
      {displayProposals.length ? (
        displayProposals.map((proposal, index) => (
          <RiseIn key={proposal.id} index={index + 2} playToken={token} duration={500}>
            <View style={styles.mobileQuestCard}>
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(119,149,143,0.12)", "rgba(28,24,20,0.66)", "rgba(217,168,108,0.06)"]}
                locations={[0, 0.62, 1]}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.92, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <QuestCardSheen />
              <View style={styles.mobileQuestTopRow}>
                <Text style={styles.mobileQuestNilo}>NILO</Text>
                <Text style={styles.mobileQuestSignal}>{t("quest.proposalSignal")}</Text>
              </View>
              <Text style={styles.questProposalObservation}>{proposal.observation}</Text>
              <Text style={styles.questProposalInvitation}>{proposal.invitation}</Text>
              <View style={styles.mobileQuestActions}>
                <Pressable onPress={() => acceptProposal(proposal)} style={({ pressed }) => [styles.mobileQuestAction, styles.mobileQuestActionPrimary, pressed && styles.touchPressedTight]}>
                  <Text style={styles.mobileQuestActionPrimaryText}>{t("quest.acceptProposal")}</Text>
                </Pressable>
                <Pressable onPress={() => declineProposal(proposal)} style={({ pressed }) => [styles.mobileQuestAction, styles.mobileQuestActionSecondary, pressed && styles.touchPressedTight]}>
                  <Text style={styles.mobileQuestActionSecondaryText}>{t("quest.declineProposal")}</Text>
                </Pressable>
              </View>
            </View>
          </RiseIn>
        ))
      ) : (
        <RiseIn index={2} playToken={token}>
          <Text style={styles.questQuietNote}>{t("quest.noProposalsNote")}</Text>
        </RiseIn>
      )}

      <RiseIn index={displayProposals.length + 2} playToken={token} style={[styles.questGroupHeader, styles.questGroupHeaderSpaced]}>
        <Text style={styles.questGroupTitle}>{t("quest.ongoingGroup")}</Text>
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
              accessibilityRole="button"
            >
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(119,149,143,0.1)", "rgba(20,18,15,0.18)", "rgba(217,168,108,0.035)"]}
                locations={[0, 0.66, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.questOngoingWash}
              />
              <QuestRowNode />
              <View style={styles.questOngoingCopy}>
                <Text style={styles.questOngoingTheme}>{quest.theme}</Text>
                <Text style={styles.questOngoingMeta}>
                  {quest.since}　・　{quest.duration}{quest.sessions ? t("quest.repeatedQuestionsSuffix", quest.sessions) : ""}
                </Text>
                {quest.clearable && <Text style={styles.questClearableMeta}>{t("quest.clearableMeta")}</Text>}
              </View>
              <Text style={styles.questOngoingArrow}>→</Text>
            </Pressable>
          </RiseIn>
        ))
      ) : (
        <RiseIn index={displayProposals.length + 3} playToken={token}>
          <Text style={styles.questQuietNote}>{t("quest.noOngoingNote")}</Text>
        </RiseIn>
      )}

      <RiseIn index={displayProposals.length + displayOngoing.length + 3} playToken={token} style={[styles.questGroupHeader, styles.questGroupHeaderSpaced]}>
        <Text style={styles.questGroupTitle}>{t("quest.futureGroup")}</Text>
        <View style={styles.questGroupRule} />
      </RiseIn>
      <RiseIn index={displayProposals.length + displayOngoing.length + 4} playToken={token} duration={500}>
        <Pressable
          onPress={() => {
            onUiSound?.();
            setFutureQuestOpen(true);
          }}
          style={({ pressed }) => [styles.questOngoingRow, pressed && styles.touchPressedSubtle]}
          accessibilityRole="button"
        >
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(119,149,143,0.09)", "rgba(20,18,15,0.18)", "rgba(217,168,108,0.04)"]}
            locations={[0, 0.66, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.questOngoingWash}
          />
          <QuestRowNode />
          <View style={styles.questOngoingCopy}>
            <Text style={styles.questOngoingTheme}>{demoFutureQuest.theme}</Text>
            <Text style={styles.questOngoingMeta}>{demoFutureQuest.since}　・　{demoFutureQuest.duration}</Text>
          </View>
          <Text style={styles.questOngoingArrow}>→</Text>
        </Pressable>
      </RiseIn>

      {closed.length > 0 && (
        <>
          <RiseIn index={displayProposals.length + displayOngoing.length + 5} playToken={token} style={[styles.questGroupHeader, styles.questGroupHeaderSpaced]}>
            <Text style={styles.questGroupTitle}>{t("quest.closedGroup")}</Text>
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
                accessibilityRole="button"
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(119,149,143,0.06)", "rgba(20,18,15,0.12)", "rgba(217,168,108,0.02)"]}
                  locations={[0, 0.66, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.questOngoingWash}
                />
                <QuestRowNode muted />
                <View style={styles.questOngoingCopy}>
                  <Text style={[styles.questOngoingTheme, styles.questClosedTheme]}>{quest.theme}</Text>
                  <Text style={styles.questOngoingMeta}>{quest.since}　・　{quest.duration}{t("quest.closedDurationSuffix")}</Text>
                </View>
                <Text style={[styles.questOngoingArrow, styles.questOngoingArrowMuted]}>→</Text>
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
      canCloseExploration={Boolean(openExploration?.clearable)}
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

// 日記タブ (per the Diary spec): 意味を主役にした二層のタイムライン。直近の
// 窓だけを詳細に見せ、それ以前は月の帯に畳み、さらに古い日々は章へ委ねる。
// 糸は「今」に最も近い一点だけが淡く光る。
function JournalScreen({ journal, active }) {
  const token = useEntrancePlay(active);
  const t = useT();
  const lang = useLang();
  const { cumulativeEntries } = getDiaryModel(journal, { lang });
  const now = new Date(`${getJournalDateKey()}T00:00:00`);

  return (
    <ScrollView contentContainerStyle={styles.journalScrollContent} showsVerticalScrollIndicator={false}>
      <RiseIn index={0} playToken={token} style={styles.journalHeader}>
        <View style={styles.journalHeaderTop}>
          <View style={styles.journalTitleBlock}>
            <Text style={styles.mobileScreenTitle}>{t("journal.title")}</Text>
            <Text style={styles.mobileGoldLabel}>{t("journal.goldLabel")}</Text>
          </View>
          <View style={styles.journalMonthPill}>
            <Text style={styles.journalMonth}>{`${englishMonthNames[now.getMonth()]} ${now.getFullYear()}`}</Text>
          </View>
        </View>
      </RiseIn>
      <View style={styles.timeline}>
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(119,149,143,0)", "rgba(119,149,143,0.26)", "rgba(217,168,108,0.15)", "rgba(217,168,108,0)"]}
          locations={[0, 0.1, 0.82, 1]}
          style={styles.timelineLine}
        />
        {cumulativeEntries.length === 0 && (
          <RiseIn index={1} playToken={token}>
            <Text style={styles.diaryEmptyRecent}>{t("journal.emptyRecent")}</Text>
          </RiseIn>
        )}
        {cumulativeEntries.map((entry, index) => (
          <RiseIn key={entry.id} index={index + 1} playToken={token} duration={550}>
            <DiaryEntryRow entry={entry} isCurrent={index === 0} />
          </RiseIn>
        ))}
      </View>
    </ScrollView>
  );
}

// 一日の記録: 出来事(小・淡)の上に意味(主役)。強く感じた日ほど文字と余白が
// 大きくなるが、その強弱は組版だけで語り、数値やバッジは出さない。
// 対話ログがある日は意味の末尾に沈黙記号「···」を淡く添え、タップでその場に
// 静かに展開する(離脱防止方針書 §05。モーダルへは遷移しない)。
function DiaryEntryRow({ entry, isCurrent }) {
  const [expanded, setExpanded] = useState(false);
  const t = useT();
  const currentFloat = useRef(new Animated.Value(0)).current;
  const tierItem =
    entry.tier === "strong" ? styles.diaryItemStrong : entry.tier === "quiet" ? styles.diaryItemQuiet : styles.diaryItemNormal;
  const tierMeaning =
    entry.tier === "strong"
      ? styles.diaryMeaningStrong
      : entry.tier === "quiet"
        ? styles.diaryMeaningQuiet
        : styles.diaryMeaningNormal;
  const logMessages = useMemo(
    () => (Array.isArray(entry.dialogue) ? entry.dialogue : []).filter((m) => m && m.text && String(m.text).trim()),
    [entry.dialogue]
  );
  // ログと呼べるのは問いと答えの往復がある日だけ。意味の一文しか無い日は展開しない。
  const hasLog = logMessages.length >= 2;
  useEffect(() => {
    if (!isCurrent) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(currentFloat, { toValue: 1, duration: 4600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(currentFloat, { toValue: 0, duration: 4600, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [currentFloat, isCurrent]);
  const currentFloatStyle = isCurrent
    ? { transform: [{ translateY: currentFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }
    : null;

  return (
    <Pressable
      onPress={hasLog ? () => setExpanded((open) => !open) : undefined}
      style={({ pressed }) => [styles.timelineItem, tierItem, hasLog && pressed && styles.touchPressedSubtle]}
      accessibilityRole={hasLog ? "button" : undefined}
      accessibilityState={hasLog ? { expanded } : undefined}
    >
      {isCurrent ? <DiaryBreathingDot /> : <View style={styles.timelineDot} />}
      <Animated.View style={[styles.timelineCopy, isCurrent && styles.timelineCopyCurrent, currentFloatStyle]}>
        {isCurrent && (
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(119,149,143,0.14)", "rgba(40,34,28,0.72)", "rgba(217,168,108,0.07)"]}
            locations={[0, 0.62, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.diaryCurrentWash}
          />
        )}
        <View style={[styles.timelineMetaRow, isCurrent && styles.timelineMetaRowCurrent]}>
          <Text style={[styles.timelineDate, isCurrent && styles.timelineDateActive]}>{entry.dateLabel}</Text>
          {!!entry.weekday && <Text style={styles.diaryWeekday}>{entry.weekday}</Text>}
          {isCurrent && <Text style={styles.diaryNowLabel}>{t("journal.nowLabel")}</Text>}
          {entry.isQuest && <Text style={styles.diaryQuestLabel}>{t("journal.questLabel")}</Text>}
        </View>
        {!!entry.event && <Text style={styles.diaryEventText}>{entry.event}</Text>}
        <Text style={tierMeaning}>
          {entry.meaning}
          {hasLog && <Text style={styles.diarySilenceMark}> ···</Text>}
        </Text>
        {hasLog && expanded && <DiaryDialogueLog messages={logMessages} meaning={entry.meaning} />}
      </Animated.View>
    </Pressable>
  );
}

// 対話ログはその場で静かに開く(§05)。フキダシ型UIを避け、Niloの問い(細字・小)と
// ユーザーの言葉(少し大)を淡々と並べる詩的な組版。タイムラインに現れていた意味の
// 一文だけは、展開後も強調を保ち、読み手が迷子にならないようにする。
function DiaryDialogueLog({ messages, meaning }) {
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [reveal]);
  const translateY = reveal.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  const scale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] });
  const meaningText = String(meaning || "").trim();
  return (
    <Animated.View style={[styles.diaryLog, { opacity: reveal, transform: [{ translateY }, { scale }] }]}>
      {messages.map((message, index) => {
        const isNilo = message.role === "nilo";
        const text = String(message.text).trim();
        const isMeaning = !isNilo && text === meaningText;
        return (
          <Text
            key={index}
            style={isNilo ? styles.diaryLogNilo : isMeaning ? styles.diaryLogUserMeaning : styles.diaryLogUser}
          >
            {text}
          </Text>
        );
      })}
    </Animated.View>
  );
}

// 糸が光るのは「いま」に最も近いただ一点(仕様 §04-③)。その一点だけが、
// Niloの光と同じゆっくりした周期で息をする。
function DiaryBreathingDot() {
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);
  const opacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.66, 1] });
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const rippleOpacity = breath.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.28, 0.08, 0] });
  const rippleScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.65] });
  return (
    <View pointerEvents="none" style={styles.diaryDotCurrentFrame}>
      <Animated.View style={[styles.diaryDotCurrentRipple, { opacity: rippleOpacity, transform: [{ scale: rippleScale }] }]} />
      <Animated.View style={[styles.diaryDotCurrentHalo, { opacity: breath }]} />
      <Animated.View style={[styles.diaryDotCurrentCore, { opacity, transform: [{ scale }] }]} />
    </View>
  );
}

function DiaryEchoMark() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.48, 0.86] });
  const rotate = pulse.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "8deg"] });
  return <Animated.Text style={[styles.diaryEchoMark, { opacity, transform: [{ rotate }] }]}>↺</Animated.Text>;
}

// 一年前の同じ季節の一日。比較や評価はせず、その日の意味を一言だけ差し出す。
function DiaryLastYearEcho({ entry, onOpenDetail }) {
  const t = useT();
  return (
    <Pressable
      onPress={() => onOpenDetail?.(entry)}
      style={({ pressed }) => [styles.diaryEchoCard, pressed && styles.touchPressedSubtle]}
      accessibilityRole="button"
    >
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(119,149,143,0.16)", "rgba(217,168,108,0.055)", "rgba(246,239,228,0.02)"]}
        locations={[0, 0.62, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.diaryEchoWash}
      />
      <View style={styles.diaryEchoTopRow}>
        <Text style={styles.diaryEchoLabel}>{t("journal.lastYearEchoLabel")}</Text>
        <DiaryEchoMark />
      </View>
      <Text style={styles.diaryEchoMeaning}>{entry.meaning}</Text>
      <Text style={styles.diaryEchoDate}>{entry.dateLabel}</Text>
    </Pressable>
  );
}

// 月の帯: 太さがその月の記録量を静かに語る。開くと意味の一言だけが並ぶ。
function DiaryBandToggleIcon({ expanded }) {
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [expanded, progress]);
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  return <Animated.Text style={[styles.diaryBandToggle, { transform: [{ rotate }, { scale }] }]}>{expanded ? "−" : "+"}</Animated.Text>;
}

function DiaryMonthBand({ band, expanded, onToggle, onOpenDetail }) {
  const t = useT();
  const barHeight = 10 + Math.min(36, band.entries.length * 3);
  return (
    <View>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.diaryBandRow, expanded && styles.diaryBandRowOpen, pressed && styles.touchPressedSubtle]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={[styles.diaryBandBar, { height: barHeight }, expanded && styles.diaryBandBarOpen]} />
        <View style={styles.diaryBandCopy}>
          <Text style={[styles.diaryBandLabel, expanded && styles.diaryBandLabelOpen]}>{band.label}</Text>
          <Text style={styles.diaryBandCount}>{band.entries.length}{t("journal.entriesUnitSuffix")}</Text>
        </View>
        <DiaryBandToggleIcon expanded={expanded} />
      </Pressable>
      {expanded &&
        band.entries.map((entry, index) => (
          <RiseIn key={entry.id} index={index} playToken={1} duration={420} distance={8}>
            <Pressable
              onPress={() => onOpenDetail?.(entry)}
              style={({ pressed }) => [styles.diaryBandEntryRow, pressed && styles.touchPressedSubtle]}
              accessibilityRole="button"
            >
              <Text style={styles.diaryBandEntryDate}>{entry.dateLabel}</Text>
              <Text style={styles.diaryBandEntryText}>{entry.meaning}</Text>
            </Pressable>
          </RiseIn>
        ))}
    </View>
  );
}

// 一定より古い日々は日記では見せない。章への静かな導線だけを置く。
function DiaryStoryGuide({ onGoToStory }) {
  const t = useT();
  return (
    <Pressable
      onPress={() => onGoToStory?.()}
      style={({ pressed }) => [styles.diaryStoryGuide, pressed && styles.touchPressedSubtle]}
      accessibilityRole="button"
    >
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(119,149,143,0.12)", "rgba(217,168,108,0.06)", "rgba(246,239,228,0.015)"]}
        locations={[0, 0.64, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.diaryStoryGuideWash}
      />
      <Text style={styles.diaryStoryGuideText}>{t("journal.storyGuideText")}</Text>
      <Text style={styles.diaryStoryGuideLink}>{t("journal.storyGuideLink")}</Text>
    </Pressable>
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
  const t = useT();
  const lang = useLang();
  const pages = getChapterPages(chapters, lang);
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
                <Text style={styles.chpEndLabel}>{t("chapter.endLabel")}</Text>
                <Text style={styles.chpEndNote}>{t("chapter.endNote")}</Text>
                {eligibleCount > 0 && (
                  <Pressable
                    disabled={busy}
                    onPress={() => onPropose()}
                    style={({ pressed }) => [styles.chapterFindButton, pressed && !busy && styles.touchPressedTight, busy && styles.disabledButton]}
                  >
                    <Text style={styles.chapterFindButtonText}>{busy ? t("chapter.findBusy") : proposals?.length ? t("chapter.findAgain") : t("chapter.findFirst")}</Text>
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
  const t = useT();
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
        {chapter.current && <Text style={styles.chpNowNote}>{t("chapter.nowInChapter")}</Text>}
      </RiseIn>

      {excerpts.length > 0 && (
        <RiseIn index={1} playToken={playToken}>
          <ChpSectionHeader label={t("chapter.sectionRecords")} note={chapter.recordCount > excerpts.length ? t("chapter.sectionRecordsNote", chapter.recordCount) : ""} />
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
          <ChpSectionHeader label={t("chapter.sectionReunion")} note={chapter.reunion.fromLabel} />
          <Text style={styles.chpReunionQuote}>「{chapter.reunion.quote}」</Text>
        </RiseIn>
      )}

      {!!chapter.wish && (
        <RiseIn index={3} playToken={playToken}>
          <ChpSectionHeader label={t("chapter.sectionWish")} />
          <Text style={styles.chpWishTheme}>{chapter.wish.theme}</Text>
          <Text style={styles.chpWishLine}>{chapter.wish.line}</Text>
        </RiseIn>
      )}

      {words.length > 0 && (
        <RiseIn index={4} playToken={playToken}>
          <ChpSectionHeader label={t("chapter.sectionWords")} />
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
          <ChpSectionHeader label={t("chapter.sectionFigures")} />
          <Text style={styles.chpFigures}>{figures.join("　・　")}</Text>
        </RiseIn>
      )}

      {!!chapter.niloLetter && (
        <RiseIn index={6} playToken={playToken}>
          <ChpSectionHeader label={t("chapter.sectionNiloLetter")} />
          <Text style={styles.chpNiloLetter}>{chapter.niloLetter}</Text>
        </RiseIn>
      )}

      <RiseIn index={7} playToken={playToken}>
        <ChpSectionHeader label={t("chapter.sectionSelfNote")} />
        <TextInput
          value={selfNote}
          onChangeText={setSelfNote}
          onBlur={() => onCommitNote?.(selfNote)}
          multiline
          placeholder={t("chapter.selfNotePlaceholder")}
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
  const t = useT();
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
              <Text style={styles.lifeQuestDetailLabel}>{t("lifeQuest.futureLabel")}</Text>
              <Text style={styles.lifeQuestDetailTitle}>{quest.theme}</Text>
              <Text style={styles.lifeQuestDetailMeta}>{quest.since}　・　{quest.duration}</Text>
              {!!quest.niloLine && <Text style={styles.futureQuestNiloLine}>{quest.niloLine}</Text>}
            </RiseIn>

            <RiseIn index={1} playToken={token} style={styles.latestWordCard}>
              <Text style={styles.latestWordLabel}>{t("lifeQuest.latestWordLabel")}</Text>
              <Text style={styles.latestWordText}>「{quest.latestLine}」</Text>
            </RiseIn>

            <RiseIn index={2} playToken={token} style={styles.recordTrailHeader}>
              <Text style={styles.recordTrailLabel}>{t("lifeQuest.recordTrailLabel")}</Text>
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
                <Text style={styles.lifeQuestTalkText}>{t("lifeQuest.talkButton")}</Text>
              </Pressable>
              <Text style={styles.lifeQuestPhilosophy}>{t("lifeQuest.philosophyFuture")}</Text>
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
function ExplorationDetailModal({ visible, quest, onClose, onCloseExploration, canCloseExploration }) {
  const token = useEntrancePlay(visible);
  const t = useT();
  const records = quest.records || [];
  const isClosed = quest.status === "closed";
  const canClose = Boolean(canCloseExploration);
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
              <Text style={styles.lifeQuestDetailLabel}>{isClosed ? t("lifeQuest.closedLabel") : t("lifeQuest.pastLabel")}</Text>
              <Text style={styles.lifeQuestDetailTitle}>{quest.theme}</Text>
              <Text style={styles.lifeQuestDetailMeta}>
                {quest.since}　・　{quest.duration}{quest.sessions ? t("quest.repeatedQuestionsSuffix", quest.sessions) : ""}
              </Text>
            </RiseIn>

            <RiseIn index={1} playToken={token} style={styles.recordTrailHeader}>
              <Text style={styles.recordTrailLabel}>{t("lifeQuest.recordTrailLabel")}</Text>
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
                <Text style={styles.questQuietNote}>{t("lifeQuest.noWordsYet")}</Text>
              </RiseIn>
            )}

            <View style={styles.lifeQuestActions}>
              {!!onCloseExploration && (
                <Pressable
                  disabled={!canClose}
                  onPress={onCloseExploration}
                  style={({ pressed }) => [styles.lifeQuestTalkButton, !canClose && styles.questCloseLocked, pressed && canClose && styles.touchPressedTight]}
                >
                  <Text style={styles.lifeQuestTalkText}>{canClose ? t("lifeQuest.closeGently") : t("lifeQuest.waitForNilo")}</Text>
                </Pressable>
              )}
              {!isClosed && !!quest.clearNote && <Text style={styles.questClearNote}>{quest.clearNote}</Text>}
              <Text style={styles.lifeQuestPhilosophy}>
                {isClosed
                  ? t("lifeQuest.philosophyClosed")
                  : canClose
                    ? t("lifeQuest.philosophyClearable")
                    : t("lifeQuest.philosophyWaiting")}
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
  const t = useT();
  const lang = useLang();
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
            <Text style={styles.modalTitle}>{t("notifications.title")}</Text>
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
                    <Text style={styles.notificationRowDate}>{formatNotificationTimestamp(item.createdAt, lang)}</Text>
                  </Pressable>
                </RiseIn>
              ))
            ) : (
              <RiseIn index={0} playToken={token} style={styles.settingsPage}>
                <SettingsPageTitle icon="notifications" title={t("notifications.emptyTitle")} body={t("notifications.emptyBody")} />
                <Text style={styles.notificationEmptyNote}>{t("notifications.emptyNote")}</Text>
              </RiseIn>
            )}

            <Pressable onPress={onOpenSettings} style={({ pressed }) => [styles.backToBase, pressed && styles.touchPressedTight]}>
              <Text style={styles.backToBaseText}>{t("notifications.setTimeLink")}</Text>
            </Pressable>
          </ScrollView>
        </View>
        <StatusBar barStyle="light-content" />
      </SafeAreaView>
    </Modal>
  );
}

// ENTRY DETAIL (SCR-05) — a tapped record opens into the full conversation
// with Nilo, the emotions it left, a similar night, and the quiet reminder
// that the record cannot be erased. Opened as a full-screen modal, like the
// life-quest detail.
function EntryDetailModal({ entry, onClose }) {
  const t = useT();
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
                <Text style={styles.entryDetailDate}>{e.dateLabel || t("entryDetail.tonightFallback")}</Text>
                {isTonight && <Text style={styles.entryDetailTonight}>TONIGHT</Text>}
                {isQuest && <Text style={styles.entryDetailQuestTag}>QUEST</Text>}
              </View>
              <View style={styles.entryDetailRule} />
            </RiseIn>

            <View style={styles.entryDetailDialogue}>
              {dialogue.map((message, index) => (
                <RiseIn key={index} index={index + 1} playToken={token} duration={550} style={styles.entryDetailMsg}>
                  {message.role === "nilo" && <Text style={styles.entryDetailNiloLabel}>{t("entryDetail.niloAsleepLabel")}</Text>}
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
                <Text style={styles.entryDetailRelatedLabel}>{t("entryDetail.similarNightsLabel")}</Text>
                {related.map((item, index) => (
                  <View key={index} style={styles.entryDetailRelatedItem}>
                    <Text style={styles.entryDetailRelatedDate}>{item.date}</Text>
                    <Text style={styles.entryDetailRelatedText}>{item.text}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.entryDetailFooter}>{t("entryDetail.footer")}</Text>
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
  const t = useT();
  const emotions = data.emotions || [];
  const people = data.people || [];
  const questions = data.questions || [];
  const hasShift = !!data.meaningFrom || !!data.meaningTo;
  if (!emotions.length && !people.length && !questions.length && !hasShift) return null;
  return (
    <View style={styles.throughline}>
      <View style={styles.ruleGold} />
      {emotions.length > 0 && <ThroughlineRow label={t("chapter.throughlineEmotions")} items={emotions} />}
      {people.length > 0 && <ThroughlineRow label={t("chapter.throughlinePeople")} items={people} />}
      {questions.length > 0 && <ThroughlineRow label={t("chapter.throughlineQuestions")} items={questions} />}
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
  const t = useT();
  if (!episodes || episodes.length === 0) return null;
  return (
    <View style={styles.episodeBlock}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.episodeToggle}>
        <Text style={styles.episodeToggleText}>{`${t("chapter.episodesLabel", episodes.length)}　${open ? "▾" : "▸"}`}</Text>
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
  const t = useT();
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState("");

  return (
    <View style={styles.proposalCard}>
      <Text style={styles.proposalEyebrow}>{t("chapter.proposalEyebrow")}</Text>
      {!!proposal.period && <Text style={styles.proposalPeriod}>{proposal.period}</Text>}
      {!!proposal.observation && <Text style={styles.proposalObservation}>{proposal.observation}</Text>}
      <ThroughlineBlock data={proposal} />
      <EpisodeList episodes={proposal.episodes} />
      {naming ? (
        <View style={styles.proposalNameRow}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t("chapter.proposalNamePlaceholder")}
            placeholderTextColor="#777"
            style={styles.settingInput}
          />
          <Pressable onPress={() => onConfirm(proposal.id, title)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t("chapter.proposalSaveButton")}</Text>
          </Pressable>
          <Pressable onPress={() => onConfirm(proposal.id, "")}>
            <Text style={styles.proposalSkipName}>{t("chapter.proposalSkipName")}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.proposalActions}>
          <Pressable disabled={busy} onPress={() => setNaming(true)} style={styles.proposalAccept}>
            <Text style={styles.proposalAcceptText}>{t("chapter.proposalAccept")}</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => onDefer(proposal.id)} style={styles.proposalGhost}>
            <Text style={styles.proposalGhostText}>{t("chapter.proposalDefer")}</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => onSplit(proposal.id)} style={styles.proposalGhost}>
            <Text style={styles.proposalGhostText}>{t("chapter.proposalSplit")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ChapterCard({ chapter, index, total, onRename }) {
  const t = useT();
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
            placeholder={t("chapter.namePlaceholder")}
            placeholderTextColor="#777"
            style={styles.settingInput}
          />
          <Pressable onPress={() => { onRename(chapter.id, title); setEditing(false); }} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{t("chapter.saveNameButton")}</Text>
          </Pressable>
          <Pressable onPress={() => setEditing(false)}>
            <Text style={styles.proposalSkipName}>{t("chapter.cancelNaming")}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => { setTitle(chapter.title || ""); setEditing(true); }}>
          <Text style={chapter.title ? styles.chapterCardTitle : styles.chapterCardTitleEmpty}>
            {chapter.title || t("chapter.namelessChapterTouch")}
          </Text>
        </Pressable>
      )}
      {!!chapter.observation && <Text style={styles.chapterEpigraph}>{chapter.observation}</Text>}
      <ThroughlineBlock data={chapter} />
      <EpisodeList episodes={chapter.episodes} />
      {past.length > 0 && (
        <Text style={styles.renameTrail}>{t("chapter.renameTrailPrefix")}{past.join(" → ")}</Text>
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
  const t = useT();
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <PageTitle eyebrow={t("memory.eyebrow")} title={t("memory.title")} subtitle={t("memory.subtitle")} />
      {memories.length === 0 ? (
        <EmptyState title={t("memory.emptyTitle")} body={t("memory.emptyBody")} />
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
  const tabs = getTabs(useLang());
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
  const t = useT();
  const lang = useLang();
  const termsSections = getTermsSections(lang);
  const privacyPolicySections = getPrivacyPolicySections(lang);
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
    setSettings((current) => {
      const next = { ...current, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, "language")) {
        next.language = normalizeLanguageCode(patch.language);
        next.languageExplicitlySelected = true;
      }
      return next;
    });
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

  const displayName = name || profile.name || session?.user?.user_metadata?.name || session?.user?.email?.split("@")[0] || t("settings.account.displayNameFallback");
  const profileInitial = displayName.slice(0, 1).toUpperCase();
  const profileDay = daysSince(birthdate) || daysSince(profile.birthdate) || daysSince(arcStartDate) + 1;
  const syncStatus = authLoading ? t("settings.account.checking") : session ? t("settings.account.connected") : t("settings.account.notConnected");
  const accountLabel = authLoading ? t("settings.account.checking") + "..." : session?.user?.email || t("settings.account.googleAccountUnconnected");
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
        title: t("settings.deletion.journalConfirmTitle"),
        body: t("settings.deletion.journalConfirmBody"),
        run: () => setJournal([])
      },
      memories: {
        title: t("settings.deletion.memoriesConfirmTitle"),
        body: t("settings.deletion.memoriesConfirmBody"),
        run: () => {
          setMemories([]);
          setChapters([]);
        }
      },
      all: {
        title: t("settings.deletion.allConfirmTitle"),
        body: t("settings.deletion.allConfirmBody"),
        run: () => {
          setJournal([]);
          setMemories([]);
          setChapters([]);
        }
      }
    };
    const target = actions[kind];
    if (!target) return;
    confirmDialog(target.title, target.body, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: target.run }
    ]);
  }

  async function runExport() {
    onUiSound?.();
    setExportStatus(t("settings.export.exporting"));
    try {
      const isMarkdown = exportFormat === "markdown";
      const content = isMarkdown
        ? buildExportMarkdown({ journal, memories, chapters }, lang)
        : buildExportJson({ journal, memories, chapters, profile, settings });
      const passphrase = exportPassphrase.trim();
      const dateKey = toDateKey(new Date());
      if (passphrase) {
        const encrypted = encryptExportPayload(content, passphrase);
        await saveTextFile(encrypted, `arc-archive-${dateKey}.encrypted.json`, "application/json");
        setExportStatus(t("settings.export.encryptedDone"));
      } else {
        await saveTextFile(
          content,
          `arc-archive-${dateKey}.${isMarkdown ? "md" : "json"}`,
          isMarkdown ? "text/markdown" : "application/json"
        );
        setExportStatus(t("settings.export.done"));
      }
      setExportPassphrase("");
    } catch {
      setExportStatus(t("settings.export.failed"));
    }
  }

  function confirmDeleteAll() {
    onUiSound?.();
    confirmDialog(
      t("settings.deletion.archiveConfirmTitle"),
      t("settings.deletion.archiveConfirmBody"),
      [
        { text: t("settings.deletion.keepBack"), style: "cancel" },
        {
          text: t("settings.deletion.deleteAction"),
          style: "destructive",
          onPress: () => confirmDialog(t("settings.deletion.finalConfirmTitle"), t("settings.deletion.finalConfirmBody"), [
            { text: t("settings.deletion.keepBack"), style: "cancel" },
            {
              text: t("settings.deletion.deleteAction"),
              style: "destructive",
              onPress: () => {
                setJournal([]);
                setMemories([]);
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
      setRecoveryStatus(t("settings.security.recoveryIssuedStatus"));
    } catch {
      setRecoveryStatus(t("settings.security.recoveryIssueFailed"));
    }
  }

  async function copyRecoveryKey() {
    if (!recoveryKey) return;
    try {
      await Clipboard.setStringAsync(recoveryKey);
      setRecoveryStatus(t("settings.security.copiedStatus"));
    } catch {
      setRecoveryStatus(t("settings.security.copyFailedStatus"));
    }
  }

  function addEmergencyContact() {
    if (!isEmailLike(emergencyEmail)) {
      setRecoveryStatus(t("settings.security.emailInvalid"));
      return;
    }
    updateSecurity({ emergencyContacts: [...(securityConfig.emergencyContacts || []), { id: createId("witness"), email: emergencyEmail.trim() }] });
    setEmergencyEmail("");
    setRecoveryStatus(t("settings.security.addedContact"));
  }

  function removeEmergencyContact(id) {
    updateSecurity({ emergencyContacts: (securityConfig.emergencyContacts || []).filter((c) => c.id !== id) });
  }

  function addHeir() {
    if (!isEmailLike(heirEmail)) {
      setInheritanceStatus(t("settings.inheritance.emailInvalid"));
      return;
    }
    updateInheritance({ contacts: [...(inheritanceConfig.contacts || []), { id: createId("heir"), email: heirEmail.trim() }] });
    setHeirEmail("");
    setInheritanceStatus(t("settings.inheritance.addedContact"));
  }

  function removeHeir(id) {
    updateInheritance({ contacts: (inheritanceConfig.contacts || []).filter((c) => c.id !== id) });
  }

  function setDefaultAction(next) {
    if ((inheritanceConfig.defaultAction || "delete") === next) return;
    onUiSound?.();
    confirmDialog(
      t("settings.inheritance.changeConfirmTitle"),
      next === "delete" ? t("settings.inheritance.changeToDeleteBody") : t("settings.inheritance.changeToTransferBody"),
      [
        { text: t("settings.deletion.keepBack"), style: "cancel" },
        {
          text: t("settings.inheritance.changeAction"),
          onPress: () => {
            updateInheritance({ defaultAction: next });
            setInheritanceStatus(t("settings.inheritance.changedNotice"));
          }
        }
      ]
    );
  }

  function addDisclosure() {
    if (!disclosureTarget.trim()) {
      setInheritanceStatus(t("settings.inheritance.disclosureTargetRequired"));
      return;
    }
    if (!isEmailLike(disclosureRecipient)) {
      setInheritanceStatus(t("settings.inheritance.disclosureRecipientInvalid"));
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
    setInheritanceStatus(t("settings.inheritance.disclosureAdded"));
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
    confirmDialog(t("settings.account.logoutConfirmTitle"), t("settings.account.logoutConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.account.logoutButton"), style: "destructive", onPress: onSignOut }
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
            <Text style={styles.modalTitle}>{t("settings.header")}</Text>
          </View>
        </View>

        <View style={styles.settingsBody}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingSection}>
            {activeSettingsTab === "base" && (
              <SettingsBase
                settings={settings}
                session={session}
                authLoading={authLoading}
                displayName={displayName}
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
                <Text style={styles.backToBaseText}>{t("settings.back")}</Text>
              </Pressable>

            {activeSettingsTab === "ownershipPolicy" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="privacy" title={t("settings.ownership.title")} body={t("settings.ownership.body")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.ownershipStatement}>{t("settings.ownership.statement")}</Text>
                  <Text style={styles.mutedText}>{t("settings.ownership.note")}</Text>
                </View>
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.ownership.portableTitle")}</Text>
                  <Text style={styles.mutedText}>{t("settings.ownership.portableNote")}</Text>
                </View>
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.ownership.localDataTitle")}</Text>
                  <View style={styles.syncSummaryRow}>
                    <BaseStat label={t("settings.ownership.journalStat")} value={`${journal.length}`} />
                    <BaseStat label={t("settings.ownership.memoryStat")} value={`${memories.length}`} />
                    <BaseStat label={t("settings.ownership.chapterStat")} value={`${chapters.length}`} />
                  </View>
                </View>
              </View>
            )}

            {activeSettingsTab === "ownershipExport" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="data" title={t("settings.export.title")} body={t("settings.export.body")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.export.formatLabel")}</Text>
                  {renderSegmentedRow([["json", "JSON"], ["markdown", "Markdown"]], exportFormat, setExportFormat)}
                  <Text style={styles.settingLabel}>{t("settings.export.encryptionLabel")}</Text>
                  <TextInput
                    value={exportPassphrase}
                    onChangeText={setExportPassphrase}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder={t("settings.export.passphrasePlaceholder")}
                    placeholderTextColor="rgba(190,180,162,0.38)"
                    style={styles.settingInput}
                  />
                  <Pressable onPress={runExport} style={({ pressed }) => [styles.secondaryButton, pressed && styles.touchPressedSoft]}>
                    <Text style={styles.secondaryButtonText}>{t("settings.export.exportButton")}</Text>
                  </Pressable>
                  {!!exportStatus && <Text style={styles.mutedText}>{exportStatus}</Text>}
                </View>
              </View>
            )}

            {activeSettingsTab === "ownershipDelete" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="data" title={t("settings.deletion.title")} body={t("settings.deletion.body")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.deletion.organizeLabel")}</Text>
                  <Pressable onPress={() => confirmClearData("journal")} style={({ pressed }) => [styles.soundTrackRow, pressed && styles.touchPressedSubtle]}>
                    <Text style={styles.settingValue}>{t("settings.deletion.deleteJournalValue")}</Text>
                    <Text style={styles.baseChevron}>›</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmClearData("memories")} style={({ pressed }) => [styles.soundTrackRow, pressed && styles.touchPressedSubtle]}>
                    <Text style={styles.settingValue}>{t("settings.deletion.deleteMemoriesValue")}</Text>
                    <Text style={styles.baseChevron}>›</Text>
                  </Pressable>
                </View>
                <View style={styles.dangerCard}>
                  <GlassBackdrop intensity={20} />
                  <Text style={styles.settingLabel}>{t("settings.deletion.dangerLabel")}</Text>
                  <Text style={styles.mutedText}>{t("settings.deletion.dangerNote")}</Text>
                  <Pressable onPress={confirmDeleteAll} style={({ pressed }) => [styles.dangerButton, pressed && styles.touchPressedSoft]}>
                    <Text style={styles.dangerButtonText}>{t("settings.deletion.deleteArchiveButton")}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {activeSettingsTab === "inheritanceContacts" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="policy" title={t("settings.inheritance.manageTitle")} body={t("settings.inheritance.manageBody")} />
                <Text style={styles.mutedText}>{t("settings.inheritance.importantNote")}</Text>
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.inheritance.contactsLabel")}</Text>
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
                    <Text style={styles.secondaryButtonText}>{t("settings.inheritance.addButton")}</Text>
                  </Pressable>
                  {(inheritanceConfig.contacts || []).length
                    ? (inheritanceConfig.contacts || []).map((c) => renderEntryRow(c.id, c.email, () => removeHeir(c.id)))
                    : <Text style={styles.mutedText}>{t("settings.inheritance.noneYet")}</Text>}
                  {!!inheritanceStatus && <Text style={styles.mutedText}>{inheritanceStatus}</Text>}
                </View>
              </View>
            )}

            {activeSettingsTab === "inheritanceDefault" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="policy" title={t("settings.inheritance.defaultTitle")} body={t("settings.inheritance.defaultBody")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.inheritance.defaultLabel")}</Text>
                  {renderSegmentedRow(
                    [["delete", t("settings.inheritance.deleteOption")], ["transfer", t("settings.inheritance.transferOption")]],
                    inheritanceConfig.defaultAction || "delete",
                    setDefaultAction
                  )}
                  <Text style={styles.mutedText}>{t("settings.inheritance.defaultNote")}</Text>
                  {!!inheritanceStatus && <Text style={styles.mutedText}>{inheritanceStatus}</Text>}
                </View>
              </View>
            )}

            {activeSettingsTab === "inheritanceDisclosure" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="policy" title={t("settings.inheritance.disclosureTitle")} body={t("settings.inheritance.disclosureBody")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.inheritance.disclosureLabel")}</Text>
                  <Text style={styles.mutedText}>{t("settings.inheritance.disclosureNote")}</Text>
                  <TextInput value={disclosureTarget} onChangeText={setDisclosureTarget} placeholder={t("settings.inheritance.disclosureTargetPlaceholder")} placeholderTextColor="rgba(190,180,162,0.38)" style={styles.settingInput} />
                  <TextInput value={disclosureDate} onChangeText={setDisclosureDate} placeholder={t("settings.inheritance.disclosureDatePlaceholder")} placeholderTextColor="rgba(190,180,162,0.38)" style={styles.settingInput} />
                  <TextInput value={disclosureRecipient} onChangeText={setDisclosureRecipient} autoCapitalize="none" keyboardType="email-address" placeholder={t("settings.inheritance.disclosureRecipientPlaceholder")} placeholderTextColor="rgba(190,180,162,0.38)" style={styles.settingInput} />
                  <Pressable onPress={addDisclosure} style={({ pressed }) => [styles.secondaryButton, pressed && styles.touchPressedSoft]}>
                    <Text style={styles.secondaryButtonText}>{t("settings.inheritance.disclosureAddButton")}</Text>
                  </Pressable>
                  {(inheritanceConfig.reservedDisclosures || []).length
                    ? (inheritanceConfig.reservedDisclosures || []).map((d) => renderEntryRow(d.id, `${d.target} → ${d.recipient}（${d.date || t("settings.inheritance.disclosureDateUnset")}）`, () => removeDisclosure(d.id)))
                    : <Text style={styles.mutedText}>{t("settings.inheritance.disclosureNoneYet")}</Text>}
                  {!!inheritanceStatus && <Text style={styles.mutedText}>{inheritanceStatus}</Text>}
                </View>
              </View>
            )}

            {activeSettingsTab === "securityEncryption" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="privacy" title={t("settings.security.encryptionTitle")} body={t("settings.security.encryptionBody")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.security.encryptionLabel")}</Text>
                  <Text style={styles.mutedText}>{t("settings.security.encryptionNote")}</Text>
                </View>
                <SettingToggleRow
                  title={t("settings.security.lockTitle")}
                  body={t("settings.security.lockBody")}
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
                <SettingsPageTitle icon="privacy" title={t("settings.security.recoveryTitle")} body={t("settings.security.recoveryBody")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.security.recoveryLabel")}</Text>
                  <Text style={styles.mutedText}>{t("settings.security.recoveryNote")}</Text>
                  {securityConfig.recoveryKeyIssued && !recoveryKey && (
                    <Text style={styles.mutedText}>{t("settings.security.recoveryIssuedNote")}</Text>
                  )}
                  <Pressable onPress={issueRecoveryKey} style={({ pressed }) => [styles.secondaryButton, pressed && styles.touchPressedSoft]}>
                    <Text style={styles.secondaryButtonText}>{securityConfig.recoveryKeyIssued ? t("settings.security.recoveryReissue") : t("settings.security.recoveryIssue")}</Text>
                  </Pressable>
                  {!!recoveryKey && <Text style={styles.recoveryKeyText}>{recoveryKey}</Text>}
                  {!!recoveryKey && (
                    <Pressable onPress={copyRecoveryKey} style={({ pressed }) => [styles.secondaryButton, pressed && styles.touchPressedSoft]}>
                      <Text style={styles.secondaryButtonText}>{t("settings.security.copyButton")}</Text>
                    </Pressable>
                  )}
                  {!!recoveryStatus && <Text style={styles.mutedText}>{recoveryStatus}</Text>}
                </View>
              </View>
            )}

            {activeSettingsTab === "securityWitness" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="privacy" title={t("settings.security.emergencyTitle")} body={t("settings.security.emergencyBody")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.security.emergencyLabel")}</Text>
                  <Text style={styles.mutedText}>{t("settings.security.emergencyNote")}</Text>
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
                    <Text style={styles.secondaryButtonText}>{t("settings.security.emergencyAddButton")}</Text>
                  </Pressable>
                  {(securityConfig.emergencyContacts || []).length
                    ? (securityConfig.emergencyContacts || []).map((c) => renderEntryRow(c.id, c.email, () => removeEmergencyContact(c.id)))
                    : <Text style={styles.mutedText}>{t("settings.security.emergencyNoneYet")}</Text>}
                  <Text style={styles.mutedText}>{t("settings.security.emergencyReviewNote")}</Text>
                  {!!recoveryStatus && <Text style={styles.mutedText}>{recoveryStatus}</Text>}
                </View>
              </View>
            )}

            {activeSettingsTab === "archiveStyle" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="feedback" title={t("settings.archiveQuality.niloStyleTitle")} body={t("settings.archiveQuality.niloStyleBody")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.archiveQuality.niloStyleLabel")}</Text>
                  {renderSegmentedRow(
                    [["empathetic", t("settings.archiveQuality.styleEmpathetic")], ["questioning", t("settings.archiveQuality.styleQuestioning")], ["organizing", t("settings.archiveQuality.styleOrganizing")], ["silent", t("settings.archiveQuality.styleSilent")]],
                    settings.niloStyle || "empathetic",
                    (value) => updateSettings({ niloStyle: value })
                  )}
                  <Text style={styles.mutedText}>{t(`settings.archiveQuality.styleHints.${settings.niloStyle || "empathetic"}`)}</Text>
                </View>
              </View>
            )}

            {activeSettingsTab === "archiveFrequency" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="ritual" title={t("settings.archiveQuality.reflectionFreqTitle")} body={t("settings.archiveQuality.reflectionFreqBody")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.archiveQuality.reflectionFreqLabel")}</Text>
                  {renderSegmentedRow(
                    ["daily", "weekly", "monthly", "seasonal", "off"].map((freq) => [freq, t(`settings.archiveQuality.reflectionFreqOptions.${freq}`)]),
                    reflectionConfig.frequency || "daily",
                    (value) => updateReflectionSettings({ frequency: value })
                  )}
                  <Text style={styles.mutedText}>{t("settings.archiveQuality.reflectionFreqNote")}</Text>
                </View>
              </View>
            )}

            {activeSettingsTab === "archiveSummary" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="ritual" title={t("settings.archiveQuality.summaryStyleTitle")} body={t("settings.archiveQuality.summaryStyleBody")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.archiveQuality.summaryStyleLabel")}</Text>
                  {renderSegmentedRow(
                    [["narrative", t("settings.archiveQuality.summaryNarrative")], ["keyword", t("settings.archiveQuality.summaryKeyword")], ["timeline", t("settings.archiveQuality.summaryTimeline")]],
                    reflectionConfig.summaryStyle || "narrative",
                    (value) => updateReflectionSettings({ summaryStyle: value })
                  )}
                  <Text style={styles.mutedText}>{t("settings.archiveQuality.summaryNote")}</Text>
                </View>
                <SettingToggleRow
                  title={t("settings.archiveQuality.compareTitle")}
                  body={t("settings.archiveQuality.compareBody")}
                  value={reflectionConfig.compareLastYear !== false}
                  onPress={() => updateReflectionSettings({ compareLastYear: reflectionConfig.compareLastYear === false })}
                />
              </View>
            )}

            {activeSettingsTab === "archiveTone" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="notifications" title={t("settings.archiveQuality.toneTitle")} body={t("settings.archiveQuality.toneBody")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.archiveQuality.toneLabel")}</Text>
                  {renderSegmentedRow(
                    [["quiet", t("settings.archiveQuality.toneQuiet")], ["active", t("settings.archiveQuality.toneActive")]],
                    reflectionConfig.tone || "quiet",
                    (value) => updateReflectionSettings({ tone: value })
                  )}
                  <Text style={styles.mutedText}>{t("settings.archiveQuality.toneNote")}</Text>
                </View>
              </View>
            )}

            {activeSettingsTab === "bgm" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="sound" title={t("settings.app.soundTitle")} body={t("settings.app.soundBody")} />
                <SettingToggleRow
                  title="BGM"
                  body={t("settings.app.bgmToggleBody")}
                  value={settings.bgmEnabled}
                  onPress={() => updateSettings({ bgmEnabled: !settings.bgmEnabled })}
                />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.app.currentBgmLabel")}</Text>
                  <Text style={styles.settingValue}>{activeBgmTrack.title}</Text>
                  <Text style={styles.mutedText}>{activeBgmTrack.subtitle}</Text>
                  <View style={styles.soundStatusRow}>
                    <Text style={styles.soundStatusText}>
                      {settings.bgmEnabled ? (bgmStatus?.playing ? t("settings.app.bgmPlaying") : t("settings.app.bgmLoading")) : t("settings.app.bgmStopped")}
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
                  <Text style={styles.settingLabel}>{t("settings.app.soundtrackLabel")}</Text>
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
                      <Text style={styles.soundTrackMark}>{settings.bgmTrackId === track.id ? t("settings.app.trackOn") : t("settings.app.trackSelect")}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {activeSettingsTab === "notifications" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="notifications" title={t("settings.app.nightWhisperTitle")} body={t("settings.app.nightWhisperBody")} />
                <SettingToggleRow
                  title={t("settings.app.notificationTitle")}
                  body={t("settings.app.notificationBody")}
                  value={settings.notificationsEnabled}
                  onPress={() => updateSettings({ notificationsEnabled: !settings.notificationsEnabled })}
                />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.app.signalTimeLabel")}</Text>
                  {renderSegmentedRow(
                    [["21:00", "21:00"], ["22:00", "22:00"], ["23:00", "23:00"]],
                    settings.notificationTime,
                    (value) => {
                      setNotificationDraft(null);
                      updateSettings({ notificationTime: value });
                    }
                  )}
                  <Text style={styles.settingTimeCaption}>{t("settings.app.timeCaption")}</Text>
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
                  <Text style={styles.mutedText}>{t("settings.app.timeSavedNote")}</Text>
                </View>
              </View>
            )}

            {activeSettingsTab === "ritual" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="ritual" title={t("settings.app.dialogueTitle")} body={t("settings.app.dialogueBody")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.app.questionCountLabel")}</Text>
                  {renderSegmentedRow(
                    [[3, `3${t("settings.app.questionCountSuffix")}`], [4, `4${t("settings.app.questionCountSuffix")}`], [5, `5${t("settings.app.questionCountSuffix")}`]],
                    ritualConfig.questionCount || 5,
                    (value) => updateRitualSettings({ questionCount: value })
                  )}
                  <Text style={styles.mutedText}>{t("settings.app.questionCountNote")}</Text>
                </View>
                <SettingToggleRow
                  title={t("settings.app.saveToJournalTitle")}
                  body={t("settings.app.saveToJournalBody")}
                  value={ritualConfig.autoSaveJournal !== false}
                  onPress={() => updateRitualSettings({ autoSaveJournal: ritualConfig.autoSaveJournal === false })}
                />
                <SettingToggleRow
                  title={t("settings.app.confirmExitTitle")}
                  body={t("settings.app.confirmExitBody")}
                  value={ritualConfig.confirmExit !== false}
                  onPress={() => updateRitualSettings({ confirmExit: ritualConfig.confirmExit === false })}
                />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.app.timeRangeLabel")}</Text>
                  <Text style={styles.mutedText}>{t("settings.app.timeRangeNote")}</Text>
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
                <SettingsPageTitle icon="language" title={t("settings.app.fontScaleTitle")} body={t("settings.app.fontScaleBody")} />
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.app.fontScaleLabel")}</Text>
                  {renderSegmentedRow(
                    [["small", t("settings.app.fontScaleSmall")], ["standard", t("settings.app.fontScaleStandard")], ["large", t("settings.app.fontScaleLarge")]],
                    settings.fontScale || "standard",
                    (value) => updateSettings({ fontScale: value })
                  )}
                  <Text style={styles.mutedText}>{t("settings.app.fontScaleNote")}</Text>
                </View>
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.app.languageLabel")}</Text>
                  {renderSegmentedRow(
                    LANGUAGES,
                    lang,
                    (value) => updateSettings({ language: value })
                  )}
                  <Text style={styles.mutedText}>{t("settings.app.languageNote")}</Text>
                </View>
              </View>
            )}

            {activeSettingsTab === "account" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="profile" title={t("settings.account.title")} body={t("settings.account.body")} />
                <View style={styles.arcSettingGroupCard}>
                  <ArcSettingRow
                    title={t("settings.account.profileTitle")}
                    body={t("settings.account.profileBody")}
                    onPress={() => {
                      onUiSound?.();
                      setActiveSettingsTab("profile");
                    }}
                  />
                  <ArcSettingRow
                    title={t("settings.account.syncTitle")}
                    body={authLoading ? t("settings.account.checking") : session ? t("settings.account.connected") : t("settings.account.notConnected")}
                    last={!session}
                    onPress={() => {
                      onUiSound?.();
                      setActiveSettingsTab("sync");
                    }}
                  />
                  {!!session && (
                    <ArcSettingRow
                      title={t("settings.account.logoutTitle")}
                      body={t("settings.account.logoutBody")}
                      last
                      onPress={() => {
                        onUiSound?.();
                        setActiveSettingsTab("logout");
                      }}
                    />
                  )}
                </View>
              </View>
            )}

            {activeSettingsTab === "profile" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="profile" title={t("settings.account.profileScreenTitle")} body={t("settings.account.profileScreenBody")} />
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
                      <Text style={styles.settingLabel}>{t("settings.account.displayProfileLabel")}</Text>
                      <Text style={styles.profileEditName}>{displayName}</Text>
                      <Text style={styles.mutedText}>{profileDay}{t("settings.account.dayRecorderSuffix")}</Text>
                    </View>
                  </View>
                  <Pressable onPress={onPickProfileImage} style={({ pressed }) => [styles.secondaryButton, pressed && styles.touchPressedSoft]}>
                    <Text style={styles.secondaryButtonText}>{t("settings.account.changePhotoButton")}</Text>
                  </Pressable>
                </View>
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.account.basicInfoLabel")}</Text>
                  <TextInput value={name} onChangeText={setName} placeholder={t("settings.account.namePlaceholder")} placeholderTextColor="rgba(190,180,162,0.38)" style={styles.settingInput} />
                  <TextInput value={birthdate} onChangeText={setBirthdate} placeholder="YYYY-MM-DD" placeholderTextColor="rgba(190,180,162,0.38)" style={styles.settingInput} />
                  <Text style={styles.mutedText}>{t("settings.account.journeyDayNote")}</Text>
                  <View style={styles.profileSaveRow}>
                    <Pressable
                      onPress={() => {
                        onUiSound?.();
                        setProfile((current) => ({ ...current, name, birthdate }));
                        setActiveSettingsTab("base");
                      }}
                      style={({ pressed }) => [styles.profileSaveButton, pressed && styles.touchPressedSoft]}
                    >
                      <Text style={styles.profileSaveButtonText}>{t("settings.account.saveProfileButton")}</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.profileDataGrid}>
                  <BaseStat label={t("settings.ownership.journalStat")} value={`${journal.length}`} />
                  <BaseStat label={t("settings.ownership.memoryStat")} value={`${memories.length}`} />
                </View>
              </View>
            )}

            {activeSettingsTab === "sync" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="sync" title={t("settings.account.syncScreenTitle")} body={t("settings.account.syncScreenBody")} />
                <View style={styles.authCard}>
                  <GlassBackdrop intensity={24} />
                  <View style={styles.authCopy}>
                    <Text style={styles.settingLabel}>{t("settings.account.googleAccountLabel")}</Text>
                    <Text style={styles.settingValue}>{accountLabel}</Text>
                    <Text style={styles.mutedText}>
                      {t("settings.account.googleConnectNote")}
                    </Text>
                  </View>
                  {session ? (
                    <View style={styles.syncStatusPill}>
                      <Text style={styles.syncStatusText}>{syncStatus}</Text>
                    </View>
                  ) : (
                    <Pressable disabled={authBusy} onPress={onGoogleSignIn} style={({ pressed }) => [styles.primaryButton, authBusy && styles.disabledButton, pressed && !authBusy && styles.touchPressedSoft]}>
                      <Text style={styles.primaryButtonText}>{authBusy ? t("gate.connecting") : t("gate.googleLogin")}</Text>
                    </Pressable>
                  )}
                  {!!authError && <Text style={styles.errorText}>{authError}</Text>}
                </View>
                <View style={styles.settingsCard}>
                  <GlassBackdrop intensity={24} />
                  <Text style={styles.settingLabel}>{t("settings.account.syncTargetLabel")}</Text>
                  <View style={styles.syncSummaryRow}>
                    <BaseStat label={t("settings.ownership.journalStat")} value={`${journal.length}`} />
                    <BaseStat label={t("settings.ownership.memoryStat")} value={`${memories.length}`} />
                  </View>
                  <Text style={styles.mutedText}>{t("settings.account.syncNote")}</Text>
                </View>
                <View style={styles.redirectBox}>
                  <Text style={styles.settingLabel}>Redirect URI</Text>
                  <Text style={styles.redirectText}>{redirectUri}</Text>
                </View>
              </View>
            )}

            {activeSettingsTab === "logout" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="logout" title={t("settings.account.logoutScreenTitle")} body={t("settings.account.logoutScreenBody")} />
                <View style={styles.dangerCard}>
                  <GlassBackdrop intensity={20} />
                  <Text style={styles.settingLabel}>{t("settings.account.currentAccountLabel")}</Text>
                  <Text style={styles.settingValue}>{accountLabel}</Text>
                  <Text style={styles.mutedText}>{t("settings.account.logoutNote")}</Text>
                  <Pressable
                    disabled={!session || authBusy}
                    onPress={confirmSignOut}
                    style={({ pressed }) => [styles.dangerButton, (!session || authBusy) && styles.disabledButton, pressed && session && !authBusy && styles.touchPressedSoft]}
                  >
                    <Text style={styles.dangerButtonText}>{authBusy ? t("gate.processing") : t("settings.account.logoutButton")}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {activeSettingsTab === "terms" && (
              <LegalPage
                icon="terms"
                title={t("settings.about.title")}
                body={t("settings.about.body")}
                updatedAt="2026.06.06"
                sections={termsSections}
              />
            )}

            {activeSettingsTab === "privacyPolicy" && (
              <LegalPage
                icon="policy"
                title={t("settings.about.privacyTitle")}
                body={t("settings.about.privacyBody")}
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
  const t = useT();
  return (
    <View style={styles.settingsPage}>
      <SettingsPageTitle icon={icon} title={title} body={body} />
      <View style={styles.legalNoticeCard}>
        <GlassBackdrop intensity={22} />
        <Text style={styles.settingLabel}>{t("settings.about.lastUpdatedLabel")}</Text>
        <Text style={styles.settingValue}>{updatedAt}</Text>
        <Text style={styles.mutedText}>
          {t("settings.about.draftNote")}
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
  displayName,
  onSelect,
  updateSettings,
  playToken = 0
}) {
  const lang = normalizeLanguageCode(settings.language);
  const t = (key, ...args) => translate(lang, key, ...args);
  const currentLanguageLabel = LANGUAGES.find(([value]) => value === lang)?.[1] || lang;

  return (
    <View style={styles.simpleSettingsPage}>
      <ArcSettingGroup label={t("settings.groups.ownership")} index={0} playToken={playToken}>
        <ArcSettingRow
          title={t("settings.rows.ownershipPolicyTitle")}
          body={t("settings.rows.ownershipPolicyBody")}
          onPress={() => onSelect("ownershipPolicy")}
        />
        <ArcSettingRow
          title={t("settings.rows.dataExportTitle")}
          body={t("settings.rows.dataExportBody")}
          onPress={() => onSelect("ownershipExport")}
        />
        <ArcSettingRow
          title={t("settings.rows.archiveDeleteTitle")}
          body={t("settings.rows.archiveDeleteBody")}
          onPress={() => onSelect("ownershipDelete")}
        />
      </ArcSettingGroup>

      <ArcSettingGroup label={t("settings.groups.inheritance")} index={1} playToken={playToken}>
        <ArcSettingRow
          title={t("settings.rows.inheritanceManageTitle")}
          body={t("settings.rows.inheritanceManageBody")}
          onPress={() => onSelect("inheritanceContacts")}
        />
        <ArcSettingRow
          title={t("settings.rows.inheritanceDefaultTitle")}
          body={t("settings.rows.inheritanceDefaultBody")}
          onPress={() => onSelect("inheritanceDefault")}
        />
        <ArcSettingRow
          title={t("settings.rows.disclosureTitle")}
          body={t("settings.rows.disclosureBody")}
          onPress={() => onSelect("inheritanceDisclosure")}
        />
      </ArcSettingGroup>

      <ArcSettingGroup label={t("settings.groups.security")} index={2} playToken={playToken}>
        <ArcSettingRow
          title={t("settings.rows.encryptionStatusTitle")}
          body={t("settings.rows.encryptionStatusBody")}
          onPress={() => onSelect("securityEncryption")}
        />
        <ArcSettingRow
          title={t("settings.rows.recoveryKeyTitle")}
          body={t("settings.rows.recoveryKeyBody")}
          onPress={() => onSelect("securityRecovery")}
        />
        <ArcSettingRow
          title={t("settings.rows.emergencyContactTitle")}
          body={t("settings.rows.emergencyContactBody")}
          onPress={() => onSelect("securityWitness")}
        />
      </ArcSettingGroup>

      <ArcSettingGroup label={t("settings.groups.archiveQuality")} index={3} playToken={playToken}>
        <ArcSettingRow
          title={t("settings.rows.niloStyleTitle")}
          body={t("settings.rows.niloStyleBody")}
          onPress={() => onSelect("archiveStyle")}
        />
        <ArcSettingRow
          title={t("settings.rows.reflectionFreqTitle")}
          body={t("settings.rows.reflectionFreqBody")}
          onPress={() => onSelect("archiveFrequency")}
        />
        <ArcSettingRow
          title={t("settings.rows.summaryStyleTitle")}
          body={t("settings.rows.summaryStyleBody")}
          onPress={() => onSelect("archiveSummary")}
        />
        <ArcSettingRow
          title={t("settings.rows.notificationToneTitle")}
          body={t("settings.rows.notificationToneBody")}
          onPress={() => onSelect("archiveTone")}
        />
      </ArcSettingGroup>

      <ArcSettingGroup label={t("settings.groups.appSettings")} index={4} playToken={playToken}>
        <ArcSettingRow
          title={t("settings.rows.nightWhisperTitle")}
          body={t("settings.rows.nightWhisperBody")}
          value={settings.notificationTime || "23:00"}
          onPress={() => onSelect("notifications")}
        />
        <ArcSettingRow
          title={t("settings.rows.nightDialogueTitle")}
          body={t("settings.rows.nightDialogueBody")}
          onPress={() => onSelect("ritual")}
        />
        <ArcSettingRow
          title={t("settings.rows.soundTitle")}
          body={t("settings.rows.soundBody")}
          onPress={() => onSelect("bgm")}
        />
        <ArcSettingRow
          title={t("settings.rows.fontScaleTitle")}
          value={{
            small: t("settings.app.fontScaleSmall"),
            standard: t("settings.app.fontScaleStandard"),
            large: t("settings.app.fontScaleLarge")
          }[settings.fontScale || "standard"]}
          onPress={() => onSelect("language")}
        />
        <ArcSettingRow
          title={t("settings.app.languageLabel")}
          body={t("settings.app.languageNote")}
          value={currentLanguageLabel}
          onPress={() => onSelect("language")}
        />
        <ArcSettingRow
          title={t("settings.rows.aboutArcTitle")}
          onPress={() => onSelect("terms")}
        />
        <ArcSettingRow
          title={t("settings.rows.privacyPolicyTitle")}
          onPress={() => onSelect("privacyPolicy")}
        />
      </ArcSettingGroup>

      <ArcSettingGroup label={t("settings.groups.account")} index={5} playToken={playToken}>
        <ArcSettingRow
          title={t("settings.rows.accountTitle")}
          body={authLoading ? t("settings.account.checking") : session ? `${t("settings.account.connected")}・${displayName}` : t("settings.account.notConnected")}
          onPress={() => onSelect("account")}
        />
      </ArcSettingGroup>

      <View style={styles.settingsWordmark}>
        <Text style={styles.settingsWordmarkText}>A R C</Text>
        <Text style={styles.settingsVersion}>{t("settings.rows.versionFooter")}</Text>
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

// 日記は二層で残す: 出来事(小・淡)と、対話の最後に立ち上がった意味(主役)。
// 旧形式のエントリー(event/meaning/dialogue なし)は保存済みの messages や
// title から同じ形に読み替えるので、データ移行はしない。
function normalizeDiaryEntry(entry, index, lang = "ja") {
  const dialogue = entry.dialogue || entry.messages || [];
  const userTexts = dialogue
    .filter((message) => message?.role === "user" && message.text)
    .map((message) => String(message.text).trim())
    .filter(Boolean);
  const lastAnswer = userTexts[userTexts.length - 1] || "";
  const meaning =
    entry.meaning || lastAnswer || entry.title || entry.summary || (entry.lines || []).join("。") || translate(lang, "journal.defaultMeaning");
  let event = entry.event || (userTexts.length > 1 ? userTexts[0] : "");
  if (event === meaning) event = "";
  const score = userTexts.length * 2 + Math.min(6, userTexts.join("").length / 40) + (entry.emotions || []).length;
  return {
    id: entry.id || `journal-${index}`,
    dateKey: entry.dateKey || "",
    dateLabel: formatMonthDay(entry.dateKey, lang) || entry.dateLabel || translate(lang, "journal.defaultDate"),
    weekday: formatWeekday(entry.dateKey, lang),
    event,
    meaning,
    isQuest: entry.source === "quest",
    score,
    // Carry the conversational record through so a tapped entry can open into
    // its full detail (dialogue / emotions / a similar night).
    title: entry.title,
    source: entry.source,
    questText: entry.questText,
    dialogue,
    emotions: entry.emotions,
    related: entry.related
  };
}

// 強弱は直近の窓の中だけで相対評価する(仕様 §04-①)。数値は表に出さない。
function assignDiaryTiers(entries) {
  if (!entries.length) return [];
  const scores = entries.map((entry) => entry.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  return entries.map((entry) => {
    if (max - min < 2) return { ...entry, tier: "normal" };
    const t = (entry.score - min) / (max - min);
    return { ...entry, tier: t >= 0.66 ? "strong" : t <= 0.25 ? "quiet" : "normal" };
  });
}

function getJournalDisplayEntries(journal, includeDemo = DEV_MODE) {
  const source = Array.isArray(journal) ? journal : [];
  if (!includeDemo) return source;

  const seen = new Set();
  return [...source, ...demoJournalEntries].filter((entry, index) => {
    if (!entry) return false;
    const key = entry.id || `${entry.dateKey || "unknown"}-${entry.meaning || entry.title || index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getDiaryModel(journal, options = {}) {
  const source = getJournalDisplayEntries(journal, options.includeDemo ?? DEV_MODE);
  const lang = normalizeLanguageCode(options.lang);
  const entries = [...source]
    .sort((a, b) => String(b.dateKey || "").localeCompare(String(a.dateKey || "")))
    .map((entry, index) => normalizeDiaryEntry(entry, index, lang));

  const now = new Date(`${getJournalDateKey()}T00:00:00`);
  const recentEdge = new Date(now);
  recentEdge.setDate(recentEdge.getDate() - DIARY_RECENT_DAYS);
  const recentEdgeKey = toDateKey(recentEdge);
  const archiveEdge = new Date(now);
  archiveEdge.setMonth(archiveEdge.getMonth() - DIARY_ARCHIVE_MONTHS);
  const archiveEdgeKey = toDateKey(archiveEdge);

  const recentEntries = [];
  const bandMap = new Map();
  let hasOlder = false;
  for (const entry of entries) {
    if (entry.dateKey >= recentEdgeKey) {
      recentEntries.push(entry);
    } else if (entry.dateKey >= archiveEdgeKey) {
      const monthKey = entry.dateKey.slice(0, 7);
      if (!bandMap.has(monthKey)) {
        const [year, month] = monthKey.split("-").map(Number);
        bandMap.set(monthKey, {
          monthKey,
          label: year === now.getFullYear() ? `${month}月` : `${year}年${month}月`,
          entries: []
        });
      }
      bandMap.get(monthKey).entries.push(entry);
    } else {
      hasOlder = true;
    }
  }

  return {
    cumulativeEntries: assignDiaryTiers(entries),
    recentEntries: assignDiaryTiers(recentEntries),
    monthlyBands: [...bandMap.values()],
    hasOlder
  };
}

// Chapters become full pages (1章＝1画面). Confirmed chapters from Nilo carry
// only period/observation/people/emotions — every richer element renders only
// when its data exists, so a sparse chapter stays quiet instead of empty.
function getChapterPages(chapters, lang = "ja") {
  if (!chapters?.length) return [...demoChapters].reverse();
  const total = chapters.length;
  return chapters.map((chapter, index) => ({
    id: chapter.id || `chapter-${index}`,
    title: chapter.title || translate(lang, "chapter.namelessChapter"),
    ordinal: `${translate(lang, "chapter.ordinalPrefix")}${lang === "ja" ? toJapaneseNumber(total - index) : total - index}${translate(lang, "chapter.ordinalSuffix")}`,
    period: chapter.period || translate(lang, "chapter.nowPeriod"),
    summary: chapter.observation || chapter.summary || translate(lang, "chapter.defaultSummary"),
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

function toJapaneseWeekday(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
}

// 「1年前の同じ季節と比べる」(Onboarding/Diary仕様の生年月日取得理由に接続)。
// ちょうど1年前を中心に前後10日の中から、いちばん近い一日を差し出す。
function findLastYearEcho(journal, options = {}) {
  const source = getJournalDisplayEntries(journal, options.includeDemo ?? DEV_MODE);
  const lang = normalizeLanguageCode(options.lang);
  const target = new Date(`${getJournalDateKey()}T00:00:00`);
  target.setFullYear(target.getFullYear() - 1);
  let best = null;
  let bestDistance = Infinity;
  source.forEach((entry, index) => {
    if (!entry.dateKey) return;
    const date = new Date(`${entry.dateKey}T00:00:00`);
    if (Number.isNaN(date.getTime())) return;
    const distance = Math.abs(date - target) / 86400000;
    if (distance <= 10 && distance < bestDistance) {
      bestDistance = distance;
      best = normalizeDiaryEntry(entry, index, lang);
    }
  });
  return best;
}

function toJapaneseNumber(value) {
  const labels = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  return labels[value] || String(value);
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

function buildExportJson({ journal, memories, chapters, profile, settings }) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    app: "ARC",
    journal,
    memories,
    chapters,
    profile,
    settings
  }, null, 2);
}

function buildExportMarkdown({ journal, memories, chapters }, lang = "ja") {
  const lines = [
    translate(lang, "export.title"),
    "",
    `${translate(lang, "export.exportedAtLabel")}: ${new Date().toLocaleString(LOCALE_TAGS[lang] || "ja-JP")}`,
    "",
    translate(lang, "export.journalHeading"),
    ""
  ];
  (journal || []).forEach((entry) => {
    lines.push(`### ${entry.dateLabel || entry.dateKey || ""}${entry.tag ? `  ·  ${entry.tag}` : ""}`);
    const body = entry.text || entry.summary || "";
    if (body) lines.push("", body);
    lines.push("");
  });
  if ((memories || []).length) {
    lines.push(translate(lang, "export.memoriesHeading"), "");
    memories.forEach((memory) => {
      lines.push(`- ${memory.dateLabel || memory.dateKey || ""}：${memory.essence || memory.keptPhrase || ""}`);
    });
    lines.push("");
  }
  if ((chapters || []).length) {
    lines.push(translate(lang, "export.chaptersHeading"), "");
    chapters.forEach((chapter) => lines.push(`### ${chapter.title || translate(lang, "export.untitledChapter")}`, chapter.summary || "", ""));
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

// ── Design tokens ─────────────────────────────────────────────────────────
// 統合UIの単一情報源。色は静的定数なので buildStyles のフォント再スケールと干渉しない。
// 命名は Web/styles.css の :root（--amber / --ink 等）と対応づく。
const TOKENS = {
  color: {
    // 背景（暖色・design_handoff 準拠）
    bgBase: "#100c0a",
    bgEdge: "#0e0b09",
    bgDeep: "#0b0807",
    scrim: "rgba(16,12,10,0.18)",
    // ゴールド・ランプ（正準）
    goldCore: "#fbead0",
    goldBright: "rgba(242,200,142,1)",
    gold: "#d9a86c",
    goldText: "rgba(228,184,124,0.9)",
    goldDeep: "#b98a50",
    // sage 副アクセント
    sage: "rgba(119,149,143,1)",
    // ニュートラル / テキスト
    ink: "#f6efe4",
    inkSoft: "rgba(246,239,228,0.72)",
    muted: "#c2bbb0",
    faint: "rgba(190,180,162,0.5)",
    hairline: "rgba(255,254,244,0.18)",
    onGold: "#201a14"
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  radius: { tight: 8, card: 14, panel: 22, pill: 999 },
  font: { label: 11, small: 12, body: 14, bodyLg: 17, title: 22, question: 27, display: 33 },
  shadow: {
    soft: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: -7, height: -9 } },
    card: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 30, shadowOffset: { width: -8, height: -12 } },
    glow: { shadowColor: "rgba(217,168,108,0.5)", shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } }
  }
};

const baseStyleDefs = ({
  background: {
    flex: 1,
    backgroundColor: TOKENS.color.bgBase
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
    backgroundColor: TOKENS.color.scrim
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
    color: TOKENS.color.ink,
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
    borderColor: TOKENS.color.bgBase,
    borderRadius: 999,
    borderWidth: 2,
    bottom: 1,
    height: 12,
    position: "absolute",
    right: 1,
    width: 12
  },
  accountButtonStatusConnected: {
    backgroundColor: TOKENS.color.gold
  },
  symbolButtonText: {
    color: TOKENS.color.ink,
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
    color: TOKENS.color.ink,
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
    borderColor: TOKENS.color.hairline,
    borderRadius: TOKENS.radius.panel,
    borderWidth: 1,
    gap: 12,
    padding: 20,
    shadowColor: TOKENS.color.goldCore,
    shadowOpacity: 0.12,
    shadowRadius: 34,
    shadowOffset: { width: -10, height: -14 }
  },
  gateEyebrow: {
    color: TOKENS.color.gold,
    fontSize: TOKENS.font.label,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  gateTitle: {
    color: TOKENS.color.ink,
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 26,
    fontWeight: "700"
  },
  gateBody: {
    color: TOKENS.color.muted,
    fontSize: 14,
    lineHeight: 22
  },
  gateButton: {
    alignItems: "center",
    backgroundColor: "rgba(217,168,108,0.94)",
    borderRadius: 999,
    justifyContent: "center",
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: 18
  },
  gateButtonText: {
    color: TOKENS.color.onGold,
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
    color: TOKENS.color.ink,
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
    color: TOKENS.color.ink,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 14
  },
  gateHint: {
    color: TOKENS.color.gold,
    fontSize: 12,
    fontWeight: "700"
  },
  gateOtpLead: {
    color: TOKENS.color.muted,
    fontSize: 12,
    lineHeight: 18
  },
  gateTextButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30
  },
  gateTextButtonText: {
    color: "rgba(217,168,108,0.86)",
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
    color: TOKENS.color.gold,
    fontSize: TOKENS.font.label,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 2,
    textTransform: "uppercase"
  },
  niloStageEyebrowCompact: {
    marginTop: 0
  },
  niloThinkingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center"
  },
  niloThinkingText: {
    color: "rgba(217,168,108,0.78)",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 4,
    marginTop: 8
  },
  niloStageTitle: {
    color: TOKENS.color.ink,
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26
  },
  niloSealMark: {
    color: "rgba(217,168,108,0.82)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: "center"
  },
  niloSealHalo: {
    borderColor: "rgba(228,196,142,0.55)",
    borderRadius: 70,
    borderWidth: 1,
    height: 140,
    left: "50%",
    marginLeft: -70,
    marginTop: -70,
    position: "absolute",
    top: "50%",
    width: 140
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
    color: "rgba(217,168,108,0.72)",
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
    color: TOKENS.color.muted,
    fontSize: 12,
    lineHeight: 18
  },
  firstRunCard: {
    backgroundColor: "rgba(255,254,244,0.085)",
    borderColor: TOKENS.color.hairline,
    borderRadius: TOKENS.radius.panel,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    padding: TOKENS.space.lg
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
    color: TOKENS.color.goldBright,
    fontSize: 18,
    lineHeight: 20
  },
  firstRunCopy: {
    flex: 1,
    gap: 4
  },
  firstRunTitle: {
    color: TOKENS.color.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  firstRunBody: {
    color: TOKENS.color.muted,
    fontSize: 12,
    lineHeight: 18
  },
  firstRunHint: {
    color: "rgba(217,168,108,0.78)",
    fontSize: 11,
    lineHeight: 16
  },
  firstRunButton: {
    alignSelf: "center",
    backgroundColor: "rgba(217,168,108,0.92)",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12
  },
  firstRunButtonText: {
    color: TOKENS.color.onGold,
    fontSize: 12,
    fontWeight: "800"
  },
  ritualCard: {
    gap: 18,
    marginBottom: 18,
    paddingVertical: 4
  },
  eyebrow: {
    color: TOKENS.color.gold,
    fontSize: TOKENS.font.label,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  inputCard: {
    backgroundColor: "rgba(255,254,244,0.085)",
    borderColor: TOKENS.color.hairline,
    borderRadius: TOKENS.radius.panel,
    borderWidth: 1,
    marginBottom: 14,
    padding: TOKENS.space.lg
  },
  input: {
    color: TOKENS.color.ink,
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
    borderColor: "rgba(217,168,108,0.28)",
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
    backgroundColor: TOKENS.color.scrim,
    position: "absolute",
  },
  ritualStartButtonPressed: {
    transform: [{ scale: 0.97 }]
  },
  ritualStartButtonDisabled: {
    backgroundColor: "rgba(12,10,12,0.74)",
    borderColor: "rgba(217,168,108,0.1)",
    opacity: 0.46,
    shadowOpacity: 0
  },
  ritualStartIcon: {
    color: TOKENS.color.goldBright,
    fontSize: 14,
    marginRight: 10,
    textShadowColor: "rgba(217,168,108,0.22)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8
  },
  ritualStartCopy: {
    alignItems: "center",
    zIndex: 1
  },
  ritualStartText: {
    color: TOKENS.color.goldCore,
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
    shadowColor: TOKENS.color.goldCore,
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
    color: "rgba(217,168,108,0.92)"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(217,168,108,0.9)",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 18,
    shadowColor: TOKENS.color.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 14
  },
  disabledButton: {
    opacity: 0.46
  },
  primaryButtonText: {
    color: TOKENS.color.onGold,
    fontFamily: fontSerifJa,
    fontSize: 14,
    letterSpacing: 0.7
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(217,168,108,0.12)",
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
    borderColor: TOKENS.color.hairline,
    borderRadius: TOKENS.radius.panel,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    padding: 16,
    shadowColor: TOKENS.color.goldCore,
    shadowOffset: { width: -7, height: -9 },
    shadowOpacity: 0.08,
    shadowRadius: 24
  },
  memoryCard: {
    backgroundColor: "rgba(255,254,244,0.06)",
    borderColor: "rgba(217,168,108,0.28)",
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
    color: TOKENS.color.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1
  },
  memoryMood: {
    color: TOKENS.color.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5
  },
  memoryEssence: {
    color: TOKENS.color.ink,
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
    backgroundColor: "rgba(217,168,108,0.16)",
    borderColor: "rgba(217,168,108,0.4)",
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
    backgroundColor: "rgba(217,168,108,0.26)"
  },
  chapterButtonIcon: {
    color: TOKENS.color.gold,
    fontSize: 14
  },
  chapterButtonText: {
    color: TOKENS.color.ink,
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
    color: TOKENS.color.gold,
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 42,
    lineHeight: 40
  },
  chapterMarkCol: {
    gap: 3,
    paddingTop: 5
  },
  chapterEyebrowLabel: {
    color: TOKENS.color.gold,
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
    backgroundColor: "rgba(217,168,108,0.22)",
    height: 1
  },
  proposalPeriod: {
    color: "rgba(217,168,108,0.85)",
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 7
  },
  chapterAccent: {
    backgroundColor: "rgba(217,168,108,0.5)",
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
    color: TOKENS.color.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5
  },
  chapterDot: {
    color: "rgba(217,168,108,0.55)",
    fontSize: 11
  },
  chapterPeriod: {
    color: TOKENS.color.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5
  },
  chapterCardTitle: {
    color: TOKENS.color.ink,
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 27,
    lineHeight: 35
  },
  chapterSummary: {
    color: TOKENS.color.muted,
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
    backgroundColor: TOKENS.color.gold,
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
    backgroundColor: "rgba(217,168,108,0.07)",
    borderColor: "rgba(217,168,108,0.32)",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    marginBottom: 12,
    padding: 20
  },
  proposalEyebrow: {
    color: TOKENS.color.gold,
    fontSize: TOKENS.font.label,
    fontWeight: "700",
    letterSpacing: 1.5
  },
  proposalObservation: {
    color: TOKENS.color.ink,
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
    backgroundColor: "rgba(217,168,108,0.18)",
    borderColor: "rgba(217,168,108,0.45)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 9
  },
  proposalAcceptText: {
    color: TOKENS.color.ink,
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
    color: TOKENS.color.muted,
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
    backgroundColor: TOKENS.color.gold,
    height: 1,
    marginVertical: 9,
    width: 26
  },
  meaningArrow: {
    color: TOKENS.color.gold,
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
    color: TOKENS.color.gold,
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
    color: TOKENS.color.gold,
    fontSize: 11,
    letterSpacing: 1,
    paddingTop: 1,
    width: 50
  },
  episodeText: {
    color: TOKENS.color.muted,
    flex: 1,
    fontSize: 14,
    lineHeight: 22
  },
  chipSmall: {
    backgroundColor: "rgba(255,254,244,0.06)",
    borderColor: "rgba(255,254,244,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    color: TOKENS.color.muted,
    fontSize: 11,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 3
  },
  panelTitle: {
    color: TOKENS.color.ink,
    fontSize: 17,
    fontWeight: "700"
  },
  entryTitle: {
    color: TOKENS.color.ink,
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 22,
    fontWeight: "600"
  },
  entryDate: {
    color: TOKENS.color.gold,
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
    color: TOKENS.color.ink,
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 38,
    fontWeight: "600"
  },
  calendarSectionLabel: {
    color: TOKENS.color.gold,
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
    color: TOKENS.color.ink,
    fontSize: 15,
    fontWeight: "700"
  },
  pastToggleMeta: {
    color: "rgba(246,239,228,0.5)",
    fontSize: 12,
    marginTop: 2
  },
  pastToggleChevron: {
    color: TOKENS.color.gold,
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
    backgroundColor: "rgba(217,168,108,0.12)",
    borderColor: "rgba(217,168,108,0.32)"
  },
  pastRowDate: {
    color: TOKENS.color.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    width: 84
  },
  pastRowTitle: {
    color: TOKENS.color.ink,
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
    color: TOKENS.color.ink,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2
  },
  calendarTextActive: {
    color: TOKENS.color.goldBright
  },
  calendarDot: {
    backgroundColor: "transparent",
    borderRadius: 999,
    height: 4,
    marginTop: 5,
    width: 4
  },
  calendarDotActive: {
    backgroundColor: TOKENS.color.gold
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
    shadowColor: TOKENS.color.goldCore,
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
    backgroundColor: "rgba(217,168,108,0.12)"
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
    color: TOKENS.color.gold
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
    shadowColor: TOKENS.color.goldCore,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18
  },
  unlockNoticeText: {
    color: TOKENS.color.ink,
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
    color: TOKENS.color.goldBright,
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
    color: TOKENS.color.muted,
    fontFamily: fontUiMedium,
    fontSize: 18,
    fontWeight: "700"
  },
  settingsTabTitle: {
    color: TOKENS.color.ink,
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
    color: TOKENS.color.gold,
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
    shadowColor: TOKENS.color.gold,
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
    shadowColor: TOKENS.color.gold,
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
    shadowColor: TOKENS.color.gold,
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
    paddingHorizontal: 46,
    position: "relative"
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
    marginBottom: 22,
    textAlign: "center"
  },
  homeLeadTextDimmed: {
    opacity: 0.28
  },
  homeQuestionFrame: {
    alignItems: "center",
    position: "relative"
  },
  homeQuestionFrameCompact: {
    transform: [{ translateY: -4 }]
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
    color: TOKENS.color.goldBright,
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
    shadowColor: TOKENS.color.goldBright,
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 }
  },
  questScrollContent: {
    paddingBottom: 118,
    paddingHorizontal: 30,
    paddingTop: 54
  },
  questHeader: {
    marginBottom: 12,
    minHeight: 146,
    overflow: "hidden",
    position: "relative"
  },
  questHeaderShimmer: {
    height: 178,
    left: -96,
    position: "absolute",
    top: -20,
    width: 82,
    zIndex: 0
  },
  questHeaderShimmerFill: {
    flex: 1
  },
  questHeaderTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    position: "relative",
    zIndex: 1
  },
  questTitleBlock: {
    flex: 1,
    paddingRight: 16
  },
  questScreenTitle: {
    color: "#E8E2D6",
    fontFamily: fontSerifJa,
    fontSize: 22,
    letterSpacing: 1.8,
    lineHeight: 30
  },
  questEyebrow: {
    color: "rgba(177,199,190,0.62)",
    fontFamily: fontSerifEnMedium,
    fontSize: 10,
    letterSpacing: 2.8,
    lineHeight: 12,
    marginTop: 7
  },
  questFieldPill: {
    alignItems: "center",
    borderColor: "rgba(119,149,143,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  questFieldPillText: {
    color: "rgba(200,207,194,0.58)",
    fontFamily: fontSerifEnMedium,
    fontSize: 10,
    letterSpacing: 2,
    lineHeight: 13
  },
  questWatermark: {
    color: "rgba(119,149,143,0.055)",
    fontFamily: fontSerifEnMedium,
    fontSize: 58,
    letterSpacing: 2,
    lineHeight: 58,
    position: "absolute",
    right: -3,
    top: 48
  },
  questPhilosophy: {
    color: "rgba(205,191,168,0.58)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 0.8,
    lineHeight: 21,
    marginTop: 17,
    position: "relative",
    zIndex: 1
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
    color: "rgba(190,180,162,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 3.3
  },
  questGroupRule: {
    backgroundColor: "rgba(119,149,143,0.18)",
    flex: 1,
    height: 1
  },
  questProposalObservation: {
    color: "#E8E2D6",
    fontFamily: fontSerifJa,
    fontSize: 17,
    letterSpacing: 0.5,
    lineHeight: 29,
    marginTop: 14,
    paddingRight: 8
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
    alignItems: "center",
    backgroundColor: "rgba(20,18,15,0.28)",
    borderColor: "rgba(119,149,143,0.16)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginBottom: 10,
    minHeight: 78,
    overflow: "hidden",
    paddingHorizontal: 15,
    paddingVertical: 15,
    position: "relative"
  },
  questOngoingWash: {
    ...StyleSheet.absoluteFillObject
  },
  questOngoingCopy: {
    flex: 1,
    position: "relative",
    zIndex: 1
  },
  questOngoingTheme: {
    color: "rgba(232,226,214,0.9)",
    fontFamily: fontSerifJa,
    fontSize: 16,
    letterSpacing: 0.4,
    lineHeight: 27
  },
  questOngoingMeta: {
    color: "rgba(205,191,168,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 0.6,
    marginTop: 7
  },
  questClearableMeta: {
    color: "rgba(228,196,142,0.78)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 8
  },
  questClosedRow: {
    borderColor: "rgba(232,226,214,0.07)",
    opacity: 0.7
  },
  questClosedTheme: {
    color: "rgba(232,226,214,0.62)"
  },
  questOngoingArrow: {
    color: "rgba(232,200,150,0.58)",
    fontFamily: fontSerifJa,
    fontSize: 17,
    lineHeight: 20,
    position: "relative",
    zIndex: 1
  },
  questOngoingArrowMuted: {
    color: "rgba(205,191,168,0.28)"
  },
  questRowNodeFrame: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    position: "relative",
    width: 24,
    zIndex: 1
  },
  questRowNodeHalo: {
    backgroundColor: "rgba(119,149,143,0.5)",
    borderRadius: 999,
    height: 24,
    position: "absolute",
    width: 24
  },
  questRowNodeHaloMuted: {
    backgroundColor: "rgba(205,191,168,0.28)"
  },
  questRowNodeCore: {
    backgroundColor: "rgba(196,218,207,0.9)",
    borderRadius: 999,
    height: 7,
    shadowColor: "#c4dacf",
    shadowOpacity: 0.42,
    shadowRadius: 8,
    width: 7
  },
  questRowNodeCoreMuted: {
    backgroundColor: "rgba(205,191,168,0.42)",
    shadowOpacity: 0.12
  },
  mobileQuestCard: {
    backgroundColor: "rgba(20,24,22,0.28)",
    borderColor: "rgba(119,149,143,0.2)",
    borderRadius: 8,
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
  mobileQuestTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    position: "relative",
    zIndex: 1
  },
  questCardSheen: {
    bottom: -24,
    position: "absolute",
    top: -24,
    width: 76
  },
  questCardSheenFill: {
    flex: 1
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
    paddingVertical: 3
  },
  mobileQuestSignal: {
    color: "rgba(196,218,207,0.58)",
    fontFamily: fontSerifJa,
    fontSize: 10,
    letterSpacing: 1.6
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
    shadowColor: TOKENS.color.goldBright,
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
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
    outlineStyle: "none",
    paddingVertical: 11
  },
  mobileQuestActionPrimary: {
    backgroundColor: "rgba(119,149,143,0.12)",
    borderColor: "rgba(119,149,143,0.3)"
  },
  mobileQuestActionSecondary: {
    backgroundColor: "rgba(232,226,214,0.03)",
    borderColor: "rgba(232,226,214,0.12)"
  },
  mobileQuestActionPrimaryText: {
    color: "rgba(196,218,207,0.9)",
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
    paddingTop: 46
  },
  journalHeader: {
    marginBottom: 18,
    minHeight: 0,
    position: "relative"
  },
  journalHeaderTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    position: "relative",
    zIndex: 1
  },
  journalTitleBlock: {
    flex: 1,
    paddingRight: 16
  },
  mobileScreenTitle: {
    color: "#E8E2D6",
    fontFamily: fontSerifJa,
    fontSize: 22,
    letterSpacing: 2.2,
    lineHeight: 30
  },
  mobileGoldLabel: {
    color: "rgba(177,199,190,0.62)",
    fontFamily: fontSerifJa,
    fontSize: 10,
    letterSpacing: 2.6,
    lineHeight: 12,
    marginTop: 7
  },
  journalMonthPill: {
    alignItems: "flex-end",
    borderColor: "rgba(119,149,143,0.2)",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  journalMonth: {
    color: "rgba(200,207,194,0.58)",
    fontFamily: fontSerifEnMedium,
    fontSize: 11,
    letterSpacing: 2,
    lineHeight: 14,
    textAlign: "right"
  },
  journalWatermark: {
    color: "rgba(119,149,143,0.07)",
    fontFamily: fontSerifJa,
    fontSize: 62,
    lineHeight: 62,
    position: "absolute",
    right: -2,
    top: 48
  },
  journalMetaRail: {
    borderBottomColor: "rgba(232,226,214,0.08)",
    borderBottomWidth: 1,
    borderTopColor: "rgba(232,226,214,0.08)",
    borderTopWidth: 1,
    flexDirection: "row",
    marginTop: 31,
    paddingVertical: 12,
    position: "relative",
    zIndex: 1
  },
  journalMetaCell: {
    flex: 1,
    gap: 4
  },
  journalMetaCellMiddle: {
    borderLeftColor: "rgba(232,226,214,0.08)",
    borderLeftWidth: 1,
    borderRightColor: "rgba(232,226,214,0.08)",
    borderRightWidth: 1,
    paddingHorizontal: 16
  },
  journalMetaLabel: {
    color: "rgba(190,180,162,0.42)",
    fontFamily: fontSerifJa,
    fontSize: 10,
    letterSpacing: 1.8,
    lineHeight: 13
  },
  journalMetaValue: {
    color: "rgba(232,226,214,0.86)",
    fontFamily: fontSerifJaMedium,
    fontSize: 16,
    letterSpacing: 1,
    lineHeight: 22
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
    marginTop: 0,
    paddingLeft: 26,
    position: "relative"
  },
  timelineLine: {
    bottom: 36,
    left: 4,
    position: "absolute",
    top: 4,
    width: 2
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
    shadowColor: TOKENS.color.gold,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    width: 10
  },
  // 「いま」の一点の呼吸するドット: 中心の芯と、その外に広がるハロー。
  diaryDotCurrentFrame: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
    left: -33,
    position: "absolute",
    top: 15,
    width: 22
  },
  diaryDotCurrentHalo: {
    backgroundColor: "rgba(242,200,142,0.22)",
    borderRadius: 999,
    height: 22,
    position: "absolute",
    width: 22
  },
  diaryDotCurrentRipple: {
    borderColor: "rgba(242,200,142,0.34)",
    borderRadius: 999,
    borderWidth: 1,
    height: 26,
    position: "absolute",
    width: 26
  },
  diaryDotCurrentCore: {
    backgroundColor: "rgba(244,206,150,0.99)",
    borderRadius: 999,
    height: 9,
    shadowColor: "#f2c88e",
    shadowOpacity: 0.7,
    shadowRadius: 10,
    width: 9
  },
  timelineCopy: {
    flex: 1,
    position: "relative"
  },
  timelineCopyCurrent: {
    backgroundColor: "rgba(20,24,22,0.26)",
    borderColor: "rgba(119,149,143,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: -2,
    marginTop: -6,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 26
  },
  diaryCurrentWash: {
    ...StyleSheet.absoluteFillObject
  },
  timelineMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    marginBottom: 9
  },
  timelineMetaRowCurrent: {
    marginBottom: 10
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
    backgroundColor: TOKENS.color.goldBright,
    height: 14,
    left: -31.6,
    top: 8,
    shadowColor: TOKENS.color.goldBright,
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
    shadowColor: TOKENS.color.gold,
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
  questCloseLocked: {
    opacity: 0.42
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
  questClearNote: {
    color: "rgba(228,196,142,0.7)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 0.4,
    lineHeight: 21,
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
    shadowColor: TOKENS.color.gold,
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
    shadowColor: TOKENS.color.gold,
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
  supportCard: {
    borderColor: "rgba(150,178,190,0.28)",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
    marginHorizontal: 26,
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  supportCardBody: {
    color: "rgba(214,222,226,0.8)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    fontWeight: "300",
    letterSpacing: 0.3,
    lineHeight: 24
  },
  supportCardLink: {
    marginTop: 12
  },
  supportCardLinkText: {
    color: "rgba(176,204,214,0.92)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 0.6,
    textDecorationLine: "underline"
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
    backgroundColor: "rgba(217,168,108,0.95)",
    borderRadius: 999,
    marginTop: 4,
    paddingHorizontal: 28,
    paddingVertical: 9,
    shadowColor: TOKENS.color.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 16
  },
  niloSendText: {
    color: TOKENS.color.onGold,
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
    backgroundColor: "rgba(217,168,108,0.95)",
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 9,
    shadowColor: TOKENS.color.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 16
  },
  niloExitConfirmPrimaryText: {
    color: TOKENS.color.onGold,
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
    shadowColor: TOKENS.color.goldBright,
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
    backgroundColor: TOKENS.color.gold,
    shadowColor: TOKENS.color.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    width: 3
  },
  diaryEventText: {
    color: "rgba(205,191,168,0.55)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 0.4,
    lineHeight: 20,
    marginBottom: 4
  },
  diaryWeekday: {
    color: "rgba(205,191,168,0.4)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 1
  },
  diaryNowLabel: {
    backgroundColor: "rgba(119,149,143,0.16)",
    borderColor: "rgba(119,149,143,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    color: "rgba(196,218,207,0.82)",
    fontFamily: fontSerifJa,
    fontSize: 10,
    letterSpacing: 1.5,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  diaryEchoCard: {
    backgroundColor: "rgba(20,18,15,0.38)",
    borderColor: "rgba(119,149,143,0.2)",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    marginTop: 6,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 16,
    position: "relative"
  },
  diaryEchoWash: {
    ...StyleSheet.absoluteFillObject
  },
  diaryEchoTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  diaryEchoLabel: {
    color: "rgba(205,191,168,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 2.4
  },
  diaryEchoMark: {
    color: "rgba(119,149,143,0.48)",
    fontFamily: fontSerifEn,
    fontSize: 16,
    lineHeight: 18
  },
  diaryEchoMeaning: {
    color: "rgba(228,225,216,0.86)",
    fontFamily: fontSerifJa,
    fontSize: 15,
    fontWeight: "300",
    letterSpacing: 0.3,
    lineHeight: 27
  },
  diaryEchoDate: {
    color: "rgba(205,191,168,0.42)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 8
  },
  diaryClosingLine: {
    color: "rgba(205,191,168,0.42)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    letterSpacing: 1,
    lineHeight: 24,
    marginTop: 44,
    paddingHorizontal: 4,
    textAlign: "center"
  },
  diarySilenceMark: {
    color: "rgba(205,191,168,0.32)",
    fontSize: 13,
    letterSpacing: 2
  },
  diaryLog: {
    borderLeftColor: "rgba(119,149,143,0.18)",
    borderLeftWidth: 1,
    gap: 14,
    marginTop: 18,
    paddingLeft: 16
  },
  diaryLogNilo: {
    color: "rgba(205,191,168,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 12,
    fontWeight: "300",
    letterSpacing: 0.4,
    lineHeight: 21
  },
  diaryLogUser: {
    color: "rgba(228,220,206,0.78)",
    fontFamily: fontSerifJa,
    fontSize: 15,
    fontWeight: "300",
    letterSpacing: 0.3,
    lineHeight: 26
  },
  diaryLogUserMeaning: {
    color: "rgba(240,234,222,0.96)",
    fontFamily: fontSerifJaMedium,
    fontSize: 16,
    letterSpacing: 0.4,
    lineHeight: 28
  },
  diaryMeaningQuiet: {
    color: "rgba(232,226,214,0.62)",
    fontFamily: fontSerifJa,
    fontSize: 15,
    fontWeight: "300",
    letterSpacing: 0.3,
    lineHeight: 26
  },
  diaryMeaningNormal: {
    color: "rgba(236,230,218,0.92)",
    fontFamily: fontSerifJa,
    fontSize: 17,
    fontWeight: "300",
    letterSpacing: 0.3,
    lineHeight: 30
  },
  diaryMeaningStrong: {
    color: "rgba(240,234,222,0.98)",
    fontFamily: fontSerifJaMedium,
    fontSize: 21,
    letterSpacing: 0.6,
    lineHeight: 36
  },
  diaryItemQuiet: {
    paddingVertical: 12
  },
  diaryItemNormal: {
    paddingVertical: 16
  },
  diaryItemStrong: {
    paddingVertical: 26
  },
  diaryQuestLabel: {
    backgroundColor: "rgba(217,168,108,0.08)",
    borderColor: "rgba(217,168,108,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    color: "rgba(222,190,144,0.62)",
    fontFamily: fontSerifJa,
    fontSize: 10,
    letterSpacing: 1.6,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  diaryDotCurrent: {
    backgroundColor: "rgba(242,200,142,0.98)",
    height: 9,
    left: -26,
    top: 21,
    width: 9
  },
  diaryEmptyRecent: {
    color: "rgba(205,191,168,0.5)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 0.6,
    lineHeight: 24,
    paddingVertical: 18
  },
  diaryBandRow: {
    alignItems: "center",
    borderBottomColor: "rgba(232,226,214,0.055)",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 16,
    minHeight: 48,
    paddingRight: 2,
    paddingVertical: 12,
    position: "relative"
  },
  diaryBandRowOpen: {
    borderBottomColor: "rgba(119,149,143,0.16)"
  },
  diaryBandBar: {
    backgroundColor: "rgba(119,149,143,0.32)",
    borderRadius: 2,
    left: -27,
    position: "absolute",
    width: 3
  },
  diaryBandBarOpen: {
    backgroundColor: "rgba(217,168,108,0.55)"
  },
  diaryBandCopy: {
    alignItems: "baseline",
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  diaryBandLabel: {
    color: "rgba(205,191,168,0.55)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 1.6
  },
  diaryBandLabelOpen: {
    color: "rgba(232,226,214,0.78)"
  },
  diaryBandCount: {
    color: "rgba(119,149,143,0.55)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 1.2
  },
  diaryBandToggle: {
    color: "rgba(232,200,150,0.7)",
    fontFamily: fontSerifEnMedium,
    fontSize: 18,
    lineHeight: 20,
    textAlign: "center",
    width: 24
  },
  diaryBandEntryRow: {
    borderBottomColor: "rgba(232,226,214,0.045)",
    borderBottomWidth: 1,
    marginLeft: 4,
    paddingBottom: 13,
    paddingLeft: 12,
    paddingTop: 12
  },
  diaryBandEntryDate: {
    color: "rgba(205,191,168,0.42)",
    fontFamily: fontSerifJa,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 2
  },
  diaryBandEntryText: {
    color: "rgba(232,226,214,0.66)",
    fontFamily: fontSerifJa,
    fontSize: 14,
    fontWeight: "300",
    letterSpacing: 0.3,
    lineHeight: 24
  },
  diaryStoryGuide: {
    backgroundColor: "rgba(20,18,15,0.34)",
    borderColor: "rgba(119,149,143,0.18)",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 26,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingVertical: 18,
    position: "relative"
  },
  diaryStoryGuideWash: {
    ...StyleSheet.absoluteFillObject
  },
  diaryStoryGuideText: {
    color: "rgba(205,191,168,0.6)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 0.5,
    lineHeight: 23
  },
  diaryStoryGuideLink: {
    color: "rgba(232,200,150,0.8)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 1.4,
    marginTop: 10
  },
  onboardScreen: {
    flex: 1
  },
  onboardThread: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 4
  },
  onboardThreadSeg: {
    backgroundColor: "rgba(246,239,228,0.14)",
    borderRadius: 999,
    flex: 1,
    height: 2
  },
  onboardThreadSegPast: {
    backgroundColor: "rgba(217,168,108,0.38)"
  },
  onboardThreadSegCurrent: {
    backgroundColor: "rgba(233,196,124,0.95)",
    height: 3,
    marginTop: -0.5,
    shadowColor: "#e9c47c",
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4
  },
  onboardConsentRow: {
    alignItems: "center",
    borderBottomColor: "rgba(246,239,228,0.12)",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 46,
    paddingHorizontal: 2
  },
  onboardConsentRowText: {
    color: "rgba(246,239,228,0.88)",
    fontFamily: fontUi,
    fontSize: 14
  },
  onboardConsentRowChevron: {
    color: "rgba(246,239,228,0.42)",
    fontSize: 18
  },
  onboardSovereignty: {
    borderColor: "rgba(217,168,108,0.3)",
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  onboardSovereigntyText: {
    color: "rgba(233,213,178,0.92)",
    fontFamily: fontSerifJa,
    fontSize: 13,
    letterSpacing: 0.4,
    lineHeight: 23
  },
  onboardDialogueScreen: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 36,
    paddingHorizontal: 30
  },
  onboardDialogueLines: {
    gap: 18,
    marginBottom: 34
  },
  onboardNiloLine: {
    color: "rgba(246,239,228,0.94)",
    fontFamily: fontSerifJa,
    fontSize: 17,
    letterSpacing: 0.6,
    lineHeight: 30
  },
  onboardUserLine: {
    color: "rgba(233,196,124,0.9)",
    fontFamily: fontUi,
    fontSize: 15,
    letterSpacing: 0.4,
    lineHeight: 24,
    textAlign: "right"
  },
  onboardDialogueComposer: {
    gap: 12
  },
  onboardDialogueInput: {
    borderBottomColor: "rgba(217,168,108,0.5)",
    borderBottomWidth: 1,
    color: TOKENS.color.ink,
    fontFamily: fontUi,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 2,
    paddingVertical: 8
  },
  onboardDialogueError: {
    color: "rgba(224,150,140,0.9)",
    fontFamily: fontUi,
    fontSize: 12
  },
  onboardDialogueSend: {
    alignItems: "center",
    alignSelf: "flex-end",
    borderColor: "rgba(217,168,108,0.55)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 22
  },
  onboardDialogueSendText: {
    color: "rgba(233,196,124,0.95)",
    fontFamily: fontUi,
    fontSize: 13,
    letterSpacing: 1
  },
  onboardWordsScreen: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 60,
    paddingHorizontal: 34
  },
  onboardWordsBlock: {
    gap: 20,
    marginBottom: 72
  },
  onboardWordsPhrase: {
    color: "rgba(246,239,228,0.94)",
    fontFamily: fontSerifJa,
    fontSize: 19,
    letterSpacing: 1,
    lineHeight: 34,
    textAlign: "center"
  },
  onboardBeginButton: {
    alignItems: "center",
    borderColor: "rgba(217,168,108,0.6)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 44
  },
  onboardBeginButtonText: {
    color: "rgba(233,196,124,0.95)",
    fontFamily: fontSerifJa,
    fontSize: 15,
    letterSpacing: 3
  },
  encryptionNotice: {
    alignItems: "center",
    alignSelf: "center",
    bottom: 96,
    flexDirection: "row",
    gap: 8,
    position: "absolute",
    zIndex: 90
  },
  encryptionNoticeText: {
    color: "rgba(233,213,178,0.85)",
    fontFamily: fontUi,
    fontSize: 12,
    letterSpacing: 0.6
  }
});

const FONT_SCALE_VALUES = { small: 0.92, standard: 1, large: 1.12 };

function buildStyles(scale) {
  const defs = baseStyleDefs && typeof baseStyleDefs === "object" ? baseStyleDefs : {};
  if (scale === 1) return StyleSheet.create(defs);
  const scaled = {};
  for (const key of Object.keys(defs)) {
    const def = defs[key] || {};
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
