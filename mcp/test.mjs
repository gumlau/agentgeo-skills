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

before(async () => {
  mock = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
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
  assert.deepEqual(byId.get(2).result, {});
  const tools = byId.get(3).result.tools;
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "fetch_raw_answers");
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
