# Deploy runbook — Admin password-recovery + RLS hardening

All steps are **operator-run** (MCP is read-only; production must not be auto-modified).
Do them in order. Nothing here auto-deploys. Branch: `feature/security/auth-recovery` (PR #2, draft).

## 0. Prereqs
- Supabase CLI: `npm i -g supabase` (or `npx supabase`). `supabase login`, then
  `supabase link --project-ref <PROJECT_REF>`.
- You can run the migration SQL either via `supabase db push` OR by pasting each file into
  the Supabase Dashboard → SQL Editor (simplest, no CLI link needed).

## 1. Apply the critical fix first (zero behavior change) — role/id pin
Run `supabase/migrations/20260616000000_profiles_role_pin.sql`.
**Verify (negative test):** as a logged-in STUDENT (anon-key client, their JWT), run
`update profiles set role='admin' where id = auth.uid()` → must FAIL
("profiles.role is immutable from client sessions"). A normal Settings save (name/phone/email)
must still SUCCEED.

## 2. Apply the audit table
Run `supabase/migrations/20260616000200_admin_audit.sql`. No behavior change.

## 3. Apply the PII fix (behavior-affecting — test first)
**Best:** create a Supabase **branch** (or use staging), apply
`20260616000100_profiles_select_restrict.sql`, and confirm: login works, student sees own
dashboard, teacher sees full roster, registration works. Then apply to prod.
**Verify:** with NO session (anon key only), `select * from profiles` → returns **0 rows**.
Logged-in student → sees only their own row. Teacher → sees all.

## 4. Deploy the Edge Function
```
supabase functions deploy admin-reset-password
supabase secrets set APP_URL=https://keytonemusicacademy.in
```
- Keep `verify_jwt` ENABLED (default) — the function also does its own admin check.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.
- **Verify:**
  - As a STUDENT JWT, invoke with any body → **403** (`forbidden`), no password change.
  - No JWT → **401**.
  - As the TEACHER (admin) with a real `target_student_id` → returns `{ ok, recovery_link }`;
    open the link → lands on `/reset-password` → set a new password → log in. Check an
    `admin_audit` row was written (`success=true`).

## 5. Ship the frontend
Only after steps 1–4 pass: mark PR #2 **Ready for review** and merge to `main`
(Vercel auto-deploys). The teacher "Reset Password" button + registration nudge go live.

## Rollback
- Frontend: `git revert <merge sha> && git push`.
- SELECT policy: re-create the old permissive policy if a read breaks
  (`create policy "Public profiles are viewable by everyone" on public.profiles for select to public using (true);`) — but prefer fixing forward; the old policy is the PII leak.
- Trigger/audit: additive; drop the trigger/table if ever needed (`drop trigger ... ; drop table ...`).

## Operator gate
Status: `pending` until steps 1–5 verified. Record results here + in the shipped-handoff
before closing.
