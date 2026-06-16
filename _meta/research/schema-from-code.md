# Supabase schema (deduced from client code) + task analysis

> Gate-0 artifact. Derived by reading `src/` only — **NOT yet verified against the live DB**.
> No migration files / `supabase/` dir exist in the repo; the DB is the sole source of truth.
> Verify every column/policy/trigger claim here against the live project (read-only) before building.

## Tables referenced by the client

| Table | Columns seen in code | Notes |
|---|---|---|
| `profiles` | `id` (=auth.users.id), `full_name`, `email`, `phone_number`, `age`, `role` (`admin`/`student`) | `email` is duplicated from auth.users at signup; separate value |
| `enrollments` | `id`, `student_id`→profiles, `course_id`→courses, `status` (`pending`/`active`), `preferred_days` (text[] like `"Monday 17:00"`), `preferred_time` (legacy, null), `joining_date`, `demo_agreed` | roster = status='active' |
| `courses` | `id` (int: 1 Piano,2 Violin,3 Vocal,4 Guitar,5 Veena,6 Keyboard-W,7 Keyboard-C), `name` | Western ids = [1,4,6]; only embedded, never written by client |
| `payments` | `id`, `student_id`, `month_for` (e.g. "March 2026"), `amount`, `proof_url`, `status` (`pending`/`approved`) | approving triggers credit assignment (DB-side) |
| `credit_ledger` | `id`, `student_id`, `amount` (+credits / -1 per class), `reason` (text e.g. "Class Attended: Piano"), `created_at` | append-only ledger; attendance = insert amount -1 |
| `student_balances` | `student_id`, `balance` | **likely a VIEW or trigger-maintained sum of credit_ledger — VERIFY** |

**Server-side (unknown, must verify read-only):** RLS policies, triggers (payment→credits "assigned by the database" per TeacherDashboard.jsx:138), any Postgres functions / edge functions. None visible in repo.

## Task analysis (6 outstanding)

1. **Cancel "mark present"** — `handleMarkAttendance` (TeacherDashboard.jsx:251) inserts credit_ledger `amount:-1`; button then disabled. Need an undo. SAFE approach TBD by schema: delete the just-created row vs insert compensating `+1` (preferred if balances are trigger-driven / ledger is append-only). Touches live credit system → careful.
2. **Change email in settings** — fake emails in use. `supabase.auth.updateUser({email})` exists as API. GOTCHA: Supabase email-change sends a confirmation link to old+new email by default ("Secure email change") → fake email never confirms → change won't apply. Must check Auth settings; also must update BOTH `auth.users.email` AND `profiles.email`. No settings screen exists yet.
3. **Change password in settings** — `updateUser({password})` works while logged in, no email dependency (already used in ResetPassword.jsx:34). Just need a logged-in settings UI. Forgot-password flow exists but is useless with fake emails.
4. **Combined WhatsApp reminders** — siblings share one `phone_number` (different `student_id`). `handleBulkReminders`/`handleSendReminder` (TeacherDashboard.jsx:274-287) dedupe by `student_id` only → two wa.me messages to one number. Fix: group targets by `phone_number`, send ONE message listing all siblings. Frontend-only.
5. **Allow 1 slot (not min 2-3)** — `Register.jsx:146`: `if (currentSchedule.length < 2) return alert("...at least 2 class slots.")`. Change min to 1. Max stays 3 (Register.jsx:131, TeacherDashboard caps at 3). Lowest-risk, frontend-only, 1 line.
6. **Aaira not showing for "mark present"** — Today's Classes = `activeRoster.filter(s => s.preferred_days.some(d => d.includes(todayName)))` where roster = enrollments status='active' joined to profiles/courses. Leading hypotheses (data, not code): (H1) her enrollment.status ≠ 'active' (stuck 'pending'); (H2) her `preferred_days` doesn't include today's weekday / is malformed/empty. Confirm with ONE read-only query:
   ```sql
   select e.id, e.status, e.preferred_days, e.course_id, p.full_name, c.name
   from enrollments e
   left join profiles p on p.id = e.student_id
   left join courses c on c.id = e.course_id
   where p.full_name ilike '%aaira%';
   ```
   (Null `preferred_days` or null `courses` would crash the WHOLE list for everyone, not just her — so symptom points to H1/H2.)
