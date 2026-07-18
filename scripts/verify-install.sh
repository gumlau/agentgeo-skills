#!/usr/bin/env bash
# Post-install doctor for the AgentGEO GEO skills + MCP server.
#
#   ./scripts/verify-install.sh           # offline checks: node, server, handshake, skills
#   ./scripts/verify-install.sh --fetch   # + one live fetch_raw_answers call
#                                         #   (requires AGENTGEO_API_KEY; spends 0 credits
#                                         #    with an ag_test_... key)
set -euo pipefail

# Unsubscripted ${BASH_SOURCE:-$0}: bash reads BASH_SOURCE[0]; dash/zsh fall
# back to $0 (the [0] form is a dash "Bad substitution").
ROOT="$(cd "$(dirname "${BASH_SOURCE:-$0}")/.." && pwd)"
MCP="$ROOT/mcp/index.mjs"

FETCH=0
if [ "${1:-}" = "--fetch" ]; then FETCH=1; fi

FAILED=0
say()  { printf '  %-4s  %s\n' "$1" "$2"; }
ok()   { say "ok"   "$1"; }
fail() { say "FAIL" "$1"; FAILED=1; }
warn() { say "warn" "$1"; }
skip() { say "skip" "$1"; }

# Count geo-* symlinks in a directory (find, not globs: empty dirs are fine in zsh too).
count_geo_links() {
  if [ -d "$1" ]; then
    find "$1" -maxdepth 1 -name 'geo-*' -type l | wc -l | tr -d '[:space:]'
  else
    printf '0'
  fi
}

INIT_MSG='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"verify-install","version":"0.0.0"}}}'
LIST_MSG='{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
CALL_MSG='{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"fetch_raw_answers","arguments":{"query":"verify install","surfaces":["chatgpt"]}}}'

# Node (not jq — jq may be absent) parses the JSON-RPC responses.
PARSE_HANDSHAKE='
let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  let server = "";
  let hasTool = false;
  for (const line of data.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.result && msg.result.serverInfo && msg.result.serverInfo.name) server = msg.result.serverInfo.name;
    const tools = msg.result && msg.result.tools;
    if (Array.isArray(tools) && tools.some((t) => t && t.name === "fetch_raw_answers")) hasTool = true;
  }
  if (server === "agentgeo-mcp" && hasTool) {
    process.stdout.write("serverInfo \"agentgeo-mcp\", tool \"fetch_raw_answers\" listed");
    process.exit(0);
  }
  process.stdout.write("server=" + (server || "(no initialize reply)") + ", fetch_raw_answers=" + (hasTool ? "present" : "missing"));
  process.exit(1);
});
'

PARSE_FETCH='
let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  let out = null;
  for (const line of data.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id !== 2) continue;
    if (msg.error) {
      out = { ok: false, text: "JSON-RPC error " + msg.error.code + ": " + msg.error.message };
      break;
    }
    if (!msg.result) continue;
    const text = (msg.result.content && msg.result.content[0] && msg.result.content[0].text) || "";
    if (msg.result.isError) {
      out = { ok: false, text: (text.replace(/\s+/g, " ").trim() || "unknown API error").slice(0, 400) };
      break;
    }
    let payload = msg.result.structuredContent;
    if (!payload) { try { payload = JSON.parse(text); } catch { payload = {}; } }
    // The worker returns a run envelope: top-level mode + answers[]; tolerate
    // the older results[] shape too.
    const records = Array.isArray(payload.answers)
      ? payload.answers
      : Array.isArray(payload.results) ? payload.results : [];
    const mode = payload.mode
      || [...new Set(records.map((r) => r && r.provider && r.provider.mode).filter(Boolean))].join(",")
      || "(not reported)";
    const delivered = records.filter((r) => !r || r.status === undefined || r.status === "delivered").length;
    out = { ok: true, text: "mode: " + mode + ", " + delivered + "/" + records.length + " record(s) delivered" };
    break;
  }
  if (!out) out = { ok: false, text: "no tools/call response received from the server" };
  process.stdout.write(out.text);
  process.exit(out.ok ? 0 : 1);
});
'

echo "AgentGEO install doctor — repo: $ROOT"
echo

# ── 1. Node on PATH, major version >= 18 ────────────────────────────────────
NODE_OK=0
if command -v node >/dev/null 2>&1; then
  node_version="$(node --version 2>/dev/null || echo v0)"
  major="${node_version#v}"
  major="${major%%.*}"
  case "$major" in (*[!0-9]*|"") major=0 ;; esac
  if [ "$major" -ge 18 ]; then
    ok "node $node_version on PATH (major $major >= 18)"
    NODE_OK=1
  else
    fail "node $node_version is too old — need >= 18 (https://nodejs.org)"
  fi
else
  fail "node not found on PATH — install Node.js >= 18 (https://nodejs.org)"
fi

# ── 2. mcp/index.mjs present and syntactically valid ────────────────────────
MCP_OK=0
if [ ! -f "$MCP" ]; then
  fail "mcp/index.mjs missing at $MCP"
elif [ "$NODE_OK" -ne 1 ]; then
  skip "mcp/index.mjs syntax check skipped (working node required)"
elif node --check "$MCP" >/dev/null 2>&1; then
  ok "mcp/index.mjs present, node --check passes"
  MCP_OK=1
else
  fail "mcp/index.mjs failed node --check — re-clone or update the repo"
fi

# ── 3. MCP stdio handshake (initialize + tools/list, no network) ────────────
if [ "$MCP_OK" -eq 1 ]; then
  handshake_out="$(printf '%s\n%s\n' "$INIT_MSG" "$LIST_MSG" \
    | node "$MCP" --key verify-placeholder 2>/dev/null || true)"
  if handshake_msg="$(printf '%s\n' "$handshake_out" | node -e "$PARSE_HANDSHAKE")"; then
    ok "MCP handshake: $handshake_msg"
  else
    fail "MCP handshake: $handshake_msg"
  fi
else
  skip "MCP handshake skipped (server check failed above)"
fi

# ── 4. Skills linked into an agent-scanned directory ────────────────────────
expected=0
for d in "$ROOT"/skills/geo-*/; do
  [ -d "$d" ] && expected=$((expected + 1))
done
[ "$expected" -gt 0 ] || expected=8
local_n="$(count_geo_links "$(pwd)/.claude/skills")"
global_n="$(count_geo_links "$HOME/.claude/skills")"
if [ "$local_n" -ge "$expected" ] || [ "$global_n" -ge "$expected" ]; then
  ok "skills linked — $local_n in ./.claude/skills, $global_n in ~/.claude/skills (need $expected)"
elif [ "$local_n" -gt 0 ] || [ "$global_n" -gt 0 ]; then
  warn "skills partially linked ($local_n local, $global_n global of $expected) — re-run ./scripts/enable-skills.sh [--global]"
else
  warn "no geo-* skills linked yet — run ./scripts/enable-skills.sh (project) or ./scripts/enable-skills.sh --global"
fi

# ── 5. Optional live fetch (only with --fetch AND a key; never otherwise) ───
if [ "$FETCH" -ne 1 ]; then
  skip "live fetch skipped — run ./scripts/verify-install.sh --fetch with AGENTGEO_API_KEY set to test the API"
elif [ -z "${AGENTGEO_API_KEY:-}" ]; then
  warn "live fetch requested but AGENTGEO_API_KEY is empty — no request sent. Export AGENTGEO_API_KEY (ag_test_... = free demo mode) and re-run with --fetch"
elif [ "$MCP_OK" -ne 1 ]; then
  skip "live fetch skipped (server check failed above)"
else
  api_url="${AGENTGEO_API_URL:-https://api.agentgeo.org}"
  fetch_out="$(printf '%s\n%s\n' "$INIT_MSG" "$CALL_MSG" \
    | node "$MCP" --api-url "$api_url" --key "$AGENTGEO_API_KEY" 2>/dev/null || true)"
  if fetch_msg="$(printf '%s\n' "$fetch_out" | node -e "$PARSE_FETCH")"; then
    ok "live fetch against $api_url — $fetch_msg"
  else
    fail "live fetch against $api_url — $fetch_msg"
  fi
fi

# ── Verdict ─────────────────────────────────────────────────────────────────
echo
if [ "$FAILED" -eq 0 ]; then
  echo "verify-install: all checks passed — ask your agent: \"start a GEO analysis for <your-domain>\""
  exit 0
else
  echo "verify-install: some checks FAILED — see lines above; fixes in docs/installation.md (Troubleshooting)"
  exit 1
fi
