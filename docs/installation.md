# Installation Guide

Get the AgentGEO GEO Skills running inside your coding agent in three steps:
**connect the MCP → pick a mode → enable the skills.** Every skill fetches real AI
answers through the AgentGEO `fetch_raw_answers` tool, then does the Generative
Engine Optimization math locally.

- New here? Start with the [repo README](../README.md).
- Ready to run an analysis? See the [Usage Guide](./usage.md).

---

## Prerequisites

| Requirement | Why | Check |
|-------------|-----|-------|
| **Node.js ≥ 18** | The MCP server (`mcp/index.mjs`) uses built-in `fetch` and `AbortSignal.timeout`, both stable in Node 18+. Zero npm dependencies. | `node --version` |
| **A coding agent / MCP client** | Runs the skills and calls the MCP tool. Claude Code, Cursor, and Codex are supported out of the box; any stdio MCP client works. | Open your agent |
| **This repo, cloned locally** | The MCP entry point and the skills both live here. | `ls mcp/index.mjs skills/` |
| **(Optional) A AgentGEO API key** | Only needed for **live** data. Demo mode works with no key. | See [Step 2](#step-2--api-key--modes) |

```bash
# Verify Node and locate the repo
node --version                 # want v18.x or newer
cd /path/to/agentgeo-skills
pwd                            # copy this — it's your <ABSOLUTE-REPO-PATH>
ls mcp/index.mjs               # should print the path, no error
```

> Throughout this guide, replace `/absolute/path/to/agentgeo-skills` with the
> path `pwd` printed above. **Relative paths do not work** — the agent starts the
> MCP server from its own working directory, not yours.

---

## Step 1 — Connect the AgentGEO MCP

The MCP server is a single, zero-dependency file: `mcp/index.mjs`. It exposes exactly
one tool, `fetch_raw_answers`. Register it once with your agent using the config for
your client below.

The server reads its target API and key from **flags first, then environment
variables**, in this order:

| Setting | Flag | Env var | Default |
|---------|------|---------|---------|
| API base URL | `--api-url <url>` | `AGENTGEO_API_URL` | `http://localhost:8080` |
| API key | `--key <ag_live_...>` | `AGENTGEO_API_KEY` | *(empty → demo mode)* |

The server calls `POST <api-url>/v1/fetches`. A trailing slash on `--api-url` is
stripped automatically.

### Claude Code

Run this repo's MCP directly with an absolute path, pointed at the **hosted API**
(works today):

```bash
claude mcp add agentgeo -- node /absolute/path/to/agentgeo-skills/mcp/index.mjs \
  --api-url https://api.agentgeo.org
```

For **local development** against your own API, point `--api-url` at localhost instead:

```bash
# local-dev alternative
claude mcp add agentgeo -- node /absolute/path/to/agentgeo-skills/mcp/index.mjs \
  --api-url http://localhost:8080
```

Once the package is on npm, the `npx` form will work (**coming soon**):

```bash
# coming soon — published npm package
claude mcp add agentgeo -- npx -y agentgeo-mcp --api-url https://api.agentgeo.org
```

Confirm it registered:

```bash
claude mcp list                # agentgeo should appear
```

### Cursor

Add a `agentgeo` entry to your MCP config, pointed at the **hosted API**.
Project-scoped lives at `.cursor/mcp.json`; global lives at `~/.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "agentgeo": {
      "command": "node",
      "args": [
        "/absolute/path/to/agentgeo-skills/mcp/index.mjs",
        "--api-url",
        "https://api.agentgeo.org"
      ]
    }
  }
}
```

For **local development**, swap the URL for `http://localhost:8080`.

To use a live key, add an `env` block instead of putting the secret on the command
line:

```json
{
  "mcpServers": {
    "agentgeo": {
      "command": "node",
      "args": ["/absolute/path/to/agentgeo-skills/mcp/index.mjs"],
      "env": {
        "AGENTGEO_API_URL": "https://api.agentgeo.org",
        "AGENTGEO_API_KEY": "ag_live_..."
      }
    }
  }
}
```

Restart Cursor (or reload the MCP server) after editing the file.

### Codex / generic stdio MCP clients

Any MCP client that launches a stdio server works. The generic command points at the
**hosted API**:

```bash
node /absolute/path/to/agentgeo-skills/mcp/index.mjs --api-url https://api.agentgeo.org
```

For **local development**, use `--api-url http://localhost:8080` instead.

Wire that into your client's server config. Codex's `~/.codex/config.toml`, for
example:

```toml
[mcp_servers.agentgeo]
command = "node"
args = ["/absolute/path/to/agentgeo-skills/mcp/index.mjs"]

[mcp_servers.agentgeo.env]
AGENTGEO_API_URL = "https://api.agentgeo.org"
AGENTGEO_API_KEY = "ag_live_..."
```

For any client, you can drive the server entirely through environment variables
instead of flags — handy when the client doesn't let you pass args:

```bash
export AGENTGEO_API_URL="https://api.agentgeo.org"
export AGENTGEO_API_KEY="ag_live_..."     # omit for demo mode
node /absolute/path/to/agentgeo-skills/mcp/index.mjs
```

Flags win over env vars if you set both.

---

## Step 2 — API key & modes

The MCP server runs in one of two modes, decided entirely by whether it has a key.

| Mode | Key present? | What you get | Cost |
|------|--------------|--------------|------|
| **Demo** | No `--key` and no `AGENTGEO_API_KEY` | Labelled demo **fixtures** — real answer/citation *shape*, so every skill runs end to end | **0 credits** |
| **Live** | Yes | Real answers, citations, and sources from the six AI surfaces | Spends credits |

### Demo mode (default — start here)

Do nothing. With no key configured, AgentGEO returns labelled demo fixtures at
**zero credits**, so you can dry-run every skill and confirm the whole loop works
before you spend anything.

```bash
# Demo mode — no key, zero credits
claude mcp add agentgeo -- node /absolute/path/to/agentgeo-skills/mcp/index.mjs \
  --api-url https://api.agentgeo.org
```

### Live mode

1. Get a key at **[agentgeo.org](https://agentgeo.org)**. Keys are created
   in the console under **API keys** (`/app/keys`).
2. **Creating your first key turns auth enforcement on.** After that, requests
   without a valid key are rejected (`401`).
3. Pass the key via `--key` or `AGENTGEO_API_KEY`, and point `--api-url` at the
   hosted API.

```bash
# Live mode — flag form
claude mcp add agentgeo -- node /absolute/path/to/agentgeo-skills/mcp/index.mjs \
  --api-url https://api.agentgeo.org \
  --key ag_live_...

# Live mode — env var form (keeps the secret off the command line)
export AGENTGEO_API_KEY="ag_live_..."
export AGENTGEO_API_URL="https://api.agentgeo.org"
claude mcp add agentgeo -- node /absolute/path/to/agentgeo-skills/mcp/index.mjs
```

The server sends the key as `Authorization: Bearer <key>`.

---

## Step 3 — Enable the skills

The skills live under `skills/` as distributable source. Your agent only runs them
once they're linked into a directory it scans (`.claude/skills/`). The helper script
does this for you:

```bash
# For the current project  ->  ./.claude/skills
./scripts/enable-skills.sh

# …or globally for every project  ->  ~/.claude/skills
./scripts/enable-skills.sh --global
```

### What the script does

It symlinks every `skills/geo-*` directory into the destination:

| Invocation | Destination | Scope |
|------------|-------------|-------|
| `./scripts/enable-skills.sh` | `./.claude/skills/` | This project only |
| `./scripts/enable-skills.sh --global` | `~/.claude/skills/` | Every project |

Each of the eight skills gets its own symlink (`ln -sfn`), so edits to the source
are picked up immediately — no re-run needed after code changes. Expected output:

```text
  linked geo-prompt-set
  linked geo-visibility
  linked geo-share-of-voice
  linked geo-citations
  linked geo-sentiment
  linked geo-competitors
  linked geo-monitor
  linked geo-report
Done — 8 skills enabled in /your/project/.claude/skills
Ask your agent: "start a GEO analysis for <your-domain>"
```

### How the agent uses them

Once linked, the agent scans `.claude/skills/` and **auto-invokes** the right skill
from natural language. Ask:

```text
Start a GEO analysis for acme.com against notion.com and coda.io
```

The agent invokes `geo-prompt-set` (the entry point), fetches through the AgentGEO
MCP, and walks the loop to a `geo-report`. You can also call any skill by name.

---

## Verify

### 1. Smoke-test the MCP tool

Ask your agent to run a minimal `fetch_raw_answers` call:

```text
Call fetch_raw_answers with query "best project management tool" and surfaces ["chatgpt"]
```

The `surfaces` array accepts any of the six supported values:
`chatgpt`, `perplexity`, `gemini`, `google_ai_overview`, `google_ai_mode`, `copilot`.

**Expected demo output shape** — normalized raw records only (answer text, citations,
sources, provider metadata). No score, ranking, or sentiment; that's all computed by
the skills. In demo mode the records are clearly labelled as fixtures, and you spend
**0 credits**. A healthy response looks like:

```json
{
  "query": "best project management tool",
  "results": [
    {
      "surface": "chatgpt",
      "answerText": "…demo fixture answer text…",
      "citations": [ { "title": "…", "url": "https://…" } ],
      "sources": [ "https://…" ],
      "provider": { "mode": "demo", "country": "US", "language": "en" }
    }
  ]
}
```

Exact field names come from the AgentGEO API; the point is that you get **raw
records back and no error**.

### 2. Confirm the skills are picked up

```bash
ls -l .claude/skills/          # project scope — should list 8 geo-* symlinks
ls -l ~/.claude/skills/        # global scope
```

Each entry should be a symlink (`geo-* -> …/skills/geo-*`). In your agent, the eight
`geo-*` skills should now be invocable by name, and a plain request like
`start a GEO analysis for acme.com` should trigger `geo-prompt-set` automatically.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Agent says the **MCP / tool isn't found**; `fetch_raw_answers` unavailable | Server not registered, or the agent wasn't reloaded | Re-run the `claude mcp add …` (or edit the client config) and restart the agent. Verify with `claude mcp list`. |
| **`node: command not found`** or the server won't start | Node missing or too old | Install Node ≥ 18; confirm with `node --version`. |
| **`Cannot find module …/index.mjs`** / server exits immediately | Relative or wrong path in the config | Use the **absolute** path from `pwd`. Confirm `ls /absolute/path/to/agentgeo-skills/mcp/index.mjs` succeeds. |
| **`401 Unauthorized`** in the fetch response | Auth is on (a key exists) but yours is missing or wrong | Pass `--key ag_live_...` or set `AGENTGEO_API_KEY`. Remember: creating the first key at `/app/keys` turns auth on for the workspace. |
| **`402 Payment Required`** / spend-cap message | Credit balance or spend cap reached in live mode | Top up / raise the cap in the console, or drop the key to fall back to free **demo mode**. |
| **`AgentGEO API is unavailable at http://localhost:8080`** | No API listening at the `--api-url` target | Start the local API, or point `--api-url` / `AGENTGEO_API_URL` at the hosted URL (`https://api.agentgeo.org`). |
| Skills **don't appear** in the agent | `enable-skills.sh` not run, or wrong scope | Run `./scripts/enable-skills.sh` (project) or `--global`; then `ls -l .claude/skills/` should show 8 symlinks. |
| **`Invalid fetch_raw_answers arguments`** | Empty `query`, empty `surfaces`, or an unsupported surface name | Send a non-empty `query` and at least one surface from: `chatgpt`, `perplexity`, `gemini`, `google_ai_overview`, `google_ai_mode`, `copilot`. |
| Fetch **times out** (~60s) | Provider slow or network blocked | Retry with fewer surfaces; check outbound network access to the `--api-url` host. |

---

## Next steps

- **[Usage Guide](./usage.md)** — run the full generate → fetch → analyze → monitor →
  report loop end to end.
- **[Repo README](../README.md)** — the skill suite, architecture, and the raw-data
  product boundary.
