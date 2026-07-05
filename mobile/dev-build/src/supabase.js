import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const memoryStorage = new Map();
let warnedAboutAsyncStorage = false;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase env vars are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.");
}

function warnAsyncStorageFallback(error) {
  if (warnedAboutAsyncStorage) return;
  warnedAboutAsyncStorage = true;
  console.warn("AsyncStorage is unavailable in this runtime. Supabase auth will use memory storage until the native module is available.", error?.message || error);
}

const safeAuthStorage = {
  async getItem(key) {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ?? memoryStorage.get(key) ?? null;
    } catch (error) {
      warnAsyncStorageFallback(error);
      return memoryStorage.get(key) ?? null;
    }
  },
  async setItem(key, value) {
    memoryStorage.set(key, value);
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      warnAsyncStorageFallback(error);
    }
  },
  async removeItem(key) {
    memoryStorage.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      warnAsyncStorageFallback(error);
    }
  }
};

export const supabase = createClient(
  supabaseUrl || "https://fbpczitkbxefjxudcqmq.supabase.co",
  supabaseAnonKey || "missing-anon-key",
{
  auth: {
    storage: safeAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    flowType: "pkce",
    detectSessionInUrl: false
  }
});
