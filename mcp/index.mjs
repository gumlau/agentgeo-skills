#!/usr/bin/env node

/**
 * AgentGEO MCP server (published to npm as `agentgeo-mcp`).
 *
 * It exposes one deliberately narrow tool: fetch raw AI answer records from
 * the AgentGEO REST API. It does not rank, score, summarize, or interpret
 * the provider response; that work stays in the calling agent.
 *
 * Zero dependencies — Node.js built-ins only. Run via `npx -y agentgeo-mcp`
 * once published, or `node mcp/index.mjs` from a repo clone.
 */

/** Keep in lockstep with package.json "version". */
const VERSION = "0.3.1";

/** Mirrors worker/src/routes/meta.ts: SUPPORTED_SURFACES (same keys, same order). */
const SURFACES = [
  "chatgpt",
  "perplexity",
  "gemini",
  "google_ai_overview",
  "google_ai_mode",
  "copilot",
];

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const USAGE = `agentgeo-mcp ${VERSION} — MCP stdio server for raw AgentGEO answer records.

Usage:
  agentgeo-mcp --key ag_live_... [--api-url https://api.agentgeo.org]

Flags:
  --key <key>      AgentGEO API key (env: AGENTGEO_API_KEY). Required.
                   Create keys in the console under /app/keys. Self-hosted
                   servers with auth disabled accept any placeholder value.
  --api-url <url>  AgentGEO API base URL (env: AGENTGEO_API_URL).
                   Defaults to https://api.agentgeo.org. Self-hosters
                   pass their own, e.g. --api-url http://localhost:8787.
  --smoke          Connectivity self-check (no MCP client needed): print the
                   version, resolved api-url, and key status, then GET the
                   public /v1/surfaces endpoint. Runs without a key and
                   spends zero credits. Exit 0 when the API answers.
  --version        Print the version and exit.
  --help           Print this message and exit.`;

// Informational flags run (and exit) before the API-key requirement below,
// so `npx -y agentgeo-mcp --version` works without any configuration.
if (hasFlag("--version") || hasFlag("-v")) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}
if (hasFlag("--help") || hasFlag("-h")) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}

// Hosted API by default so `npx -y agentgeo-mcp` works for strangers;
// self-hosters override with --api-url / AGENTGEO_API_URL.
const apiUrl = (
  readArg("--api-url") || process.env.AGENTGEO_API_URL || "https://api.agentgeo.org"
).replace(/\/$/, "");
const apiKey = readArg("--key") || process.env.AGENTGEO_API_KEY || "";

// Connectivity self-check: `agentgeo-mcp --smoke` answers "can this machine
// reach the API?" without an MCP client. GET /v1/surfaces is public, so the
// check runs even when no key is set (this branch sits before the missing-key
// fail-fast on purpose) and it never calls POST /v1/fetches — zero credits.
if (hasFlag("--smoke")) {
  // Report the key's prefix class only; the key itself is never printed.
  const keyStatus = !apiKey
    ? "none set"
    : apiKey.startsWith("ag_test_")
      ? "ag_test_ (demo mode)"
      : apiKey.startsWith("ag_live_")
        ? "ag_live_ (live mode)"
        : "custom";
  process.stdout.write(`agentgeo-mcp ${VERSION}\n`);
  process.stdout.write(`api-url: ${apiUrl}\n`);
  process.stdout.write(`key: ${keyStatus}\n`);
  try {
    // Deliberately no Authorization header: an unauthenticated probe keeps
    // "is the API reachable" separate from "is my key valid".
    const response = await fetch(`${apiUrl}/v1/surfaces`, {
      signal: AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = undefined;
    }
    if (!response.ok || payload === undefined) {
      process.stdout.write(
        `surfaces: HTTP ${response.status}${payload === undefined ? " (non-JSON body)" : ""} — expected 200 with JSON\n`,
      );
      process.exit(1);
    }
    const engines = Array.isArray(payload.engines) ? payload.engines : [];
    const configured = engines.filter((engine) => engine?.configured === true).length;
    process.stdout.write(
      `surfaces: reachable — count ${payload.count}, ${configured}/${engines.length} engines configured\n`,
    );
    process.exit(0);
  } catch (cause) {
    process.stdout.write(
      `surfaces: unreachable at ${apiUrl}: ${cause instanceof Error ? cause.message : String(cause)}\n`,
    );
    process.exit(1);
  }
}

// Fail fast with a usage message instead of emitting 401s on every tool call.
if (!apiKey) {
  process.stderr.write(`error: missing API key — pass --key or set AGENTGEO_API_KEY\n\n${USAGE}\n`);
  process.exit(1);
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, value) {
  write({ jsonrpc: "2.0", id, result: value });
}

function error(id, code, message, data) {
  write({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  });
}

const fetchTool = {
  name: "fetch_raw_answers",
  title: "Fetch raw AI answers",
  description:
    "Fetch raw answer text, citations, and provider metadata through AgentGEO's managed AI scrapers. Returns no ranking, sentiment, visibility score, or other analysis.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    // Bounds mirror the worker's FetchCreate validation
    // (worker/src/routes/fetches.ts: QUERY_MAX, SURFACES_MAX, etc.).
    properties: {
      query: { type: "string", minLength: 1, maxLength: 4096, description: "Prompt sent to each selected AI surface." },
      surfaces: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        uniqueItems: true,
        items: { type: "string", enum: SURFACES },
        description: "AI scraper surfaces to query.",
      },
      country: { type: "string", minLength: 2, maxLength: 8, default: "US", description: "Provider country input, e.g. \"US\"." },
      language: { type: "string", minLength: 2, maxLength: 12, default: "en", description: "Provider language input, e.g. \"en\"." },
      web_search: { type: "boolean", description: "Allow provider web search where supported. Omit to keep the provider default." },
      snapshot_id: {
        type: "string",
        minLength: 1,
        maxLength: 128,
        description:
          "Redeem a finished async job instead of starting a new scrape. When a record fails with providerFields.snapshot_id (slow upstream scrape), retry with that id and the SAME single surface to collect the finished answer without paying for a re-scrape.",
      },
    },
    required: ["query", "surfaces"],
  },
};

async function callFetchTool(id, args) {
  const query = typeof args?.query === "string" ? args.query.trim() : "";
  const surfaces = Array.isArray(args?.surfaces) ? args.surfaces : [];
  const invalid = surfaces.filter((surface) => !SURFACES.includes(surface));

  if (!query || surfaces.length === 0 || invalid.length > 0) {
    error(id, -32602, "Invalid fetch_raw_answers arguments", {
      query_required: true,
      surfaces_required: true,
      supported_surfaces: SURFACES,
      invalid_surfaces: invalid,
    });
    return;
  }

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  // web_search is Optional[bool] on the wire (worker parseBody): only send it
  // when the caller set it, so an omitted flag keeps the provider default
  // instead of forcing web search on.
  const body = {
    query,
    surfaces,
    country: args.country || "US",
    language: args.language || "en",
  };
  if (typeof args.web_search === "boolean") body.web_search = args.web_search;
  if (typeof args.snapshot_id === "string" && args.snapshot_id) body.snapshot_id = args.snapshot_id;

  try {
    const response = await fetch(`${apiUrl}/v1/fetches`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      // Live surfaces are slow: an AI Overview SERP round-trip runs 40-90s and
      // a chatbot dataset scrape can take a couple of minutes on the sync path.
      signal: AbortSignal.timeout(180_000),
    });
    const text = await response.text();
    let payload;
    let parseFailed = false;
    try {
      payload = JSON.parse(text);
    } catch {
      // A non-JSON body is never a valid fetch result, even on HTTP 200.
      parseFailed = true;
      payload = { detail: `AgentGEO returned a non-JSON HTTP ${response.status} response` };
      if (text) payload.body = text.slice(0, 2000);
    }

    if (!response.ok || parseFailed) {
      result(id, {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      });
      return;
    }

    result(id, {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    });
  } catch (cause) {
    result(id, {
      isError: true,
      content: [{
        type: "text",
        text: `AgentGEO API is unavailable at ${apiUrl}: ${cause instanceof Error ? cause.message : String(cause)}`,
      }],
    });
  }
}

async function handle(message) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    error(message?.id, -32600, "Invalid JSON-RPC request");
    return;
  }

  if (message.method.startsWith("notifications/")) return;

  switch (message.method) {
    case "initialize":
      result(message.id, {
        protocolVersion: message.params?.protocolVersion || "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "agentgeo-mcp", version: VERSION },
        instructions:
          "Use fetch_raw_answers to retrieve raw provider records. Perform ranking, sentiment, comparisons, and reporting locally in the agent.",
      });
      break;
    case "ping":
      result(message.id, {});
      break;
    case "tools/list":
      result(message.id, { tools: [fetchTool] });
      break;
    case "tools/call":
      if (message.params?.name !== fetchTool.name) {
        error(message.id, -32602, `Unknown tool: ${message.params?.name || "(missing)"}`);
        return;
      }
      await callFetchTool(message.id, message.params.arguments || {});
      break;
    default:
      error(message.id, -32601, `Method not found: ${message.method}`);
  }
}

process.stdin.setEncoding("utf8");
let buffer = "";
let queue = Promise.resolve();

process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    queue = queue.then(async () => {
      try {
        await handle(JSON.parse(line));
      } catch (cause) {
        error(null, -32700, "Parse error", cause instanceof Error ? cause.message : String(cause));
      }
    });
  }
});

