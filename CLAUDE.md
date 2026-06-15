# SportsFacts — Claude Code Instructions

## Git workflow

**Always use feature branches + PRs for OpenSpec changes. Never commit directly to `main`.**

For every `/opsx:apply` (or any OpenSpec feature implementation):
1. Create a feature branch before making any changes: `git checkout -b feat/<change-name>`
2. Implement and commit on the branch as normal
3. Push the branch and open a PR to `main` via `gh pr create`
4. Do NOT push to `main` directly — the user reviews and merges via GitHub

Branch naming: `feat/<change-name>` (e.g. `feat/kafka-streaming-swap`).
