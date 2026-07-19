# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] — 2026-07-18

npm publish of `agentgeo-mcp@0.3.1` is pending.

### Added

- **MCP**: `--smoke` flag — connectivity self-check that runs without an MCP
  client and without a key. Prints the version, resolved api-url, and key
  status (prefix class only, never the key), then probes the public
  `GET /v1/surfaces` endpoint. Spends zero credits; exit 0 when the API
  answers.
- **MCP**: automated test suite (`mcp/test.mjs`, `node:test` + built-ins only)
  covering the CLI flags, the JSON-RPC surface, `fetch_raw_answers` against a
  local HTTP mock, and `--smoke`; wired into CI via `npm test`.

### Fixed

- **MCP**: HTTP 200 responses with non-JSON bodies are now reported as tool
  errors instead of successes (`fetch_raw_answers` flags the parse failure and
  returns the truncated body for debugging).

### Changed

- **Docs**: demo mode is documented as requiring an `ag_test_` test-scope key
  (created under `/app/keys`) — the hosted API enforces Bearer auth on every
  request, so there is no anonymous demo. `ag_live_` keys return live data and
  spend credits.
- Grammar/typo sweep (MCP tool description and docs).

## [0.3.0] — 2026-07-16

Published to npm as `agentgeo-mcp@0.3.0` (first npm release).

### Added

- **MCP**: `snapshot_id` argument on `fetch_raw_answers` — redeem a finished
  async scrape instead of paying for a re-run.

### Changed

- **MCP**: fetch timeout raised to 180 s to cover slow live surfaces.
- **MCP**: npm-valid `bin` path (no `./` prefix) so the bin entry survives
  publish; `repository` field points at this public repo.

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

[Unreleased]: https://github.com/gumlau/agentgeo-skills/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/gumlau/agentgeo-skills/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/gumlau/agentgeo-skills/compare/v0.1.0...v0.3.0
[0.1.0]: https://github.com/gumlau/agentgeo-skills/releases/tag/v0.1.0
