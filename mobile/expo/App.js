import Constants from "expo-constants";
import "react-native-url-polyfill/auto";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Linking from "expo-linking";
import {
  Alert,
  Animated,
  Easing,
  Image,
  ImageBackground,
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
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./src/supabase";

WebBrowser.maybeCompleteAuthSession();

const tabs = [
  { id: "quests", label: "クエスト" },
  { id: "journal", label: "日記" },
  { id: "home", label: "ホーム" },
  { id: "story", label: "章" },
  { id: "memory", label: "記憶" }
];

const settingsTabs = [
  { id: "bgm", label: "音楽", sub: "BGMの設定", icon: "♪" },
  { id: "profile", label: "冒険者", sub: "あなたの情報", icon: "♁" },
  { id: "language", label: "言語", sub: "Language", icon: "◁" },
  { id: "notifications", label: "夜の呼びかけ", sub: "Niloからのリマインド", icon: "♢" },
  { id: "privacy", label: "プライバシー", sub: "データとプライバシー", icon: "▤" }
];

const mobileBackgrounds = [
  { id: "navy-check", label: "ネイビーチェック", source: require("./assets/backgrounds/bg-navy-check.png") },
  { id: "serenity", label: "静かな夜", source: require("./assets/backgrounds/bg-serenity.png") },
  { id: "joy", label: "灯る朝", source: require("./assets/backgrounds/bg-joy.png") },
  { id: "trust", label: "澄んだ湖", source: require("./assets/backgrounds/bg-trust.png") },
  { id: "acceptance", label: "深い森", source: require("./assets/backgrounds/bg-acceptance.png") },
  { id: "fear", label: "遠い霧", source: require("./assets/backgrounds/bg-fear.png") },
  { id: "sadness", label: "青い静寂", source: require("./assets/backgrounds/bg-sadness.png") },
  { id: "disgust", label: "紫の岸辺", source: require("./assets/backgrounds/bg-disgust.png") },
  { id: "anger", label: "赤い地平", source: require("./assets/backgrounds/bg-anger.png") }
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

function getEmailOtpErrorMessage(error) {
  const message = String(error?.message || "");
  const status = error?.status;
  if (status === 403 || /expired|invalid|token|otp|code/i.test(message)) {
    return "コードが無効、または期限切れです。新しい6桁コードを再送して、もう一度お試しください。";
  }
  return message || "コードを確認できませんでした。少し時間をおいてもう一度お試しください。";
}

function AppContent() {
  const { width, height } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState("base");
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
  const [journal, setJournal] = useState([]);
  const [quests, setQuests] = useState(() => createDailyQuests());
  const [memories, setMemories] = useState([]);
  const [profile, setProfile] = useState(() => DEV_MODE ? DEV_PROFILE : { name: "", birthdate: "" });
  const [settings, setSettings] = useState({
    bgmEnabled: false,
    bgmTrackId: "arc-night",
    bgmVolume: 0.36,
    soundEffectsEnabled: true,
    backgroundId: "navy-check",
    language: "ja",
    notificationsEnabled: false,
    notificationTime: "22:00",
    privacy: {
      questLink: true,
      memoryLink: true,
      profileUse: true
    }
  });

  const activeQuests = useMemo(() => quests.filter((quest) => !quest.completed), [quests]);
  const journalDateKey = getJournalDateKey();
  const journalRecordedToday = journal.some((entry) => entry.dateKey === journalDateKey);
  const ritualAvailable = isRitualWindow(new Date()) && !journalRecordedToday;
  const reflectionInputEnabled = ritualLocked || (!journalRecordedToday && (ritualAvailable || DEV_MODE));
  const composerPrompt = journalRecordedToday ? "今日は記録済みです" : "短く答える";
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
  const activeBackground = mobileBackgrounds.find((background) => background.id === settings.backgroundId) || mobileBackgrounds[0];
  const activeBgmTrack = bgmTracks.find((track) => track.id === settings.bgmTrackId) || bgmTracks[0];
  const [bgmStatus, setBgmStatus] = useState({ playing: false, isLoaded: false });
  const bgmPlayerRef = useRef(null);
  const sfxPlayerRef = useRef(null);
  const pageScrollX = useRef(new Animated.Value(0)).current;
  const tabPressMotion = useRef(new Animated.Value(0)).current;
  const tabBarOpacity = useRef(new Animated.Value(1)).current;
  const unlockNoticeOpacity = useRef(new Animated.Value(0)).current;
  const tabPressListener = useRef(null);
  const unlockNoticeTimer = useRef(null);
  const pageScrollRef = useRef(null);
  const composerInputRef = useRef(null);
  const ritualLockedRef = useRef(false);
  const ritualFocusTimers = useRef([]);
  const ritualRunIdRef = useRef(0);
  const didShowInitialHomePrompt = useRef(false);
  const currentPageIndex = useRef(0);
  const pagePosition = useRef(0);
  const viewportFraction = 0.92;
  const pageGap = 10;
  const pageWidth = width * viewportFraction;
  const pageStep = pageWidth + pageGap;
  const sidePeek = Math.max(0, (width - pageWidth) / 2);
  const initialPageIndex = tabs.findIndex((tab) => tab.id === "home");
  const didSetInitialPage = useRef(false);
  const composerOpacity = pageScrollX.interpolate({
    inputRange: [(initialPageIndex - 0.7) * pageStep, initialPageIndex * pageStep, (initialPageIndex + 0.7) * pageStep],
    outputRange: [0, 1, 0],
    extrapolate: "clamp"
  });
  const composerTranslateY = pageScrollX.interpolate({
    inputRange: [(initialPageIndex - 1) * pageStep, initialPageIndex * pageStep, (initialPageIndex + 1) * pageStep],
    outputRange: [18, 0, 18],
    extrapolate: "clamp"
  });
  const composerScale = pageScrollX.interpolate({
    inputRange: [(initialPageIndex - 1) * pageStep, initialPageIndex * pageStep, (initialPageIndex + 1) * pageStep],
    outputRange: [0.985, 1, 0.985],
    extrapolate: "clamp"
  });
  const redirectUri = Linking.createURL("auth/callback");

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
    setRitualLocked(false);
    setInputMode(false);
    setHomePromptVisible(false);
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

  function requestExitNightRitual() {
    Alert.alert(
      "本当に終了しますか？",
      "",
      [
        { text: "キャンセル", style: "cancel", onPress: keepRitualInputFocused },
        { text: "終了", style: "destructive", onPress: exitNightRitual }
      ]
    );
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
    const nextIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (nextIndex < 0) return;
    if (tabId !== activeTab) playUiSound();
    const startX = pagePosition.current;
    const endX = nextIndex * pageStep;
    setActiveTab(tabId);
    currentPageIndex.current = nextIndex;
    tabPressMotion.stopAnimation();
    if (tabPressListener.current) {
      tabPressMotion.removeListener(tabPressListener.current);
      tabPressListener.current = null;
    }
    tabPressMotion.setValue(startX);
    const listenerId = tabPressMotion.addListener(({ value }) => {
      pageScrollRef.current?.scrollTo({ x: value, animated: false });
    });
    tabPressListener.current = listenerId;
    Animated.timing(tabPressMotion, {
      toValue: endX,
      duration: 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start(() => {
      tabPressMotion.removeListener(listenerId);
      tabPressListener.current = null;
      pageScrollRef.current?.scrollTo({ x: endX, animated: false });
    });
  }

  const handlePageScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { x: pageScrollX } } }],
    {
      useNativeDriver: false,
      listener: (event) => {
        if (ritualLocked) {
          currentPageIndex.current = initialPageIndex;
          pagePosition.current = initialPageIndex * pageStep;
          setActiveTab("home");
          return;
        }
        const offsetX = event.nativeEvent.contentOffset.x;
        pagePosition.current = offsetX;
        if (tabPressListener.current) return;
        const nextIndex = Math.max(0, Math.min(tabs.length - 1, Math.round(offsetX / pageStep)));
        if (!tabUnlocks[tabs[nextIndex].id]) {
          currentPageIndex.current = initialPageIndex;
          pagePosition.current = initialPageIndex * pageStep;
          setActiveTab("home");
          requestAnimationFrame(() => {
            pageScrollRef.current?.scrollTo({ x: initialPageIndex * pageStep, animated: true });
          });
          return;
        }
        if (nextIndex !== currentPageIndex.current) {
          currentPageIndex.current = nextIndex;
          setActiveTab(tabs[nextIndex].id);
        }
      }
    }
  ), [initialPageIndex, pageScrollX, pageStep, ritualLocked, tabUnlocks]);

  function settlePage(event) {
    if (ritualLocked) {
      currentPageIndex.current = initialPageIndex;
      pagePosition.current = initialPageIndex * pageStep;
      pageScrollRef.current?.scrollTo({ x: initialPageIndex * pageStep, animated: false });
      setActiveTab("home");
      requestAnimationFrame(() => composerInputRef.current?.focus());
      return;
    }
    const offsetX = event.nativeEvent.contentOffset.x;
    pagePosition.current = offsetX;
    const nextIndex = Math.max(0, Math.min(tabs.length - 1, Math.round(offsetX / pageStep)));
    if (!tabUnlocks[tabs[nextIndex].id]) {
      currentPageIndex.current = initialPageIndex;
      pagePosition.current = initialPageIndex * pageStep;
      pageScrollRef.current?.scrollTo({ x: initialPageIndex * pageStep, animated: true });
      setActiveTab("home");
      return;
    }
    currentPageIndex.current = nextIndex;
    setActiveTab(tabs[nextIndex].id);
  }

  function beginReflectionInput() {
    if (activeTab !== "home" || !reflectionInputEnabled || isSending) return;
    currentPageIndex.current = initialPageIndex;
    pagePosition.current = initialPageIndex * pageStep;
    pageScrollX.setValue(initialPageIndex * pageStep);
    pageScrollRef.current?.scrollTo({ x: initialPageIndex * pageStep, animated: false });
    setActiveTab("home");
    setRitualLocked(true);
    setInputMode(true);
    setHomePromptVisible(true);
    ritualLockedRef.current = true;
    ritualRunIdRef.current += 1;
    keepRitualInputFocused();
  }

  function syncInitialPage() {
    if (didSetInitialPage.current || !pageStep) return;
    didSetInitialPage.current = true;
    currentPageIndex.current = initialPageIndex;
    pagePosition.current = initialPageIndex * pageStep;
    pageScrollX.setValue(initialPageIndex * pageStep);
    requestAnimationFrame(() => {
      pageScrollRef.current?.scrollTo({ x: initialPageIndex * pageStep, animated: false });
    });
  }

  const pageViews = [
    {
      id: "quests",
      node: <QuestScreen quests={activeQuests} completeQuest={completeQuest} />
    },
    {
      id: "journal",
      node: <JournalScreen journal={journal} />
    },
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
          screenHeight={height}
          onBeginInput={beginReflectionInput}
        />
      )
    },
    {
      id: "story",
      node: <StoryScreen />
    },
    {
      id: "memory",
      node: <MemoryScreen memories={memories} />
    }
  ];

  async function submitRitual() {
    const text = input.trim().slice(0, 50);
    if (!text || isSending || !reflectionInputEnabled) return;

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
          forceFinish: questionCount >= maxReflectionQuestions,
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
    }, 460);
  }

  function applyNightResult(result, messages) {
    if (result.done) {
      const entryDateKey = getJournalDateKey();
      const closing = getShortClosingComment(result);
      const finalMessages = [...messages, { role: "nilo", text: closing }];
      const journalId = createId("journal");
      setRitualMessages([{ role: "nilo", text: reflectionQuestions[0] }]);
      showReflectionQuestion(closing);
      setQuestionCount(1);
      ritualLockedRef.current = false;
      setRitualLocked(false);
      setInputMode(false);
      composerInputRef.current?.blur();
      Keyboard.dismiss();
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
      addGeneratedQuests(result);
      return;
    }

    const nextQuestion = result.nextQuestion || createLocalFollowUpQuestion(messages);
    setQuestionCount((value) => Math.min(maxReflectionQuestions, value + 1));
    setRitualMessages([
      ...messages,
      { role: "nilo", text: nextQuestion }
    ]);
    showReflectionQuestion(nextQuestion);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  }

  function applyReflectionFallback(messages) {
    if (questionCount >= maxReflectionQuestions) {
      completeFallback(messages);
      return;
    }

    const nextQuestion = createLocalFollowUpQuestion(messages);
    setQuestionCount((value) => Math.min(maxReflectionQuestions, value + 1));
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
    setRitualMessages([{ role: "nilo", text: reflectionQuestions[0] }]);
    showReflectionQuestion(closing);
    setQuestionCount(1);
    ritualLockedRef.current = false;
    setRitualLocked(false);
    setInputMode(false);
    composerInputRef.current?.blur();
    Keyboard.dismiss();
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
      tag: result?.tag || "Night Ritual",
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

  if (authLoading) {
    return (
      <ImageBackground source={activeBackground.source} style={styles.background} resizeMode="cover">
        <View style={styles.scrim} />
        <SafeAreaView style={styles.safe}>
          <AuthGate loading />
          <StatusBar barStyle="light-content" />
        </SafeAreaView>
      </ImageBackground>
    );
  }

  if (!session) {
    return (
      <ImageBackground source={activeBackground.source} style={styles.background} resizeMode="cover">
        <View style={styles.scrim} />
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
      </ImageBackground>
    );
  }

  if (!profileComplete) {
    return (
      <ImageBackground source={activeBackground.source} style={styles.background} resizeMode="cover">
        <View style={styles.scrim} />
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
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={activeBackground.source} style={styles.background} resizeMode="cover">
      <View style={styles.scrim} />
      <SafeAreaView style={styles.safe}>
        <Header onSettings={() => setSettingsOpen(true)} />

        <Animated.ScrollView
          ref={pageScrollRef}
          horizontal
          decelerationRate="fast"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          snapToInterval={pageStep}
          snapToAlignment="start"
          scrollEventThrottle={16}
          onScroll={handlePageScroll}
          onMomentumScrollEnd={settlePage}
          onScrollEndDrag={settlePage}
          scrollEnabled={!ritualLocked}
          contentContainerStyle={[
            styles.pageRail,
            { paddingLeft: sidePeek, paddingRight: sidePeek }
          ]}
          onLayout={syncInitialPage}
          style={styles.content}
        >
          {pageViews.map((page, index) => {
            const scale = pageScrollX.interpolate({
              inputRange: [(index - 1) * pageStep, index * pageStep, (index + 1) * pageStep],
              outputRange: [0.965, 1, 0.965],
              extrapolate: "clamp"
            });
            const opacity = pageScrollX.interpolate({
              inputRange: [(index - 1) * pageStep, index * pageStep, (index + 1) * pageStep],
              outputRange: [0.74, 1, 0.74],
              extrapolate: "clamp"
            });
            return (
              <Animated.View
                key={page.id}
                style={[
                  styles.pageFrame,
                  {
                    width: pageWidth,
                    marginRight: index === pageViews.length - 1 ? 0 : pageGap,
                    opacity,
                    transform: [{ scale }]
                  }
                ]}
              >
                {page.node}
              </Animated.View>
            );
          })}
        </Animated.ScrollView>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
          style={[styles.composerAvoider, keyboardVisible && styles.composerAvoiderFocused]}
        >
          {ritualLocked ? (
            <RitualComposer
              inputRef={composerInputRef}
              input={input}
              setInput={setInput}
              submitRitual={submitRitual}
              isSending={isSending}
              visible={activeTab === "home" && homePromptVisible}
              focused={inputMode}
              locked={ritualLocked}
              enabled={reflectionInputEnabled}
              prompt={composerPrompt}
              onFocus={() => setInputMode(true)}
              onBlur={() => {
                if (ritualLocked) {
                  keepRitualInputFocused();
                  return;
                }
                setInputMode(false);
              }}
              onPress={keepRitualInputFocused}
              onExit={requestExitNightRitual}
              animatedStyle={{
                transform: [{ scale: composerScale }]
              }}
            />
          ) : (
            <NightRitualButton
              enabled={reflectionInputEnabled}
              visible={activeTab === "home" && homePromptVisible}
              streakDays={journalStreakDays}
              onPress={beginReflectionInput}
              animatedStyle={{
                transform: [{ scale: composerScale }]
              }}
            />
          )}
        </KeyboardAvoidingView>

        <TabBar
          activeTab={activeTab}
          setActiveTab={goToTab}
          scrollX={pageScrollX}
          pageStep={pageStep}
          hidden={inputMode || keyboardVisible || ritualLocked}
          opacity={tabBarOpacity}
          unlocks={tabUnlocks}
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
          quests={quests}
          memories={memories}
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
        <StatusBar barStyle="light-content" />
      </SafeAreaView>
    </ImageBackground>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function Header({ onSettings }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>Arc</Text>
        <Text style={styles.brandSub}>夜に帰ってくる人生アプリ</Text>
      </View>
      <Pressable onPress={onSettings} style={styles.settingsButton}>
        <SettingsIcon id="settings" active />
      </Pressable>
    </View>
  );
}

function NiloHomeStage({ question, dimmed, thinking, hideQuestion, compact }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: dimmed ? 0 : 1,
      duration: dimmed ? 320 : 720,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [dimmed, opacity, question]);

  return (
    <View style={[styles.niloStage, compact && styles.niloStageCompact]}>
      <View style={[styles.niloStageCopy, compact && styles.niloStageCopyCompact]}>
        {thinking && <NiloThinkingIndicator />}
        {!hideQuestion && (
          <Animated.Text style={[styles.niloStageQuestion, compact && styles.niloStageQuestionCompact, { opacity }]}>{question}</Animated.Text>
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
    }, 34);

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
  screenHeight,
  onBeginInput
}) {
  const questionLift = useRef(new Animated.Value(0)).current;
  const needsProfile = !profile.name?.trim() || !profile.birthdate?.trim();
  const showFirstRun = !authLoading && (!session || needsProfile);
  const compact = keyboardVisible;
  const liftedY = inputLocked ? 0 : screenHeight < 720 ? -118 : screenHeight < 820 ? -140 : -164;

  useEffect(() => {
    Animated.timing(questionLift, {
      toValue: keyboardVisible ? liftedY : 0,
      duration: keyboardVisible ? 260 : 320,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [keyboardVisible, liftedY, questionLift]);

  return (
    <View
      style={styles.homeReflectionScreen}
    >
      <Animated.View style={[styles.reflectionTapArea, { transform: [{ translateY: questionLift }] }]}>
        <NiloHomeStage
          question={reflectionQuestion}
          dimmed={questionTransitioning}
          thinking={questionTransitioning || isSending}
          hideQuestion={Boolean(answerPreview)}
          compact={compact}
        />
        <AnswerPreview answer={answerPreview} fading={questionTransitioning} compact={compact} />
      </Animated.View>

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
        <Text style={styles.counter}>{input.length}/50</Text>
      </Pressable>
    </Animated.View>
  );
}

function NightRitualButton({ enabled, visible, streakDays, onPress, animatedStyle }) {
  const fade = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 180,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [fade, visible]);

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
        <Text style={[styles.ritualStartIcon, !enabled && styles.ritualStartTextDisabled]}>✦</Text>
        <View style={styles.ritualStartCopy}>
          <Text style={[styles.ritualStartText, !enabled && styles.ritualStartTextDisabled]}>Night Ritual</Text>
          <Text style={[styles.ritualStreakText, !enabled && styles.ritualStartTextDisabled]}>
            {`現在 ${streakDays}日連続`}
          </Text>
        </View>
      </Pressable>
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

function QuestScreen({ quests, completeQuest }) {
  const [questView, setQuestView] = useState("daily");
  const [renderedQuestView, setRenderedQuestView] = useState("daily");
  const [questSwitchWidth, setQuestSwitchWidth] = useState(0);
  const questContentFade = useRef(new Animated.Value(1)).current;
  const questSwitchMotion = useRef(new Animated.Value(0)).current;
  const habitQuests = quests.filter((quest) => quest.source === "daily");
  const nrQuests = quests.filter((quest) => quest.source === "journal-daily");
  const lifeQuests = quests.filter((quest) => quest.source !== "daily" && quest.source !== "journal-daily");
  const dailyQuestCount = habitQuests.length + nrQuests.length;
  const questSwitchGap = 8;
  const questSwitchPadding = 5;
  const questSwitchSlot = questSwitchWidth ? (questSwitchWidth - questSwitchPadding * 2 - questSwitchGap) / 2 : 0;
  const questSwitchHighlightX = questSwitchMotion.interpolate({
    inputRange: [0, 1],
    outputRange: [0, questSwitchSlot + questSwitchGap]
  });
  const questContentLift = questContentFade.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0]
  });

  function switchQuestView(nextView) {
    if (nextView === questView) return;
    setQuestView(nextView);
    Animated.timing(questSwitchMotion, {
      toValue: nextView === "daily" ? 0 : 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
    Animated.timing(questContentFade, {
      toValue: 0,
      duration: 120,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start(() => {
      setRenderedQuestView(nextView);
      questContentFade.setValue(0);
      Animated.timing(questContentFade, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <PageTitle eyebrow="Quiet quests" title="クエスト" subtitle="明日の自分が少し続きを見たくなる約束。" />
      <View style={styles.questSwitch} onLayout={(event) => setQuestSwitchWidth(event.nativeEvent.layout.width)}>
        {!!questSwitchSlot && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.questSwitchHighlight,
              {
                width: questSwitchSlot,
                transform: [{ translateX: questSwitchHighlightX }]
              }
            ]}
          />
        )}
        {[
          ["daily", "デイリー", dailyQuestCount],
          ["life", "ライフ", lifeQuests.length]
        ].map(([value, label, count]) => (
          <Pressable
            key={value}
            onPress={() => switchQuestView(value)}
            style={styles.questSwitchButton}
          >
            <Text style={[styles.questSwitchText, questView === value && styles.questSwitchTextActive]}>{label}</Text>
            <Text style={[styles.questSwitchCount, questView === value && styles.questSwitchTextActive]}>{count}</Text>
          </Pressable>
        ))}
      </View>
      <Animated.View style={{ opacity: questContentFade, transform: [{ translateY: questContentLift }] }}>
        {renderedQuestView === "daily" ? (
          <>
            <QuestSection title="習慣クエスト" quests={habitQuests} completeQuest={completeQuest} />
            <QuestSection title="NRクエスト" quests={nrQuests} completeQuest={completeQuest} />
            {!dailyQuestCount && (
              <EmptyState
                title="今日のデイリークエストはありません"
                body="習慣やNight Ritualから生まれる明日の一歩が、ここに並びます。"
              />
            )}
          </>
        ) : (
          <>
            <View style={styles.questGrid}>
              {lifeQuests.map((quest) => (
                <QuestTile key={quest.id} quest={quest} onComplete={completeQuest} />
              ))}
            </View>
            {!lifeQuests.length && (
              <EmptyState
                title="ライフクエストはまだありません"
                body="Niloとの会話から、中期・長期の約束が見つかるとここに残ります。"
              />
            )}
          </>
        )}
      </Animated.View>
    </ScrollView>
  );
}

function QuestSection({ title, quests, completeQuest }) {
  if (!quests.length) return null;
  return (
    <View style={styles.questSection}>
      <Text style={styles.questSectionTitle}>{title}</Text>
      <View style={styles.questGrid}>
        {quests.map((quest) => (
          <QuestTile key={quest.id} quest={quest} onComplete={completeQuest} />
        ))}
      </View>
    </View>
  );
}

function QuestTile({ quest, onComplete }) {
  const collapse = useRef(new Animated.Value(0)).current;
  const dust = useRef(questDust.map(() => new Animated.Value(0))).current;
  const [isCompleting, setIsCompleting] = useState(false);

  function completeWithAnimation() {
    if (isCompleting) return;
    setIsCompleting(true);

    Animated.parallel([
      Animated.timing(collapse, {
        toValue: 1,
        duration: 720,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false
      }),
      Animated.stagger(
        34,
        dust.map((value) => Animated.timing(value, {
          toValue: 1,
          duration: 680,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }))
      )
    ]).start(() => onComplete(quest.id));
  }

  const tileOpacity = collapse.interpolate({
    inputRange: [0, 0.34, 0.78, 1],
    outputRange: [1, 1, 0.46, 0]
  });
  const tileScale = collapse.interpolate({
    inputRange: [0, 0.28, 0.72, 1],
    outputRange: [1, 1.01, 0.62, 0.04]
  });
  const tileRotate = collapse.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: ["0deg", "-3deg", "-7deg"]
  });
  const tileTranslateX = collapse.interpolate({
    inputRange: [0, 0.24, 0.72, 1],
    outputRange: [0, 18, 62, 74]
  });
  const tileTranslateY = collapse.interpolate({
    inputRange: [0, 0.24, 0.72, 1],
    outputRange: [0, -16, -52, -34]
  });
  const tileHeight = collapse.interpolate({
    inputRange: [0, 0.48, 1],
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
        <View style={styles.questTileHead}>
          <View style={styles.questIconMark}>
            <View style={styles.questIconMarkLine} />
            <View style={styles.questIconMarkDot} />
          </View>
          <Pressable disabled={isCompleting} onPress={completeWithAnimation} style={[styles.checkButton, isCompleting && styles.checkButtonActive]}>
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

function JournalScreen({ journal }) {
  const calendarDays = getJournalCalendarDays();
  const [selectedDate, setSelectedDate] = useState(getJournalDateKey());
  const selectedEntries = journal.filter((entry) => (entry.dateKey || getJournalDateKey()) === selectedDate);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <PageTitle eyebrow="One reflection a day" title="日記" subtitle="今日の自分に戻る場所。" />
      <View style={styles.calendarStrip}>
        {calendarDays.map((day) => {
          const hasEntry = journal.some((entry) => entry.dateKey === day.key);
          const selected = selectedDate === day.key;
          return (
            <Pressable
              key={day.key}
              onPress={() => setSelectedDate(day.key)}
              style={[styles.calendarDay, selected && styles.calendarDayActive]}
            >
              <Text style={[styles.calendarWeek, selected && styles.calendarTextActive]}>{day.weekday}</Text>
              <Text style={[styles.calendarDate, selected && styles.calendarTextActive]}>{day.day}</Text>
              <View style={[styles.calendarDot, hasEntry && styles.calendarDotActive]} />
            </Pressable>
          );
        })}
      </View>
      {selectedEntries.length === 0 ? (
        <EmptyState title="まだ日記はありません" body="今夜の会話を終えると、ここに記録が残ります。" />
      ) : selectedEntries.map((entry) => (
        <View key={entry.id} style={styles.panel}>
          <Text style={styles.entryDate}>{entry.dateLabel || formatDotDate(entry.dateKey)}</Text>
          <Text style={styles.entryTitle}>{entry.title}</Text>
          {entry.lines.map((line, index) => <Text key={index} style={styles.mutedText}>{line}</Text>)}
        </View>
      ))}
    </ScrollView>
  );
}

function StoryScreen() {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <PageTitle eyebrow="Life chapters" title="人生の章" subtitle="あなたのストーリーを章として残します。" />
      <EmptyState title="まだ章はありません" body="大きな場面が日記に残ると、ここに章として灯ります。" />
    </ScrollView>
  );
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

function TabBar({ activeTab, setActiveTab, scrollX, pageStep, hidden, opacity, unlocks }) {
  const [barWidth, setBarWidth] = useState(0);
  const tabSlot = barWidth ? barWidth / tabs.length : 0;
  const indicatorTranslate = scrollX.interpolate({
    inputRange: tabs.map((_, index) => index * pageStep),
    outputRange: tabs.map((_, index) => index * tabSlot + 2),
    extrapolate: "clamp"
  });

  return (
    <Animated.View
      pointerEvents={hidden ? "none" : "auto"}
      style={[styles.tabBar, { opacity }]}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
    >
      {!!barWidth && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tabHighlight,
            {
              width: tabSlot - 4,
              transform: [{ translateX: indicatorTranslate }]
            }
          ]}
        />
      )}
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isUnlocked = unlocks?.[tab.id] !== false;
        return (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[
              styles.tabItem,
              tab.id === "home" && styles.tabItemHome,
              isActive && tab.id === "home" && styles.tabItemHomeActive,
              !isUnlocked && styles.tabItemLocked
            ]}
          >
            <TabIcon id={tab.id} active={isActive} locked={!isUnlocked} />
            <Text style={[styles.tabText, isActive && styles.tabTextActive, !isUnlocked && styles.tabTextLocked]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

function TabIcon({ id, active, locked }) {
  const lineStyle = [styles.tabIconLine, active && styles.tabIconLineActive, locked && styles.tabIconLineLocked];
  const dotStyle = [styles.tabIconDot, active && styles.tabIconDotActive, locked && styles.tabIconLineLocked];
  const boxStyle = [styles.tabIconBox, active && styles.tabIconBoxActive, locked && styles.tabIconLineLocked];

  if (id === "quests") {
    return (
      <View style={styles.tabIconCanvas}>
        <View style={[lineStyle, styles.questIconStem]} />
        <View style={[lineStyle, styles.questIconFlag]} />
        <View style={[dotStyle, styles.questIconPoint]} />
      </View>
    );
  }

  if (id === "journal") {
    return (
      <View style={styles.tabIconCanvas}>
        <View style={[boxStyle, styles.journalIconPage]} />
        <View style={[lineStyle, styles.journalIconLineA]} />
        <View style={[lineStyle, styles.journalIconLineB]} />
      </View>
    );
  }

  if (id === "home") {
    return (
      <View style={styles.tabIconCanvas}>
        <View style={[lineStyle, styles.homeIconRoofLeft]} />
        <View style={[lineStyle, styles.homeIconRoofRight]} />
        <View style={[boxStyle, styles.homeIconBase]} />
      </View>
    );
  }

  if (id === "story") {
    return (
      <View style={styles.tabIconCanvas}>
        <View style={[boxStyle, styles.storyIconLeft]} />
        <View style={[boxStyle, styles.storyIconRight]} />
        <View style={[lineStyle, styles.storyIconSpine]} />
      </View>
    );
  }

  return (
    <View style={styles.tabIconCanvas}>
      <View style={[boxStyle, styles.memoryIconRing]} />
      <View style={[dotStyle, styles.memoryIconDotCenter]} />
      <View style={[dotStyle, styles.memoryIconDotOrbit]} />
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
  quests,
  memories,
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

  useEffect(() => {
    if (visible) setActiveSettingsTab(initialTab || "base");
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

  function updatePrivacy(key) {
    setSettings((current) => ({
      ...current,
      privacy: {
        ...current.privacy,
        [key]: !current.privacy[key]
      }
    }));
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleWrap}>
            <Text style={styles.modalTitle}>設定</Text>
            <Text style={styles.modalSub}>Arc settings</Text>
          </View>
          <Pressable onPress={onClose} style={styles.modalCompass}>
            <Text style={styles.modalCompassText}>×</Text>
          </Pressable>
        </View>

        <View style={styles.settingsBody}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingSection}>
            {activeSettingsTab === "base" && (
              <SettingsBase
                profile={profile}
                session={session}
                authLoading={authLoading}
                settings={settings}
                activeBgmTrack={activeBgmTrack}
                journal={journal}
                quests={quests}
                memories={memories}
                onPickProfileImage={onPickProfileImage}
                onSelect={(tab) => {
                  onUiSound?.();
                  setActiveSettingsTab(tab);
                }}
              />
            )}

            {activeSettingsTab !== "base" && (
              <Pressable
                onPress={() => {
                  onUiSound?.();
                  setActiveSettingsTab("base");
                }}
                style={styles.backToBase}
              >
                <Text style={styles.backToBaseText}>‹ 拠点へ戻る</Text>
              </Pressable>
            )}

            {activeSettingsTab === "bgm" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="sound" title="音楽" body="日々のBGMを選んで、心地よい時間を。" />
                <SettingToggleRow
                  title="BGM"
                  body="夜のサウンドトラックを流します。"
                  value={settings.bgmEnabled}
                  onPress={() => updateSettings({ bgmEnabled: !settings.bgmEnabled })}
                />
                <SettingToggleRow
                  title="操作音"
                  body="ボタンや記録の小さな音を鳴らします。"
                  value={settings.soundEffectsEnabled}
                  onPress={() => updateSettings({ soundEffectsEnabled: !settings.soundEffectsEnabled })}
                />
                <View style={styles.settingsCard}>
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
                    <Pressable onPress={() => updateBgmVolume(-0.1)} style={styles.soundStepButton}>
                      <Text style={styles.soundStepText}>−</Text>
                    </Pressable>
                    <View style={styles.soundVolumeTrack}>
                      <View style={[styles.soundVolumeFill, { width: `${Math.round(settings.bgmVolume * 100)}%` }]} />
                    </View>
                    <Pressable onPress={() => updateBgmVolume(0.1)} style={styles.soundStepButton}>
                      <Text style={styles.soundStepText}>＋</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.settingsCard}>
                  <Text style={styles.settingLabel}>サウンドトラック</Text>
                  {bgmTracks.map((track) => (
                    <Pressable
                      key={track.id}
                      onPress={() => updateSettings({ bgmTrackId: track.id, bgmEnabled: true })}
                      style={[styles.soundTrackRow, settings.bgmTrackId === track.id && styles.soundTrackRowActive]}
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

            {activeSettingsTab === "profile" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="profile" title="冒険者" body="名前と生年月日を保存します。" />
                <View style={styles.authCard}>
                  <View style={styles.authCopy}>
                    <Text style={styles.settingLabel}>アカウント</Text>
                    <Text style={styles.settingValue}>
                      {authLoading ? "確認中..." : session?.user?.email || "未ログイン"}
                    </Text>
                    <Text style={styles.mutedText}>
                      Googleログインで記録をあなたのアカウントに結びます。
                    </Text>
                  </View>
                  {session ? (
                    <Pressable disabled={authBusy} onPress={onSignOut} style={[styles.secondaryButton, authBusy && styles.disabledButton]}>
                      <Text style={styles.secondaryButtonText}>{authBusy ? "処理中..." : "ログアウト"}</Text>
                    </Pressable>
                  ) : (
                    <Pressable disabled={authBusy} onPress={onGoogleSignIn} style={[styles.primaryButton, authBusy && styles.disabledButton]}>
                      <Text style={styles.primaryButtonText}>{authBusy ? "接続中..." : "Googleでログイン"}</Text>
                    </Pressable>
                  )}
                  {!!authError && <Text style={styles.errorText}>{authError}</Text>}
                  <View style={styles.redirectBox}>
                    <Text style={styles.settingLabel}>Redirect URI</Text>
                    <Text style={styles.redirectText}>{redirectUri}</Text>
                  </View>
                </View>
                <TextInput value={name} onChangeText={setName} placeholder="名前" placeholderTextColor="#777" style={styles.settingInput} />
                <TextInput value={birthdate} onChangeText={setBirthdate} placeholder="YYYY-MM-DD" placeholderTextColor="#777" style={styles.settingInput} />
                {!!daysSince(birthdate) && <Text style={styles.mutedText}>{daysSince(birthdate)}日目</Text>}
                <Pressable
                  onPress={() => {
                    setProfile((current) => ({ ...current, name, birthdate }));
                    onClose();
                  }}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>保存</Text>
                </Pressable>
              </View>
            )}

            {activeSettingsTab === "language" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="language" title="言語" body="アプリで使う言語を選びます。" />
                <View style={styles.segmentedRow}>
                  {[
                    ["ja", "日本語"],
                    ["en", "English"],
                    ["es", "Español"],
                    ["zh", "中文"]
                  ].map(([value, label]) => (
                    <Pressable
                      key={value}
                      onPress={() => updateSettings({ language: value })}
                      style={[styles.segmentButton, settings.language === value && styles.segmentButtonActive]}
                    >
                      <Text style={[styles.segmentText, settings.language === value && styles.segmentTextActive]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {activeSettingsTab === "notifications" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="notifications" title="夜の呼びかけ" body="Niloからのリマインドを整えます。" />
                <SettingToggleRow
                  title="通知"
                  body="夜の記録の時間に知らせます。"
                  value={settings.notificationsEnabled}
                  onPress={() => updateSettings({ notificationsEnabled: !settings.notificationsEnabled })}
                />
                <TextInput
                  value={settings.notificationTime}
                  onChangeText={(notificationTime) => updateSettings({ notificationTime })}
                  placeholder="22:00"
                  placeholderTextColor="#777"
                  style={styles.settingInput}
                />
                <Text style={styles.mutedText}>Expo Goでは通知許可のUIだけ先に用意しています。</Text>
              </View>
            )}

            {activeSettingsTab === "privacy" && (
              <View style={styles.settingsPage}>
                <SettingsPageTitle icon="privacy" title="プライバシー" body="Arcが記録をどう扱うかを選びます。" />
                <SettingToggleRow
                  title="日記からクエストを作る"
                  body="夜の会話の内容をクエスト生成に使います。"
                  value={settings.privacy.questLink}
                  onPress={() => updatePrivacy("questLink")}
                />
                <SettingToggleRow
                  title="Niloの記憶に保存する"
                  body="大事な場面として残す候補に使います。"
                  value={settings.privacy.memoryLink}
                  onPress={() => updatePrivacy("memoryLink")}
                />
                <SettingToggleRow
                  title="プロフィールを反映する"
                  body="名前や日数を表示に使います。"
                  value={settings.privacy.profileUse}
                  onPress={() => updatePrivacy("profileUse")}
                />
              </View>
            )}

            {activeSettingsTab === "terms" && (
              <LegalPage
                icon="terms"
                title="利用規約"
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
        <Text style={styles.panelTitle}>{title}</Text>
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
        <Text style={styles.settingLabel}>最終更新</Text>
        <Text style={styles.settingValue}>{updatedAt}</Text>
        <Text style={styles.mutedText}>
          この文面はアプリ内表示用のドラフトです。公開前には必要に応じて専門家の確認を行ってください。
        </Text>
      </View>
      {sections.map((section) => (
        <View key={section.title} style={styles.legalSectionCard}>
          <Text style={styles.legalSectionTitle}>{section.title}</Text>
          <Text style={styles.legalBody}>{section.body}</Text>
        </View>
      ))}
    </View>
  );
}

function SettingsBase({ profile, session, authLoading, settings, activeBgmTrack, journal, quests, memories, onPickProfileImage, onSelect }) {
  const displayName = profile.name || session?.user?.user_metadata?.name || session?.user?.email?.split("@")[0] || "あなた";
  const journeyDay = daysSince(profile.birthdate) || daysSince(arcStartDate) + 1;
  const journalCount = journal.length;
  const completedQuestCount = quests.filter((quest) => quest.completed).length;
  const activeQuestCount = quests.filter((quest) => !quest.completed).length;
  const memoryCount = memories.length;
  const recordScore = journalCount * 2 + completedQuestCount + memoryCount * 3;
  const visibleLevel = Math.max(1, Math.floor(recordScore / 5) + 1);
  const levelProgress = Math.min(100, (recordScore % 5) * 20 || (recordScore > 0 ? 100 : 8));
  const profileInitial = displayName.slice(0, 1).toUpperCase();
  const syncText = authLoading ? "同期状態を確認中" : session ? "Googleで同期中" : "未接続";

  return (
    <View style={styles.basePage}>
      <View style={styles.baseProfileCard}>
        <View style={styles.baseProfileTop}>
          <Pressable onPress={onPickProfileImage} style={styles.baseAvatar}>
            {profile.imageUri ? (
              <Image source={{ uri: profile.imageUri }} style={styles.baseAvatarImage} />
            ) : (
              <Text style={styles.baseAvatarText}>{profileInitial}</Text>
            )}
          </Pressable>
          <View style={styles.baseProfileInfo}>
            <Text style={styles.baseName}>{displayName}</Text>
            <Text style={styles.baseLevel}>Lv.{visibleLevel} 記録者</Text>
            <View style={styles.baseLevelBar}>
              <View style={[styles.baseLevelFill, { width: `${levelProgress}%` }]} />
            </View>
            <Text style={styles.baseXpText}>夜の記録から少しずつ育っています</Text>
          </View>
        </View>
        <View style={styles.baseMetaRow}>
          <View style={[styles.baseMetaItem, styles.baseMetaItemStart]}>
            <Text style={styles.baseMetaIcon}>✺</Text>
            <View>
              <Text style={styles.baseMetaLabel}>ARC開始日</Text>
              <Text style={styles.baseMetaValue}>{formatDotDate(arcStartDate)}</Text>
            </View>
          </View>
          <View style={styles.baseMetaDivider} />
          <View style={styles.baseMetaItem}>
            <Text style={styles.baseMetaIcon}>♨</Text>
            <View>
              <Text style={styles.baseMetaLabel}>Journey Day</Text>
              <Text style={styles.baseMetaValue}>{journeyDay}日目</Text>
            </View>
          </View>
        </View>
        <View style={styles.baseStatGrid}>
          <BaseStat label="日記" value={`${journalCount}`} />
          <BaseStat label="進行中" value={`${activeQuestCount}`} />
          <BaseStat label="完了" value={`${completedQuestCount}`} />
          <BaseStat label="記憶" value={`${memoryCount}`} />
        </View>
      </View>

      <SettingsSection title="アプリ">
        <BaseSettingRow icon="notifications" title="通知" body={settings.notificationsEnabled ? `${settings.notificationTime} に夜の記録を知らせます` : "通知はオフです"} value={settings.notificationsEnabled ? "ON" : "OFF"} onPress={() => onSelect("notifications")} />
        <BaseSettingRow icon="sound" title="サウンド" body={settings.bgmEnabled ? `${activeBgmTrack.title} / ${Math.round(settings.bgmVolume * 100)}%` : "BGMはオフです"} value={settings.bgmEnabled ? "ON" : "OFF"} onPress={() => onSelect("bgm")} />
        <BaseSettingRow icon="language" title="表示設定" body={`表示言語 ${languageLabel(settings.language)}`} value={settings.language.toUpperCase()} onPress={() => onSelect("language")} />
      </SettingsSection>

      <SettingsSection title="ARC">
        <BaseSettingRow icon="profile" title="冒険データ" body={`日記 ${journalCount} / クエスト完了 ${completedQuestCount} / 記憶 ${memoryCount}`} value="記録" onPress={() => onSelect("profile")} />
        <BaseSettingRow icon="sync" title="データ同期" body={syncText} value={session ? "接続済み" : "未接続"} onPress={() => onSelect("profile")} />
        <BaseSettingRow icon="privacy" title="プライバシー" body={privacySummary(settings.privacy)} value="管理" onPress={() => onSelect("privacy")} />
      </SettingsSection>

      <SettingsSection title="サポート">
        <BaseSettingRow icon="feedback" title="フィードバック" body="ご意見・ご要望をお聞かせください" value="準備中" disabled />
        <BaseSettingRow icon="terms" title="利用規約" body="ARCの利用条件" value="表示" onPress={() => onSelect("terms")} />
        <BaseSettingRow icon="policy" title="プライバシーポリシー" body="データの取り扱いについて" value="表示" onPress={() => onSelect("privacyPolicy")} />
        <BaseSettingRow icon="contact" title="お問い合わせ" body="サポートへ連絡する" value="準備中" disabled />
      </SettingsSection>
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

function SettingsSection({ title, children }) {
  return (
    <View style={styles.baseSection}>
      <Text style={styles.baseSectionTitle}>{title}</Text>
      <View style={styles.baseList}>{children}</View>
    </View>
  );
}

function BaseSettingRow({ icon, title, body, badge, value, disabled = false, onPress }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.baseRow, disabled && styles.baseRowDisabled]}>
      <View style={[styles.baseRowIcon, disabled && styles.baseRowIconDisabled]}>
        <SettingsIcon id={icon} locked={disabled} />
      </View>
      <View style={styles.baseRowCopy}>
        <Text style={[styles.baseRowTitle, disabled && styles.baseTextDisabled]}>{title}</Text>
        <Text style={[styles.baseRowBody, disabled && styles.baseTextDisabled]}>{body}</Text>
      </View>
      {!!badge && (
        <View style={styles.baseBadge}>
          <Text style={styles.baseBadgeText}>{badge}</Text>
        </View>
      )}
      {!!value && !badge && <Text style={[styles.baseRowValue, disabled && styles.baseTextDisabled]}>{value}</Text>}
      {!disabled && <Text style={styles.baseChevron}>›</Text>}
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

  if (id === "privacy") {
    return (
      <View style={styles.settingsIconCanvas}>
        <View style={[boxStyle, styles.settingsIconShield]} />
        <View style={[lineStyle, styles.settingsIconShieldLine]} />
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
      <View style={styles.toggleRow}>
        <View style={styles.toggleCopy}>
          <Text style={styles.settingValue}>{title}</Text>
          <Text style={styles.mutedText}>{body}</Text>
        </View>
        <Pressable onPress={onPress} style={[styles.togglePill, value && styles.togglePillOn]}>
          <Text style={[styles.toggleText, value && styles.toggleTextOn]}>{value ? "ON" : "OFF"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createDailyQuests() {
  return [...dailyBank]
    .sort(() => Math.random() - 0.5)
    .slice(0, 4)
    .map((title) => ({ id: createId("daily"), title, source: "daily", completed: false }));
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

function isRitualWindow(date = new Date()) {
  const hour = date.getHours();
  return hour >= 20 || hour < 3;
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

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#03050b"
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,5,11,0.58)"
  },
  safe: {
    flex: 1
  },
  app: {
    flex: 1
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10
  },
  brand: {
    color: "#f6efe4",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 34,
    fontWeight: "600"
  },
  brandSub: {
    color: "rgba(246,239,228,0.68)",
    fontSize: 12
  },
  settingsButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,254,244,0.105)",
    borderColor: "rgba(255,254,244,0.24)",
    borderRadius: 16,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    shadowColor: "#ffffff",
    shadowOffset: { width: -7, height: -9 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    width: 42
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
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 48,
    fontWeight: "700"
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
  niloStageQuestion: {
    color: "#f6efe4",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 25,
    fontWeight: "600",
    lineHeight: 34,
    marginTop: 10,
    textAlign: "center"
  },
  niloStageQuestionCompact: {
    fontSize: 23,
    lineHeight: 31,
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
    color: "rgba(255,254,244,0.82)",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 18,
    lineHeight: 26,
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
    backgroundColor: "rgba(255,254,244,0.14)",
    borderColor: "rgba(255,254,244,0.3)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 17,
    paddingVertical: 7,
    shadowColor: "#fff7df",
    shadowOffset: { width: -8, height: -10 },
    shadowOpacity: 0.16,
    shadowRadius: 34
  },
  ritualStartButtonPressed: {
    transform: [{ scale: 0.98 }]
  },
  ritualStartButtonDisabled: {
    backgroundColor: "rgba(255,254,244,0.04)",
    borderColor: "rgba(255,254,244,0.08)",
    opacity: 0.46,
    shadowOpacity: 0
  },
  ritualStartIcon: {
    color: "#f0d18a",
    fontSize: 14,
    marginRight: 10
  },
  ritualStartCopy: {
    alignItems: "center"
  },
  ritualStartText: {
    color: "#f6efe4",
    fontFamily: Platform.select({ ios: "Didot", android: "serif", default: "serif" }),
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  ritualStreakText: {
    color: "rgba(240,209,138,0.78)",
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
  primaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(236,193,112,0.84)",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 18
  },
  disabledButton: {
    opacity: 0.46
  },
  primaryButtonText: {
    color: "#07080b",
    fontSize: 14,
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 17
  },
  secondaryButtonText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    fontWeight: "700"
  },
  panel: {
    backgroundColor: "rgba(255,254,244,0.085)",
    borderColor: "rgba(255,254,244,0.2)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    padding: 16
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
    color: "#c2bbb0",
    fontSize: 14,
    lineHeight: 21
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
  calendarStrip: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14
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
    shadowRadius: 26
  },
  tabHighlight: {
    backgroundColor: "rgba(255,254,244,0.56)",
    borderRadius: 999,
    height: 2,
    position: "absolute",
    top: 0
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
  tabItemHome: {
    backgroundColor: "rgba(255,254,244,0.07)",
    borderColor: "rgba(255,254,244,0.12)",
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 2,
    minHeight: 58,
    shadowColor: "#fff7df",
    shadowOffset: { width: -5, height: -7 },
    shadowOpacity: 0.08,
    shadowRadius: 18
  },
  tabItemHomeActive: {
    backgroundColor: "rgba(255,254,244,0.16)",
    borderColor: "rgba(255,254,244,0.3)",
    shadowOpacity: 0.16,
    shadowRadius: 26
  },
  tabItemActive: {
    backgroundColor: "rgba(217,179,106,0.12)"
  },
  tabItemLocked: {
    opacity: 0.34
  },
  tabIconCanvas: {
    height: 22,
    position: "relative",
    width: 24
  },
  tabIconLine: {
    backgroundColor: "rgba(246,239,228,0.62)",
    borderRadius: 999,
    position: "absolute"
  },
  tabIconLineActive: {
    backgroundColor: "rgba(255,254,244,0.78)"
  },
  tabIconLineLocked: {
    opacity: 0.56
  },
  tabIconDot: {
    backgroundColor: "rgba(246,239,228,0.62)",
    borderRadius: 999,
    position: "absolute"
  },
  tabIconDotActive: {
    backgroundColor: "rgba(255,254,244,0.78)"
  },
  tabIconBox: {
    borderColor: "rgba(246,239,228,0.62)",
    borderRadius: 4,
    borderWidth: 1.5,
    position: "absolute"
  },
  tabIconBoxActive: {
    borderColor: "rgba(255,254,244,0.78)"
  },
  questIconStem: {
    height: 16,
    left: 8,
    top: 3,
    width: 1.5
  },
  questIconFlag: {
    height: 1.5,
    left: 9,
    top: 5,
    width: 9
  },
  questIconPoint: {
    height: 4,
    left: 15,
    top: 4,
    width: 4
  },
  journalIconPage: {
    height: 17,
    left: 5,
    top: 2,
    width: 14
  },
  journalIconLineA: {
    height: 1.4,
    left: 8,
    top: 8,
    width: 8
  },
  journalIconLineB: {
    height: 1.4,
    left: 8,
    top: 12,
    width: 6
  },
  homeIconRoofLeft: {
    height: 1.8,
    left: 4,
    top: 7,
    transform: [{ rotate: "-38deg" }],
    width: 11
  },
  homeIconRoofRight: {
    height: 1.8,
    right: 4,
    top: 7,
    transform: [{ rotate: "38deg" }],
    width: 11
  },
  homeIconBase: {
    borderTopWidth: 0,
    height: 11,
    left: 6,
    top: 10,
    width: 12
  },
  storyIconLeft: {
    borderBottomRightRadius: 2,
    borderTopRightRadius: 2,
    height: 15,
    left: 4,
    top: 4,
    width: 8
  },
  storyIconRight: {
    borderBottomLeftRadius: 2,
    borderTopLeftRadius: 2,
    height: 15,
    right: 4,
    top: 4,
    width: 8
  },
  storyIconSpine: {
    height: 14,
    left: 11.25,
    top: 5,
    width: 1.5
  },
  memoryIconRing: {
    borderRadius: 999,
    height: 16,
    left: 4,
    top: 3,
    width: 16
  },
  memoryIconDotCenter: {
    height: 4,
    left: 10,
    top: 9,
    width: 4
  },
  memoryIconDotOrbit: {
    height: 3,
    left: 17,
    top: 5,
    width: 3
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
  modalTitleWrap: {
    alignItems: "center",
    flex: 1,
    paddingLeft: 42
  },
  modalTitle: {
    color: "#fafafa",
    fontFamily: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
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
    fontSize: 11,
    marginTop: 3,
    textTransform: "uppercase"
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
    fontSize: 24,
    fontWeight: "300",
    lineHeight: 26
  },
  settingsBody: {
    flex: 1
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
    fontSize: 18,
    fontWeight: "700"
  },
  settingsTabTitle: {
    color: "#f6efe4",
    fontSize: 14,
    fontWeight: "700"
  },
  settingsTabSub: {
    color: "#aaa6af",
    fontSize: 10,
    lineHeight: 13
  },
  settingSection: {
    gap: 20,
    padding: 20,
    paddingBottom: 54
  },
  settingsPage: {
    gap: 14
  },
  basePage: {
    gap: 22
  },
  baseProfileCard: {
    backgroundColor: "rgba(255,255,255,0.055)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 260,
    padding: 20,
    shadowColor: "#ffffff",
    shadowOffset: { width: -10, height: -12 },
    shadowOpacity: 0.055,
    shadowRadius: 34
  },
  baseProfileTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 20,
    zIndex: 1
  },
  baseAvatar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.065)",
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    borderWidth: 2,
    height: 104,
    justifyContent: "center",
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
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 34,
    fontWeight: "700"
  },
  baseProfileInfo: {
    flex: 1,
    gap: 7
  },
  baseName: {
    color: "#fbfbfb",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 25,
    fontWeight: "700"
  },
  baseLevel: {
    color: "rgba(236,193,112,0.86)",
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
    backgroundColor: "rgba(236,193,112,0.82)",
    borderRadius: 999,
    height: "100%",
    width: "36%"
  },
  baseXpText: {
    color: "rgba(255,255,255,0.55)",
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
    fontSize: 20,
    width: 30
  },
  baseMetaLabel: {
    color: "rgba(255,255,255,0.52)",
    fontSize: 12
  },
  baseMetaValue: {
    color: "#fbfbfb",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
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
    backgroundColor: "rgba(255,255,255,0.045)",
    borderColor: "rgba(255,255,255,0.105)",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10
  },
  baseStatValue: {
    color: "#fbfbfb",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 18,
    fontWeight: "700"
  },
  baseStatLabel: {
    color: "rgba(255,255,255,0.44)",
    fontSize: 10,
    marginTop: 2
  },
  baseSection: {
    gap: 10
  },
  baseSectionTitle: {
    color: "rgba(255,255,255,0.48)",
    fontFamily: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
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
    backgroundColor: "rgba(255,255,255,0.52)",
    borderRadius: 999,
    position: "absolute"
  },
  settingsIconLineActive: {
    backgroundColor: "rgba(255,255,255,0.88)"
  },
  settingsIconLocked: {
    opacity: 0.48
  },
  settingsIconDot: {
    backgroundColor: "rgba(255,255,255,0.52)",
    borderRadius: 999,
    position: "absolute"
  },
  settingsIconDotActive: {
    backgroundColor: "rgba(255,255,255,0.88)"
  },
  settingsIconBox: {
    borderColor: "rgba(255,255,255,0.52)",
    borderRadius: 5,
    borderWidth: 1.5,
    position: "absolute"
  },
  settingsIconBoxActive: {
    borderColor: "rgba(255,255,255,0.88)"
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
  baseTextDisabled: {
    color: "rgba(255,255,255,0.34)"
  },
  baseRowCopy: {
    flex: 1,
    gap: 3
  },
  baseRowTitle: {
    color: "#f7f7f7",
    fontSize: 15,
    fontWeight: "700"
  },
  baseRowBody: {
    color: "rgba(255,255,255,0.43)",
    fontSize: 12
  },
  baseRowValue: {
    color: "rgba(255,255,255,0.62)",
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
    fontSize: 12,
    fontWeight: "700"
  },
  baseChevron: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 26,
    lineHeight: 28
  },
  backToBase: {
    alignSelf: "flex-start",
    paddingVertical: 4
  },
  backToBaseText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "700"
  },
  settingsPageTitle: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 6
  },
  settingsPageIcon: {
    color: "rgba(240,189,118,0.72)",
    fontSize: 20,
    fontWeight: "700",
    width: 34
  },
  settingsPageCopy: {
    flex: 1,
    gap: 3
  },
  settingsCard: {
    backgroundColor: "rgba(255,255,255,0.048)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 20,
    borderWidth: 1,
    gap: 7,
    padding: 14
  },
  authCard: {
    backgroundColor: "rgba(255,255,255,0.048)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 14
  },
  authCopy: {
    gap: 5
  },
  errorText: {
    color: "#ffb4a7",
    fontSize: 12,
    lineHeight: 18
  },
  noticeText: {
    color: "#d9b36a",
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
    fontSize: 11,
    lineHeight: 16
  },
  settingLabel: {
    color: "rgba(255,255,255,0.43)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  settingValue: {
    color: "#f7f7f7",
    fontSize: 16,
    fontWeight: "700"
  },
  soundStatusRow: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.075)",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 10
  },
  soundStatusText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    fontWeight: "700"
  },
  soundVolumeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 4
  },
  soundStepButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.045)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  soundStepText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 21
  },
  soundVolumeTrack: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    flex: 1,
    height: 7,
    overflow: "hidden"
  },
  soundVolumeFill: {
    backgroundColor: "rgba(236,193,112,0.72)",
    borderRadius: 999,
    height: "100%"
  },
  soundTrackRow: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12
  },
  soundTrackRowActive: {
    backgroundColor: "rgba(236,193,112,0.11)",
    borderColor: "rgba(236,193,112,0.28)"
  },
  soundTrackMark: {
    color: "rgba(236,193,112,0.86)",
    fontSize: 11,
    fontWeight: "800"
  },
  legalNoticeCard: {
    backgroundColor: "rgba(255,255,255,0.045)",
    borderColor: "rgba(255,255,255,0.115)",
    borderRadius: 20,
    borderWidth: 1,
    gap: 7,
    padding: 14
  },
  legalSectionCard: {
    backgroundColor: "rgba(255,255,255,0.038)",
    borderColor: "rgba(255,255,255,0.095)",
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 14
  },
  legalSectionTitle: {
    color: "#f7f7f7",
    fontSize: 15,
    fontWeight: "800"
  },
  legalBody: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    lineHeight: 21
  },
  settingInput: {
    backgroundColor: "rgba(255,255,255,0.044)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    borderWidth: 1,
    color: "#f7f7f7",
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 14
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
    backgroundColor: "rgba(255,255,255,0.045)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 58,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  togglePillOn: {
    backgroundColor: "rgba(236,193,112,0.18)",
    borderColor: "rgba(236,193,112,0.34)",
    shadowColor: "#ecc170",
    shadowOffset: { width: -4, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 14
  },
  toggleText: {
    color: "rgba(255,255,255,0.54)",
    fontSize: 12,
    fontWeight: "800"
  },
  toggleTextOn: {
    color: "#f8e4b8"
  },
  segmentedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  segmentButton: {
    backgroundColor: "rgba(255,255,255,0.045)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  segmentButtonActive: {
    backgroundColor: "rgba(236,193,112,0.16)",
    borderColor: "rgba(236,193,112,0.32)",
    shadowColor: "#ecc170",
    shadowOffset: { width: -4, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 14
  },
  segmentText: {
    color: "rgba(255,255,255,0.54)",
    fontSize: 13,
    fontWeight: "700"
  },
  segmentTextActive: {
    color: "#f8e4b8"
  }
});
