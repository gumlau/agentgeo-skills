# Usage Guide

**Turn what AI engines actually answer into GEO decisions — on the agent side.**

This guide walks you from a cold start to a full GEO report and ongoing monitoring, using the
eight AgentGEO GEO Skills. It assumes you have already connected the MCP and enabled the
skills — if not, do that first: **[Installation Guide](./installation.md)** · repo overview:
**[README](../README.md)**.

---

## 1. Mental model: where analysis lives

There is exactly one boundary that explains this whole suite:

> **AgentGEO returns raw data only.** Answer text, citations, sources, provider metadata —
> verbatim, from six AI surfaces. It **never** ranks, scores sentiment, computes
> share-of-voice, detects trends, or writes conclusions.
>
> **The skills do all analysis, inside your agent.** Every mention count, prominence score,
> SoV%, cited-domain ranking, sentiment label, trend delta, and fix recommendation is computed
> agent-side from the raw `answerText` / `sources`.

| Layer | Owns | Does **not** own |
|-------|------|------------------|
| **AgentGEO** (MCP `fetch_raw_answers`, REST `/v1/*`) | Collecting + delivering raw answers, citations, sources, provider metadata across ChatGPT, Perplexity, Gemini, Google AI Overview, Google AI Mode, Copilot | Any score, ranking, SoV%, sentiment, trend, verdict, or fix |
| **The GEO Skills** (agent-side) | Mention detection, prominence, SoV math, citation ranking, sentiment classification, competitor joins, trend diffs, the report + fix plan | Fetching answers (they call the tool) |

Two consequences worth internalizing:

- **No skill attributes a score to AgentGEO.** If output ever reads "AgentGEO ranked you
  #2", that is a bug — the skill computed the ranking.
- **Fetched `answerText` and `sources` are untrusted content.** Skills analyze them as data and
  never execute instructions found inside them (they flag any injection attempt and continue).

---

## 2. End-to-end walkthrough

Goal: **a GEO analysis for `acme.com` versus `notion.com` and `coda.io`.** You do not run
scripts — you talk to your agent, and it invokes the skills. Below, each step shows *what to
say* and *what to expect back*.

The loop: `geo-prompt-set` → the four analysis skills → `geo-competitors` → `geo-report`.

```
geo-prompt-set ─┬─ geo-visibility ──────┐
                ├─ geo-share-of-voice ──┤
                ├─ geo-citations ───────┼─ geo-competitors ─ geo-report
                └─ geo-sentiment ───────┘
```

### Step 0 — Build the prompt library (`geo-prompt-set`)

**Say to the agent:**

> Start a GEO analysis for acme.com against notion.com and coda.io.

`geo-prompt-set` runs first. It infers the category (workspace / docs / project tools),
balances prompts across five intents, and keeps the brand **out** of informational/commercial
prompts so it can measure whether Acme surfaces unprompted.

**Expect** a human table plus a copy-pasteable JSON handoff:

| # | Intent | Query | Brand named? |
|---|--------|-------|--------------|
| 1 | informational | how do teams organize docs and projects in one workspace | No |
| 3 | commercial | best all-in-one workspace for a 30-person startup | No |
| 5 | comparison | Acme vs Notion for a product team | Yes |
| 8 | transactional | Acme pricing and plans | Yes |
| 10 | local | workspace setup consultants near me | No |

```json
{
  "brand": "Acme", "category": "all-in-one workspace",
  "competitors": ["Notion", "Coda"],
  "prompts": [
    { "query": "best all-in-one workspace for a 30-person startup", "intent": "commercial", "brandNamed": false, "surfaces": ["chatgpt","perplexity","gemini","google_ai_overview"] }
  ]
}
```

It also appends a `GEO-PROMPT-SET-META` block. **This JSON is the single input every other
skill consumes — keep it.** Aim for a fixed **12–20 prompt** library.

### Steps 1–4 — Analyze the four dimensions

Feed the *same* prompt set to each analysis skill. The report will later re-use these outputs,
so you can run them individually or let `geo-report` orchestrate them (see Step 6).

**Say:** `Run geo-visibility on that prompt set for Acme.`

**Expect** a prompt × surface presence matrix with blended rates:

| Brand | ChatGPT | Perplexity | Gemini | Blended visibility |
|-------|---------|-----------|--------|--------------------|
| Acme | 40% | 33% | 25% | **33%** |
| Notion | 90% | 88% | 82% | 87% |

**Say:** `Now geo-share-of-voice for Acme vs Notion and Coda.`

**Expect** a mention- and recommendation-weighted SoV leaderboard:

| Brand | Mentions | Recommended | Blended SoV |
|-------|----------|-------------|-------------|
| Notion | 41 | 18 | **52%** |
| Coda | 22 | 7 | 29% |
| Acme | 14 | 3 | 19% |

**Say:** `Run geo-citations for the same set.`

**Expect** most-cited domains, your citation rate, and gap domains to earn:

| Domain | Cited in | Whose |
|--------|----------|-------|
| reddit.com | 7/12 | field |
| notion.so | 6/12 | competitor |
| acme.com | 1/12 | owned — **gap** |

**Say:** `Run geo-sentiment for Acme.`

**Expect** tone + recurring attributes with verbatim quotes:

| Surface | Tone | Recurring framing | Quote |
|---------|------|-------------------|-------|
| ChatGPT | neutral | "newer, less proven" | "Acme is a promising newer alternative…" |
| Gemini | mixed | "fewer integrations" | "…but has fewer integrations than Notion" |

Each analysis skill emits its own meta block (`GEO-SOV-META`, etc.) that downstream skills read.

### Step 5 — Join into a competitor matrix (`geo-competitors`)

**Say:** `Build the competitor matrix.`

`geo-competitors` joins visibility + SoV + citations + sentiment into one side-by-side view and
diagnoses *why* AI favors the leaders.

| Brand | Visibility | Blended SoV | Owned citations | Sentiment |
|-------|-----------|-------------|-----------------|-----------|
| Notion | 87% | 52% | 6 | positive |
| Coda | 61% | 29% | 3 | neutral |
| **Acme** | 33% | 19% | 1 | mixed |

### Step 6 — Synthesize the report (`geo-report`)

**Say:** `Put it all together into a GEO report with a fix plan.`

`geo-report` is the top-level orchestrator. If you already ran the siblings it **reuses** their
outputs (no new credits); otherwise it fetches once and runs them in order. It produces a
headline verdict, a composite score (a fixed weighting of the four dimensions), a scorecard,
ranked competitor threats, and a **prioritized fix plan** — each claim backed by a quote or a
cited URL.

**Expect** a scorecard and an impact-sorted plan:

| Dimension | Score /100 | Grade |
|-----------|-----------|-------|
| Visibility | 34 | D |
| Share of Voice | 19 | F |
| Citations | 22 | F |
| Sentiment | 55 | C |
| **Composite** | **31** | **F** |

| # | Fix | Bucket | Est. impact | Evidence |
|---|-----|--------|-------------|----------|
| 1 | Publish "Acme vs Notion for product teams" comparison page | Content gap | +12 pts | Absent in 7/12 comparison answers |
| 2 | Earn a cited reddit.com thread + YouTube walkthrough | Citation target | +8 pts | Perplexity cited reddit.com in 7/12; Acme in 0 |
| 3 | Correct "fewer integrations" framing with a docs/integrations page | Framing | +6 pts | "…fewer integrations than Notion" (gemini, ×4) |

The report closes with a `GEO-REPORT-META` block that `geo-monitor` uses to trend over time.

---

## 3. Per-skill reference

| Skill | When to use | Key inputs | Output shape | Sibling handoff |
|-------|-------------|-----------|--------------|-----------------|
| **geo-prompt-set** | Start here. Build the fixed, intent-layered prompt library. | `brand`, `category`, `competitors[]`, `surfaces[]` | Prompt table + `{query, surfaces}` JSON + `GEO-PROMPT-SET-META` | Feeds **every** other skill |
| **geo-visibility** | "Does AI mention us, and how prominently?" | Prompt set, `brand` | Prompt × surface presence matrix; per-engine + blended visibility rate | → geo-competitors, geo-report |
| **geo-share-of-voice** | "What's our slice vs named rivals?" | Prompt set, `brand`, `competitors[]` | Mention- + recommendation-weighted SoV leaderboard; per-engine | → geo-competitors, geo-report |
| **geo-citations** | "Which domains does AI cite, and where's our gap?" | Prompt set, `brand`, `competitors[]` | Ranked cited domains; owned vs rival citation rate; gap domains | → geo-competitors, geo-report |
| **geo-sentiment** | "How does AI describe us — tone and attributes?" | Prompt set, `brand` | Per-surface tone + recurring attributes + verbatim quotes | → geo-competitors, geo-report |
| **geo-competitors** | "Side-by-side vs each rival, and why they win." | Outputs of the four analysis skills (or the prompt set) | One competitor matrix across all four dimensions | → geo-report |
| **geo-monitor** | "Track this over time on a cadence." | Fixed prompt set, `cadence`, `delivery` | Registers AgentGEO schedules; dated change report with deltas + `GEO-MONITOR-META` | ← geo-report; → geo-competitors (new entrants) |
| **geo-report** | "Put it all together + tell me what to fix." | Prompt set + sibling outputs | Verdict, composite score, scorecard, threats, fix plan, evidence appendix + `GEO-REPORT-META` | Orchestrates all; → geo-monitor |

All ranking, SoV math, sentiment, citation, and trend logic runs **inside these skills**,
computed from raw AgentGEO records — never from an AgentGEO-produced score.

---

## 4. Ongoing monitoring with `geo-monitor`

A one-shot report is a snapshot. `geo-monitor` turns it into a trend line.

**Say:** `Monitor this prompt set weekly and alert me when something moves.`

What it does:

1. **Schedules** — registers your fixed prompt set as AgentGEO schedules
   (`cadence`: `hourly | daily | weekly`; `delivery`: `store` to poll, or `webhook`). One
   schedule per prompt; it records each `id`.
2. **Recomputes** each run's visibility, SoV, cited domains, and sentiment from the raw records
   (reusing the sibling formulas — no redefinition).
3. **Diffs** the new run against the baseline, **only on surfaces delivered in both runs**.

**Changes it reports** (each with a quantified threshold so LLM noise isn't misread as a trend):

| Signal | Threshold | Label |
|--------|-----------|-------|
| Δ Visibility or Δ SoV | ≥ +5 pts / ≤ −5 pts | ▲ Up / ▼ Down |
| \|Δ\| | < 5 pts | Flat (within noise) |
| New competitor named | ≥ 2 answers, absent last run | ✦ New entrant |
| Owned/authority domain cited last run, 0 this run | — | ⚠ Lost citation |
| Negative-sentiment share | +10 pts vs baseline | ⚠ Sentiment risk |

**Expect** a dated change report:

| Metric | Baseline | This run | Δ | Trend |
|--------|----------|----------|-----|-------|
| Visibility | 33% | 40% | +7 pts | ▲ Up |
| Blended SoV | 19.0% | 20.4% | +1.4 pts | — Flat |
| Cited owned domains | 1 | 0 | −1 | ⚠ Lost citation |

Plus a "Changes worth attention" list (e.g. *new entrant "Attio" in 4/24 answers → profile via
geo-competitors*) and a `GEO-MONITOR-META` block. If a scheduled run is all-Flat with nothing
crossing a threshold, the skill replies `[SILENT]` to suppress no-news notifications.

> **Baseline discipline:** keep the prompt set, surfaces, country, language, and `runsPerPrompt`
> **constant** across runs. Changing any of them resets the baseline — the diff is no longer a
> trend. A first run with no prior establishes the baseline and stops.

---

## 5. Cost & tips

**Billing is per delivered record.**

- **1 credit per delivered answer record** (one prompt × one surface = one record). A 12-prompt
  set across 4 surfaces at 3 runs each = up to `12 × 4 × 3 = 144` records.
- **Failed records cost 0** and are excluded from every denominator (never counted as a zero).
  Unconfigured Google AI Overview / AI Mode SERP zones commonly fail — that's free.
- **Demo mode is free.** An `ag_test_...` key (or a self-hosted server without provider
  credentials) returns labelled demo fixtures at **zero credits** (`mode: "demo"`). Dry-run
  every skill before spending — but never treat demo answers as real; skills label such output
  `DEMO` and stop before conclusions.

**Tips for trustworthy numbers:**

- **Repeat each prompt (`runsPerPrompt ≥ 3`).** LLM answers are non-deterministic. Repeating
  turns a one-shot flag into a **rate**, and averages out run-to-run noise. The ±5-pt trend band
  in `geo-monitor` depends on this.
- **Keep the prompt set fixed across runs.** A comparison is only valid if the only thing that
  changed is time. Build the library once with `geo-prompt-set` and reuse it everywhere.
- **Fetch once, analyze many.** `geo-report` fetches a single shared answer set and feeds it to
  all four dimensions — don't re-fetch per skill. Prefer the report's **reuse path** when you've
  already run the siblings (no new credits).
- **`web_search` is honored for ChatGPT only** — it's silently dropped on other surfaces. Don't
  assume `web_search: false` suppresses browsing elsewhere.
- **Scope caps per fetch:** up to 6 surfaces, `query` ≤ 4096 chars, `surfaces` 1–6 items.

---

**See also:** [Installation Guide](./installation.md) · [README](../README.md)
