# ECC for Codex CLI

This supplements the root `AGENTS.md` with a repo-local ECC baseline.

## Repo Skill

- Repo-generated Codex skill: `.agents/skills/ston3gpt/SKILL.md`
- Claude-facing companion skill: `.claude/skills/ston3gpt/SKILL.md`
- Keep user-specific credentials and private MCPs in `~/.codex/config.toml`, not in this repo.

## MCP Baseline

Treat `.codex/config.toml` as the default ECC-safe baseline for work in this repository.
The baseline enables only pinned Context7 and Playwright MCP packages. Add authenticated GitHub,
memory, search, or other external integrations in user-specific configuration when a task requires
them; do not commit credentials or broad external access to this repository.

## Multi-Agent Support

- Explorer: read-only evidence gathering
- Reviewer: correctness, security, and regression review
- Docs researcher: API and release-note verification

## Workflow Files

- Use npm workspace commands from the StoneOS skill for builds and tests.
- Use an isolated PostgreSQL schema for destructive integration tests.
- Run production audits and Docker configuration checks for release-facing changes.
