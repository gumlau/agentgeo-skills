# ChatSights local MCP server

This stdio MCP server gives Claude Code, Cursor, Codex, and other MCP clients
one tool: `fetch_raw_answers`.

It calls the local or hosted ChatSights REST API and returns the normalized raw
answer records unchanged. It does not calculate rankings, sentiment, share of
voice, confidence, or conclusions.

## Setup

Register the server with your agent. Once published to npm you can run it with
`npx`; until then, point at this file with an absolute path so the client can
start it from any working directory:

```bash
# From npm (once published)
claude mcp add chatsights -- npx -y chatsights-mcp --api-url https://api.trychatsights.com

# …or run this file directly
claude mcp add chatsights -- node /absolute/path/to/chatsights-geo-skills/mcp/index.mjs \
  --api-url http://localhost:8080
```

If API key authentication is enabled, append `--key cs_live_...` or set
`CHATSIGHTS_API_KEY`. Keys are created in the console under **API keys**
(`/app/keys`); creating the first key turns auth enforcement on. To target a
hosted API, set `--api-url` or `CHATSIGHTS_API_URL`.

No npm install is required; the server uses Node.js built-ins only.
