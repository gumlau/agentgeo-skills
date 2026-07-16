#!/usr/bin/env node

/**
 * ChatSights local MCP server.
 *
 * It exposes one deliberately narrow tool: fetch raw AI answer records from
 * the ChatSights REST API. It does not rank, score, summarize, or interpret
 * the provider response; that work stays in the calling agent.
 */

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

const apiUrl = (
  readArg("--api-url") || process.env.CHATSIGHTS_API_URL || "http://localhost:8080"
).replace(/\/$/, "");
const apiKey = readArg("--key") || process.env.CHATSIGHTS_API_KEY || "";

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
    "Fetch raw answer text, citations, and provider metadata through ChatSights' managed AI scrapers. Returns no ranking, sentiment, visibility score, or other analysis.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: { type: "string", minLength: 1, description: "Prompt sent to each selected AI surface." },
      surfaces: {
        type: "array",
        minItems: 1,
        uniqueItems: true,
        items: { type: "string", enum: SURFACES },
        description: "AI scraper surfaces to query.",
      },
      country: { type: "string", default: "US", description: "Two-letter provider country input." },
      language: { type: "string", default: "en", description: "Provider language input." },
      web_search: { type: "boolean", default: true, description: "Allow provider web search when supported." },
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

  try {
    const response = await fetch(`${apiUrl}/v1/fetches`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        surfaces,
        country: args.country || "US",
        language: args.language || "en",
        web_search: args.web_search ?? true,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { detail: text || `ChatSights returned HTTP ${response.status}` };
    }

    if (!response.ok) {
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
        text: `ChatSights API is unavailable at ${apiUrl}: ${cause instanceof Error ? cause.message : String(cause)}`,
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
        serverInfo: { name: "chatsights-local", version: "0.1.0" },
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

