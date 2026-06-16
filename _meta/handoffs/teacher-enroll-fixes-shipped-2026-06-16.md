# Handoff — Teacher/enroll fixes batch (shipped 2026-06-16)

Shipped three additive, frontend-only fixes via **PR #1** (squash-merged to `main`, commit `17f3a8f`, auto-deployed by Vercel): single-slot enrollment, combined sibling reminders, and undo-attendance. Diagnosed the "Aaira not showing" bug (deleted enrollment → resolvable by self re-enroll). Two larger items (phone recovery, duplicate prevention) deferred pending a design decision.

## Resume next session

```
Continue music-class-manager outstanding tasks. Shipped (PR #1): single-slot, combined sibling reminders, undo attendance. Next: (1) decide phone-based account recovery approach (needs SMS-provider + cost decision) and duplicate-signup prevention; (2) confirm teacher operator-gate result from 2026-06-16; (3) flip Supabase "Secure email change" toggle so student email edits apply with fake emails. Read _meta/research/schema-verified.md (local, has the verified schema).
```

## Operator gate

**Status: `deferred (teacher unavailable until 2026-06-16): re-check date 2026-06-16`**

Teacher to verify on the LIVE site (changes are already in production):
- **Undo attendance (Task 1, credit-touching — verify first):** mark a student present → confirm balance −1 → click **Undo** → confirm balance returns +1 and button shows "Mark Present" again. Check the student's credit balance is correct after.
- **Combined reminders (Task 4):** open Reminders with at least one set of siblings sharing a phone number among the unpaid set → confirm they appear as ONE row ("Combined · 1 message to N siblings") and Send opens a single WhatsApp chat addressed to both names.
- **Single slot (Task 5):** register / "Enroll New Course" with just 1 day selected → confirm it submits (no "at least 2" block).

Record the result back here (`exercised 2026-06-16: <result>`) before this handoff is closed.

## What shipped (detail)

| Task | File(s) | Note |
|---|---|---|
| 5 — single slot | `Register.jsx`, `StudentDashboard.jsx` | min 2→1; max still 3 |
| 4 — combined reminders | `TeacherDashboard.jsx` | group unpaid by phone; one message lists all siblings |
| 1 — undo attendance | `TeacherDashboard.jsx` | `handleCancelAttendance`: deletes today's exact `Class Attended` ledger row by id (confirm dialog), refunds 1 credit |

## Task 6 — Aaira: RESOLVED (no code change)

Real paying Violin student whose enrollment row was deleted (after her last class 2026-04-24) → invisible to teacher while credits/payments persisted. **Fix = she self-re-enrolls** on her existing account (Log in → Enroll New Course → Violin → schedule → teacher approves); history is preserved because it's the same profile. Message text given to operator. Systemic: ~22 profiles have no enrollment (some real, some test accounts).

## Deferred — need a decision before building

1. **Phone-based account recovery.** Root-cause fix for fake-email lockout → duplicate signups. Requires an **SMS provider (Twilio/MessageBird) + ongoing cost**, and existing email/password users' phones aren't linked as auth identities. Touches LIVE auth — must not be auto-shipped. Decide: enable Supabase phone OTP vs. an admin-initiated reset flow (edge function + service role).
2. **Prevent duplicate signup.** Duplicates come from *different fake emails*, undetectable client-side (profiles RLS blocks logged-out reads). Needs a secure phone/email lookup RPC — coupled to (1).
3. **Tasks 2/3 (email/password in settings) already exist** in `StudentDashboard` Settings modal. Password change works. **Email change is blocked by Supabase's "Secure email change" confirmation** (fake emails never confirm). Action: in Supabase Dashboard → Authentication → Providers/Email, review "Secure email change" / email-confirmation settings. This is a dashboard toggle + behavior decision, NOT code.

## Notes / risks

- `_meta/research/schema-verified.md` is kept **local (uncommitted)** — it contains a student name + phone + UUID (PII); not pushed to GitHub.
- Pre-existing lint baseline is red (`react-hooks/immutability`, an unused `studentId`, `process` in `test_*.js`) — unrelated to these changes; separate cleanup if desired.
- Deploy model: push to `main` → Vercel prod (no staging). Rollback = `git revert` + push.
