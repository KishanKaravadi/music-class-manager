# music-class-manager — project conventions

Project-scoped rules. The cross-project layer lives in `~/.claude/CLAUDE.md`
(anti-patterns / patterns / gotchas / preferences). The memory layer is in
`~/.claude/projects/-home-kishan-dev-music-class-manager/memory/`.

> Stamped from `~/ai-workflow/templates/kernel/project-CLAUDE.md` by
> `setup-project.sh`. Adapt the domain-specific blocks (deploy / verify / operator
> gate) to THIS project's stack — keep the structure (cadence gates, handoff
> format, mandatory operator gate), rewrite the specifics.

---

## Handoff format — `## Operator gate` section is mandatory

Every workstream handoff at `_meta/handoffs/<phase-or-feature>-shipped-YYYY-MM-DD.md`
MUST include an `## Operator gate` section near the top (after the one-paragraph
summary, before the detailed body).

Status field is exactly one of:

- `exercised YYYY-MM-DD: <one-line result>` — the gate was actually run (real
  device / remote env / prod-like check) and the result is recorded.
- `deferred (<reason>): re-check date YYYY-MM-DD` — the gate cannot be exercised
  yet (dependency not shipped, device/env unavailable). Reason + hard re-check
  date both required.
- `pending` — initial state. **A workstream with `pending` status is NOT
  shipped.** Do not merge or close the handoff in this state.

A workstream is "shipped" only when status ≠ `pending`. The PR/commit that closes
the workstream cites the gate result. If `deferred`, the dependent workstream
inherits a follow-up entry to re-run it on the re-check date.

The per-workstream checklist lives in
[`_meta/operator-gates/TEMPLATE.md`](_meta/operator-gates/TEMPLATE.md). Copy/inline
it when writing the workstream brief. The cross-workstream smoke-test (separate
cadence) lives in [`_meta/operator-gates/smoke-test.md`](_meta/operator-gates/smoke-test.md).

## Handoff format — `## Resume next session` section is mandatory

Every shipped-handoff includes a code-fenced one-line paste-ready prompt the user
copies into the next session, placed near the top (between title and `## Operator
gate`). If a pre-resumption step is required (PR merge, deploy), call it out
alongside. Surface the prompt in chat at session-end too. The Resume prompt is
FUTURE-only: re-sync title + summary + prompt + roadmap at end of session so it
never tells the next session to redo finished work.

---

## Workstream cadence — kernel gates mandatory

Every workstream (any new functionality, Tier 2+) runs these gates in order.
Skipping any is a deviation that must be called out explicitly in the handoff.

0. **Source reconciliation (pre-Codex-consult). MANDATORY if the project has
   upstream source/spec docs.** Locate the feature's ORIGINAL source docs (not a
   distilled summary) and enumerate EVERY behavioral claim. The design-of-record
   must account for each: *carried* / *deferred (reason)* / *N-A*. The inception
   distillation is lossy and no other gate back-checks it — only the operator
   (product owner) catches a dropped requirement otherwise.
1. **Codex consult** (pre-impl design lock). Multi-pass until GO. Invoke via the
   `codex:codex-rescue` agent / `codex exec`. Design-correctness lens.
2. **`/kernel:tearitapart`** (pre-impl PROCEED gate). Mandatory for high-risk /
   Tier 1; optional for Tier 2. Operator / runtime / testing / architecture lens —
   catches what the Codex design lens structurally cannot.
3. **Implementation** with per-step **`/kernel:validate`** (build / types / lint /
   tests / security scan) before each commit.
4. **`kernel:pre-ship`** (post-impl, pre-merge composite). REQUIRED. Spawn via the
   Agent tool with `subagent_type=kernel:pre-ship` — adversary + reviewer +
   validator + security-scan in parallel. Verdict gates the merge.
5. **Operator gate** exercise per `_meta/operator-gates/TEMPLATE.md`. Status must
   reach `exercised …` or `deferred …` before "shipped".
6. **`/kernel:retrospective`** (end-of-session). REQUIRED. Cross-session pattern
   synthesis; promotes durable learnings to `~/.claude/CLAUDE.md`.

Codex (design-correctness), the kernel agents (structural / security / validation),
and tearitapart (operator / runtime) are NOT substitutes — they catch different bug
classes. Run all three on every workstream.

**Skill vs agent distinction:** `kernel:validate`, `kernel:review`,
`kernel:retrospective`, `kernel:tearitapart` are skills (invoke via `/<name>`).
`kernel:adversary`, `kernel:reviewer`, `kernel:validator`, `kernel:pre-ship` are
agents (spawn via the Agent tool with `subagent_type`).

---

## Related discipline docs

- [`_meta/operator-gates/TEMPLATE.md`](_meta/operator-gates/TEMPLATE.md) —
  per-workstream operator gate checklist.
- [`_meta/operator-gates/smoke-test.md`](_meta/operator-gates/smoke-test.md) —
  recurring cross-surface smoke-test.
- [`_meta/operator-gates/runs/`](_meta/operator-gates/runs/) — run log, one file
  per run.
