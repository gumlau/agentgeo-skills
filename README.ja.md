<div align="center">

# ChatSights GEO Skills

**AI エンジンが実際に返す答えを、GEO の意思決定へ — エージェント側で。**

8 つの Agent Skill と、依存ゼロの MCP サーバーからなるオープンなスイートです。あなたのコーディングエージェントが、6 つの AI サーフェス（ChatGPT、Perplexity、Gemini、Google AI Overview、Google AI Mode、Copilot）にわたる**実際の**回答・引用・出典を [ChatSights](https://trychatsights.com) 経由で取得し、Generative Engine Optimization の分析をローカルで実行します。

<p>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-orange.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/skills-8-blue.svg" alt="8 skills">
  <img src="https://img.shields.io/badge/MCP-1%20tool-5865F2.svg" alt="MCP: 1 tool">
  <img src="https://img.shields.io/badge/deps-0-brightgreen.svg" alt="Zero dependencies">
  <a href="https://trychatsights.com"><img src="https://img.shields.io/badge/Powered%20by-ChatSights-181818.svg" alt="Powered by ChatSights"></a>
</p>
<p>
  <a href="https://x.com/chatsights"><img src="https://img.shields.io/badge/Follow%20on%20X-000000?logo=x&logoColor=white&style=for-the-badge" alt="Follow on X"></a>
  <a href="https://trychatsights.com"><img src="https://img.shields.io/badge/trychatsights.com-181818?style=for-the-badge&logoColor=white" alt="trychatsights.com"></a>
</p>

<p>
  <a href="./README.md">English</a> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <b>日本語</b> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.fr.md">Français</a>
</p>

⭐ <em>これらのスキルが AI の回答に登場する助けになったなら、GitHub スターをいただけると大変ありがたいです。</em>

</div>

## ChatSights GEO Skills

ほとんどの GEO ツールは*あなたの* HTML、robots.txt、スキーマを調べ、AI があなたを認識できるかどうかを**推測**します。これらのスキルは、AI エンジンが**実際に語る**内容を読み取ります。だからこそ、可視性・シェア・オブ・ボイス・引用・センチメントは、推論ではなく確かな事実（グラウンドトゥルース）から得られます。

データは、マネージド AI スクレイパーの薄いアクセス層である ChatSights から取得されます。返されるのは、生の回答・引用・出典・プロバイダーのメタデータ**のみ**です。このリポジトリのあらゆるスコア、ランキング、判定は、プラットフォームではなく、あなたのエージェント内でスキルによって算出されます。

### 仕組み

あなたのコーディングエージェントは、このリポジトリ内の 2 つの要素を通じて ChatSights に到達します。

- **MCP サーバー**（`mcp/`）— `fetch_raw_answers` という限定的なツールを 1 つだけ公開し、MCP 互換の任意のエージェント（Claude Code、Cursor、Codex）から呼び出せます。
- **スキル**（`skills/`）— そのツールを呼び出したうえで、GEO の計算をローカルで行う 8 つの Agent Skill です。プロンプト生成、可視性、シェア・オブ・ボイス、引用、センチメント、競合、モニタリング、そして完全なレポートを担います。

```mermaid
graph TB
    subgraph TOP[" "]
        AG[AI Coding Agent · Claude Code / Cursor / Codex]
    end
    subgraph MID[" "]
        SK[ChatSights GEO Skills]
    end
    AG --> SK
    SK -->|fetch_raw_answers| MCP[ChatSights MCP]
    MCP -->|REST /v1/fetches| API[ChatSights API]
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

### スキル一覧

このスイートは 1 つのループです。**プロンプトを生成 → 回答を取得 → 分析 → モニタリング → レポート。**

| スキル | 役割 |
|-------|-------------|
| **geo-prompt-set** | エントリーポイント。意図を階層化したプロンプトライブラリを生成し、他のすべてのスキルが利用するコピー&ペースト可能な `{query, surfaces}` JSON を出力します。 |
| **geo-visibility** | ブランドが AI の回答に登場するか、どれだけ目立って登場するか — プロンプト × サーフェスの登場マトリクス。 |
| **geo-share-of-voice** | 各エンジンにわたる、名指しした競合に対するブランドのシェア・オブ・ボイス。 |
| **geo-citations** | AI の回答がどの出典ドメインを引用しているか。競合と比較したあなたの引用率、そして獲得すべきギャップドメイン。 |
| **geo-sentiment** | AI があなたのブランドをどう描写しているか — トーン、属性、フレーミングを、逐語引用付きで。 |
| **geo-competitors** | 可視性 + SoV + 引用 + センチメントを 1 つの競合マトリクスに統合。 |
| **geo-monitor** | プロンプトセットを ChatSights のスケジュールとして登録し、各実行の差分を取って時系列のトレンドを報告します。 |
| **geo-report** | 最上位のオーケストレーター。すべてを統合し、優先順位付きの改善プランを備えたエグゼクティブレポートにまとめます。 |

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

### 1 回の分析の流れ

```mermaid
sequenceDiagram
    participant U as You
    participant A as Agent + Skill
    participant M as ChatSights MCP
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

## ⭐️ リポジトリにスターを

これらのスキルが役に立ったなら、GitHub スター ⭐️ が他のビルダーにも見つけてもらう助けになります。

## クイックスタート

> 📖 クライアント別（Claude Code / Cursor / Codex）のステップバイステップのセットアップと、エンドツーエンドのウォークスルーはこちら: **[インストールガイド](./docs/installation.md)** ·
> **[使い方ガイド](./docs/usage.md)**

### 前提 — ChatSights MCP を接続する

```bash
# Connect this repo's MCP to the hosted ChatSights API — works today (absolute path)
claude mcp add chatsights -- node /absolute/path/to/chatsights-geo-skills/mcp/index.mjs \
  --api-url https://api.trychatsights.com

# …or point it at a local dev server instead
claude mcp add chatsights -- node /absolute/path/to/chatsights-geo-skills/mcp/index.mjs \
  --api-url http://localhost:8080

# …or from npm (coming soon)
claude mcp add chatsights -- npx -y chatsights-mcp --api-url https://api.trychatsights.com
```

プロバイダーの認証情報がなくても、ChatSights はラベル付きの**デモフィクスチャをクレジット消費ゼロで**返します。そのため、費用をかける前にすべてのスキルをドライランで試せます。API キーは [trychatsights.com](https://trychatsights.com) で取得してください。

### スキルを有効化する

```bash
# For the current project:
./scripts/enable-skills.sh

# …or globally for every project:
./scripts/enable-skills.sh --global
```

これにより `skills/geo-*` が、エージェントがスキャンするディレクトリ（`.claude/skills/`）へリンクされます。

### 実行する

エージェントにこう頼むだけです。

```
Start a GEO analysis for acme.com against notion.com and coda.io
```

エージェントは `geo-prompt-set` を自動的に呼び出し、ChatSights を通じてデータを取得し、ループをたどって `geo-report` まで進めます。もちろん、任意のスキルを名前で直接呼び出すこともできます。

## プロダクトの境界

ChatSights が返すのは**生データのみ**です — 回答テキスト、引用、出典、プロバイダーのメタデータ。ランキング付け、センチメントのスコアリング、シェア・オブ・ボイスの算出、結論の記述は一切行いません。**すべての分析は、これらのスキルの内部、つまりエージェント側で行われます。** スキルはまた、取得した `answerText` と `sources` を信頼できないコンテンツとして扱い、その中に含まれる指示を決して実行しません。

## コントリビュート

Issue と PR を歓迎します — 新しい GEO スキル、より優れた検出ヒューリスティクス、対応エンジンの追加など。[CONTRIBUTING.md](./CONTRIBUTING.md) をご覧ください。すべてのスキルは、上記の生データの境界を守る必要があります。

## コミュニティ & サポート

- **ドキュメント & API キー** — [trychatsights.com](https://trychatsights.com)
- **Issue** — バグや スキルのアイデアは、このリポジトリで起票してください
- **アップデート** — [X の @chatsights](https://x.com/chatsights)

## ライセンス

スキルと MCP クライアントは [MIT](./LICENSE) です。これらは、独自の利用規約を持つホスト型サービスである [ChatSights](https://trychatsights.com) に接続します。

## ChatSights で構築

これらのスキルをプロジェクトで使っていますか？ バッジを追加しましょう。

```md
[![Powered by ChatSights](https://img.shields.io/badge/Powered%20by-ChatSights-181818.svg)](https://trychatsights.com)
```
