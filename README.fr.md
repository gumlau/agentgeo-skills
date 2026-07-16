<div align="center">

# ChatSights GEO Skills

**Transformez ce que les moteurs d'IA répondent réellement en décisions GEO — du côté de l'agent.**

Une suite ouverte de huit Agent Skills + un serveur MCP sans dépendances. Votre agent de code
récupère des réponses, citations et sources **réelles** sur six surfaces d'IA — ChatGPT, Perplexity,
Gemini, Google AI Overview, Google AI Mode et Copilot — via
[ChatSights](https://trychatsights.com), puis exécute l'analyse d'optimisation pour moteurs
génératifs (Generative Engine Optimization) en local.

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
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.es.md">Español</a> ·
  <b>Français</b>
</p>

⭐ <em>Si ces skills vous aident à apparaître dans les réponses d'IA, une étoile GitHub compterait beaucoup pour nous.</em>

</div>

## ChatSights GEO Skills

La plupart des outils GEO inspectent *votre* HTML, votre robots.txt et vos données structurées, puis
**devinent** si l'IA peut vous voir. Ces skills lisent ce que les moteurs d'IA **disent réellement** — ainsi
la visibilité, la part de voix, les citations et le sentiment reposent sur des faits établis, pas sur des
suppositions.

Les données proviennent de ChatSights, une fine couche d'accès à des scrapers d'IA managés. Elle ne renvoie
**que** des réponses brutes, des citations, des sources et des métadonnées de fournisseur. Chaque score,
classement et jugement de ce dépôt est calculé par les skills, à l'intérieur de votre agent — jamais par la
plateforme.

### Comment ça fonctionne

Votre agent de code atteint ChatSights à travers deux composants de ce dépôt :

- **Serveur MCP** (`mcp/`) — expose un seul outil restreint, `fetch_raw_answers`, que tout
  agent compatible MCP (Claude Code, Cursor, Codex) peut appeler.
- **Skills** (`skills/`) — huit Agent Skills qui appellent cet outil, puis effectuent les calculs GEO
  en local : génération de prompts, visibilité, part de voix, citations, sentiment, concurrents,
  surveillance et un rapport complet.

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

### Les skills

La suite forme une seule boucle : **générer des prompts → récupérer les réponses → analyser → surveiller → produire un rapport.**

| Skill | Ce qu'il fait |
|-------|-------------|
| **geo-prompt-set** | Point d'entrée. Génère une bibliothèque de prompts stratifiée par intention et émet un JSON `{query, surfaces}` prêt à copier-coller que consomment tous les autres skills. |
| **geo-visibility** | Si une marque apparaît dans les réponses d'IA, et avec quelle proéminence — une matrice de présence prompt × surface. |
| **geo-share-of-voice** | La part de voix d'une marque face à des concurrents nommés, à travers les moteurs. |
| **geo-citations** | Quels domaines sources les réponses d'IA citent ; votre taux de citation face aux concurrents, et les domaines à conquérir. |
| **geo-sentiment** | Comment l'IA décrit votre marque — ton, attributs et cadrage, avec des citations textuelles. |
| **geo-competitors** | Visibilité + part de voix + citations + sentiment réunis en une seule matrice concurrentielle. |
| **geo-monitor** | Enregistre un jeu de prompts comme planifications ChatSights et compare chaque exécution pour rendre compte de la tendance dans le temps. |
| **geo-report** | Orchestrateur de haut niveau : synthétise l'ensemble en un rapport exécutif assorti d'un plan de correction priorisé. |

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

### À quoi ressemble une analyse

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

## ⭐️ Ajoutez le dépôt à vos favoris

Si ces skills vous sont utiles, une étoile GitHub ⭐️ aide d'autres créateurs à les découvrir.

## Démarrage rapide

> 📖 Configuration complète pas à pas par client (Claude Code / Cursor / Codex) et un
> parcours de bout en bout : **[Guide d'installation](./docs/installation.md)** ·
> **[Guide d'utilisation](./docs/usage.md)**

### Prérequis — connecter le MCP ChatSights

```bash
# Run this repo's MCP directly against the hosted API — works today (absolute path)
claude mcp add chatsights -- node /absolute/path/to/chatsights-geo-skills/mcp/index.mjs \
  --api-url https://api.trychatsights.com

# …or point it at a local development server instead
claude mcp add chatsights -- node /absolute/path/to/chatsights-geo-skills/mcp/index.mjs \
  --api-url http://localhost:8080

# …or from npm (coming soon)
claude mcp add chatsights -- npx -y chatsights-mcp --api-url https://api.trychatsights.com
```

Sans identifiants de fournisseur, ChatSights renvoie des **jeux de démonstration étiquetés, sans consommer de crédits**,
ce qui vous permet de tester chaque skill à blanc avant de dépenser. Obtenez une clé API sur
[trychatsights.com](https://trychatsights.com).

### Activer les skills

```bash
# For the current project:
./scripts/enable-skills.sh

# …or globally for every project:
./scripts/enable-skills.sh --global
```

Cela relie `skills/geo-*` à un répertoire que votre agent analyse (`.claude/skills/`).

### Lancer l'analyse

Il suffit de demander à votre agent :

```
Start a GEO analysis for acme.com against notion.com and coda.io
```

L'agent invoque automatiquement `geo-prompt-set`, récupère les données via ChatSights et parcourt la boucle
jusqu'à un `geo-report`. Vous pouvez aussi invoquer n'importe quel skill par son nom.

## La frontière du produit

ChatSights ne renvoie **que des données brutes** — texte de réponse, citations, sources, métadonnées de
fournisseur. Il ne classe jamais, n'évalue pas le sentiment, ne calcule pas la part de voix et ne rédige aucune
conclusion. **Toute l'analyse se déroule à l'intérieur de ces skills, du côté de l'agent.** Les skills traitent
également les `answerText` et `sources` récupérés comme du contenu non fiable et n'exécutent jamais les
instructions qu'ils pourraient contenir.

## Contribuer

Les issues et PR sont les bienvenues — nouveaux skills GEO, meilleures heuristiques de détection, davantage de
moteurs. Voir [CONTRIBUTING.md](./CONTRIBUTING.md). Chaque skill doit préserver la frontière des données brutes
décrite ci-dessus.

## Communauté et assistance

- **Docs et clés API** — [trychatsights.com](https://trychatsights.com)
- **Issues** — ouvrez-en une dans ce dépôt pour les bugs ou les idées de skills
- **Actualités** — [@chatsights sur X](https://x.com/chatsights)

## Licence

[MIT](./LICENSE) pour les skills et le client MCP. Ils se connectent à
[ChatSights](https://trychatsights.com), un service hébergé régi par ses propres conditions.

## Conçu avec ChatSights

Vous utilisez ces skills dans votre projet ? Ajoutez le badge :

```md
[![Powered by ChatSights](https://img.shields.io/badge/Powered%20by-ChatSights-181818.svg)](https://trychatsights.com)
```
