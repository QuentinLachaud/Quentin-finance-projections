# BTL Portfolio: Chat-to-GitHub delivery

**2026-10-10 BST — GitHub-native production handoff (active)**

BTL Portfolio uses the connected GitHub integration directly from normal ChatGPT Chat.
The Google Drive/Mac Python queue is **disabled for this repository only**.
The canonical repository identity is `btl_portfolio` in
`My Drive/BrainDrain/App & Repository Instructions/_System/brain_drain_config.json`.

In that JSON, `repositories.btl_portfolio.enabled = false` means **disabled for
the local Python runner**, not disabled for GitHub delivery. The same repository
entry declares `delivery.mode = chat-to-github-pull-request`.
The authoritative human-readable cross-repository contract is
`My Drive/BrainDrain/ChatGPT Operating Instructions`.

## Chat → PR → website

1. **Capture/authorisation.** A concrete request to implement a BTL Portfolio
   change (including “Brain Drain task”) authorises a code change and a PR;
   an exploratory thought alone authorises capture only. Work in normal ChatGPT
   Chat with the GitHub connector, not the Mac listener or Work mode.
2. **Scope.** Read current `main`, relevant source/tests, existing PRs and the
   delivery contract. Do not guess repository paths or overwrite unrelated work.
   Use one coherent branch `braindrain/<task>` per feature.
3. **Implement.** Make production-quality code and regression tests on that
   feature branch; account for Supabase RLS/storage/schema migrations,
   Cloudflare Pages Functions and secrets when applicable.
4. **Validate.** Open a PR against `main`. GitHub Actions
   `.github/workflows/ci.yml` runs `npm ci --no-audit --no-fund`,
   `npm test` and `npm run build` as the `validate-btl-portfolio` job.
   Inspect both the GitHub Actions run and commit status; investigate and fix
   failures on the same PR while the chat turn is active.
5. **Approval.** Leave the PR unmerged by default and report the link, scope,
   tests and any remaining deployment/migration steps. Merge only after
   explicit user approval for that PR; enable auto-merge only if explicitly
   authorised and the `main` protection rules are verified. Never push
   directly to `main`.
6. **Deploy.** A successful merge into `main` is expected to trigger the
   connected Cloudflare Pages production build. Verify its final status and
   the live site separately. A green GitHub CI run or a merged PR alone does
   **not** prove production deployment succeeded.
7. **Report.** Distinguish branch created, PR opened, tests passed, merged,
   deployment complete and any manual database/secret migration required.

## Failures and safety

- Failed, pending or cancelled required checks block merge.
- Do not weaken tests or suppress build errors to obtain a green CI check.
- Supabase SQL migrations and Cloudflare settings may require a separate
  authorised operational step; code rollback does not undo database changes.
- High-risk/destructive changes need exact-target confirmation before
  irreversible actions, independently of PR approval.
- An interrupted/finished ChatGPT turn does not run an autonomous repair
  agent. On a later turn use a request such as “fix the failing PR”.
- Do not claim verified branch protection, Cloudflare settings or live release
  unless those were actually checked.

## One-time external verification (repo / Cloudflare owner)

1. GitHub → Settings → Rules → Rulesets: an active `main` branch ruleset
   should require a PR and passing `validate-btl-portfolio`; disallow force
   pushes, deletion and bypass. In a single-owner repository, avoid an
   impossible separate-reviewer requirement.
2. GitHub → Actions: verify the BTL Portfolio CI workflow is enabled, allowed
   to run on PRs, and that a real PR runs its `validate-btl-portfolio` job.
3. Cloudflare Pages → Builds & deployments: verify the Git integration points
   to `QuentinLachaud/Quentin-finance-projections`, production branch is
   `main`, and preview branches are not treated as production.
4. Cloudflare Pages → Custom domains: verify `btlportfolio.co.uk` points to
   the intended Pages project. Confirm a merged, passing change deploys and
   appears on the live site. Check migrations/secrets separately.

## Cutover and boundaries

- The former BTL Portfolio `Queued` folder is renamed
  `Queued — DISABLED — GitHub-only`; its `History` is preserved.
  **Never create or queue a Python task** for BTL Portfolio and never use
  `brain_drain_runtime.py` to change that repository.
- `brain_drain_runtime.py` uses the `enabled` flag to fail closed for
  disabled local-runner repositories. Keep it unchanged.
- TakeHomeCalc, Casa and Spreadem remain on their existing Google Drive
  `Queued/.processing/History` and Mac Python listener workflow. Do not
  disable their runner or alter their configuration as part of BTL work.
- The Google Drive operating-instructions document is not automatically
  included in arbitrary new chats. Keep matching rules in the BrainDrain
  ChatGPT Project Instructions for dependable routing across turns.
