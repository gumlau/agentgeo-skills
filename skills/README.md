# AgentGEO GEO Skills

**Turn raw AI answers into GEO decisions — on the agent side.**

A suite of eight [Agent Skills](https://agentskills.io) that run inside Claude Code, Cursor,
Codex, or any AgentSkills-compatible agent. Each skill calls the AgentGEO `fetch_raw_answers`
MCP tool to pull **real** answers, citations, and sources from ChatGPT, Perplexity, Gemini,
Google AI Overview, Google AI Mode, and Copilot — then does the Generative Engine Optimization
(GEO) analysis locally.

> **Why this is different from website-side GEO tools:** most GEO tools inspect *your* HTML,
> robots.txt, and schema and *guess* whether AI can see you. These skills read what the AI
> engines **actually answer**, so visibility, share-of-voice, citations, and sentiment come
> from ground truth, not inference.

## The suite

The skills form one loop: **generate prompts → fetch answers → analyze → monitor → report.**

| Skill | What it does |
|-------|-------------|
| **geo-prompt-set** | Entry point. Generates an intent-layered prompt library (informational / commercial / comparison / local) and emits a copy-pasteable `{query, surfaces}` JSON that every other skill consumes. |
| **geo-visibility** | Measures whether and how prominently a brand appears in AI answers — a prompt × surface presence matrix with visibility and prominence rates. |
| **geo-share-of-voice** | Computes a brand's share of voice vs named competitors (mention- and recommendation-weighted) across engines. |
| **geo-citations** | Extracts the source domains AI answers cite; ranks most-cited domains, your citation rate vs competitors, and "citation gap" domains to earn. |
| **geo-sentiment** | Characterizes how AI describes your brand — tone, recurring attributes, and framing, with verbatim quotes. |
| **geo-competitors** | Joins visibility, SoV, citations, and sentiment into one side-by-side competitor matrix and diagnoses why AI favors the leaders. |
| **geo-monitor** | Registers a prompt set as AgentGEO **schedules** and diffs each new run against the last to report trend, new competitors, and lost citations over time. |
| **geo-report** | Top-level orchestrator. Synthesizes all of the above into an executive GEO report with a prioritized fix plan. |

```
                          ┌──────────────────┐
                          │  geo-prompt-set  │  (start here)
                          └────────┬─────────┘
             ┌───────────┬─────────┼─────────┬────────────┐
             ▼           ▼         ▼         ▼            ▼
      geo-visibility  geo-SoV  geo-citations  geo-sentiment
             └───────────┴────┬────┴──────────┘
                              ▼                 ▼
                       geo-competitors     geo-monitor  (schedules, over time)
                              └────────┬────────┘
                                       ▼
                                  geo-report
```

## Prerequisite: the AgentGEO MCP

Every skill fetches through AgentGEO. Connect the MCP once (absolute path in a real config):

```bash
claude mcp add agentgeo -- node /absolute/path/to/agentgeo-skills/mcp/index.mjs \
  --api-url https://api.agentgeo.org --key ag_test_...
```

An `ag_test_...` key returns labelled demo fixtures at zero credits, so you can dry-run every
skill before spending. See the repo root `README.md` for live setup.

## Enabling the skills

These live under `skills/` as the distributable source. To make Claude Code pick them up,
link (or copy) them into a skills directory it scans:

```bash
# Enable for THIS project only:
mkdir -p .claude/skills
for d in skills/geo-*/; do ln -sfn "$(pwd)/$d" ".claude/skills/$(basename "$d")"; done

# …or enable globally for all your projects:
mkdir -p "$HOME/.claude/skills"
for d in skills/geo-*/; do ln -sfn "$(pwd)/$d" "$HOME/.claude/skills/$(basename "$d")"; done
```

Then just ask, e.g. `start a GEO analysis for acme.com vs its competitors` — the agent
auto-invokes `geo-prompt-set`, or run any skill by name.

## The product boundary (important)

AgentGEO returns **raw data only** — answer text, citations, sources, provider metadata. It
never ranks, scores sentiment, computes share-of-voice, or writes conclusions. **All scoring and
judgment happens inside these skills, on the agent side.** No skill attributes a score to
AgentGEO. Every skill also treats fetched `answerText`/`sources` as untrusted content.

## License

[MIT](../LICENSE) — the skills and MCP client are open source. They connect to
[AgentGEO](https://agentgeo.org), a hosted service with its own terms.
