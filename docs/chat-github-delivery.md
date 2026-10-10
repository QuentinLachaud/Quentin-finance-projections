# BTL Portfolio: Chat-to-GitHub delivery

**2026-10-09 14:39 BST — GitHub-native CI pilot**

This repository is the first Brain Drain application migrated from Google Drive
Python-task handoff to direct ChatGPT/GitHub changes. This file documents the
repository-specific policy; cross-repository routing remains authoritative in
Brain Drain's `ChatGPT Operating Instructions` and `_System` configuration
until the system-level cutover is explicitly completed.

## Required delivery path

1. From normal ChatGPT chat, inspect this repository's latest `main`, relevant
   files and tests. Implement changes on a new `braindrain/<task>` branch.
2. Open a pull request targeting `main`, describing scope, tests and risks.
3. The `BTL Portfolio CI` workflow must pass:
   `npm ci --no-audit --no-fund`, `npm test`, and `npm run build`.
4. Merge only with GitHub's protection of `main` enforcing the
   `validate-btl-portfolio` check, the pull-request requirement and no bypass.
   Auto-merge is optional; enable it only *after* protections are confirmed.
5. Cloudflare production deployments should be triggered only by merges to
   `main`, not by changes on feature branches. Cloudflare preview deployments
   on PRs are permitted but do not constitute production verification.
6. Inspect deployment results before reporting successful release.

## Failure policy

- A failed/pending/cancelled CI check must prevent the PR from merging.
- Inspect the failed GitHub Actions job/step logs. While a chat turn is active,
  ChatGPT may diagnose, update the same feature branch and recheck. A completed
  chat cannot automatically restart to repair failures without a separate AI
  service; request `fix the failing PR` for a later repair turn.
- Never silence failures by removing assertions, skipping tests or suppressing
  type/build errors without explaining and justifying the change.
- A successful build does not validate authenticated user flows, Supabase
  migrations, Stripe, server-side secrets or live Cloudflare configuration.
  Handle these separately when a task affects them.
- If release breaks production, stop further merges and revert the responsible
  commit via a new, reviewed change. Data migrations need their own forward-fix
  or backup/restore strategy; code rollback is not a database rollback.

## One-time GitHub configuration (manual administrator action)

1. Repository Settings → Rules → Rulesets → New branch ruleset targeting
   branch `main`. Enable the ruleset in Active mode.
2. Require a pull request before merging. Do **not** require a separate
   approver/review for a single-owner repository unless one is available.
3. Require status checks to pass. Choose `validate-btl-portfolio` after the
   first workflow run completes. Require the branch to be up to date before
   merging where practical.
4. Disallow force pushes and branch deletions, and enable no bypass of the
   rules (including repository admins). Confirm that the ruleset is active.
5. Repository Settings → General → Pull Requests → Allow auto-merge, if desired.
   Enable auto-merge per PR only *after* the ruleset is operating correctly.
6. Confirm Cloudflare Pages → project → Settings / Builds & deployments uses
   this GitHub repository with production branch `main`, and that production
   build/deploy results are healthy.

## Migration safety

- Do not disable the existing Mac listener or mutate Brain Drain's
  `brain_drain_config.json`/`brain_drain_runtime.py` merely because this
  repository has CI; the current Google Drive task protocol is still active
  until its authoritative routing instructions are updated.
- Avoid concurrent local-listener tasks and ChatGPT GitHub PRs modifying the
  same repository during cutover. Finish/verify queued and processing tasks
  before switching this repository.
- Preserve existing `Queued/` and `History/` as archival records.
- Continue using the old path for repositories not yet migrated.
