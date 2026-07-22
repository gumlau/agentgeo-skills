# agentgeo-mcp

MCP stdio server for [AgentGEO](https://agentgeo.org). Two jobs, one product
boundary:

- **`fetch_raw_answers`** — fetch raw AI answer records (answer text, source
  citations, provider metadata) from ChatGPT, Perplexity, Gemini, Google AI
  Overview, Google AI Mode, and Copilot through AgentGEO's managed scrapers.
- **`list_geo_skills` / `get_geo_skill`** — deliver the eight built-in GEO
  analysis skills (prompt-set, visibility, share-of-voice, citations,
  sentiment, competitors, monitor, report) straight into any connected agent.
  The same eight skills are also exposed through the MCP **prompts**
  capability (Claude Code renders them as `/mcp__agentgeo__geo-report`-style slash
  commands, with an optional `request` argument).

It returns provider records unchanged — no rankings, sentiment, visibility
scores, or conclusions. That analysis stays in your agent, guided by the
built-in skills.

Skill delivery is remote-first: the server reads the live copies from
`GET /v1/skills` (so a worker deploy refreshes them, no npm release needed —
and skill reads are free, they never spend credits), and falls back to the
copies bundled in the tarball (`skills.generated.mjs`, regenerated with
`node scripts/build-skill-bundle.mjs` after any SKILL.md change).

Zero npm dependencies; Node.js 18+ built-ins only.

## Install & run

No install step is needed — `npx` fetches it from npm on first run:

```bash
npx -y agentgeo-mcp --key ag_live_...
```

Or run it straight from a clone of this repo:

```bash
node /absolute/path/to/agentgeo-skills/mcp/index.mjs --key ag_live_...
```

The server speaks MCP over stdio — register it with a client rather than
running it interactively.

## Flags & environment variables

| Flag | Env var | Default | Meaning |
| --- | --- | --- | --- |
| `--key <key>` | `AGENTGEO_API_KEY` | — (required) | AgentGEO API key. Create one in the console under **API keys** (`/app/keys`). Self-hosted servers with auth disabled accept any placeholder value. |
| `--api-url <url>` | `AGENTGEO_API_URL` | `https://api.agentgeo.org` | AgentGEO API base URL. Self-hosters point this at their own server, e.g. `--api-url http://localhost:8787` (the worker's `npm run dev` port). |
| `--version` | — | — | Print the version and exit. |
| `--help` | — | — | Print usage and exit. |
| — | `AGENTGEO_TIMEOUT_MS` | `180000` | Fetch timeout in milliseconds. Live surfaces can take minutes; raise it for slower self-hosted upstreams. |

The server exits non-zero with a usage message if no API key is provided.

## Client setup

Claude Code:

```bash
claude mcp add agentgeo -- npx -y agentgeo-mcp --key ag_live_...
```

Codex:

```bash
codex mcp add agentgeo -- npx -y agentgeo-mcp --key ag_live_...
```

Cursor — add to `~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):

```json
{ "mcpServers": { "agentgeo": { "command": "npx", "args": ["-y", "agentgeo-mcp", "--key", "ag_live_..."] } } }
```

From a repo clone instead of npm, replace `npx -y agentgeo-mcp` with
`node /absolute/path/to/agentgeo-skills/mcp/index.mjs` in any of the above.

## The tool

`fetch_raw_answers` posts to `POST /v1/fetches` and returns the run envelope
verbatim.

Request arguments:

| Argument | Type | Notes |
| --- | --- | --- |
| `query` | string, required | 1–4096 characters, sent to each selected surface. |
| `surfaces` | string[], required | 1–6 of: `chatgpt`, `perplexity`, `gemini`, `google_ai_overview`, `google_ai_mode`, `copilot`. |
| `country` | string | Provider country input, default `US`. |
| `language` | string | Provider language input, default `en`. |
| `web_search` | boolean | Provider web-search toggle where supported. Omit to keep the provider default. |
| `snapshot_id` | string | Redeems a finished async job: when a record fails with `providerFields.snapshot_id` (slow upstream scrape), retry with that id and the SAME single surface to collect the finished answer without paying for a re-scrape. Not valid for `google_ai_overview`. |

Requests wait up to 180 seconds — live surfaces are slow (an AI Overview SERP
round-trip runs 40–90s; chatbot dataset scrapes can exceed the API's sync
budget entirely, which is what `snapshot_id` redemption is for).

Each per-surface record in `answers` carries `surfaceKey`, `status`
(`delivered` or `failed`), `answerText`, `sources` (title / url / position),
`fetchedAt`, `latencyMs`, `providerRecordId`, and the raw `providerFields`.

## Credits

One successfully **delivered** record costs one credit; failed records cost
zero. Demo-mode runs — an `ag_test_...` key on the hosted API, or a
self-hosted server without provider credentials — return clearly labelled
demo records at zero credits.

## License

MIT — see [LICENSE](./LICENSE).
