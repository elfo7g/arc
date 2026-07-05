import { supabase } from "./supabase";

// Same shape the client persists to AsyncStorage — Supabase just becomes the
// authoritative copy so it survives a reinstall or follows the user to
// another device.
export function collectSyncedState({
  journal, memories, chapters, chapterNotes, profile, settings,
  questProposals, explorations, declinedQuestThemes, questScanDateKey, notifications,
  onboardingComplete
} = {}) {
  return {
    journal, memories, chapters, chapterNotes, profile, settings,
    questProposals, explorations, declinedQuestThemes, questScanDateKey, notifications,
    onboardingComplete
  };
}

// Reads/writes go through RPCs (get_user_state / set_user_state) instead of
// the table directly — the row is encrypted at rest and only those
// SECURITY DEFINER functions can reach the key. userId is kept for call-site
// compatibility; the RPCs scope to auth.uid() server-side regardless.
export async function fetchRemoteUserState(userId) {
  const { data, error } = await supabase.rpc("get_user_state");
  if (error) throw error;
  return data || null;
}

export async function saveRemoteUserState(userId, state) {
  const { error } = await supabase.rpc("set_user_state", { p_data: state });
  if (error) throw error;
}
