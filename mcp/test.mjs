/**
 * Test suite for the AgentGEO MCP server (`agentgeo-mcp`).
 *
 * Node.js built-ins only (node:test, node:assert, node:child_process,
 * node:http) — no dependencies, matching the server itself. Run with
 * `npm test` (node --test test.mjs). Not shipped in the npm tarball.
 *
 * The suite spawns `node index.mjs` with controlled argv/env and talks
 * JSON-RPC over stdio. Network-facing behavior is exercised against a local
 * node:http mock on an ephemeral port, so no real API is contacted and no
 * credits are ever spent.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = join(HERE, "index.mjs");
const PKG = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8"));

/** Mirrors index.mjs SURFACES (same keys, same order). */
const SURFACES = [
  "chatgpt",
  "perplexity",
  "gemini",
  "google_ai_overview",
  "google_ai_mode",
  "copilot",
];

// Strip AgentGEO variables from the inherited env so a developer's real key
// or self-hosted URL can never leak into (or accidentally satisfy) a test.
const cleanEnv = { ...process.env };
delete cleanEnv.AGENTGEO_API_KEY;
delete cleanEnv.AGENTGEO_API_URL;

// ---------------------------------------------------------------------------
// Local API mock: POST /v1/fetches keyed on the "query" field of the request
// body, GET /v1/surfaces always healthy. Echoes the fetch body back under
// "received" so tests can assert on exactly what the server sent.
// ---------------------------------------------------------------------------

let mock;
let mockUrl;

// Counts upstream fetches for the geo-singleflight skill name (used ONLY by the
// single-flight regression test), so that test can assert concurrent same-name
// loads collapse to one upstream call.
let singleflightFetches = 0;

before(async () => {
  mock = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (req.method === "GET" && req.url === "/v1/skills") {
        // A one-entry live catalog, deliberately different from the bundle:
        // tests assert the remote copy wins over the eight bundled skills.
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            object: "skill_list",
            count: 1,
            skills: [{ name: "geo-visibility", description: "live catalog entry", version: "9.9.9" }],
          }),
        );
        return;
      }
      if (req.method === "GET" && req.url === "/v1/skills/geo-visibility") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            object: "skill",
            name: "geo-visibility",
            description: "live",
            version: "9.9.9",
            content: "# LIVE geo-visibility workflow",
          }),
        );
        return;
      }
      if (req.method === "GET" && req.url === "/v1/skills/geo-report") {
        // Non-JSON body: the server must fall back to the bundled copy.
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html>gateway interstitial</html>");
        return;
      }
      if (req.method === "GET" && req.url === "/v1/skills/geo-ninth") {
        // A catalog-only skill the npm bundle doesn't know about — added by a
        // worker deploy after this package shipped.
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            object: "skill",
            name: "geo-ninth",
            description: "catalog-only skill",
            version: "1.0.0",
            content: "# NINTH workflow",
          }),
        );
        return;
      }
      if (req.method === "GET" && req.url === "/__singleflight_count") {
        // Out-of-band read of the geo-singleflight fetch counter. Named outside
        // the /v1/skills/ namespace so it can never be mistaken for a skill.
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ count: singleflightFetches }));
        return;
      }
      if (req.method === "GET" && req.url === "/v1/skills/geo-singleflight") {
        // A live-only skill (no bundled copy) whose every fetch is counted.
        // Single-flight means N concurrent get_geo_skill("geo-singleflight")
        // calls in one session increment this exactly once.
        singleflightFetches += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            object: "skill",
            name: "geo-singleflight",
            description: "single-flight probe",
            version: "1.0.0",
            content: "# SINGLEFLIGHT live workflow",
          }),
        );
        return;
      }
      if (req.method === "GET" && req.url?.startsWith("/v1/skills/")) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ detail: "unknown skill" }));
        return;
      }
      if (req.method === "GET" && req.url === "/v1/surfaces") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            object: "surface_list",
            count: 6,
            engines: SURFACES.map((surface) => ({ surface, configured: true })),
          }),
        );
        return;
      }
      if (req.method === "POST" && req.url === "/v1/fetches") {
        let body;
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          body = {};
        }
        if (body.query === "notjson") {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<html><body>gateway interstitial</body></html>");
          return;
        }
        if (body.query === "boom") {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ detail: "internal error" }));
          return;
        }
        if (body.query === "slow") {
          // Answers after 2s — paired with a tiny AGENTGEO_TIMEOUT_MS to
          // exercise the client-side timeout without slowing the suite.
          setTimeout(() => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ mode: "demo", answers: [] }));
          }, 2000);
          return;
        }
        // "ok" (and anything else): success payload echoing the request body.
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            mode: "demo",
            answers: [{ surface: body.surfaces?.[0] ?? null, answer_text: "stub answer" }],
            received: body,
          }),
        );
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: "not found" }));
    });
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  mockUrl = `http://127.0.0.1:${mock.address().port}`;
});

after(() => new Promise((resolve) => mock.close(resolve)));

/** A localhost port that nothing is listening on (bind, read, release). */
async function deadPort() {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

// ---------------------------------------------------------------------------
// Helpers to drive the server as a child process.
// ---------------------------------------------------------------------------

/**
 * Run `node index.mjs <args>` to completion and capture exit code + output.
 * Async (never spawnSync) so the in-process mock server stays responsive
 * while the child talks to it.
 */
function runCli(args, { env = cleanEnv, timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [INDEX, ...args], { env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI run timed out: ${args.join(" ")}`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.stdin.end();
    child.on("error", (cause) => {
      clearTimeout(timer);
      reject(cause);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * Spawn the server, write JSON-RPC lines to stdin (objects are serialized,
 * strings pass through verbatim for malformed-input tests), and collect
 * stdout lines until every expected id has a response. Returns a Map keyed
 * by response id (parse errors arrive keyed as null). Kills the child on
 * timeout so a hung server fails the test instead of the whole run.
 */
function rpcSession(
  messages,
  { args = ["--key", "ag_test_dummy"], env = cleanEnv, expectIds, timeoutMs = 30_000 } = {},
) {
  const ids =
    expectIds ??
    messages.filter((message) => typeof message === "object" && "id" in message).map((message) => message.id);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [INDEX, ...args], { env });
    const wanted = new Set(ids);
    const byId = new Map();
    let buffer = "";
    let settled = false;
    const finish = (cause) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (cause) reject(cause);
      else resolve(byId);
    };
    const timer = setTimeout(() => {
      finish(new Error(`rpc session timed out waiting for ids [${[...wanted].join(", ")}]`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        byId.set(message.id ?? null, message);
        wanted.delete(message.id ?? null);
      }
      if (wanted.size === 0) finish();
    });
    child.on("error", finish);
    for (const message of messages) {
      child.stdin.write(typeof message === "string" ? `${message}\n` : `${JSON.stringify(message)}\n`);
    }
  });
}

const callFetch = (id, args) => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name: "fetch_raw_answers", arguments: args },
});

// ---------------------------------------------------------------------------
// 1. CLI flags
// ---------------------------------------------------------------------------

test("--version prints the VERSION and exits 0", async () => {
  const out = await runCli(["--version"]);
  assert.equal(out.code, 0);
  assert.equal(out.stdout.trim(), PKG.version);
});

test("--help exits 0 and documents --smoke", async () => {
  const out = await runCli(["--help"]);
  assert.equal(out.code, 0);
  assert.match(out.stdout, /Usage:/);
  assert.match(out.stdout, /--smoke/);
});

test("no key fails fast: exit 1 with missing API key on stderr", async () => {
  const out = await runCli([]);
  assert.equal(out.code, 1);
  assert.match(out.stderr, /missing API key/);
});

// ---------------------------------------------------------------------------
// 2. JSON-RPC protocol surface (no network needed)
// ---------------------------------------------------------------------------

test("initialize, ping, tools/list", async () => {
  const byId = await rpcSession([
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    },
    { jsonrpc: "2.0", id: 2, method: "ping" },
    { jsonrpc: "2.0", id: 3, method: "tools/list" },
  ]);
  assert.equal(byId.get(1).result.serverInfo.name, "agentgeo-mcp");
  assert.equal(byId.get(1).result.serverInfo.version, PKG.version);
  assert.ok(byId.get(1).result.capabilities.prompts, "prompts capability must be declared");
  assert.match(byId.get(1).result.instructions, /list_geo_skills/);
  assert.deepEqual(byId.get(2).result, {});
  const tools = byId.get(3).result.tools;
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["list_geo_skills", "get_geo_skill", "fetch_raw_answers"],
  );
});

test("unknown method returns -32601", async () => {
  const byId = await rpcSession([{ jsonrpc: "2.0", id: 4, method: "resources/list" }]);
  assert.equal(byId.get(4).error.code, -32601);
});

test("unknown tool returns -32602", async () => {
  const byId = await rpcSession([
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "rank_answers", arguments: {} } },
  ]);
  assert.equal(byId.get(5).error.code, -32602);
  assert.match(byId.get(5).error.message, /Unknown tool/);
});

test("malformed JSON line returns -32700", async () => {
  const byId = await rpcSession(["{this is not json"], { expectIds: [null] });
  assert.equal(byId.get(null).error.code, -32700);
});

test("invalid arguments return -32602 with supported_surfaces in data", async () => {
  const byId = await rpcSession([
    callFetch(10, { query: "   ", surfaces: ["chatgpt"] }), // whitespace-only query
    callFetch(11, { query: "hello", surfaces: [] }), // empty surfaces
    callFetch(12, { query: "hello", surfaces: ["bing"] }), // unsupported surface
  ]);
  for (const id of [10, 11, 12]) {
    assert.equal(byId.get(id).error.code, -32602, `id ${id} should be -32602`);
    assert.deepEqual(byId.get(id).error.data.supported_surfaces, SURFACES, `id ${id} should list surfaces`);
  }
  assert.deepEqual(byId.get(12).error.data.invalid_surfaces, ["bing"]);
});

// ---------------------------------------------------------------------------
// 3. tools/call against the local mock
// ---------------------------------------------------------------------------

test("successful fetch: structuredContent, defaults, and forwarded fields", async () => {
  const byId = await rpcSession(
    [callFetch(20, { query: "ok", surfaces: ["chatgpt"], web_search: true, snapshot_id: "s_123" })],
    { args: ["--key", "ag_test_dummy", "--api-url", mockUrl] },
  );
  const res = byId.get(20).result;
  assert.ok(!res.isError, "success must not set isError");
  assert.equal(res.content[0].type, "text");
  assert.ok(res.structuredContent, "structuredContent must be present");
  assert.equal(res.structuredContent.mode, "demo");
  const received = res.structuredContent.received;
  assert.equal(received.query, "ok");
  assert.deepEqual(received.surfaces, ["chatgpt"]);
  assert.equal(received.country, "US", "country default must be US");
  assert.equal(received.language, "en", "language default must be en");
  assert.equal(received.web_search, true, "explicit web_search must be forwarded");
  assert.equal(received.snapshot_id, "s_123", "snapshot_id must be forwarded");
});

test("HTTP 200 with a non-JSON body is a tool error", async () => {
  const byId = await rpcSession([callFetch(21, { query: "notjson", surfaces: ["chatgpt"] })], {
    args: ["--key", "ag_test_dummy", "--api-url", mockUrl],
  });
  const res = byId.get(21).result;
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /non-JSON/);
});

test("HTTP 500 is a tool error", async () => {
  const byId = await rpcSession([callFetch(22, { query: "boom", surfaces: ["chatgpt"] })], {
    args: ["--key", "ag_test_dummy", "--api-url", mockUrl],
  });
  const res = byId.get(22).result;
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /internal error/);
});

test("unreachable API is a tool error mentioning unavailable", async () => {
  const port = await deadPort();
  const byId = await rpcSession([callFetch(23, { query: "ok", surfaces: ["chatgpt"] })], {
    args: ["--key", "ag_test_dummy", "--api-url", `http://127.0.0.1:${port}`],
  });
  const res = byId.get(23).result;
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /unavailable/);
});

test("AGENTGEO_TIMEOUT_MS bounds the fetch: a slow response becomes a tool error", async () => {
  const byId = await rpcSession([callFetch(24, { query: "slow", surfaces: ["chatgpt"] })], {
    args: ["--key", "ag_test_dummy", "--api-url", mockUrl],
    env: { ...cleanEnv, AGENTGEO_TIMEOUT_MS: "150" },
  });
  const res = byId.get(24).result;
  assert.equal(res.isError, true, "a fetch exceeding the timeout must be a tool error");
});

// Regression: requests used to chain onto one global promise queue, so a slow
// fetch head-of-line blocked every request behind it — a client fanning out N
// prompt fetches got them executed strictly sequentially (N × fetch duration),
// and queued calls timed out client-side before the API was even contacted.
// Concurrent dispatch means the fast fetch's response must land while the slow
// one (2s mock delay) is still in flight. Map preserves insertion order, so
// the order of rpcSession's keys IS the arrival order.
test("tools/call requests run concurrently: a slow fetch does not block a fast one", async () => {
  const byId = await rpcSession(
    [
      callFetch(26, { query: "slow", surfaces: ["chatgpt"] }),
      callFetch(27, { query: "ok", surfaces: ["chatgpt"] }),
    ],
    { args: ["--key", "ag_test_dummy", "--api-url", mockUrl] },
  );
  assert.ok(!byId.get(26).result.isError, "slow fetch must still succeed");
  assert.ok(!byId.get(27).result.isError, "fast fetch must succeed");
  const arrival = [...byId.keys()];
  assert.deepEqual(
    arrival,
    [27, 26],
    "the fast fetch's response must arrive before the slow fetch's (no head-of-line blocking)",
  );
});

test("an invalid AGENTGEO_TIMEOUT_MS falls back to the default (fetch still succeeds)", async () => {
  const byId = await rpcSession([callFetch(25, { query: "ok", surfaces: ["chatgpt"] })], {
    args: ["--key", "ag_test_dummy", "--api-url", mockUrl],
    env: { ...cleanEnv, AGENTGEO_TIMEOUT_MS: "not-a-number" },
  });
  const res = byId.get(25).result;
  assert.ok(!res.isError, "an unparseable override must not break fetching");
});

// ---------------------------------------------------------------------------
// 4. --smoke
// ---------------------------------------------------------------------------

test("--smoke against a healthy API exits 0 and reports api-url and count", async () => {
  const out = await runCli(["--smoke", "--key", "ag_test_dummy", "--api-url", mockUrl]);
  assert.equal(out.code, 0);
  assert.ok(out.stdout.includes(mockUrl), "output must mention the resolved api-url");
  assert.match(out.stdout, /6/);
  assert.match(out.stdout, /ag_test_/);
  assert.ok(!out.stdout.includes("ag_test_dummy"), "the key itself must never be printed");
});

test("--smoke against a dead port exits 1", async () => {
  const port = await deadPort();
  const out = await runCli(["--smoke", "--api-url", `http://127.0.0.1:${port}`, "--key", "ag_live_dummy"]);
  assert.equal(out.code, 1);
  assert.match(out.stdout, /unreachable/);
});

test("--smoke runs without a key (no fail-fast)", async () => {
  const out = await runCli(["--smoke", "--api-url", mockUrl]);
  assert.equal(out.code, 0, "smoke must not require a key");
  assert.match(out.stdout, /none set/);
  assert.doesNotMatch(out.stderr, /missing API key/);
});

// ---------------------------------------------------------------------------
// 5. Built-in GEO skills: tools + prompts
// ---------------------------------------------------------------------------

/** Mirrors scripts/build-skill-bundle.mjs ORDER (the recommended pipeline). */
const PIPELINE_ORDER = [
  "geo-prompt-set",
  "geo-visibility",
  "geo-share-of-voice",
  "geo-citations",
  "geo-sentiment",
  "geo-competitors",
  "geo-monitor",
  "geo-report",
];

const callTool = (id, name, args = {}) => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name, arguments: args },
});

test("list_geo_skills prefers the live catalog over the bundle", async () => {
  const byId = await rpcSession([callTool(30, "list_geo_skills")], {
    args: ["--key", "ag_test_dummy", "--api-url", mockUrl],
  });
  const res = byId.get(30).result;
  assert.ok(!res.isError, "listing skills must never be an error");
  const payload = res.structuredContent;
  assert.equal(payload.object, "skill_list");
  assert.equal(payload.count, 1, "the mock's one-entry live catalog must win over the bundle");
  assert.equal(payload.skills[0].version, "9.9.9");
  assert.match(payload.pipeline, /geo-prompt-set/);
  assert.match(payload.next_step, /get_geo_skill/);
});

test("list_geo_skills falls back to the eight bundled skills when the API is unreachable", async () => {
  const port = await deadPort();
  const byId = await rpcSession([callTool(31, "list_geo_skills")], {
    args: ["--key", "ag_test_dummy", "--api-url", `http://127.0.0.1:${port}`],
  });
  const payload = byId.get(31).result.structuredContent;
  assert.equal(payload.count, 8);
  assert.deepEqual(
    payload.skills.map((skill) => skill.name),
    PIPELINE_ORDER,
    "bundled skills must list in pipeline order",
  );
});

test("get_geo_skill returns the live SKILL.md when the API serves it", async () => {
  const byId = await rpcSession([callTool(32, "get_geo_skill", { name: "geo-visibility" })], {
    args: ["--key", "ag_test_dummy", "--api-url", mockUrl],
  });
  const res = byId.get(32).result;
  assert.ok(!res.isError);
  assert.equal(res.content[0].text, "# LIVE geo-visibility workflow");
});

test("get_geo_skill falls back to the bundled copy on a non-JSON response", async () => {
  const byId = await rpcSession([callTool(33, "get_geo_skill", { name: "geo-report" })], {
    args: ["--key", "ag_test_dummy", "--api-url", mockUrl],
  });
  const text = byId.get(33).result.content[0].text;
  assert.ok(text.startsWith("---"), "bundled SKILL.md keeps its frontmatter");
  assert.match(text, /# geo-report Skill/);
});

test("get_geo_skill falls back to the bundled copy on a 404", async () => {
  const byId = await rpcSession([callTool(34, "get_geo_skill", { name: "geo-monitor" })], {
    args: ["--key", "ag_test_dummy", "--api-url", mockUrl],
  });
  assert.match(byId.get(34).result.content[0].text, /# geo-monitor Skill/);
});

test("get_geo_skill serves a catalog-only skill the bundle doesn't know", async () => {
  const byId = await rpcSession([callTool(35, "get_geo_skill", { name: "geo-ninth" })], {
    args: ["--key", "ag_test_dummy", "--api-url", mockUrl],
  });
  const res = byId.get(35).result;
  assert.ok(!res.isError, "a live-catalog skill must resolve even without a bundled copy");
  assert.equal(res.content[0].text, "# NINTH workflow");
});

// Regression: concurrent request dispatch (the parallel-fetch fix) exposed a
// check-then-act race in the skill cache — two get_geo_skill calls for the same
// name each fired their own authenticated fetch, and a slow one falling back to
// the bundle could overwrite a live copy a fast one had cached. Single-flight
// caching (one shared in-flight promise per name) collapses concurrent same-name
// loads to ONE upstream fetch. The mock counts fetches for this probe name.
test("get_geo_skill is single-flight: concurrent same-name loads share one upstream fetch", async () => {
  const byId = await rpcSession(
    [
      callTool(45, "get_geo_skill", { name: "geo-singleflight" }),
      callTool(46, "get_geo_skill", { name: "geo-singleflight" }),
    ],
    { args: ["--key", "ag_test_dummy", "--api-url", mockUrl] },
  );
  assert.equal(byId.get(45).result.content[0].text, "# SINGLEFLIGHT live workflow");
  assert.equal(byId.get(46).result.content[0].text, "# SINGLEFLIGHT live workflow");
  const { count } = await fetch(`${mockUrl}/__singleflight_count`).then((r) => r.json());
  assert.equal(count, 1, "two concurrent same-name loads must issue exactly one upstream fetch");
});

test("get_geo_skill rejects an unknown skill name when the API misses too", async () => {
  const byId = await rpcSession([callTool(36, "get_geo_skill", { name: "geo-nonsense" })], {
    args: ["--key", "ag_test_dummy", "--api-url", mockUrl],
  });
  assert.equal(byId.get(36).error.code, -32602);
  assert.deepEqual(byId.get(36).error.data.known_skills, PIPELINE_ORDER);
});

test("get_geo_skill rejects an unknown name offline (bundle miss, API down)", async () => {
  const port = await deadPort();
  const byId = await rpcSession([callTool(37, "get_geo_skill", { name: "geo-nonsense" })], {
    args: ["--key", "ag_test_dummy", "--api-url", `http://127.0.0.1:${port}`],
  });
  assert.equal(byId.get(37).error.code, -32602);
});

test("get_geo_skill rejects path-shaped names before any network call", async () => {
  // No --api-url: a name that failed the slug gate must never reach fetch, so
  // the default hosted API being unreachable in tests is irrelevant.
  const byId = await rpcSession([
    callTool(38, "get_geo_skill", { name: "../keys" }),
    callTool(39, "get_geo_skill", { name: "geo/../fetches" }),
  ]);
  assert.equal(byId.get(38).error.code, -32602);
  assert.equal(byId.get(39).error.code, -32602);
});

test("prompts/list returns the eight skills in pipeline order", async () => {
  const byId = await rpcSession([{ jsonrpc: "2.0", id: 40, method: "prompts/list" }]);
  const prompts = byId.get(40).result.prompts;
  assert.deepEqual(
    prompts.map((prompt) => prompt.name),
    PIPELINE_ORDER,
  );
  for (const prompt of prompts) {
    assert.ok(!prompt.description.includes("Use when"), `${prompt.name}: trigger tail must be trimmed`);
    assert.equal(prompt.arguments[0].name, "request");
    assert.equal(prompt.arguments[0].required, false);
  }
});

test("prompts/get returns the workflow and appends the request argument", async () => {
  const port = await deadPort();
  const byId = await rpcSession(
    [
      {
        jsonrpc: "2.0",
        id: 41,
        method: "prompts/get",
        params: { name: "geo-prompt-set", arguments: { request: "acme.com vs notion.so" } },
      },
    ],
    { args: ["--key", "ag_test_dummy", "--api-url", `http://127.0.0.1:${port}`] },
  );
  const res = byId.get(41).result;
  const text = res.messages[0].content.text;
  assert.equal(res.messages[0].role, "user");
  assert.ok(text.startsWith("---"), "the workflow leads");
  assert.ok(text.endsWith("User request: acme.com vs notion.so"), "the request lands at the end");
});

test("prompts/get without arguments returns the bare workflow", async () => {
  const port = await deadPort();
  const byId = await rpcSession(
    [{ jsonrpc: "2.0", id: 42, method: "prompts/get", params: { name: "geo-report" } }],
    { args: ["--key", "ag_test_dummy", "--api-url", `http://127.0.0.1:${port}`] },
  );
  const text = byId.get(42).result.messages[0].content.text;
  assert.match(text, /# geo-report Skill/);
  assert.ok(!text.includes("User request:"), "no argument, no appendix");
});

test("prompts/get rejects an unknown prompt", async () => {
  const byId = await rpcSession([
    { jsonrpc: "2.0", id: 43, method: "prompts/get", params: { name: "geo-nonsense" } },
  ]);
  assert.equal(byId.get(43).error.code, -32602);
  assert.deepEqual(byId.get(43).error.data.known_prompts, PIPELINE_ORDER);
});
