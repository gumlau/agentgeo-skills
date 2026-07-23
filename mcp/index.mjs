#!/usr/bin/env node

/**
 * AgentGEO MCP server (published to npm as `agentgeo-mcp`).
 *
 * Two jobs, one product boundary:
 *
 *   - fetch_raw_answers — fetch raw AI answer records from the AgentGEO REST
 *     API. It does not rank, score, summarize, or interpret the provider
 *     response; that work stays in the calling agent.
 *   - list_geo_skills / get_geo_skill (plus the same eight skills as MCP
 *     prompts) — deliver the GEO analysis workflows the agent runs locally.
 *     Served live from GET /v1/skills so they stay fresh without an npm
 *     release, with the copies bundled at publish time
 *     (skills.generated.mjs) as the offline fallback.
 *
 * Zero dependencies — Node.js built-ins only. Run via `npx -y agentgeo-mcp`
 * once published, or `node mcp/index.mjs` from a repo clone.
 */

import { GEO_SKILLS } from "./skills.generated.mjs";

/** Keep in lockstep with package.json "version". */
const VERSION = "0.4.1";

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

const USAGE = `agentgeo-mcp ${VERSION} — MCP stdio server for raw AgentGEO answer records
and the eight built-in GEO analysis skills.

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
  --help           Print this message and exit.

Environment:
  AGENTGEO_TIMEOUT_MS  Fetch timeout in milliseconds (default 180000). Live
                       surfaces can take minutes; raise this for slower
                       self-hosted upstreams.`;

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

// Fetch timeout for /v1/fetches. Live surfaces are slow (an AI Overview SERP
// round-trip runs 40-90s; a chatbot dataset scrape can take minutes on the
// sync path), so the default is generous; self-hosters with slower upstreams
// can raise it via AGENTGEO_TIMEOUT_MS. Non-numeric or non-positive values
// fall back to the default rather than erroring.
const parsedTimeout = Number(process.env.AGENTGEO_TIMEOUT_MS);
const fetchTimeoutMs =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 180_000;

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
    "Fetch raw answer text, citations, and provider metadata through AgentGEO's managed AI scrapers. Returns no ranking, sentiment, visibility score, or other analysis. Safe to call in parallel: for a multi-prompt run, issue ALL prompt fetches as one concurrent batch of tool calls (do not split into sequential waves) — the server and API handle them simultaneously. If a record fails with providerFields.snapshot_id, redeem it (same single surface + snapshot_id) instead of re-fetching.",
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

// --- Built-in GEO skills -----------------------------------------------------
//
// The eight skills are the product's analysis layer: AgentGEO returns raw
// records only, and each SKILL.md tells the agent exactly how to turn them
// into visibility, share-of-voice, citation, sentiment, competitor, monitor
// and report output. Delivering them through the server means every MCP
// client gets the workflows with zero extra install. Live copies come from
// GET /v1/skills (kept fresh by worker deploys; the authenticated read also
// doubles as the console's agent-connected signal); the bundle from
// skills.generated.mjs answers when the API is unreachable.

const SKILL_NAMES = GEO_SKILLS.map((skill) => skill.name);

/**
 * Names are URL path segments and get an Authorization header attached —
 * gate them to the skill-slug shape before any fetch so a crafted name can
 * never traverse to a different endpoint.
 */
const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

const SKILL_FETCH_TIMEOUT_MS = 10_000;

/**
 * Per-process cache, keyed by skill name -> the SINGLE in-flight (or settled)
 * resolution promise. Caching the promise rather than the resolved value makes
 * loadSkill single-flight: concurrent get_geo_skill / prompts/get calls for the
 * same name share ONE authenticated fetch and ONE result. That matters now that
 * requests dispatch concurrently — with the old serial queue two loadSkill calls
 * never overlapped, but under concurrency a naive check-then-act cache let the
 * slowest caller (a 10s-timed-out fetch that falls back to the bundled copy)
 * overwrite a live copy a faster caller had already cached, pinning the stale
 * bundled content for the rest of the session. A resolved skill — live or
 * bundled — is stable for the life of one MCP session; the bundled fallback is
 * thus cached at most one npm release stale instead of re-timing-out on every
 * later call. Unknown-name misses are NOT cached (the entry is deleted on a null
 * result), so a catalog-only skill can be retried once the API is reachable.
 */
const skillCache = new Map();

function loadSkill(name) {
  const inflight = skillCache.get(name);
  if (inflight !== undefined) return inflight;
  const promise = resolveSkill(name).then((resolved) => {
    // Don't pin an unknown-name miss: drop it so a later call can retry once a
    // worker deploy makes the API serve it. Bundled names always resolve, so
    // only catalog-only misses take this branch.
    if (!resolved) skillCache.delete(name);
    return resolved;
  });
  skillCache.set(name, promise);
  return promise;
}

async function resolveSkill(name) {
  const bundled = GEO_SKILLS.find((skill) => skill.name === name);
  // Bundled names never fail; names the bundle doesn't know (a skill added by
  // a worker deploy after this npm release) resolve only when the API serves
  // them — that keeps list_geo_skills' live catalog and get_geo_skill in
  // agreement instead of advertising names the enum-era code would reject.
  let resolved = bundled ?? null;
  try {
    const response = await fetch(`${apiUrl}/v1/skills/${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(SKILL_FETCH_TIMEOUT_MS),
    });
    if (response.ok) {
      const payload = JSON.parse(await response.text());
      if (payload && typeof payload.content === "string" && payload.content.trim()) {
        resolved = {
          name,
          description: typeof payload.description === "string" ? payload.description : (bundled?.description ?? ""),
          version: typeof payload.version === "string" ? payload.version : (bundled?.version ?? ""),
          content: payload.content,
        };
      }
    }
  } catch {
    // Unreachable API — the bundled copy (when one exists) is the answer.
  }
  return resolved;
}

const listSkillsTool = {
  name: "list_geo_skills",
  title: "List built-in GEO skills",
  description:
    "List the eight GEO analysis skills built into this server, in recommended pipeline order. Call this FIRST for any GEO analysis ask — visibility, share of voice, citations, sentiment, competitor comparison, monitoring, or a full report — then load the matching workflow with get_geo_skill. Free: contacts no AI provider and spends no credits.",
  inputSchema: { type: "object", additionalProperties: false, properties: {} },
};

const getSkillTool = {
  name: "get_geo_skill",
  title: "Get a built-in GEO skill",
  description:
    "Return the full SKILL.md workflow for one GEO skill by name (use the names list_geo_skills returns; the built-in eight are geo-prompt-set, geo-visibility, geo-share-of-voice, geo-citations, geo-sentiment, geo-competitors, geo-monitor, geo-report). Follow it step by step: skills consume fetch_raw_answers output and run every ranking, scoring and reporting step locally in the agent — AgentGEO itself only ever returns raw answers. Free: contacts no AI provider and spends no credits.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: {
        // Deliberately NOT an enum of the bundled names: the live catalog can
        // grow via a worker deploy, and this npm artifact must keep serving
        // whatever list_geo_skills advertises.
        type: "string",
        pattern: "^[a-z0-9][a-z0-9-]{0,63}$",
        description: 'Skill to load, e.g. "geo-visibility". Take names from list_geo_skills.',
      },
    },
    required: ["name"],
  },
};

/** One-line map of how the eight skills chain, shown by list_geo_skills. */
const SKILL_PIPELINE =
  "geo-prompt-set builds the prompt library every other skill consumes; " +
  "geo-visibility, geo-share-of-voice, geo-citations and geo-sentiment each analyze one dimension; " +
  "geo-competitors joins them into one comparison; geo-monitor tracks runs over time; " +
  "geo-report synthesizes everything into an executive report.";

async function callListSkills(id) {
  // Remote-first so a redeployed worker can update the catalog without an npm
  // release. Any failure falls through to the bundled index — listing skills
  // must never be the step that breaks.
  let skills;
  try {
    const response = await fetch(`${apiUrl}/v1/skills`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(SKILL_FETCH_TIMEOUT_MS),
    });
    if (response.ok) {
      const payload = JSON.parse(await response.text());
      if (Array.isArray(payload?.skills) && payload.skills.length > 0) {
        const remote = payload.skills
          .filter((skill) => skill && typeof skill.name === "string")
          .map(({ name, description, version }) => ({ name, description, version }));
        if (remote.length > 0) skills = remote;
      }
    }
  } catch {
    // Unreachable API — fall through to the bundle.
  }
  if (!skills) {
    skills = GEO_SKILLS.map(({ name, description, version }) => ({ name, description, version }));
  }
  const payload = {
    object: "skill_list",
    count: skills.length,
    pipeline: SKILL_PIPELINE,
    next_step: "Call get_geo_skill with a name below, then follow the returned workflow.",
    skills,
  };
  result(id, {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  });
}

async function callGetSkill(id, args) {
  const name = typeof args?.name === "string" ? args.name.trim() : "";
  if (!SKILL_NAME_PATTERN.test(name)) {
    error(id, -32602, "Invalid get_geo_skill arguments", {
      known_skills: SKILL_NAMES,
      requested: name || null,
    });
    return;
  }
  const skill = await loadSkill(name);
  if (!skill) {
    error(id, -32602, "Unknown skill", {
      known_skills: SKILL_NAMES,
      requested: name,
      note: "Names outside the bundled eight resolve only when the AgentGEO API serves them (list_geo_skills shows the live catalog).",
    });
    return;
  }
  result(id, { content: [{ type: "text", text: skill.content }] });
}

/**
 * The same eight skills through the MCP prompts capability. Clients with
 * prompt UI (Claude Code renders these as /mcp__agentgeo__* slash commands)
 * get one-keystroke access; clients without it lose nothing — the tools
 * above deliver identical content.
 */
function promptEntry(skill) {
  // First sentence only: prompt pickers render one line, and each
  // description's "Use when…" tail is trigger phrasing for skill routers,
  // not for humans.
  const summary = skill.description.split(" Use when")[0];
  return {
    name: skill.name,
    description: summary,
    arguments: [
      {
        name: "request",
        description: "Brand or site, competitors, surfaces — anything specific this run should analyze.",
        required: false,
      },
    ],
  };
}

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
      signal: AbortSignal.timeout(fetchTimeoutMs),
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
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: "agentgeo-mcp", version: VERSION },
        instructions:
          "AgentGEO returns raw AI answers only; every analysis runs locally in this agent, guided by eight built-in GEO skills. For any GEO analysis ask (visibility, share of voice, citations, sentiment, competitors, monitoring, report), call list_geo_skills FIRST, then get_geo_skill for the matching workflow and follow it. fetch_raw_answers retrieves the raw provider records the skills consume.",
      });
      break;
    case "ping":
      result(message.id, {});
      break;
    case "tools/list":
      result(message.id, { tools: [listSkillsTool, getSkillTool, fetchTool] });
      break;
    case "tools/call": {
      const toolName = message.params?.name;
      const toolArgs = message.params?.arguments || {};
      if (toolName === fetchTool.name) await callFetchTool(message.id, toolArgs);
      else if (toolName === listSkillsTool.name) await callListSkills(message.id);
      else if (toolName === getSkillTool.name) await callGetSkill(message.id, toolArgs);
      else error(message.id, -32602, `Unknown tool: ${toolName || "(missing)"}`);
      break;
    }
    case "prompts/list":
      result(message.id, { prompts: GEO_SKILLS.map(promptEntry) });
      break;
    case "prompts/get": {
      const promptName = message.params?.name;
      if (typeof promptName !== "string" || !SKILL_NAMES.includes(promptName)) {
        error(message.id, -32602, `Unknown prompt: ${promptName || "(missing)"}`, {
          known_prompts: SKILL_NAMES,
        });
        break;
      }
      const skill = await loadSkill(promptName);
      const request = message.params?.arguments?.request;
      const text =
        typeof request === "string" && request.trim()
          ? `${skill.content}\n\n---\n\nUser request: ${request.trim()}`
          : skill.content;
      result(message.id, {
        description: promptEntry(skill).description,
        messages: [{ role: "user", content: { type: "text", text } }],
      });
      break;
    }
    default:
      error(message.id, -32601, `Method not found: ${message.method}`);
  }
}

process.stdin.setEncoding("utf8");
let buffer = "";

process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch (cause) {
      error(null, -32700, "Parse error", cause instanceof Error ? cause.message : String(cause));
      continue;
    }
    // Dispatch WITHOUT awaiting. Requests used to chain onto one global
    // promise queue, which serialized every tools/call: one live fetch runs
    // 30-150s, so a client fanning out N prompt fetches in parallel got them
    // executed strictly one-after-another — an N-prompt audit took N fetch
    // durations, and queued calls blew past the client's per-request timeout
    // while the worker was never even contacted. JSON-RPC responses carry the
    // request id and may arrive in any order; each write() below emits one
    // complete line atomically, so concurrent handlers cannot interleave
    // output. handle() resolves errors internally — this catch is the
    // last-resort guard for unexpected throws.
    void handle(message).catch((cause) => {
      error(
        message?.id ?? null,
        -32603,
        "Internal error",
        cause instanceof Error ? cause.message : String(cause),
      );
    });
  }
});

