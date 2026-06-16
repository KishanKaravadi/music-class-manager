// admin-reset-password — admin-only password RECOVERY LINK generator.
//
// A teacher (role='admin') calls this for a locked-out student; it returns a one-time
// Supabase recovery LINK (not a password) that the teacher delivers manually over WhatsApp.
// The link lands in the app's existing /reset-password flow. No SMS provider needed.
//
// Security model (see _meta/plans/auth-recovery-design.md, Codex consult 2026-06-16):
//   1. Require caller JWT (gateway verify_jwt stays ON); resolve via getUser.
//   2. Service-role read of caller's profiles.role MUST be 'admin' (never trust the client).
//   3. Target must be an existing role='student' profile.
//   4. admin.generateLink({type:'recovery'}) — return ONLY the action link.
//   5. Audit the OUTCOME; never store the link/token.
//
// Deploy:  supabase functions deploy admin-reset-password
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are injected by the
//          platform; set APP_URL via `supabase secrets set APP_URL=https://keytonemusicacademy.in`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_URL = Deno.env.get("APP_URL") ?? "https://keytonemusicacademy.in";
const ALLOWED_ORIGINS = [
  "https://keytonemusicacademy.in",
  "https://www.keytonemusicacademy.in",
];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Authenticate the caller.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401, origin);
  const authClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401, origin);
  const callerId = userData.user.id;

  // Service-role client (bypasses RLS). Used ONLY after auth, never returned to client.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 2. Caller must be an admin — checked via service-role read, not via client claims/RLS.
  const { data: caller } = await admin.from("profiles").select("role").eq("id", callerId).single();
  if (!caller || caller.role !== "admin") return json({ error: "forbidden" }, 403, origin);

  // Parse + strictly validate input.
  let body: { target_student_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400, origin); }
  const targetId = body?.target_student_id;
  if (!targetId || !UUID_RE.test(targetId)) return json({ error: "invalid_target" }, 400, origin);

  // Lightweight abuse control: max 10 actions / admin / 60s (audit-table based).
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count: recent } = await admin
    .from("admin_audit")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", callerId)
    .gte("created_at", since);
  if ((recent ?? 0) >= 10) return json({ error: "rate_limited" }, 429, origin);

  const audit = (success: boolean, error_code?: string) =>
    admin.from("admin_audit").insert({
      actor_id: callerId, target_id: targetId, action: "password_recovery_link", success, error_code,
    });

  // 3. Target must be an existing student.
  const { data: target } = await admin.from("profiles").select("role").eq("id", targetId).single();
  if (!target || target.role !== "student") {
    await audit(false, "target_not_student");
    return json({ error: "invalid_target" }, 400, origin);
  }

  // generateLink needs the auth email (may differ from profiles.email).
  const { data: targetUser, error: getErr } = await admin.auth.admin.getUserById(targetId);
  const email = targetUser?.user?.email;
  if (getErr || !email) {
    await audit(false, "no_email");
    return json({ error: "no_email_on_account" }, 422, origin);
  }

  // 4. Generate the recovery link.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${APP_URL}/reset-password` },
  });
  if (linkErr || !link?.properties?.action_link) {
    await audit(false, linkErr?.message ?? "generate_failed");
    return json({ error: "could_not_generate_link" }, 500, origin);
  }

  // 5. Audit success (never store the link itself).
  await audit(true);
  return json({ ok: true, recovery_link: link.properties.action_link }, 200, origin);
});
