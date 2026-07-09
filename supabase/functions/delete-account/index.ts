// GDPR Art.17(消去権)対応: アカウントと全サーバーデータの完全削除。
//
// クライアントは supabase.functions.invoke() で呼ぶ(ユーザーのJWTが自動添付され、
// config.toml の verify_jwt = true がゲートする)。ここでは service_role で
// auth.users から本人を削除する。public.user_state は user_id の外部キーが
// on delete cascade なので、行(暗号化された日記・記憶・章の全部)も同時に消える。
//
// 誤爆防止として body に { confirm: true } を要求する。削除は取り消せない。

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { message: "Method not allowed." });

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (body.confirm !== true) {
      return jsonResponse(400, { message: "Missing confirmation." });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return jsonResponse(401, { message: "Missing authorization." });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // JWTから本人を解決する。他人のIDをbodyで受け取る形は最初から作らない。
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return jsonResponse(401, { message: "Invalid session." });
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
    if (deleteError) {
      return jsonResponse(500, { message: "Account deletion failed.", detail: deleteError.message });
    }

    return jsonResponse(200, { ok: true });
  } catch (error) {
    return jsonResponse(500, {
      message: error instanceof Error ? error.message : "Account deletion failed."
    });
  }
});
