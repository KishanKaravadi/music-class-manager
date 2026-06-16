# Design-of-record — Account recovery + duplicate prevention (no SMS provider)

Status: DRAFT for Codex design consult (gate 1). Stack: React 19 + Vite (Vercel) + Supabase (Postgres + Auth + Edge Functions). Production, real users, additive-only.

## Gate 0 — source reconciliation
No upstream product docs exist. The "source" is the operator's stated requirements in-session (2026-06-16):
1. Students use **fake emails** → can't self-reset password → get locked out → **re-register** → duplicate profiles + orphaned originals (credits/payments stranded). [verified: 22 enrollment-less profiles; duplicate names `Purvi Shree Panda`, `Sriruchith` live]
2. Operator wants recovery **without a paid SMS provider**; "everyone uses WhatsApp in India."
3. Real emails are NOT required — email is just a login username today.

Verified facts driving the design (`schema-verified.md`, Supabase docs):
- `profiles` (RLS on): `id` uuid = auth.users.id, `role` text CHECK in (admin, student), `phone_number` text, `email` text, `full_name` text.
- **Automated phone/WhatsApp OTP REQUIRES a provider** — docs: WhatsApp is only a channel for Twilio/Twilio Verify. ⇒ rejected (cost/setup).
- `supabase.auth.admin.updateUserById(id, { password })` sets a password directly, no confirmation flow — **service-role only**, must run server-side. ⇒ the chosen mechanism.
- **Siblings legitimately share one `phone_number`** (this is the premise of the shipped combined-reminders feature). ⇒ phone is NOT a reliable duplicate signal.

## Scope (v1)

### A. Edge Function `admin-reset-password` (the core)
- **Purpose:** an admin resets a locked-out student's password; returns a temporary password the teacher delivers over their normal WhatsApp.
- **Auth model (must be airtight):**
  1. Require `Authorization: Bearer <caller JWT>`. Resolve caller via an anon-key client `auth.getUser(jwt)`; reject if absent/invalid (401).
  2. Look up caller's `profiles.role`; require `= 'admin'` (403 otherwise). Do NOT trust any client-sent role.
  3. Only then instantiate the **service-role** client (key from Edge Function secret `SERVICE_ROLE_KEY`, never shipped to browser).
- **Action:** validate `target_student_id` (uuid) belongs to a `role='student'` profile; generate a temp password (e.g. 10–12 chars, unambiguous charset); `admin.updateUserById(target_id, { password })`.
- **Return:** `{ ok: true, temp_password }` to the admin caller only.
- **Audit:** insert one row into a NEW additive table `admin_audit(id, actor_id, action, target_id, created_at)` — `action='password_reset'`. (Additive; RLS deny-all to clients, written by service role.)
- **CORS:** allow the app origin; handle preflight `OPTIONS`.

### B. Teacher UI — "Reset Password"
- In `TeacherDashboard` student profile modal (`viewingStudent`) + directory row: a **Reset Password** button → calls the Edge Function via `supabase.functions.invoke('admin-reset-password', { body: { target_student_id }})`.
- On success: show a small modal with the **temp password**, a **Copy** button, and **Send via WhatsApp** (wa.me to the student's number, message pre-filled: "Your login was reset. Temporary password: XXReset it in Settings after logging in.").
- Surface errors from `FunctionsHttpError.context` (status + body), not the generic message.

### C. Duplicate-prevention — registration nudge (NON-blocking)
- Because **siblings share phones**, a hard phone-based block creates false positives. v1 = **static, prominent messaging** on the Register page + at the email/phone step: *"Already enrolled? Don't create a new account — Log in, or ask your teacher to reset your password."* with a Login link.
- **Deferred (needs its own decision):** a server-side soft "this phone already has an account" hint via a `SECURITY DEFINER` RPC returning only a boolean (no PII), shown as a dismissible nudge (still non-blocking for siblings). Duplicate-merge tooling deferred entirely.

## Non-goals (v1)
- No switch to phone-as-login-identifier (would force SMS confirmation on existing users). Keep email/password; fake emails stay valid usernames.
- No automated OTP of any kind. No duplicate auto-merge.

## New deploy/setup surface (flag)
- This project has **no `supabase/` dir, no CLI, no shipped Edge Functions** — this is the FIRST Edge Function. Deploy path TBD: Supabase CLI (`supabase functions deploy`) or dashboard. Our MCP is `--read-only` so it cannot deploy.
- Requires setting Edge Function secret `SERVICE_ROLE_KEY` (+ project URL). Never in the repo/Vercel client env.

## Acceptance criteria (to be re-verified in-code at pre-ship)
- AC1: non-admin (student JWT) calling the function → 403, no password change, no service client instantiated on the reject path.
- AC2: missing/invalid JWT → 401.
- AC3: admin caller + valid student target → password changed; student can log in with the temp password; `admin_audit` row written.
- AC4: target that is not a `role='student'` (e.g. another admin, or nonexistent id) → rejected.
- AC5: service-role key never present in any client bundle or function response.
- AC6: temp password is high-entropy, single delivery; student can change it in Settings afterward.
- AC7: registration page shows the "log in / ask teacher" nudge; existing register flow still works with 1+ slot.

## Codex consult result (gate 1) — VERDICT: REVISE → folded

Codex reviewed against shipped code; verdict **REVISE** (2 BLOCKER, 3 MAJOR, 2 MINOR). All folded:

- **BLOCKER-1 (CONFIRMED LIVE VULN):** `profiles.role` is mutable by the owner → privilege escalation. Verified against prod RLS: UPDATE policy `"Unified Update Profile"` = `USING (auth.uid()=id OR is_teacher())`, **with_check NULL, no column restriction, no trigger guard** → a student can `update profiles set role='admin' where id=auth.uid()` and self-promote to admin. **This is a prerequisite to fix BEFORE the recovery feature** — otherwise the function's admin gate is meaningless. → see "PREREQUISITE" below.
- **BLOCKER-2:** Use `admin.generateLink({type:'recovery', email, options:{redirectTo:'<app>/reset-password'}})` and return the **recovery URL** (teacher WhatsApps the link), NOT a plaintext temp password. Link is scoped + time-limited, teacher never learns the password, and it lands in the EXISTING `ResetPassword.jsx` (PASSWORD_RECOVERY) flow. Plaintext password = fallback only. → revise Component A.
- **MAJOR-3:** Don't rely on RLS for the function's admin check — after JWT validation, use the **service-role** client to read `profiles` for actor id `role='admin'`, then verify target `role='student'`; no mutation before both pass.
- **MAJOR-4:** Audit records OUTCOME: `actor_id, target_id, action, success, error_code, created_at, request_id`; NEVER store the temp password / recovery token/link.
- **MAJOR-5:** Abuse controls — reject non-POST, strict UUID validation, rate-limit per admin + per target, normalized errors (don't leak existence), log failures.
- **MINOR-6:** Registration nudge stays non-blocking (sibling-shared phones). ✓ already aligned.
- **MINOR-7:** CORS on every response path incl. errors; preflight OPTIONS; service-role secret absent from client bundle (add as ACs).

### Revised Component A (post-Codex)
`admin-reset-password` Edge Function: validate JWT (`getUser`) → service-role read actor `role='admin'` (401/403 else) → validate `target_student_id` is uuid + `role='student'` → `admin.generateLink({type:'recovery'})` → return ONLY the recovery URL → write `admin_audit` outcome row. POST-only, CORS on all paths, rate-limited.

## PREREQUISITE workstream — live RLS hardening (do FIRST)

Two pre-existing prod vulnerabilities surfaced by the consult (independent of this feature, both live now):

1. **Privilege escalation (critical):** role-pin. Fix = additive **BEFORE UPDATE trigger** on `profiles` (per the field-immutability pattern: RLS WITH CHECK can't see OLD) raising if `role` or `id` changes from a non-service-role session. Robust regardless of grant structure. + negative test: student JWT `update ... set role='admin'` must fail.
2. **PII exposure:** `profiles` SELECT policy `USING (true)` to `public` exposes all 62 children's names/emails/phones to ANY anon caller. Tighten to `auth.uid()=id OR is_teacher()` — BUT verify no anon flow needs profile reads (Register inserts only; StudentDashboard reads own; TeacherDashboard runs as admin) before changing. Behavior-affecting → test on a Supabase branch first.

Both are prod writes → operator runs reviewed SQL (MCP is read-only). Sequence: hardening (1 then 2, tested) → then build the recovery feature.

## Open questions for Codex
1. Is the admin-verification chain (anon-client `getUser` → `profiles.role` check → only then service client) the right, minimal, non-bypassable shape? Any privilege-escalation hole?
2. Plaintext temp password returned to the teacher + sent over WhatsApp — acceptable risk for this context, or should we instead generate a one-time **recovery link** (`admin.generateLink({type:'recovery'})`) the teacher forwards? Trade-offs given fake emails (a recovery LINK doesn't need the email inbox — it's a URL — so it may be strictly better than a plaintext password). Evaluate.
3. Should the function take `target_student_id` (from the teacher's already-loaded roster) vs `phone` (ambiguous for siblings)? Lean id.
4. Audit table shape + RLS (deny-all to clients, service-role writes) — correct and sufficient?
5. Anything about Supabase Edge Function auth/CORS/secret handling we're getting wrong.
