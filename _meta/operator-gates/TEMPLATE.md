# Operator gate — `<workstream-id>` (`<short-name>`)

Per-workstream operator gate. **Copy this file** into the surgeon brief or the
workstream's shipped-handoff section when starting work. Fill in the relevant
blocks; delete the ones that don't apply. A workstream is NOT "shipped" until every
applicable block is `[x]` with a date + result note.

> Stack-agnostic template stamped by `setup-project.sh`. Replace the example blocks
> (data layer / external surface / client / scheduled jobs) with the real surfaces
> of THIS project. See [`smoke-test.md`](smoke-test.md) for the cross-workstream
> walkthrough.

---

## Header

- **Workstream:** `<id>` — `<short-name>`
- **Date exercised:** `YYYY-MM-DD`
- **Operator:** `<name>`
- **Environment:** `<device / remote env / staging / prod-like>`

---

## A. Data layer — schema / migration / queries

Skip if the workstream touched no persistence layer.

- [ ] Migrations / schema changes applied cleanly to a fresh state AND the live
      target — capture the run timestamp.
- [ ] Test suite passes against both fresh and applied state.
- [ ] Authorization spot-check: for any new access rule, exercise BOTH the
      allow-path AND the deny-path (a policy/permission that fails open or silent
      is the classic miss).

**Result notes:**
```
<command output, test summary>
```

---

## B. External surface — API / function / service

Skip if no externally-callable surface changed.

- [ ] Deployed; version/build captured from the deploy output.
- [ ] Any new config/secret present in the target environment.
- [ ] One happy-path call exercised end-to-end with REAL caller credentials (not
      an admin/root bypass — exercise the actual auth path).
- [ ] Each error path probed at least once (bad auth, malformed input,
      business-rule rejection); response shape matches the contract.
- [ ] Logs reviewed for the probe window — no unexpected errors, no stale debug
      output left in.

**Result notes:**
```
<version, probe outputs, log excerpt>
```

---

## C. Client / UI

Skip if no user-visible surface changed.

- [ ] Built and launched in a realistic environment (not just unit harness).
- [ ] Each new screen/flow reached via the intended entry point — NOT a hardcoded
      shortcut. Test the route the user actually takes.
- [ ] Primary happy path completes end-to-end.
- [ ] Back/cancel navigation works; no orphaned spinner or stuck state on an
      in-flight request.
- [ ] At least one explicit failure path tested (offline, stale session,
      race-tap). Error surface renders the expected copy.
- [ ] Permission/role gate (if gated): test on an account WITHOUT the privilege;
      confirm the gated action is invisible/disabled.

**Result notes:**
```
<environment, paths, screenshots if helpful>
```

---

## D. Scheduled / background jobs

Skip if no scheduled job was added or changed.

- [ ] Job is registered and active (one row, enabled).
- [ ] Any required secret/config present.
- [ ] After the first run window (or a manual trigger): telemetry/audit shows the
      expected tick row. A job that produces no telemetry is an invisible failure.
- [ ] Template placeholders substituted before applying; superseded/duplicate jobs
      removed to avoid double-fires.

**Result notes:**
```
<job id, first run at, telemetry sanity>
```

---

## E. Smoke-test cross-check

After every shipped workstream touching a shared backend/service/job surface, the
next [`smoke-test.md`](smoke-test.md) run MUST be exercised within 24h OR before the
next merge — whichever comes first. This is the cross-surface drift catcher.

- [ ] Smoke-test scheduled (date: `YYYY-MM-DD`) OR exercised this session.

---

## Final status

Pick exactly one. This is the status the handoff `## Operator gate` section quotes:

- [ ] `exercised YYYY-MM-DD: <one-line result summary>`
- [ ] `deferred (<reason>): re-check date <YYYY-MM-DD>`
- [ ] `pending` ← **do not commit the shipped-handoff with this status**
