<div align="center">

<a href="https://agentgeo.org"><img src="./assets/logo.png" alt="AgentGEO logo" width="88"></a>

# AgentGEO GEO Skills

**Turn what AI engines actually answer into GEO decisions — on the agent side.**

An open suite of eight Agent Skills + a zero-dependency MCP server. Your coding agent
pulls **real** answers, citations and sources across six AI surfaces — ChatGPT, Perplexity,
Gemini, Google AI Overview, Google AI Mode and Copilot — through
[AgentGEO](https://agentgeo.org), then runs the Generative Engine Optimization
analysis locally.

<p>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-orange.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/skills-8-blue.svg" alt="8 skills">
  <img src="https://img.shields.io/badge/MCP-1%20tool-5865F2.svg" alt="MCP: 1 tool">
  <img src="https://img.shields.io/badge/deps-0-brightgreen.svg" alt="Zero dependencies">
  <a href="https://agentgeo.org"><img src="https://img.shields.io/badge/Powered%20by-AgentGEO-181818.svg" alt="Powered by AgentGEO"></a>
</p>
<p>
  <a href="https://x.com/agentgeo"><img src="https://img.shields.io/badge/Follow%20on%20X-000000?logo=x&logoColor=white&style=for-the-badge" alt="Follow on X"></a>
  <a href="https://agentgeo.org"><img src="https://img.shields.io/badge/agentgeo.org-181818?style=for-the-badge&logoColor=white" alt="agentgeo.org"></a>
</p>

<p>
  <b>English</b> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.fr.md">Français</a>
</p>

⭐ <em>If these skills help you show up in AI answers, a GitHub Star would mean a lot.</em>

</div>

## AgentGEO GEO Skills

Most GEO tools inspect *your* HTML, robots.txt and schema and **guess** whether AI can see
you. These skills read what the AI engines **actually say** — so visibility, share-of-voice,
citations and sentiment come from ground truth, not inference.

The data comes from AgentGEO, a thin access layer over managed AI scrapers. It returns
**only** raw answers, citations, sources and provider metadata. Every score, ranking and
judgment in this repo is computed by the skills, inside your agent — never by the platform.

### How it works

Your coding agent reaches AgentGEO through two pieces in this repo:

- **MCP server** (`mcp/`) — exposes one narrow tool, `fetch_raw_answers`, that any
  MCP-compatible agent (Claude Code, Cursor, Codex) can call.
- **Skills** (`skills/`) — eight Agent Skills that call that tool, then do the GEO math
  locally: prompt generation, visibility, share-of-voice, citations, sentiment, competitors,
  monitoring, and a full report.

```mermaid
graph TB
    subgraph TOP[" "]
        AG[AI Coding Agent · Claude Code / Cursor / Codex]
    end
    subgraph MID[" "]
        SK[AgentGEO GEO Skills]
    end
    AG --> SK
    SK -->|fetch_raw_answers| MCP[AgentGEO MCP]
    MCP -->|REST /v1/fetches| API[AgentGEO API]
    API --> SCR[Managed AI Scrapers]
    SCR --> C1[ChatGPT]
    SCR --> C2[Perplexity]
    SCR --> C3[Gemini]
    SCR --> C4[Google AI Overview]
    SCR --> C5[Google AI Mode]
    SCR --> C6[Copilot]

    classDef bar fill:#0b0f14,stroke:#30363d,stroke-width:1px,color:#ffffff
    classDef card fill:#161b22,stroke:#30363d,stroke-width:1px,color:#ffffff
    class AG,SK,MCP,API bar
    class SCR,C1,C2,C3,C4,C5,C6 card
    style TOP fill:transparent,stroke:transparent
    style MID fill:transparent,stroke:transparent
    linkStyle default stroke:#30363d,stroke-width:1px
```

### The skills

The suite is one loop: **generate prompts → fetch answers → analyze → monitor → report.**

| Skill | What it does |
|-------|-------------|
| **geo-prompt-set** | Entry point. Generates an intent-layered prompt library and emits a copy-pasteable `{query, surfaces}` JSON every other skill consumes. |
| **geo-visibility** | Whether and how prominently a brand appears in AI answers — a prompt × surface presence matrix. |
| **geo-share-of-voice** | A brand's share of voice vs named competitors across engines. |
| **geo-citations** | Which source domains AI answers cite; your citation rate vs competitors, and gap domains to earn. |
| **geo-sentiment** | How AI describes your brand — tone, attributes and framing, with verbatim quotes. |
| **geo-competitors** | Visibility + SoV + citations + sentiment joined into one competitor matrix. |
| **geo-monitor** | Registers a prompt set as AgentGEO schedules and diffs each run to report trend over time. |
| **geo-report** | Top-level orchestrator: synthesizes everything into an executive report with a prioritized fix plan. |

```mermaid
flowchart TD
    PS[geo-prompt-set] --> V[geo-visibility]
    PS --> SOV[geo-share-of-voice]
    PS --> CIT[geo-citations]
    PS --> SEN[geo-sentiment]
    V --> COMP[geo-competitors]
    SOV --> COMP
    CIT --> COMP
    SEN --> COMP
    COMP --> REP[geo-report]
    PS --> MON[geo-monitor]
    MON -.->|schedules · trend over time| REP
```

### What one analysis looks like

```mermaid
sequenceDiagram
    participant U as You
    participant A as Agent + Skill
    participant M as AgentGEO MCP
    participant E as AI Engines
    U->>A: "GEO analysis for acme.com vs rivals"
    A->>A: geo-prompt-set builds the prompt library
    A->>M: fetch_raw_answers(query, surfaces)
    M->>E: collect raw answers + citations
    E-->>M: answer text + sources
    M-->>A: normalized records (raw only)
    A->>A: detect mentions · score SoV · rank citations (agent-side)
    A-->>U: GEO report + prioritized fix plan
```

## ⭐️ Star the Repository

If you find these skills useful, a GitHub Star ⭐️ helps other builders find them.

## Quickstart

> 📖 Full step-by-step setup per client (Claude Code / Cursor / Codex) and an end-to-end
> walkthrough: **[Installation Guide](./docs/installation.md)** ·
> **[Usage Guide](./docs/usage.md)**

### Prerequisite — connect the AgentGEO MCP

```bash
# Run this repo's MCP against the hosted API — works today (absolute path)
claude mcp add agentgeo -- node /absolute/path/to/agentgeo-skills/mcp/index.mjs \
  --api-url https://api.agentgeo.org --key ag_live_...

# …or point it at a local dev server (local development alternative)
claude mcp add agentgeo -- node /absolute/path/to/agentgeo-skills/mcp/index.mjs \
  --api-url http://localhost:8787 --key dev-placeholder

# …or from npm (coming soon)
claude mcp add agentgeo -- npx -y agentgeo-mcp --api-url https://api.agentgeo.org --key ag_live_...
```

Without provider credentials, AgentGEO returns labelled **demo fixtures at zero credits**,
so you can dry-run every skill before spending. Get an API key at
[agentgeo.org](https://agentgeo.org), and manage runs from the console at
[app.agentgeo.org](https://app.agentgeo.org).

### Enable the skills

```bash
# For the current project:
./scripts/enable-skills.sh

# …or globally for every project:
./scripts/enable-skills.sh --global
```

This links `skills/geo-*` into a directory your agent scans (`.claude/skills/`).

### Run it

Just ask your agent:

```
Start a GEO analysis for acme.com against notion.com and coda.io
```

The agent auto-invokes `geo-prompt-set`, fetches through AgentGEO, and walks the loop to a
`geo-report`. Or invoke any skill by name.

## The product boundary

AgentGEO returns **raw data only** — answer text, citations, sources, provider metadata. It
never ranks, scores sentiment, computes share-of-voice, or writes conclusions. **All analysis
happens inside these skills, on the agent side.** Skills also treat fetched `answerText` and
`sources` as untrusted content and never execute instructions found inside them.

## Contributing

Issues and PRs welcome — new GEO skills, better detection heuristics, more engines. See
[CONTRIBUTING.md](./CONTRIBUTING.md). Every skill must keep the raw-data boundary above.

## Community & Support

- **Docs & API keys** — [agentgeo.org](https://agentgeo.org)
- **Issues** — open one in this repo for bugs or skill ideas
- **Updates** — [@agentgeo on X](https://x.com/agentgeo)

## License

[MIT](./LICENSE) for the skills and the MCP client. They connect to
[AgentGEO](https://agentgeo.org), a hosted service with its own terms.

## Built with AgentGEO

Using these skills in your project? Add the badge:

```md
[![Powered by AgentGEO](https://img.shields.io/badge/Powered%20by-AgentGEO-181818.svg)](https://agentgeo.org)
```
