const storageKey = "arc.nilo.night.ai.v1";
const validTabs = ["home", "journal", "quests", "story", "memory"];
const scrollTabThreshold = 32;
const scrollTabCooldownMs = 280;
const scrollTabEdgeInset = 36;
const scrollTabResetMs = 220;

const defaultState = {
  activeTab: "home",
  reflections: [],
  memories: [],
  quests: [],
  tomorrowQuestCandidates: [],
  tomorrowQuestGeneratedFor: "",
  nightRitual: {
    dateKey: "",
    questionCount: 0,
    completed: false,
    messages: []
  },
  chapters: [],
  nilo: {
    xp: 0
  },
  settings: {
    bgmEnabled: false,
    bgmTrack: "",
    language: "ja",
    notificationsEnabled: false,
    notificationTime: "22:00",
    notificationDays: [0, 1, 2, 3, 4, 5, 6],
    privacy: {
      questLink: true,
      memoryLink: true,
      profileUse: true
    }
  },
  profile: {
    name: "",
    birthdate: "",
    image: ""
  },
  today: {
    moodLabel: "未記録",
    moodScore: null,
    niloLine: "今日の言葉を書くと、ここにNiloの映した一言が入ります。",
    niloMessage: "まだ今日の記録はありません。"
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

let state = loadState();
let scrollTabDelta = 0;
let lastScrollTabAt = 0;
let lastScrollWheelAt = 0;

const screens = $$(".screen");
const navButtons = $$("[data-tab]");
const tabs = $$(".tab");
const reflectionForm = $("#reflection-form");
const reflectionText = $("#reflection-text");
const reflectionCounter = $("#reflection-counter");
const ritualMessages = $("#ritual-messages");
const ritualStatus = $("#ritual-status");
const questList = $("#quest-list");
const questPageList = $("#quest-page-list");
const tomorrowQuestStatus = $("#tomorrow-quests-status");
const tomorrowQuestCandidates = $("#tomorrow-quest-candidates");
const acceptTomorrowQuests = $("#accept-tomorrow-quests");
const memoryList = $("#memory-list");
const memoryPageList = $("#memory-page-list");
const journalList = $("#journal-list");
const journalCalendar = $("#journal-calendar");
const journalMonthLabel = $("#journal-month-label");
const journalSelectedTitle = $("#journal-selected-title");
const journalPrevMonth = $("#journal-prev-month");
const journalNextMonth = $("#journal-next-month");
const journalToday = $("#journal-today");
const chapterList = $("#chapter-list");
const clockTime = $("#clock-time");
const clockDate = $("#clock-date");
const todayNoteTitle = $(".nilo-note strong");
const niloMessage = $("#nilo-message");
const moodLabel = $(".mood-line strong");
const moodScore = $(".mood-line b");
const moodDots = $(".mood-line .dots");
const dailyWord = $(".daily-word p");
const submitButton = $(".primary-action");
const reflectionPlaceholder = reflectionText?.getAttribute("placeholder") || "今日の出来事や気持ちを書いてみよう...";
const homeTitle = $("#home-title");
const brandSub = $(".brand-sub");
const lifeDayCount = $("#life-day-count");
const niloLevel = $("#nilo-level");
const niloLevelProgress = $("#nilo-level-progress");
const settingsButton = $(".brand-action");
const settingsOpenButtons = $$("[data-settings-open], .brand-action");
const settingsPanel = $("#settings-panel");
const profileName = $("#profile-name");
const profileBirthdate = $("#profile-birthdate");
const profileImage = $("#profile-image");
const profileAvatarButton = $("#profile-avatar-button");
const profileSave = $("#profile-save");
const profileAvatarPreview = $("#profile-avatar-preview");
const profileAvatarFallback = $("#profile-avatar-fallback");
const settingsTabs = $$(".settings-tab[data-settings-tab]");
const settingsPages = $$("[data-settings-page]");
const bgmPlayer = $("#bgm-player");
const bgmToggle = $("#bgm-toggle");
const bgmRandom = $("#bgm-random");
const bgmTrackLabel = $("#bgm-track-label");
const bgmTrackList = $("#bgm-track-list");
const niloCursor = $("#nilo-cursor");
const languageSelect = $("#language-select");
const languageStatus = $("#language-status");
const notificationToggle = $("#notification-toggle");
const notificationTime = $("#notification-time");
const notificationPermission = $("#notification-permission");
const notificationStatus = $("#notification-status");
const privacyToggles = $$("[data-privacy-toggle]");
const privacyExport = $("#privacy-export");
const privacyStatus = $("#privacy-status");

const bgmTracks = [
  "Arc-524-a1.mp3",
  "Arc-528-a2.mp3",
  "Arc-26528-b1.mp3",
  "Arc-26528-a4.mp3",
  "Arc-26528-b2.mp3",
  "Arc-26529-a5.mp3",
  "Arc-26529-a6.mp3",
  "Arc-26530-a7.mp3",
  "Arc-26529-a2.mp3"
];

const questBankGroups = [
  ["健康", "水を1杯飲む,水を500ml飲む,水を1L飲む,朝7時までに起きる,朝8時までに起きる,23時までに寝る,24時までに寝る,睡眠7時間達成,睡眠8時間達成,ストレッチ3分,ストレッチ5分,ストレッチ10分,散歩10分,散歩20分,散歩30分,スクワット10回,スクワット20回,スクワット50回,腕立て10回,腕立て20回,腹筋20回,腹筋50回,プランク30秒,プランク1分,階段3階分,階段5階分,野菜1品食べる,野菜3品食べる,果物1個食べる,朝食を食べる,昼食を抜かない,夕食を抜かない,湯船10分,湯船20分,歯磨き3分,フロスを使う,ジョギング1km,ジョギング3km,ランニング5km,ジムに行く,筋トレ15分,筋トレ30分,ヨガ10分,瞑想5分,瞑想10分,深呼吸20回,姿勢を1時間意識,カフェインを17時以降飲まない,お菓子を食べない,ジュースを飲まない,エナドリを飲まない,昼寝15分以内,日光を10分浴びる,日光を30分浴びる,目を5分休ませる,肩回し20回,首ストレッチ3分,1万歩達成,8000歩達成,睡眠記録をつける"],
  ["学習", "本を1ページ読む,本を5ページ読む,本を20ページ読む,本を50ページ読む,記事を1本読む,記事を3本読む,学習15分,学習30分,学習60分,学習90分,英単語10個覚える,英単語30個覚える,英単語50個覚える,問題5問解く,問題10問解く,問題30問解く,ノート1ページ書く,ノート3ページ書く,要約100文字書く,要約300文字書く,TEDを1本見る,ドキュメンタリーを見る,AIに質問する,新しい単語5個調べる,新しい単語10個調べる,コード15分書く,コード30分書く,コード60分書く,論文1本読む,本の感想を書く,学習計画を作る,今日の学びを1つ書く,今日の学びを3つ書く,外国語15分勉強,外国語30分勉強,動画講義1本,動画講義3本,資格勉強30分,資格勉強60分,タイピング10分,タイピング20分,新しい知識を共有,メモを10個作る,本屋に行く,本を購入する,学習記録を書く,自己分析を書く,強みを3つ書く,弱みを3つ書く,将来像を書く,目標を1つ設定,目標を見直す,振り返りを書く,記事を保存する,ブログ1本読む,プレゼン練習10分,プレゼン練習30分,新しいスキルを調べる,学習環境を整える,今日の学習を記録"],
  ["生活", "ベッドを整える,ゴミを捨てる,ゴミ出しする,洗濯する,洗濯物を畳む,食器を洗う,掃除機をかける,机を片付ける,部屋を10分掃除,部屋を30分掃除,トイレ掃除,洗面所掃除,キッチン掃除,窓掃除,玄関掃除,シーツ交換,タオル交換,冷蔵庫整理,本棚整理,引き出し整理,財布整理,カバン整理,PC整理,デスクトップ整理,フォルダ整理,アプリ1個削除,写真10枚整理,写真50枚整理,メール10件整理,メール50件整理,不用品1個捨てる,不用品5個捨てる,不用品10個捨てる,家計簿記録,買い物リスト作成,サブスク確認,支出記録,ATMに行く,荷物受け取り,郵便確認,料理する,作り置きする,植物に水やり,エアコン掃除,靴磨き,車を洗う,防災用品確認,電池確認,書類提出,予定整理,カレンダー確認,ToDo整理,クローゼット整理,棚を整理,水回り掃除,家事15分,家事30分,部屋リセット,整理整頓10分,整理整頓30分"],
  ["人間関係", "家族に連絡,親に連絡,兄弟に連絡,友達に連絡,ありがとうを伝える,誰かを褒める,LINE返信,DM返信,電話をかける,電話に出る,感謝メッセージ送信,食事に誘う,約束を決める,久しぶりの人に連絡,誕生日メッセージ送信,お礼を言う,謝る,応援メッセージ送信,相談する,相談に乗る,相手へ質問3つ,家族と10分会話,家族と30分会話,友達と10分会話,友達と30分会話,新しい人と話す,イベント参加,飲み会参加,コミュニティ参加,SNSコメント,SNS投稿,写真共有,思い出共有,プレゼント購入,プレゼントを渡す,手伝いをする,挨拶する,笑顔で挨拶,会いに行く,訪問する,人を紹介する,食事を一緒にする,誘いを受ける,誘いをする,感謝を書く,相手の良い所を3つ書く,相手の話を最後まで聞く,相手の名前を呼ぶ,SNSで応援する,近況報告する,同僚と話す,上司と話す,後輩と話す,仲間と目標共有,お祝いする,集合写真を撮る,グループ通話参加,オフラインイベント参加,名刺交換する,初対面の人と会話"],
  ["冒険", "初めての店に入る,初めてのカフェに行く,初めての料理を食べる,初めての商品を買う,初めての道を歩く,初めての駅で降りる,公園に行く,本屋に行く,神社に行く,写真を3枚撮る,写真を10枚撮る,夕日を見る,日の出を見る,星を見る,月を見る,海を見る,川を見る,山を見る,展望台に行く,美術館に行く,博物館に行く,新しい音楽を3曲聴く,新しい映画を見る,新しい本を買う,新しいゲームを遊ぶ,新しい趣味を試す,行ったことない場所へ行く,電車で1駅移動,電車で5駅移動,自転車で30分移動,散歩コースを変える,行きたい場所を登録,やりたいことを追加,旅行先を調べる,地図を10分見る,カメラを持って外出,朝の散歩,夜の散歩,一人で外食,一人でカフェ,一人で映画,一人旅計画,新しいレシピ挑戦,新しい服を試着,新しい店を開拓,地元の名所へ行く,観光地へ行く,自然に触れる,森を歩く,ベンチで10分過ごす,空の写真を撮る,花の写真を撮る,旅の計画を書く,行きたい国を調べる,新しいイベントを探す,フェスに参加,マルシェに行く,朝活する,いつもと違う選択をする,行ったことない場所で写真を撮る"]
];

const questBank = questBankGroups.flatMap(([category, titles], groupIndex) =>
  titles.split(",").map((title, index) => ({
    id: `${groupIndex + 1}-${index + 1}`,
    category,
    title
  }))
);

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return structuredClone(defaultState);
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      reflections: Array.isArray(parsed.reflections) ? parsed.reflections.map(normalizeReflection) : [],
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      quests: Array.isArray(parsed.quests) ? parsed.quests.map(normalizeQuest) : [],
      tomorrowQuestCandidates: Array.isArray(parsed.tomorrowQuestCandidates) ? parsed.tomorrowQuestCandidates : [],
      tomorrowQuestGeneratedFor: parsed.tomorrowQuestGeneratedFor || "",
      nightRitual: normalizeNightRitual(parsed.nightRitual),
      chapters: Array.isArray(parsed.chapters) ? parsed.chapters : [],
      nilo: { ...structuredClone(defaultState.nilo), ...(parsed.nilo || {}) },
      settings: {
        ...structuredClone(defaultState.settings),
        ...(parsed.settings || {}),
        privacy: {
          ...structuredClone(defaultState.settings.privacy),
          ...((parsed.settings || {}).privacy || {})
        }
      },
      profile: { ...structuredClone(defaultState.profile), ...(parsed.profile || {}) },
      today: { ...structuredClone(defaultState.today), ...(parsed.today || {}) }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function createId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeReflection(item) {
  return {
    id: item.id || createId("reflection"),
    ...item
  };
}

function normalizeQuest(item) {
  return {
    id: item.id || createId("quest"),
    title: String(item.title || "明日のクエスト").slice(0, 36),
    reason: String(item.reason || "").slice(0, 90),
    firstStep: String(item.firstStep || "").slice(0, 70),
    category: item.category || "",
    current: Number.isFinite(Number(item.current)) ? Number(item.current) : 0,
    target: Number.isFinite(Number(item.target)) ? Math.max(1, Math.min(14, Number(item.target))) : 7,
    icon: item.icon || "moon",
    createdAt: item.createdAt || new Date().toISOString(),
    scheduledFor: item.scheduledFor || "",
    source: item.source || "nilo",
    status: item.status || (item.completedAt ? "completed" : "active"),
    completedAt: item.completedAt || "",
    lastJudgedAt: item.lastJudgedAt || "",
    latestNote: item.latestNote || ""
  };
}

function normalizeNightRitual(item = {}) {
  const messages = Array.isArray(item.messages)
    ? item.messages.slice(0, 12).map((message) => ({
      role: message.role === "user" ? "user" : "nilo",
      text: String(message.text || "").slice(0, 400)
    })).filter((message) => message.text)
    : [];

  return {
    dateKey: String(item.dateKey || ""),
    questionCount: Number.isFinite(Number(item.questionCount)) ? Math.max(0, Math.min(5, Number(item.questionCount))) : 0,
    completed: Boolean(item.completed),
    messages
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function xpNeededForLevel(level) {
  return 40 + (level - 1) * 18;
}

function getNiloLevelInfo() {
  let level = 1;
  let remainingXp = Math.max(0, Number(state.nilo?.xp || 0));
  let needed = xpNeededForLevel(level);

  while (remainingXp >= needed) {
    remainingXp -= needed;
    level += 1;
    needed = xpNeededForLevel(level);
  }

  return {
    level,
    progress: Math.max(0, Math.min(100, Math.round((remainingXp / needed) * 100)))
  };
}

function addNiloXp(value) {
  const gain = Number.isFinite(Number(value)) ? Math.max(0, Math.min(30, Number(value))) : 0;
  state.nilo.xp = Math.max(0, Number(state.nilo.xp || 0) + gain);
}

function randomBgmTrack(exceptTrack = "") {
  const choices = bgmTracks.filter((track) => track !== exceptTrack);
  const list = choices.length ? choices : bgmTracks;
  return list[Math.floor(Math.random() * list.length)];
}

function bgmSrc(track) {
  return `assets/bgm/${track}`;
}

function bgmDisplayName(track) {
  return String(track || "").replace(".mp3", "");
}

function updateBgmUi() {
  if (!bgmToggle || !bgmTrackLabel) return;
  bgmToggle.textContent = state.settings.bgmEnabled ? "ON" : "OFF";
  bgmToggle.setAttribute("aria-pressed", String(state.settings.bgmEnabled));
  bgmToggle.classList.toggle("is-on", state.settings.bgmEnabled);
  bgmTrackLabel.textContent = state.settings.bgmTrack
    ? bgmDisplayName(state.settings.bgmTrack)
    : "ランダムに夜のサウンドトラックを流します。";
  if (bgmTrackList) {
    bgmTrackList.innerHTML = bgmTracks.map((track, index) => {
      const isActive = state.settings.bgmTrack === track;
      return `
        <button class="settings-track ${isActive ? "is-active" : ""}" type="button" data-bgm-track="${escapeHtml(track)}" aria-pressed="${isActive}">
          <span>${isActive ? "▮▮" : "▷"}</span>
          <strong>${escapeHtml(bgmDisplayName(track))}</strong>
          ${isActive ? "<i>✓</i>" : ""}
        </button>
      `;
    }).join("");
  }
}

function updateLanguageUi() {
  const language = state.settings.language || "ja";
  document.documentElement.lang = language;
  document.body.dataset.language = language;
  if (languageSelect) languageSelect.value = language;
}

function updateNotificationUi() {
  if (notificationToggle) {
    notificationToggle.textContent = state.settings.notificationsEnabled ? "ON" : "OFF";
    notificationToggle.setAttribute("aria-pressed", String(state.settings.notificationsEnabled));
    notificationToggle.classList.toggle("is-on", state.settings.notificationsEnabled);
  }
  if (notificationTime) notificationTime.value = state.settings.notificationTime || "22:00";
  const days = new Set(Array.isArray(state.settings.notificationDays) ? state.settings.notificationDays.map(Number) : []);
  $$("[data-notification-day]").forEach((button) => {
    const isActive = days.has(Number(button.dataset.notificationDay));
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function updatePrivacyUi() {
  const privacy = state.settings.privacy || {};
  privacyToggles.forEach((button) => {
    const key = button.dataset.privacyToggle;
    const isOn = privacy[key] !== false;
    button.textContent = isOn ? "ON" : "OFF";
    button.setAttribute("aria-pressed", String(isOn));
    button.classList.toggle("is-on", isOn);
  });
}

async function playBgm(track = state.settings.bgmTrack || randomBgmTrack()) {
  if (!bgmPlayer) return;
  state.settings.bgmTrack = track;
  bgmPlayer.src = bgmSrc(track);
  bgmPlayer.volume = 0.42;
  bgmPlayer.loop = false;
  updateBgmUi();
  await bgmPlayer.play();
}

function stopBgm() {
  if (!bgmPlayer) return;
  bgmPlayer.pause();
  bgmPlayer.currentTime = 0;
}

function openSettings() {
  if (!settingsPanel) return;
  settingsPanel.hidden = false;
}

function closeSettings() {
  if (!settingsPanel) return;
  settingsPanel.hidden = true;
}

function setupNiloCursor() {
  if (!niloCursor || matchMedia("(pointer: coarse)").matches) return;
  document.body.classList.add("has-nilo-cursor");

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;
  let hasPointer = false;

  function animate() {
    currentX += (targetX - currentX) * 0.62;
    currentY += (targetY - currentY) * 0.62;
    niloCursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(animate);
  }

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    targetX = event.clientX;
    targetY = event.clientY;
    if (!hasPointer) {
      hasPointer = true;
      currentX = targetX;
      currentY = targetY;
      niloCursor.classList.add("is-visible");
    }
  });

  window.addEventListener("pointerleave", () => {
    niloCursor.classList.remove("is-visible");
  });

  requestAnimationFrame(animate);
}

function switchSettingsTab(tabName) {
  settingsTabs.forEach((tab) => {
    const isActive = tab.dataset.settingsTab === tabName;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  settingsPages.forEach((page) => {
    page.hidden = page.dataset.settingsPage !== tabName;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(date) {
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getMonth() + 1}月${date.getDate()}日（${weekdays[date.getDay()]}）`;
}

function daysSinceBirth(value) {
  if (!value) return null;
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  const start = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate());
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.floor((current - start) / 86400000);
  return diff >= 0 ? diff + 1 : null;
}

function updateProfileUi() {
  const name = state.profile.name.trim();
  const days = daysSinceBirth(state.profile.birthdate);
  if (profileName) profileName.value = state.profile.name;
  if (profileBirthdate) profileBirthdate.value = state.profile.birthdate;
  if (homeTitle) homeTitle.textContent = name ? `おかえり、${name}。` : "おかえり。";
  if (brandSub) brandSub.textContent = name ? `${name}の人生アプリ` : "夜に帰ってくる人生アプリ";
  if (lifeDayCount) lifeDayCount.textContent = days ? `${days.toLocaleString("ja-JP")}日目` : "";

  if (profileAvatarPreview && profileAvatarFallback) {
    if (state.profile.image) {
      profileAvatarPreview.src = state.profile.image;
      profileAvatarPreview.hidden = false;
      profileAvatarFallback.hidden = true;
    } else {
      profileAvatarPreview.hidden = true;
      profileAvatarFallback.hidden = false;
      profileAvatarFallback.textContent = name ? name.slice(0, 1).toUpperCase() : "A";
    }
  }
}

function isDiaryWindowOpen(date = new Date()) {
  const hour = date.getHours();
  return hour >= 20 || hour < 3;
}

function updateReflectionCounter() {
  if (!reflectionText || !reflectionCounter) return;
  const max = Number(reflectionText.maxLength) > 0 ? Number(reflectionText.maxLength) : 50;
  reflectionCounter.textContent = `${reflectionText.value.length}/${max}`;
}

function updateReflectionAvailability() {
  const isOpen = isDiaryWindowOpen();
  const isLoading = reflectionForm.classList.contains("is-loading");
  const isCompleted = isNightRitualCompletedToday();
  reflectionForm.classList.toggle("is-closed", !isOpen || isCompleted);
  reflectionText.disabled = !isOpen || isLoading || isCompleted;
  reflectionText.placeholder = isCompleted
    ? "今夜の記録は保存済みです。"
    : (isOpen ? reflectionPlaceholder : "日記は20:00〜翌3:00に書けます。");

  if (isLoading) return;
  submitButton.disabled = !isOpen || isCompleted;
  submitButton.textContent = isCompleted ? "保存済み" : (isOpen ? "答える ›" : "20時から");
  updateReflectionCounter();
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date) {
  return toDateKey(date).slice(0, 7);
}

function tomorrowKey() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toDateKey(date);
}

function dateFromKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function formatJournalDate(key) {
  const date = dateFromKey(key);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  });
}

function getReflectionDateKey(item) {
  return item.dateKey || item.createdAt?.slice(0, 10) || toDateKey(new Date());
}

function getJournalSelection() {
  return state.journalSelectedDate || toDateKey(new Date());
}

function createFreshNightRitual() {
  return {
    dateKey: toDateKey(new Date()),
    questionCount: 1,
    completed: false,
    messages: [
      { role: "nilo", text: "今日、一番印象に残ったことは？" }
    ]
  };
}

function ensureNightRitual() {
  const todayKey = toDateKey(new Date());
  if (state.nightRitual?.dateKey !== todayKey || !Array.isArray(state.nightRitual.messages) || !state.nightRitual.messages.length) {
    state.nightRitual = createFreshNightRitual();
  }
  return state.nightRitual;
}

function isNightRitualCompletedToday() {
  return state.nightRitual?.dateKey === toDateKey(new Date()) && state.nightRitual.completed;
}

function renderNightRitual() {
  if (!ritualMessages || !ritualStatus) return;
  const ritual = ensureNightRitual();
  ritualMessages.innerHTML = ritual.messages.map((message) => `
    <article class="ritual-message is-${message.role}">
      <span>${message.role === "user" ? "あなた" : "Nilo"}</span>
      <p>${escapeHtml(message.text)}</p>
    </article>
  `).join("");
  ritualMessages.scrollTop = ritualMessages.scrollHeight;

  if (ritual.completed) {
    ritualStatus.textContent = "今夜の記録を日記に保存しました。";
  } else {
    ritualStatus.textContent = "";
  }
}

function updateClock() {
  const now = new Date();
  clockTime.textContent = now.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  clockDate.textContent = formatDate(now);
  updateReflectionAvailability();
  updateProfileUi();
}

function iconForQuest(icon) {
  const icons = {
    book: "assets/icons/status-expression.png",
    chain: "assets/icons/status-consistency.png",
    moon: "assets/icons/status-stability.png"
  };
  return icons[icon] || icons.book;
}

function emptyCard(title, body) {
  return `
    <article class="empty-card">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}

function questDescription(quest) {
  if (quest.source === "tomorrow-habit") return "";
  if (quest.reason && quest.firstStep) return `${quest.reason} 最初の一歩: ${quest.firstStep}`;
  return quest.reason || quest.firstStep || "今日のNiloとの会話から生まれた、小さく戻ってこられる約束です。";
}

function addGeneratedQuests(insight) {
  const now = new Date().toISOString();
  const candidates = Array.isArray(insight.quests) && insight.quests.length
    ? insight.quests
    : (insight.questSuggestion ? [{ title: insight.questSuggestion, target: 7 }] : []);

  candidates.map(normalizeQuest).forEach((quest) => {
    const exists = state.quests.some((item) => item.title.trim() === quest.title.trim());
    if (exists) return;
    state.quests.unshift({
      ...quest,
      createdAt: now,
      source: "daily-nilo",
      icon: quest.icon || "moon"
    });
  });
}

function generateTomorrowQuestCandidates() {
  const activeTitles = new Set(state.quests
    .filter((quest) => quest.status !== "completed")
    .map((quest) => quest.title.trim()));
  const available = questBank.filter((quest) => !activeTitles.has(quest.title));
  const count = 2 + Math.floor(Math.random() * 3);
  const shuffled = [...available].sort(() => Math.random() - 0.5);

  state.tomorrowQuestCandidates = shuffled.slice(0, count).map((quest) => ({
    id: createId("candidate"),
    bankId: quest.id,
    category: quest.category,
    title: quest.title,
    accepted: true
  }));

  const added = addTomorrowQuests(state.tomorrowQuestCandidates);
  state.tomorrowQuestCandidates = [];
  return added;
}

function ensureTomorrowQuestsGenerated() {
  const key = tomorrowKey();
  if (state.tomorrowQuestGeneratedFor === key) {
    if (tomorrowQuestStatus) tomorrowQuestStatus.textContent = "明日のクエストは生成済みです。";
    return false;
  }

  const added = generateTomorrowQuestCandidates();
  state.tomorrowQuestGeneratedFor = key;
  if (tomorrowQuestStatus) {
    tomorrowQuestStatus.textContent = added
      ? `${added}個の明日のクエストを自動生成しました。`
      : "追加できる新しいクエストがありません。";
  }
  return true;
}

function renderTomorrowQuestCandidates() {
  if (!tomorrowQuestCandidates || !acceptTomorrowQuests) return;

  tomorrowQuestCandidates.innerHTML = "";
  tomorrowQuestCandidates.hidden = true;
  acceptTomorrowQuests.hidden = true;
}

function addTomorrowQuests(quests) {
  const scheduledFor = tomorrowKey();
  let added = 0;

  quests.slice(0, 5).map(normalizeQuest).forEach((quest) => {
    const exists = state.quests.some((item) => item.title.trim() === quest.title.trim() && item.status !== "completed");
    if (exists) return;
    state.quests.unshift({
      ...quest,
      current: 0,
      target: 1,
      scheduledFor,
      source: "tomorrow-habit",
      reason: "",
      firstStep: "",
      icon: "moon",
      createdAt: new Date().toISOString()
    });
    added += 1;
  });

  return added;
}

function applyQuestUpdates(insight) {
  if (!Array.isArray(insight.questUpdates)) return;
  const now = new Date().toISOString();

  insight.questUpdates.forEach((update) => {
    const quest = state.quests.find((item) => {
      if (update.id && item.id === update.id) return true;
      return update.title && item.title.trim() === update.title.trim();
    });
    if (!quest || quest.status === "completed") return;

    const delta = Number.isFinite(Number(update.progressDelta)) ? Math.max(0, Math.min(1, Number(update.progressDelta))) : 0;
    quest.current = Math.min(quest.target || 1, (quest.current || 0) + delta);
    quest.lastJudgedAt = now;
    quest.latestNote = update.note || (delta ? "今日の会話から一歩進んだとNiloが見ました。" : quest.latestNote || "");

    if (update.completed || quest.current >= (quest.target || 1)) {
      quest.current = quest.target || 1;
      quest.status = "completed";
      quest.completedAt = now;
      quest.latestNote = update.note || "Niloがこのクエストを達成として受け取りました。";
    }
  });
}

function completeQuest(questId) {
  const quest = state.quests.find((item) => item.id === questId);
  if (!quest) return;

  quest.current = quest.target || 1;
  quest.status = "completed";
  quest.completedAt = new Date().toISOString();
  quest.latestNote = "チェックで完了しました。";
}

function saveReflectionAsMemory(reflectionId) {
  const reflection = state.reflections.find((item) => item.id === reflectionId);
  if (!reflection || state.memories.some((memory) => memory.sourceId === reflectionId)) return;

  state.memories.unshift({
    id: createId("memory"),
    sourceId: reflection.id,
    title: reflection.text,
    body: reflection.memory || reflection.text,
    tag: reflection.tag || "大事な場面",
    savedAt: reflection.savedAt || reflection.dateLabel || formatJournalDate(getReflectionDateKey(reflection)),
    dateLabel: reflection.dateLabel,
    createdAt: new Date().toISOString()
  });
}

function renderQuests() {
  const activeQuests = state.quests.filter((quest) => quest.status !== "completed");
  if (!activeQuests.length) {
    const empty = emptyCard("まだクエストはありません", "最初の振り返りのあと、Niloがあなたの言葉から次の約束を見つけます。");
    questList.innerHTML = empty;
    questPageList.innerHTML = empty;
    return;
  }

  const orderedQuests = [...activeQuests];

  questList.innerHTML = orderedQuests.slice(0, 2).map((quest) => {
    const percent = Math.min(100, Math.round(((quest.current || 0) / (quest.target || 1)) * 100));
    return `
      <article class="quest-card ${quest.source === "tomorrow-habit" ? "is-daily-quest" : ""}" data-quest-card="${escapeHtml(quest.id)}">
        <img src="${iconForQuest(quest.icon)}" alt="" aria-hidden="true">
        <div>
          <strong>${escapeHtml(quest.title)}</strong>
          ${quest.source === "tomorrow-habit" ? "" : `<small>${escapeHtml(quest.latestNote || quest.firstStep || "")}</small>`}
          ${quest.source === "tomorrow-habit" ? "" : `<span class="meter"><i style="width:${percent}%"></i></span>`}
        </div>
        <button class="quest-complete" type="button" data-complete-quest="${escapeHtml(quest.id)}" aria-label="${escapeHtml(quest.title)}を完了">✓</button>
      </article>
    `;
  }).join("");

  questPageList.innerHTML = orderedQuests.map((quest) => {
    const percent = Math.min(100, Math.round(((quest.current || 0) / (quest.target || 1)) * 100));
    const description = questDescription(quest);
    return `
      <article class="list-card quest-list-card ${quest.source === "tomorrow-habit" ? "is-daily-quest" : ""}" data-quest-card="${escapeHtml(quest.id)}">
        <img src="${iconForQuest(quest.icon)}" alt="" aria-hidden="true">
        <div>
          <small>${quest.source === "tomorrow-habit" ? "Daily" : "進行中"}</small>
          <strong>${escapeHtml(quest.title)}</strong>
          ${description ? `<p>${escapeHtml(description)}</p>` : ""}
          ${quest.source === "tomorrow-habit" ? "" : `<span class="meter"><i style="width:${percent}%"></i></span>`}
          <div class="entry-actions">
            <button class="${quest.source === "tomorrow-habit" ? "daily-check-button" : ""}" type="button" data-complete-quest="${escapeHtml(quest.id)}">${quest.source === "tomorrow-habit" ? "✓" : "完了にする"}</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderJournal() {
  if (!journalCalendar || !journalList) return;

  const todayKey = toDateKey(new Date());
  const selectedDate = getJournalSelection();
  const selectedMonth = state.journalMonth || monthKey(dateFromKey(selectedDate));
  const [year, month] = selectedMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const offset = firstDay.getDay();
  const reflectionCounts = state.reflections.reduce((counts, item) => {
    const key = getReflectionDateKey(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  journalMonthLabel.textContent = firstDay.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long"
  });
  journalSelectedTitle.textContent = `${formatJournalDate(selectedDate)}の日記`;

  const cells = [];
  for (let i = 0; i < offset; i += 1) {
    cells.push(`<span class="journal-day is-blank" aria-hidden="true"></span>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    const count = reflectionCounts[key] || 0;
    const classes = [
      "journal-day",
      key === selectedDate ? "is-selected" : "",
      key === todayKey ? "is-today" : "",
      count ? "has-entry" : ""
    ].filter(Boolean).join(" ");
    const entryLabel = count ? `${count}件の記録` : "記録なし";
    cells.push(`
      <button class="${classes}" type="button" data-journal-date="${key}" aria-label="${formatJournalDate(key)} ${entryLabel}">
        <span>${day}</span>
        ${count ? `<i>${count}</i>` : ""}
      </button>
    `);
  }
  journalCalendar.innerHTML = cells.join("");

  const selectedItems = state.reflections.filter((item) => getReflectionDateKey(item) === selectedDate);
  if (!selectedItems.length) {
    journalList.innerHTML = emptyCard("この日の記録はまだありません", "ホームの入力欄から、今日の出来事や気持ちを残せます。");
    return;
  }

  journalList.innerHTML = selectedItems.map((item) => `
    <article class="list-card journal-entry-card">
      <span class="memory-mark" aria-hidden="true"></span>
      <div>
        <small>${escapeHtml(item.savedAt || item.dateLabel || formatJournalDate(getReflectionDateKey(item)))} / ${escapeHtml(item.tag)}</small>
        <strong>${escapeHtml(item.text)}</strong>
        <p>${escapeHtml(item.memory || "Niloはこの記憶を、あなたが戻ってこられる言葉として覚えています。")}</p>
        <div class="entry-actions">
          <button type="button" data-save-memory="${escapeHtml(item.id)}">
            ${state.memories.some((memory) => memory.sourceId === item.id) ? "記憶に保存済み" : "記憶に残す"}
          </button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderReflections() {
  if (!state.memories.length) {
    const empty = emptyCard("まだ大事な場面はありません", "日記の中で残したい場面を選ぶと、ここにNiloの記憶として保存されます。");
    memoryList.innerHTML = empty;
    memoryPageList.innerHTML = empty;
    return;
  }

  memoryList.innerHTML = state.memories.slice(0, 3).map((item) => `
    <article class="memory-row">
      <span aria-hidden="true"></span>
      <div>
        <p>${escapeHtml(item.body || item.text)}</p>
        <time>${escapeHtml(item.savedAt || item.dateLabel)}</time>
      </div>
    </article>
  `).join("");

  const fullHtml = state.memories.map((item) => `
    <article class="list-card">
      <span class="memory-mark" aria-hidden="true"></span>
      <div>
        <small>${escapeHtml(item.savedAt || item.dateLabel)} / ${escapeHtml(item.tag || "大事な場面")}</small>
        <strong>${escapeHtml(item.title || item.text)}</strong>
        <p>${escapeHtml(item.body || "Niloはこの場面を、あとで戻ってこられる記憶として覚えています。")}</p>
      </div>
    </article>
  `).join("");
  memoryPageList.innerHTML = fullHtml;
}

function renderChapters() {
  if (!state.chapters.length) {
    chapterList.innerHTML = `
      <li class="empty-card">
        <strong>まだ章はありません</strong>
        <p>日々の記憶が重なると、Niloが人生の章として整理します。</p>
      </li>
    `;
    return;
  }

  chapterList.innerHTML = state.chapters.map((chapter) => `
    <li>
      <time>${escapeHtml(chapter.date)}</time>
      <strong>${escapeHtml(chapter.title)}</strong>
      <p>${escapeHtml(chapter.body)}</p>
    </li>
  `).join("");
}

function renderTodayPanel() {
  const count = state.reflections.length;
  const levelInfo = getNiloLevelInfo();
  if (niloLevel) niloLevel.textContent = `Lv. ${levelInfo.level}`;
  if (niloLevelProgress) niloLevelProgress.style.width = `${levelInfo.progress}%`;
  if (todayNoteTitle) {
    todayNoteTitle.textContent = count ? "今夜の記録を保存しました。" : "今夜の記録はこれからです。";
  }
  niloMessage.textContent = state.today.niloMessage || (count ? `Niloの記憶が${count}つ灯っています。` : "まだ今日の記録はありません。");
  dailyWord.textContent = state.today.niloLine || defaultState.today.niloLine;
  moodLabel.textContent = state.today.moodLabel || "未記録";
  moodScore.textContent = Number.isFinite(state.today.moodScore) ? `${state.today.moodScore}/10` : "--/10";
  moodDots.classList.toggle("is-empty", !Number.isFinite(state.today.moodScore));
}

function render() {
  renderNightRitual();
  renderQuests();
  renderTomorrowQuestCandidates();
  renderReflections();
  renderJournal();
  renderChapters();
  renderTodayPanel();
  updateBgmUi();
  updateLanguageUi();
  updateNotificationUi();
  updatePrivacyUi();
  updateProfileUi();
}

async function askNilo(text) {
  const response = await fetch("/api/nilo/reflection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      recentMemories: [
        ...state.memories.slice(0, 4).map((item) => item.body || item.text),
        ...state.reflections.slice(0, 4).map((item) => item.memory || item.text)
      ],
      activeQuests: state.quests
        .filter((quest) => quest.status !== "completed")
        .slice(0, 5)
        .map((quest) => ({
          id: quest.id,
          title: quest.title,
          current: quest.current || 0,
          target: quest.target || 1,
          firstStep: quest.firstStep || ""
        }))
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Niloと接続できませんでした。");
  }

  return response.json();
}

async function askNightRitual(forceFinish = false) {
  const ritual = ensureNightRitual();
  const response = await fetch("/api/nilo/night-ritual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: ritual.messages,
      questionCount: ritual.questionCount,
      forceFinish,
      activeQuests: state.quests
        .filter((quest) => quest.status !== "completed")
        .slice(0, 8)
        .map((quest) => ({
          id: quest.id,
          title: quest.title,
          current: quest.current || 0,
          target: quest.target || 1,
          firstStep: quest.firstStep || ""
        }))
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Night Ritualを保存できませんでした。");
  }

  return response.json();
}

function fallbackNightRitualResult() {
  const ritual = ensureNightRitual();
  const userLines = ritual.messages
    .filter((message) => message.role === "user")
    .map((message) => message.text)
    .slice(-5);
  const firstLine = userLines[0] || "静かな一日";
  const title = firstLine.length > 22 ? `${firstLine.slice(0, 22)}...` : firstLine;
  return {
    done: true,
    title,
    summaryLines: userLines.length ? userLines.slice(0, 5) : ["今日の印象を短く残しました。"],
    relatedQuests: [],
    moodLabel: "記録済み",
    moodScore: null,
    niloLine: `${title}のことを、今夜のしるしとして残しました。`,
    niloMessage: "ここまでで、今夜の記録にしましょう。",
    closingMessage: "ここまでで、今夜の記録にしましょう。",
    tag: "Night Ritual",
    xpGain: 5
  };
}

function completeNightRitual(result) {
  const ritual = ensureNightRitual();
  const now = new Date();
  const dateKey = toDateKey(now);
  const lines = Array.isArray(result.summaryLines) && result.summaryLines.length
    ? result.summaryLines.slice(0, 5).map((line) => String(line).slice(0, 90))
    : fallbackNightRitualResult().summaryLines;
  const relatedQuests = Array.isArray(result.relatedQuests)
    ? result.relatedQuests.slice(0, 5).map((quest) => String(quest).slice(0, 36)).filter(Boolean)
    : [];
  const closingMessage = String(result.closingMessage || result.niloMessage || "ここまでで、今夜の記録にしましょう。").slice(0, 90);

  if (!ritual.messages.some((message) => message.role === "nilo" && message.text === closingMessage)) {
    ritual.messages.push({ role: "nilo", text: closingMessage });
  }

  state.reflections.unshift({
    id: createId("reflection"),
    text: result.title || "今夜の記録",
    title: result.title || "今夜の記録",
    createdAt: now.toISOString(),
    dateKey,
    dateLabel: formatJournalDate(dateKey),
    savedAt: "今日 " + clockTime.textContent,
    tag: result.tag || "Night Ritual",
    memory: lines.join("\n"),
    summaryLines: lines,
    linkedQuestTitles: relatedQuests,
    ritualMessages: ritual.messages
  });
  state.journalSelectedDate = dateKey;
  state.journalMonth = monthKey(now);
  state.today = {
    moodLabel: result.moodLabel || "記録済み",
    moodScore: Number.isFinite(result.moodScore) ? Math.max(1, Math.min(10, result.moodScore)) : null,
    niloLine: result.niloLine || `${result.title || "今日"}のことを、今夜のしるしとして残しました。`,
    niloMessage: result.niloMessage || closingMessage
  };

  addNiloXp(result.xpGain);
  applyQuestUpdates(result);
  addGeneratedQuests(result);
  ritual.completed = true;
}

function applyNiloInsight(text, insight) {
  const fallbackMemory = text.length > 80 ? `${text.slice(0, 80)}...` : text;
  const now = new Date();
  const dateKey = toDateKey(now);
  state.reflections.unshift({
    text,
    createdAt: now.toISOString(),
    dateKey,
    dateLabel: formatJournalDate(dateKey),
    savedAt: "今日 " + clockTime.textContent,
    tag: insight.tag || "今日の振り返り",
    memory: insight.memory || fallbackMemory
  });
  state.journalSelectedDate = dateKey;
  state.journalMonth = monthKey(now);

  state.today = {
    moodLabel: insight.moodLabel || "記録済み",
    moodScore: Number.isFinite(insight.moodScore) ? Math.max(1, Math.min(10, insight.moodScore)) : null,
    niloLine: insight.niloLine || "言葉にしたことで、今日の輪郭が少し見えました。",
    niloMessage: insight.niloMessage || `Niloの記憶が${state.reflections.length}つ灯っています。`
  };

  addNiloXp(insight.xpGain);
  applyQuestUpdates(insight);
  addGeneratedQuests(insight);

  if (insight.chapterTitle && !state.chapters.some((chapter) => chapter.title === insight.chapterTitle)) {
    state.chapters.unshift({
      date: formatDate(new Date()),
      title: insight.chapterTitle,
      body: insight.chapterBody || "今日の言葉から、Niloが新しい章を見つけました。"
    });
  }
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Niloが記録しています..." : "答える ›";
  reflectionForm.classList.toggle("is-loading", isSubmitting);
  updateReflectionAvailability();
}

function switchTab(tabName, direction = 0) {
  const next = validTabs.includes(tabName) ? tabName : "home";
  if (next === state.activeTab && document.body.dataset.screen === next) return;
  document.body.dataset.tabDirection = direction >= 0 ? "down" : "up";
  state.activeTab = next;
  document.body.dataset.screen = next;
  screens.forEach((screen) => screen.classList.toggle("is-active", screen.id === next));
  navButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === next));
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === next));
  if (next === "quests" && ensureTomorrowQuestsGenerated()) {
    renderQuests();
    renderTomorrowQuestCandidates();
  }
  if (location.hash !== `#${next}`) history.replaceState(null, "", `#${next}`);
  saveState();
}

function switchTabByOffset(offset) {
  const currentIndex = Math.max(0, validTabs.indexOf(state.activeTab));
  const nextIndex = Math.max(0, Math.min(validTabs.length - 1, currentIndex + offset));
  if (nextIndex === currentIndex) return false;
  switchTab(validTabs[nextIndex], offset);
  return true;
}

function shouldIgnoreScrollTab(event) {
  if (settingsPanel && !settingsPanel.hidden) return true;
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  return Boolean(event.target.closest(".ritual-messages, textarea, input, select, button, [role='dialog']"));
}

function atPageScrollEdge(deltaY) {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  if (maxScroll < 8) return true;
  return deltaY > 0 ? scrollTop >= maxScroll - scrollTabEdgeInset : scrollTop <= scrollTabEdgeInset;
}

function handleTabWheel(event) {
  if (shouldIgnoreScrollTab(event)) return;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

  const now = Date.now();
  if (now - lastScrollTabAt < scrollTabCooldownMs) return;
  if (now - lastScrollWheelAt > scrollTabResetMs) scrollTabDelta = 0;
  lastScrollWheelAt = now;

  if (!atPageScrollEdge(event.deltaY)) {
    scrollTabDelta = 0;
    return;
  }

  scrollTabDelta += event.deltaY;
  if (Math.abs(scrollTabDelta) < scrollTabThreshold) return;

  const moved = switchTabByOffset(scrollTabDelta > 0 ? 1 : -1);
  if (moved) {
    event.preventDefault();
    lastScrollTabAt = now;
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  scrollTabDelta = 0;
}

function getInitialTab() {
  const hash = location.hash.replace("#", "");
  if (validTabs.includes(hash)) return hash;
  return validTabs.includes(state.activeTab) ? state.activeTab : "home";
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const currentIndex = validTabs.indexOf(state.activeTab);
    const nextIndex = validTabs.indexOf(button.dataset.tab);
    switchTab(button.dataset.tab, nextIndex >= currentIndex ? 1 : -1);
  });
});

window.addEventListener("wheel", handleTabWheel, { passive: false });

settingsOpenButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    openSettings();
  });

  button.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    openSettings();
  });
});

settingsPanel?.addEventListener("click", (event) => {
  if (event.target === settingsPanel) closeSettings();
});

settingsPanel?.addEventListener("click", (event) => {
  if (event.target.closest("[data-settings-close]")) closeSettings();
});

settingsTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchSettingsTab(tab.dataset.settingsTab));
});

languageSelect?.addEventListener("change", () => {
  state.settings.language = languageSelect.value;
  saveState();
  updateLanguageUi();
  if (languageStatus) languageStatus.textContent = "言語設定を保存しました。";
});

notificationToggle?.addEventListener("click", () => {
  state.settings.notificationsEnabled = !state.settings.notificationsEnabled;
  saveState();
  updateNotificationUi();
  if (notificationStatus) notificationStatus.textContent = state.settings.notificationsEnabled ? "夜の呼びかけをONにしました。" : "夜の呼びかけをOFFにしました。";
});

notificationTime?.addEventListener("change", () => {
  state.settings.notificationTime = notificationTime.value || "22:00";
  saveState();
  updateNotificationUi();
  if (notificationStatus) notificationStatus.textContent = "呼びかける時間を保存しました。";
});

$$("[data-notification-day]").forEach((button) => {
  button.addEventListener("click", () => {
    const day = Number(button.dataset.notificationDay);
    const days = new Set(Array.isArray(state.settings.notificationDays) ? state.settings.notificationDays.map(Number) : []);
    if (days.has(day) && days.size > 1) {
      days.delete(day);
    } else {
      days.add(day);
    }
    state.settings.notificationDays = Array.from(days).sort((a, b) => a - b);
    saveState();
    updateNotificationUi();
  });
});

notificationPermission?.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    if (notificationStatus) notificationStatus.textContent = "この環境では通知を利用できません。";
    return;
  }
  const permission = await Notification.requestPermission();
  if (notificationStatus) notificationStatus.textContent = permission === "granted" ? "通知が許可されました。" : "通知は許可されていません。";
});

privacyToggles.forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.privacyToggle;
    state.settings.privacy = {
      ...structuredClone(defaultState.settings.privacy),
      ...(state.settings.privacy || {}),
      [key]: !(state.settings.privacy || {})[key]
    };
    saveState();
    updatePrivacyUi();
    if (privacyStatus) privacyStatus.textContent = "プライバシー設定を保存しました。";
  });
});

privacyExport?.addEventListener("click", () => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `arc-data-${toDateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  if (privacyStatus) privacyStatus.textContent = "データを書き出しました。";
});

profileAvatarButton?.addEventListener("click", () => {
  profileImage?.click();
});

profileImage?.addEventListener("change", () => {
  const file = profileImage.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.profile.image = String(reader.result || "");
    updateProfileUi();
  });
  reader.readAsDataURL(file);
});

profileSave?.addEventListener("click", () => {
  state.profile.name = profileName.value.trim();
  state.profile.birthdate = profileBirthdate.value;
  saveState();
  updateProfileUi();
});

bgmToggle?.addEventListener("click", async () => {
  state.settings.bgmEnabled = !state.settings.bgmEnabled;
  try {
    if (state.settings.bgmEnabled) {
      await playBgm(state.settings.bgmTrack || randomBgmTrack());
    } else {
      stopBgm();
    }
  } catch {
    state.settings.bgmEnabled = false;
    stopBgm();
    bgmTrackLabel.textContent = "ブラウザが再生を止めました。もう一度ONにしてください。";
  }
  saveState();
  updateBgmUi();
});

bgmRandom?.addEventListener("click", async () => {
  const nextTrack = randomBgmTrack(state.settings.bgmTrack);
  state.settings.bgmTrack = nextTrack;
  if (state.settings.bgmEnabled) {
    try {
      await playBgm(nextTrack);
    } catch {
      state.settings.bgmEnabled = false;
      stopBgm();
    }
  }
  saveState();
  updateBgmUi();
});

bgmTrackList?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-bgm-track]");
  if (!button) return;
  const nextTrack = button.dataset.bgmTrack;
  state.settings.bgmTrack = nextTrack;
  if (state.settings.bgmEnabled) {
    try {
      await playBgm(nextTrack);
    } catch {
      state.settings.bgmEnabled = false;
      stopBgm();
    }
  }
  saveState();
  updateBgmUi();
});

bgmPlayer?.addEventListener("ended", async () => {
  if (!state.settings.bgmEnabled) return;
  try {
    await playBgm(randomBgmTrack(state.settings.bgmTrack));
    saveState();
  } catch {
    state.settings.bgmEnabled = false;
    saveState();
    updateBgmUi();
  }
});

$$("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!isDiaryWindowOpen()) return;
    reflectionText.value = `${button.dataset.prompt}：`;
    updateReflectionCounter();
    reflectionText.focus();
  });
});

reflectionText?.addEventListener("input", updateReflectionCounter);

reflectionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isDiaryWindowOpen()) {
    updateReflectionAvailability();
    return;
  }
  if (isNightRitualCompletedToday()) {
    renderNightRitual();
    updateReflectionAvailability();
    return;
  }
  const text = reflectionText.value.trim();
  if (!text) {
    reflectionText.focus();
    return;
  }

  const ritual = ensureNightRitual();
  ritual.messages.push({ role: "user", text });
  reflectionText.value = "";
  updateReflectionCounter();
  saveState();
  renderNightRitual();

  setSubmitting(true);
  try {
    const shouldFinish = ritual.questionCount >= 5;
    const result = await askNightRitual(shouldFinish);
    if (result.done || shouldFinish) {
      completeNightRitual(result);
    } else {
      ritual.questionCount = Math.min(5, ritual.questionCount + 1);
      ritual.messages.push({
        role: "nilo",
        text: result.nextQuestion || "もう少しだけ、その場面を残すなら？"
      });
    }
    saveState();
    render();
  } catch (error) {
    completeNightRitual({
      ...fallbackNightRitualResult(),
      niloMessage: error.message
    });
    saveState();
    render();
  } finally {
    setSubmitting(false);
  }
});

journalCalendar?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-journal-date]");
  if (!button) return;
  state.journalSelectedDate = button.dataset.journalDate;
  state.journalMonth = monthKey(dateFromKey(state.journalSelectedDate));
  saveState();
  renderJournal();
});

journalList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-save-memory]");
  if (!button) return;
  saveReflectionAsMemory(button.dataset.saveMemory);
  saveState();
  render();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-complete-quest]");
  if (!button) return;
  const questId = button.dataset.completeQuest;
  const card = button.closest("[data-quest-card]");
  card?.classList.add("is-dusting");
  button.disabled = true;

  setTimeout(() => {
    completeQuest(questId);
    saveState();
    render();
  }, 680);
});

journalPrevMonth?.addEventListener("click", () => {
  const current = dateFromKey(`${state.journalMonth || monthKey(dateFromKey(getJournalSelection()))}-01`);
  current.setMonth(current.getMonth() - 1);
  state.journalMonth = monthKey(current);
  state.journalSelectedDate = `${state.journalMonth}-01`;
  saveState();
  renderJournal();
});

journalNextMonth?.addEventListener("click", () => {
  const current = dateFromKey(`${state.journalMonth || monthKey(dateFromKey(getJournalSelection()))}-01`);
  current.setMonth(current.getMonth() + 1);
  state.journalMonth = monthKey(current);
  state.journalSelectedDate = `${state.journalMonth}-01`;
  saveState();
  renderJournal();
});

journalToday?.addEventListener("click", () => {
  const today = new Date();
  state.journalSelectedDate = toDateKey(today);
  state.journalMonth = monthKey(today);
  saveState();
  renderJournal();
});

updateClock();
setInterval(updateClock, 1000 * 30);
setupNiloCursor();
render();
switchTab(getInitialTab(), 1);
