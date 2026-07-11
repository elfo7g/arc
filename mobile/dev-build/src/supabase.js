import "react-native-url-polyfill/auto";
import "react-native-get-random-values";
import * as aesjs from "aes-js";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const memoryStorage = new Map();
let warnedAboutSecureStore = false;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase env vars are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.");
}

function warnSecureStoreFallback(error) {
  if (warnedAboutSecureStore) return;
  warnedAboutSecureStore = true;
  console.warn("SecureStore is unavailable in this runtime. Supabase auth will use memory storage until the native module is available.", error?.message || error);
}

// SecureStore only holds small values reliably, so the session (which can exceed
// that) is AES-encrypted and stored elsewhere with just the per-key AES key kept
// in the OS keystore/keychain via SecureStore. This mirrors Supabase's own
// recommended pattern for Expo apps (session tokens must never sit in plaintext
// AsyncStorage, since a compromised device would otherwise hand over the account
// and everything the backend can decrypt for it).
const encryptedValueStorage = {
  async getItem(key) {
    return AsyncStorage_getItem(key);
  },
  async setItem(key, value) {
    return AsyncStorage_setItem(key, value);
  },
  async removeItem(key) {
    return AsyncStorage_removeItem(key);
  }
};

// Lazily required to keep this file's top-level imports focused on the secure path;
// AsyncStorage here only ever stores AES-encrypted ciphertext, never plaintext tokens.
const AsyncStorage = require("@react-native-async-storage/async-storage").default;
async function AsyncStorage_getItem(key) { return AsyncStorage.getItem(key); }
async function AsyncStorage_setItem(key, value) { return AsyncStorage.setItem(key, value); }
async function AsyncStorage_removeItem(key) { return AsyncStorage.removeItem(key); }

function encryptValue(key, value) {
  const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
  const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
  const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  return {
    encryptionKeyHex: aesjs.utils.hex.fromBytes(encryptionKey),
    encryptedHex: aesjs.utils.hex.fromBytes(encryptedBytes)
  };
}

function decryptValue(encryptionKeyHex, encryptedHex) {
  const encryptionKey = aesjs.utils.hex.toBytes(encryptionKeyHex);
  const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
  const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(encryptedHex));
  return aesjs.utils.utf8.fromBytes(decryptedBytes);
}

const safeAuthStorage = {
  async getItem(key) {
    try {
      const encryptionKeyHex = await SecureStore.getItemAsync(key);
      if (!encryptionKeyHex) return memoryStorage.get(key) ?? null;
      const encryptedHex = await encryptedValueStorage.getItem(key);
      if (!encryptedHex) return memoryStorage.get(key) ?? null;
      return decryptValue(encryptionKeyHex, encryptedHex);
    } catch (error) {
      warnSecureStoreFallback(error);
      return memoryStorage.get(key) ?? null;
    }
  },
  async setItem(key, value) {
    memoryStorage.set(key, value);
    try {
      const { encryptionKeyHex, encryptedHex } = encryptValue(key, value);
      await SecureStore.setItemAsync(key, encryptionKeyHex);
      await encryptedValueStorage.setItem(key, encryptedHex);
    } catch (error) {
      warnSecureStoreFallback(error);
    }
  },
  async removeItem(key) {
    memoryStorage.delete(key);
    try {
      await SecureStore.deleteItemAsync(key);
      await encryptedValueStorage.removeItem(key);
    } catch (error) {
      warnSecureStoreFallback(error);
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
