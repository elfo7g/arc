const storageKey = "arc.life.archive.v2";
const tabs = ["home", "quest", "diary", "chapter"];

const seedEntries = [
  {
    id: "entry-2026-06-28-home",
    dateKey: "2026-06-28",
    jdate: "6月28日",
    dateLabel: "JUNE 28",
    source: "home",
    tonight: true,
    title: "今日はどんな日だった？",
    summary: "夕方、ひとりで長い散歩をした。川沿いの道を、ただ歩いていた。",
    lines: ["夕方、ひとりで長い散歩をした。", "川沿いの道を、ただ歩いていた。"],
    emotions: ["#静けさ", "#回復", "#ひとり時間"],
    dialogue: [
      { role: "nilo", text: "今日はどんな日だった？" },
      { role: "user", text: "夕方、ひとりで長い散歩をした。川沿いの道を、ただ歩いていた。" },
      { role: "nilo", text: "ひとりの時間は、あなたにとってどんな意味があった？" },
      { role: "user", text: "誰にも気をつかわなくていい。ようやく、呼吸ができた気がした。" },
      { role: "nilo", text: "その「呼吸ができた」感じを、最近よく探している？" },
      { role: "user", text: "たぶん。少しずつ、自分のペースを取り戻している。" }
    ],
    related: [
      { date: "5月19日", text: "夜、海まで歩いた。波の音だけが、ずっと残っていた。" }
    ]
  },
  {
    id: "entry-2026-06-27-quest",
    dateKey: "2026-06-27",
    jdate: "6月27日",
    dateLabel: "JUNE 27",
    source: "quest",
    questText: "いちばん安心する場所は、どこ？",
    title: "安心する場所",
    summary: "実家の台所の隅。母が料理していた音がする場所。",
    lines: ["実家の台所の隅。", "母が料理していた音がする場所。"],
    emotions: ["#安心", "#記憶", "#家族"],
    dialogue: [
      { role: "nilo", text: "いちばん安心する場所は、どこ？" },
      { role: "user", text: "実家の台所の隅。母が料理していた音がする場所。" },
      { role: "nilo", text: "その音は、いまのあなたに何を思い出させる？" },
      { role: "user", text: "守られていた頃のこと。もう戻れないけど、確かにあった時間。" }
    ]
  },
  {
    id: "entry-2026-06-25-home",
    dateKey: "2026-06-25",
    jdate: "6月25日",
    dateLabel: "JUNE 25",
    source: "home",
    title: "予定のない朝",
    summary: "雨の音で目が覚めた。久しぶりに、何も予定のない朝。",
    lines: ["雨の音で目が覚めた。", "久しぶりに、何も予定のない朝。"],
    emotions: ["#休息", "#静けさ"],
    dialogue: [
      { role: "nilo", text: "今日はどんな日だった？" },
      { role: "user", text: "雨の音で目が覚めた。久しぶりに、何も予定のない朝。" },
      { role: "nilo", text: "その静けさは、どんな色をしていた？" },
      { role: "user", text: "薄いグレー。でも嫌じゃない、やわらかい色。" }
    ]
  },
  {
    id: "entry-2026-06-21-home",
    dateKey: "2026-06-21",
    jdate: "6月21日",
    dateLabel: "JUNE 21",
    source: "home",
    title: "短い電話",
    summary: "母に電話した。短い会話だったけど、声が聞けてよかった。",
    lines: ["母に電話した。", "短い会話だったけど、声が聞けてよかった。"],
    emotions: ["#家族", "#感謝"],
    dialogue: [
      { role: "nilo", text: "今日はどんな日だった？" },
      { role: "user", text: "母に電話した。短い会話だったけど、声が聞けてよかった。" },
      { role: "nilo", text: "伝えられなかったことは、何かある？" },
      { role: "user", text: "ありがとう、かな。いつも言いそびれてしまう。" }
    ]
  },
  {
    id: "entry-2026-06-14-quest",
    dateKey: "2026-06-14",
    jdate: "6月14日",
    dateLabel: "JUNE 14",
    source: "quest",
    questText: "そっと手放したいものは？",
    title: "手放したいもの",
    summary: "完璧じゃない自分を、責めてしまう癖。",
    lines: ["完璧じゃない自分を、責めてしまう癖。"],
    emotions: ["#決意", "#内省"],
    dialogue: [
      { role: "nilo", text: "そっと手放したいものは？" },
      { role: "user", text: "完璧じゃない自分を責める癖。" },
      { role: "nilo", text: "それを手放せたら、何が変わると思う？" },
      { role: "user", text: "もう少し、自分にやさしくなれる気がする。" }
    ]
  }
];

const chapters = [
  {
    number: "第二章",
    title: "静かな回復",
    era: "2023 — いま",
    essence: "波が引くように、痛みが遠ざかる。",
    current: true,
    lifeQuest: {
      title: "航空大学校に合格する",
      count: 12,
      last: "6月20日"
    }
  },
  {
    number: "第一章",
    title: "遠回りの年",
    era: "2021 — 2023",
    essence: "迷いながら、それでも歩いていた。",
    current: false
  },
  {
    number: "序章",
    title: "はじまりの場所",
    era: "2019 — 2021",
    essence: "何も知らずに、ただ眩しかった。",
    current: false
  }
];

const trajectory = [
  { date: "6月20日", text: "数学の過去問、ようやく7割。少しだけ、光が見えた。" },
  { date: "6月8日", text: "模試の結果に落ち込んだ。でも、やめる気はない。" },
  { date: "5月22日", text: "身体検査の不安を、Niloに話した。" },
  { date: "4月2日", text: "この夢を、はじめてちゃんと言葉にした日。" }
];

const defaultState = {
  screen: "home",
  activeTab: "home",
  stack: [],
  selectedEntryId: "entry-2026-06-28-home",
  entries: seedEntries,
  settings: {
    nilo: true,
    lock: true
  },
  dialogue: {
    source: "home",
    questionCount: 1,
    messages: [],
    status: "",
    isSubmitting: false,
    done: false,
    lastResult: null
  }
};

let typeTimer = null;
const prefersReducedMotion = window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
  : false;

function clearTypeTimer() {
  if (typeTimer) {
    clearTimeout(typeTimer);
    typeTimer = null;
  }
}

// Nilo writes a question into the top tier, character by character.
function writeQuestion(full) {
  clearTypeTimer();
  if (!dom.niloQuestion) return;
  if (prefersReducedMotion) {
    dom.niloQuestion.textContent = full;
    return;
  }
  dom.niloQuestion.textContent = "";
  let i = 0;
  const step = () => {
    i += 1;
    dom.niloQuestion.textContent = full.slice(0, i);
    if (i < full.length) typeTimer = setTimeout(step, 52);
  };
  typeTimer = setTimeout(step, 340);
}

// Erase the current question, then write the next one in its place.
function eraseThenWrite(full) {
  clearTypeTimer();
  if (!dom.niloQuestion) return;
  if (prefersReducedMotion) {
    writeQuestion(full);
    return;
  }
  const current = dom.niloQuestion.textContent || "";
  let len = current.length;
  const step = () => {
    len -= 1;
    dom.niloQuestion.textContent = current.slice(0, Math.max(0, len));
    if (len > 0) typeTimer = setTimeout(step, 22);
    else typeTimer = setTimeout(() => writeQuestion(full), 240);
  };
  typeTimer = setTimeout(step, 120);
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

let state = loadState();
applyInitialHash();

const dom = {
  screens: $$(".screen"),
  tabButtons: $$("#tab-bar [data-tab]"),
  tabBar: $("#tab-bar"),
  backButton: $("#back-button"),
  statusTime: $("#status-time"),
  litQuestionList: $("#lit-question-list"),
  diaryList: $("#diary-list"),
  diaryMonth: $("#diary-month"),
  chapterList: $("#chapter-list"),
  niloDate: $("#nilo-date"),
  niloQuestion: $("#nilo-question-text"),
  niloCaret: $("#nilo-caret"),
  niloClosing: $("#nilo-closing"),
  niloAnswer: $("#nilo-answer"),
  niloSend: $("#nilo-send"),
  dialogueForm: $("#dialogue-form"),
  dialogueInput: $("#dialogue-input"),
  dialogueStatus: $("#dialogue-status"),
  detailDate: $("#detail-date"),
  detailTags: $("#detail-tags"),
  detailTitle: $("#detail-title"),
  detailDialogue: $("#detail-dialogue"),
  detailEmotions: $("#detail-emotions"),
  relatedSection: $("#related-section"),
  relatedList: $("#related-list"),
  trajectoryList: $("#trajectory-list"),
  settingNilo: $("#setting-nilo"),
  settingLock: $("#setting-lock")
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!saved) return clone(defaultState);

    return {
      ...clone(defaultState),
      ...saved,
      entries: Array.isArray(saved.entries) && saved.entries.length ? saved.entries : clone(seedEntries),
      settings: { ...clone(defaultState.settings), ...(saved.settings || {}) },
      dialogue: { ...clone(defaultState.dialogue), ...(saved.dialogue || {}), isSubmitting: false },
      stack: Array.isArray(saved.stack) ? saved.stack : []
    };
  } catch {
    return clone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify({
    ...state,
    dialogue: { ...state.dialogue, isSubmitting: false, status: "" }
  }));
}

function applyInitialHash() {
  const hash = location.hash.replace("#", "");
  const validScreens = [...tabs, "settings", "lifequest", "detail"];
  if (!validScreens.includes(hash)) return;
  state.screen = hash;
  if (tabs.includes(hash)) state.activeTab = hash;
  state.stack = [];
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isTabScreen(screen = state.screen) {
  return tabs.includes(screen);
}

function goTo(screen, options = {}) {
  const push = options.push !== false && !isTabScreen(screen);
  if (push && state.screen !== screen) {
    state.stack = [...state.stack, state.screen].slice(-8);
  }
  state.screen = screen;
  if (tabs.includes(screen)) {
    state.activeTab = screen;
    state.stack = [];
  }
  if (location.hash !== `#${screen}`) {
    history.replaceState(null, "", `#${screen}`);
  }
  saveState();
  render();
}

function back() {
  const previous = state.stack.pop();
  state.screen = previous || state.activeTab || "home";
  if (location.hash !== `#${state.screen}`) {
    history.replaceState(null, "", `#${state.screen}`);
  }
  saveState();
  render();
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatJapaneseDate(date = new Date()) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatEnglishDate(date = new Date()) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase();
}

function monthLabel(date = new Date()) {
  return `${date.toLocaleDateString("en-US", { month: "long" }).toUpperCase()} · ${date.getFullYear()}`;
}

function getSelectedEntry() {
  return state.entries.find((entry) => entry.id === state.selectedEntryId) || state.entries[0] || seedEntries[0];
}

function truncate(value, max) {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function render() {
  const mode = isTabScreen() ? "tab" : "immersive";
  document.body.dataset.screen = state.screen;
  document.body.dataset.mode = mode;

  dom.screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === state.screen);
  });

  dom.tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === state.activeTab);
  });

  dom.backButton.hidden = mode === "tab";
  dom.statusTime.textContent = formatTime();

  renderHome();
  renderQuest();
  renderDiary();
  renderChapter();
  renderDialogue();
  renderDetail();
  renderLifeQuest();
  renderSettings();
}

function renderHome() {
}

function renderQuest() {
  const questEntries = state.entries.filter((entry) => entry.source === "quest" || entry.questText);
  dom.litQuestionList.innerHTML = questEntries.length
    ? questEntries.map((entry) => `
      <button class="lit-item" type="button" data-action="open-entry" data-entry-id="${escapeHtml(entry.id)}">
        <span class="lit-meta"><span>${escapeHtml(entry.dateLabel || entry.jdate)}</span><span>QUEST</span></span>
        <strong>${escapeHtml(entry.questText || entry.title || "灯した問い")}</strong>
        <span>${escapeHtml(entry.summary)}</span>
      </button>
    `).join("")
    : `<div class="lit-item"><strong>最初の問いが、まだ灯る前です。</strong></div>`;
}

function renderDiary() {
  dom.diaryMonth.textContent = monthLabel(new Date());
  dom.diaryList.innerHTML = state.entries.map((entry, index) => `
    <button class="diary-item ${index > 1 ? "is-old" : ""}" type="button" data-action="open-entry" data-entry-id="${escapeHtml(entry.id)}">
      <span class="diary-meta">
        <span>${escapeHtml(entry.jdate)}</span>
        ${entry.tonight || entry.dateKey === dateKey() ? "<em>TONIGHT</em>" : ""}
        ${entry.source === "quest" ? "<em>QUEST</em>" : ""}
      </span>
      <p>${escapeHtml(entry.summary)}</p>
    </button>
  `).join("");
}

function renderChapter() {
  dom.chapterList.innerHTML = chapters.map((chapter) => `
    <article class="chapter-item ${chapter.current ? "" : "is-past"}">
      <button type="button" ${chapter.lifeQuest ? 'data-action="open-lifequest"' : 'aria-disabled="true" tabindex="-1"'}>
        <span class="chapter-item-top">
          <span>${escapeHtml(chapter.number)}</span>
          <span>${escapeHtml(chapter.era)}</span>
        </span>
        <h2>${escapeHtml(chapter.title)}</h2>
        <p>${escapeHtml(chapter.essence)}</p>
        ${chapter.current ? `<div class="chapter-note">—— いま、この章の中に</div>` : ""}
      </button>
      ${chapter.lifeQuest ? `
        <button class="lifequest-card" type="button" data-action="open-lifequest">
          <small>LIFE QUEST</small>
          <strong>${escapeHtml(chapter.lifeQuest.title)}</strong>
          <span>記録 ${chapter.lifeQuest.count} 回 · 最終 ${escapeHtml(chapter.lifeQuest.last)} ›</span>
        </button>
      ` : ""}
    </article>
  `).join("") + `
    <div class="chapter-new" aria-hidden="true">
      <span class="chapter-new-node"></span>
      <span class="chapter-new-label">＋　新しい章を始める</span>
    </div>
  `;
}

function renderDialogue() {
  const dialogue = state.dialogue;
  dom.niloDate.textContent = `${formatEnglishDate()} · 今夜`;
  dom.dialogueStatus.textContent = dialogue.status || "";
  dom.dialogueInput.disabled = dialogue.isSubmitting || dialogue.done;
  if (dom.niloSend) dom.niloSend.disabled = dialogue.isSubmitting || dialogue.done;
  if (dom.niloCaret) dom.niloCaret.style.display = dialogue.done ? "none" : "";
  if (dom.niloClosing) dom.niloClosing.hidden = !dialogue.done;
  if (dom.niloAnswer) dom.niloAnswer.hidden = dialogue.done;
}

function renderDetail() {
  const entry = getSelectedEntry();
  dom.detailDate.textContent = `${entry.jdate || ""} ${entry.tonight ? "TONIGHT" : ""}`;
  dom.detailTitle.textContent = entry.title || entry.questText || "この夜の記録";
  dom.detailTags.innerHTML = [
    entry.source === "quest" ? "Quest" : "Nilo",
    ...(entry.tonight ? ["Tonight"] : [])
  ].map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");

  const dialogue = Array.isArray(entry.dialogue) && entry.dialogue.length
    ? entry.dialogue
    : (entry.lines || [entry.summary]).map((text, index) => ({ role: index % 2 ? "nilo" : "user", text }));

  dom.detailDialogue.innerHTML = dialogue.map((message) => `
    <div class="detail-block ${message.role === "user" ? "is-user" : "is-nilo"}">
      <small>${message.role === "user" ? "YOU" : "NILO"}</small>
      <p>${escapeHtml(message.text)}</p>
    </div>
  `).join("");

  dom.detailEmotions.innerHTML = (entry.emotions || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");

  const related = Array.isArray(entry.related) ? entry.related : [];
  dom.relatedSection.hidden = related.length === 0;
  dom.relatedList.innerHTML = related.map((item) => `
    <button type="button">${escapeHtml(item.date)}　${escapeHtml(item.text)}</button>
  `).join("");
}

function renderLifeQuest() {
  dom.trajectoryList.innerHTML = trajectory.map((item) => `
    <div class="trajectory-item">
      <p>${escapeHtml(item.date)}</p>
      <p>${escapeHtml(item.text)}</p>
    </div>
  `).join("");
}

function renderSettings() {
  dom.settingNilo.classList.toggle("is-on", state.settings.nilo);
  dom.settingLock.classList.toggle("is-on", state.settings.lock);
}

function startDialogue(source = "home") {
  const firstQuestion = "今日はどんな日だった？";
  state.dialogue = {
    source,
    questionCount: 1,
    messages: [{ role: "nilo", text: firstQuestion }],
    status: "",
    isSubmitting: false,
    done: false,
    lastResult: null
  };
  dom.dialogueInput.value = "";
  goTo("nilo");
  writeQuestion(firstQuestion);
  requestAnimationFrame(() => dom.dialogueInput.focus());
}

async function submitDialogue(text) {
  const trimmed = text.trim();
  if (!trimmed || state.dialogue.isSubmitting || state.dialogue.done) return;

  state.dialogue.messages.push({ role: "user", text: trimmed });
  state.dialogue.status = "ニロが、言葉の輪郭を見ています。";
  state.dialogue.isSubmitting = true;
  dom.dialogueInput.value = "";
  render();

  try {
    const result = await askNilo();
    applyNiloResult(result);
  } catch {
    applyNiloResult(fallbackNiloResult());
  } finally {
    state.dialogue.isSubmitting = false;
    saveState();
    render();
    if (!state.dialogue.done && state.screen === "nilo") {
      requestAnimationFrame(() => dom.dialogueInput.focus());
    }
  }
}

async function askNilo(forceFinish = false) {
  const response = await fetch("/api/nilo/night-ritual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: state.dialogue.messages,
      questionCount: state.dialogue.questionCount,
      forceFinish,
      activeQuests: []
    })
  });

  if (!response.ok) throw new Error("Nilo API unavailable");
  return response.json();
}

function applyNiloResult(result) {
  if (result.done) {
    const closing = result.closingMessage || result.niloMessage || "今夜は、よく話してくれた。ここまでにしようか。";
    state.dialogue.messages.push({ role: "nilo", text: closing });
    state.dialogue.done = true;
    state.dialogue.lastResult = result;
    state.dialogue.status = "";
    eraseThenWrite(closing);
    return;
  }

  const nextQuestion = result.nextQuestion || fallbackQuestion();
  state.dialogue.questionCount += 1;
  state.dialogue.messages.push({ role: "nilo", text: nextQuestion });
  state.dialogue.status = "";
  eraseThenWrite(nextQuestion);
}

function fallbackNiloResult(forceDone = false) {
  const userCount = state.dialogue.messages.filter((message) => message.role === "user").length;
  if (forceDone || userCount >= 3 || state.dialogue.questionCount >= 4) {
    const userTexts = state.dialogue.messages.filter((message) => message.role === "user").map((message) => message.text);
    const first = userTexts[0] || "静かな夜";
    return {
      done: true,
      title: truncate(first, 24),
      summaryLines: userTexts.slice(0, 4),
      moodLabel: "静けさ",
      moodScore: null,
      closingMessage: "ここまでを、今夜の記録にしましょう。",
      tag: "Night Ritual"
    };
  }

  return {
    done: false,
    nextQuestion: fallbackQuestion()
  };
}

function fallbackQuestion() {
  const latest = [...state.dialogue.messages].reverse().find((message) => message.role === "user")?.text || "";
  const fragment = truncate(latest.replace(/[。、.]/g, ""), 12);
  const questions = [
    fragment ? `「${fragment}」の何が残っている？` : "その場面で、何が残った？",
    "その時の自分に、名前をつけるなら？",
    "明日の自分へ、何を渡したい？"
  ];
  return questions[Math.min(state.dialogue.questionCount - 1, questions.length - 1)];
}

function endDialogue() {
  clearTypeTimer();
  const hasUserText = state.dialogue.messages.some((message) => message.role === "user");
  if (!hasUserText) {
    back();
    return;
  }
  const result = state.dialogue.lastResult || fallbackNiloResult(true);
  if (!state.dialogue.done) {
    state.dialogue.messages.push({
      role: "nilo",
      text: result.closingMessage || "ここまでを、今夜の記録にしましょう。"
    });
  }
  saveDialogueAsEntry(result);
  state.dialogue.done = false;
  state.activeTab = "diary";
  state.screen = "diary";
  state.stack = [];
  saveState();
  render();
}

function saveDialogueAsEntry(result) {
  const now = new Date();
  const userTexts = state.dialogue.messages
    .filter((message) => message.role === "user")
    .map((message) => message.text);
  const summaryLines = Array.isArray(result.summaryLines) && result.summaryLines.length
    ? result.summaryLines
    : userTexts.slice(0, 4);
  const summary = summaryLines.join(" ");
  const quest = null;
  const moodTag = result.moodLabel ? `#${String(result.moodLabel).replace(/^#/, "")}` : "#記録";

  const entry = {
    id: createId("entry"),
    dateKey: dateKey(now),
    jdate: formatJapaneseDate(now),
    dateLabel: formatEnglishDate(now),
    source: state.dialogue.source === "quest" ? "quest" : "home",
    questText: quest ? quest.title : "",
    tonight: true,
    title: result.title || truncate(userTexts[0] || "今夜の記録", 26),
    summary: summary || "今夜の言葉を、静かに残しました。",
    lines: summaryLines.length ? summaryLines : ["今夜の言葉を、静かに残しました。"],
    emotions: [moodTag, result.tag ? `#${String(result.tag).replace(/^#/, "")}` : "#Night"],
    dialogue: clone(state.dialogue.messages),
    related: []
  };

  state.entries = [entry, ...state.entries.map((item) => ({ ...item, tonight: false }))];
  state.selectedEntryId = entry.id;
}

function openEntry(entryId) {
  if (!state.entries.some((entry) => entry.id === entryId)) return;
  state.selectedEntryId = entryId;
  goTo("detail");
}

function toggleSetting(key) {
  state.settings[key] = !state.settings[key];
  saveState();
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `arc-records-${dateKey()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function handleClick(event) {
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    goTo(tab.dataset.tab, { push: false });
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;

  const action = actionTarget.dataset.action;

  if (action === "open-dialogue") startDialogue("home", null);
  if (action === "open-entry") openEntry(actionTarget.dataset.entryId);
  if (action === "open-lifequest") goTo("lifequest");
  if (action === "open-settings") goTo("settings");
  if (action === "back") back();
  if (action === "end-dialogue") endDialogue();
  if (action === "toggle-setting") toggleSetting(actionTarget.dataset.setting);
  if (action === "export-data") exportData();
}

document.addEventListener("click", handleClick);

dom.dialogueForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitDialogue(dom.dialogueInput.value);
});

setInterval(() => {
  dom.statusTime.textContent = formatTime();
}, 30_000);

render();

// When a dialogue is restored from storage, the typed question text isn't
// re-animated — paint the current question so the top tier isn't blank.
if (state.screen === "nilo" && dom.niloQuestion) {
  const lastNilo = [...state.dialogue.messages].reverse().find((message) => message.role === "nilo");
  if (lastNilo) dom.niloQuestion.textContent = lastNilo.text;
}
