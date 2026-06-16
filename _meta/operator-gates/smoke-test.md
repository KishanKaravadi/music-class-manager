# Cross-surface smoke-test

Recurring end-to-end walkthrough that catches DRIFT between surfaces (the bug class
where each workstream passed its own gate but two surfaces disagree). Run cadence:
≤3 days during active development, AND within 24h of any merge touching a shared
backend/service/job surface.

> Stack-agnostic template stamped by `setup-project.sh`. Replace the steps below
> with THIS project's real critical-path flows. Each run gets its own file in
> [`runs/`](runs/) named `YYYY-MM-DD-<short-label>.md`.

---

## How to run

1. Copy this file's checklist into a new `runs/YYYY-MM-DD-<label>.md`.
2. Walk each step on a realistic environment, one at a time. Record PASS/FAIL + a
   one-line note as you go (do not batch — write results live).
3. Any FAIL → open a tracked follow-up before the next merge.
4. Record the final result line at the bottom of the run file.

---

## Critical-path flows

Replace with the project's real flows. Examples of the SHAPE:

- [ ] **Cold start / onboarding** — fresh install/clone → first-run path completes,
      no crash, no stuck state.
- [ ] **Primary create flow** — the core "make a thing" path persists and reads
      back correctly across a reload.
- [ ] **Primary read/sync flow** — data written by one surface is visible to
      another surface (the drift catcher).
- [ ] **Auth / permission boundary** — a non-privileged actor cannot reach a gated
      action; a privileged one can.
- [ ] **Failure handling** — an induced failure (offline, bad input) surfaces the
      expected error, recovers cleanly.
- [ ] **Background/scheduled effect** — a job-driven side effect appears in
      telemetry/audit within its window.

---

## Final result

```
smoke-test YYYY-MM-DD: <PASS / N issues found — refs> on <environment>
```
