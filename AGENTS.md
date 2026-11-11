# Carnelian Academy repository instructions

## Scope and architecture

- Work only inside this repository and on the requested milestone/task. Stop at its review boundary; do not start the next task automatically.
- Follow the approved architecture in `docs/architecture.md`, decisions in `docs/decisions.md`, the applicable `docs/milestones/` document, and the owner's approved task requirements. Do not treat proposed future work as approved scope. Explain conflicts before overwriting existing instructions or changing architecture.
- Stack: ASP.NET Core Web API / C# / .NET 8; React / Vite / TypeScript; SQL Server Express / EF Core; REST/JSON and OpenAPI. This is a local-first, milestone-driven application. Implement stack components only when the requested task authorizes them.
- Do not invent or implement unapproved enrollment, billing, collections, or other business rules.

## Security and data

- Keep student and payment information confidential. Do not copy real records into code, tests, fixtures, documentation, logs, review reports, or external services. Use synthetic data and redact sensitive evidence.
- Never hard-code credentials, passwords, tokens, connection secrets, or API keys. Use approved local secret/configuration mechanisms and exclude secrets from Git.
- Follow secure development practices, including OWASP ASVS Level 2 where applicable. Review relevant validation, access control, least privilege, injection prevention, sensitive logging, error disclosure, and secure transport requirements. Do not claim ASVS compliance without evidence or add out-of-scope security features automatically.
- Use EF Core migrations for database schema changes. Do not apply migrations or change production data without explicit authorization and target verification.
- Preserve the approved REST/JSON and OpenAPI contract. Explain contract changes and obtain approval rather than silently breaking callers.

## Repository safety

- Inspect the current branch and Git status before work. If on `main`, stop and ask the owner to switch to `feature/m01-foundation`; never switch branches automatically.
- Preserve pre-existing tracked, staged, and untracked changes. Do not overwrite unrelated files.
- Never commit, push, merge, or delete files without explicit owner authorization. The owner performs Git commits and merges manually. Do not stage changes or reset/clean the working tree as part of a review.
- Do not install software or dependencies without task authorization.

## Developer and reviewer responsibilities

- Developer: implement only authorized changes, add appropriate automated tests, run relevant checks, and update documentation. Milestone completion requires automated testing and current documentation; a single completed task does not complete its milestone.
- Reviewer: use `.agents/skills/carnelian-code-guardian/SKILL.md` for requested Carnelian code reviews. Inspect changes and report evidence; do not modify application code or automatically fix findings.
- Keep development and review separate. Use a separate reviewer session/person from the author for independent review. An author's self-check is not independent approval; never approve your own work.
- Review recommendations are advisory. Even PASS requires the owner's manual approval before any Git commit or merge.

See `docs/code-review-process.md` for invocation, findings, verdicts, and re-review.
