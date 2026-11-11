// Supabase Edge Function: reset-password
// Employee Code + registered email match hone par naya password set karta hai.
// Service role key sirf server side (Edge Function) me rehti hai — browser me nahi.
//
// Deploy: Supabase Dashboard -> Edge Functions -> Deploy a new function
//         naam: reset-password -> ye poora code paste karo -> Deploy.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.employeeCode || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.newPassword || "");

    if (!code || !email || email.indexOf("@") === -1) {
      return json({ ok: false, error: "Employee Code aur Email dono daalein." }, 400);
    }
    if (password.length < 6) {
      return json({ ok: false, error: "Password kam se kam 6 characters ka hona chahiye." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: rows, error } = await supabase
      .from("users")
      .select("id,employeeCode,email,authEmail")
      .ilike("employeeCode", code)
      .limit(1);

    if (error) throw error;
    const user = rows && rows[0];
    if (!user) return json({ ok: false, error: "Employee Code ya Email match nahi hua." });

    const actual = String(user.authEmail || user.email || "").trim().toLowerCase();
    if (!actual || actual !== email) {
      return json({ ok: false, error: "Employee Code ya Email match nahi hua." });
    }

    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (updErr) return json({ ok: false, error: updErr.message }, 400);

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String((e && (e as Error).message) || e) }, 500);
  }
});
