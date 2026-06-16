# What changed & what to test — Music Class Manager (16 June 2026)

A plain-language summary for the teacher. Everything below is **already live** on the website.

---

## What's new (and why)

1. **Undo a "Mark Present" mistake.** If you tap *Mark Present* by accident, a small red
   **Undo** now appears next to the green "Present ✓". Tapping it removes that class and gives
   the student their credit back. (Works in both the Today's Classes list and the student popup.)

2. **One reminder for siblings.** When several kids share the same WhatsApp number, the
   Reminders screen now shows them as a **single combined entry** ("1 message to N siblings") and
   sends **one** WhatsApp message addressed to all of them — instead of the same message twice.

3. **Join with just one class a week.** New students (and existing ones adding a course) can now
   pick **just 1 day** instead of being forced to pick at least 2.

4. **Reset a student's password for them.** Many families signed up with fake email addresses,
   so they can't use the normal "forgot password" email. Now, open a student's popup (or use the
   key icon in the directory) and tap **Reset Password** — you'll get a secure one-time link with a
   **Send via WhatsApp** button. The student opens the link, sets their own new password, and logs
   in. You never see or type their password.

5. **A note at sign-up** now reminds new visitors: *"Already enrolled? Don't make a second
   account — log in instead."* This should reduce duplicate accounts.

6. **Two security fixes (behind the scenes).** (a) Students can no longer accidentally/maliciously
   turn themselves into teachers. (b) Student names/phones/emails are no longer readable by the
   public — only by you and the student themselves.

### About "Aaira" (the student who disappeared)
Her enrollment row had been deleted at some point, which made her vanish from your dashboard even
though her payments and class history were all still saved. **Fix:** ask her family to **log into
their existing account** (not make a new one) → **Enroll New Course → Violin →** pick the day/time →
you approve it. All her history comes back because it's the same account.

---

## What to test (5 quick checks)

Please try these on the live site and tell Kishan if anything looks off.

- [ ] **Undo attendance:** Mark a student present → note their credit dropped by 1 → tap **Undo**
      → the credit comes back and the button says "Mark Present" again.
- [ ] **Combined reminders:** Open **Reminders**. If two siblings share a number, they should
      appear as one "Combined" row, and **Send** opens one WhatsApp chat naming both kids.
- [ ] **One-day enrollment:** Have a student (or test account) enroll choosing only **1 day** — it
      should go through (no "pick at least 2" message).
- [ ] **Reset Password:** Open a student → **Reset Password** → **Send via WhatsApp** to yourself →
      open that link → set a new password → log in with it. (Then check it worked.)
- [ ] **Sanity check:** Log in as **yourself** — you should still see every student. Log in as a
      **student** — they should see only their own dashboard.

If a reset link ever says it's expired, just generate a new one — they're one-time and time-limited
on purpose.
