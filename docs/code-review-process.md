# Carnelian code review process

## Invoke Code Guardian

Open this repository in Codex from VS Code. Use a separate reviewer session from the implementation session. In Codex CLI or the IDE extension, type `$` and select `carnelian-code-guardian`, or use `/skills`. Send this prompt:

```text
$carnelian-code-guardian Review M01-T01 against docs/milestones/M01.md and its approved acceptance criteria. Review staged, unstaged, and untracked changes against HEAD. Do not change application code. Report findings, commands, test results, limitations, and a final recommendation.
```

Codex discovers repository skills under `.agents/skills`. If the new skill does not appear, restart Codex. As a fallback, explicitly ask Codex to read and follow `.agents/skills/carnelian-code-guardian/SKILL.md` for this review. Discovery and invocation are documented in the [official OpenAI skill guide](https://learn.chatgpt.com/docs/build-skills).

The skill is an instruction-based workflow, not an enforced filesystem sandbox or an autonomous background service. Use read-only execution permissions where available. It needs no additional software or dependency installation.

## Review a milestone or task

1. Identify the requested task, approved acceptance criteria, current branch, HEAD commit, and comparison scope. On `main`, stop and ask the owner to switch to `feature/m01-foundation`. Never switch automatically.
2. Read `AGENTS.md`, applicable nested instructions, architecture, decisions, and milestone documentation. The current foundation defers persistence, frontend, and business modules; do not expand the review into implementation of those components.
3. Review staged, unstaged, and relevant untracked files against HEAD by default. Untracked files must be read separately. For a branch/commit comparison, specify the exact baseline or range in the request; do not assume every file in a milestone is an uncommitted change.
4. Inspect surrounding code and contracts, tests, security/data handling, migrations when present, and documentation. Do not apply migrations or run destructive/data-changing commands.
5. Inspect tests and scripts before running them. Run available checks only when safe and prerequisites exist; disclose temporary build/cache/test artifacts. Do not install missing dependencies automatically. Record all commands and classify tests as passed, failed, or not run with reasons. Historical results do not prove the current tree passes.
6. Report severity, evidence, limitations, and recommendation. Review completion is not milestone completion. The owner determines milestone acceptance after tests, documentation, and independent review are complete.

For each finding, include an ID, severity, Confirmed defect/Possible risk category, file path and line number, explanation, trigger/evidence, impact, and recommended fix. Include the validation needed to resolve a possible risk. Redact confidential data. When no confirmed defects are found, say so without claiming defect-free software.

## Severity

| Level | Meaning |
| --- | --- |
| Critical | Evidenced exposure of confidential data/secrets, broadly exploitable compromise, or catastrophic/irreversible data loss. Immediate remediation required. |
| High | Serious correctness/security defect, unauthorized access, payment/data-integrity damage, or core behavior unusable under a credible trigger. Must fix before acceptance. |
| Medium | Material validation, regression, maintainability, test, or documentation gap with bounded impact. Fix or obtain documented owner disposition with rationale and follow-up. |
| Low | Minor clarity, consistency, or limited-impact improvement. May be deferred explicitly. |

Severity measures impact; confidence measures evidence. A possible risk is not a confirmed vulnerability. A credible unresolved risk of Critical/High impact requires investigation before acceptance.

## Recommendations

| Result | Criteria |
| --- | --- |
| PASS | Requested scope fully reviewed; no unresolved confirmed defects or material risks; acceptance criteria, required automated checks, and documentation satisfied. No required test verification missing. Independent reviewer only. |
| PASS WITH WARNINGS | No Critical/High defects or unresolved risks of that impact; only nonblocking gaps, explicitly accepted Medium findings, Low findings, or disclosed optional-check limitations remain. Required checks pass. State all warnings and owner decisions needed. |
| BLOCK | Critical/High defect or credible unresolved risk of that impact; unmet acceptance criterion; required checks failed or not run; material scope/evidence missing; unaccepted Medium finding; or independent approval unavailable because reviewer authored the changes. Explain whether the block is a defect or verification/independence gap. |

A successful test run does not override security or integrity findings. Do not invent a clean PASS merely because nothing obvious was found. A self-check is useful developer verification but cannot replace independent review or approve its author's work.

## Resolve findings and request a second review

The developer, in a separate implementation task/session, addresses each finding by ID, adds a regression test where appropriate, updates documentation/migrations if needed, and reruns relevant checks. The reviewer does not implement fixes. Disagreements and deferrals need evidence and owner disposition; Critical/High blockers must be resolved and re-reviewed rather than silently waived.

Request a second independent review:

```text
$carnelian-code-guardian Re-review M01-T01 after fixes for findings CG-001 and CG-002. Review the current changes against HEAD, verify each finding's resolution and relevant regression checks, and inspect the fixes for new issues. Do not change application code. Report unresolved findings and a new recommendation.
```

Provide the prior report and any owner dispositions. If changes have since been committed manually, supply the relevant commit range so resolved code is still covered. The second review records each prior finding as resolved, unresolved, or deferred by the owner, with evidence. Findings are not closed solely on the developer's assertion.

## Manual Git approval

PASS and PASS WITH WARNINGS are recommendations, never authorization to commit, push, or merge. The repository owner reviews the report, dispositions, tests, and final diff, then explicitly approves and performs Git commits/merges manually. Code Guardian never stages, commits, pushes, merges, deletes files, or switches branches. Stop after reporting; do not start the next task.
