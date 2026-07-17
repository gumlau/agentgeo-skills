# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-07-16

### Added

- **Eight GEO agent skills** built on AgentGEO raw answers:
  `geo-prompt-set`, `geo-visibility`, `geo-share-of-voice`, `geo-citations`,
  `geo-sentiment`, `geo-competitors`, `geo-monitor`, `geo-report`.
- **Zero-dependency MCP client** (`mcp/`) exposing one tool, `fetch_raw_answers`,
  across six AI surfaces (ChatGPT, Perplexity, Gemini, Google AI Overview,
  Google AI Mode, Copilot), with a REST fallback.
- `scripts/enable-skills.sh` to symlink the skills into `.claude/skills`
  (per-project or `--global`).
- README with architecture, skill-loop and sequence **mermaid** diagrams, in
  **six languages** (English, 简体中文, 日本語, 한국어, Español, Français).
- **Installation** and **Usage** guides under `docs/`.
- Project docs: `CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY`, issue/PR templates.

[Unreleased]: https://github.com/gumlau/agentgeo-skills/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/gumlau/agentgeo-skills/releases/tag/v0.1.0
