<div align="center">

# AgentGEO GEO Skills

**Convierte lo que los motores de IA realmente responden en decisiones de GEO — desde el lado del agente.**

Un conjunto abierto de ocho Agent Skills + un servidor MCP sin dependencias. Tu agente de
programación obtiene respuestas, citas y fuentes **reales** en seis superficies de IA — ChatGPT, Perplexity,
Gemini, Google AI Overview, Google AI Mode y Copilot — a través de
[AgentGEO](https://agentgeo.org), y luego ejecuta el análisis de Generative Engine Optimization
de forma local.

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
  <a href="./README.md">English</a> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <b>Español</b> ·
  <a href="./README.fr.md">Français</a>
</p>

⭐ <em>Si estas skills te ayudan a aparecer en las respuestas de IA, una Star en GitHub significaría mucho.</em>

</div>

## AgentGEO GEO Skills

La mayoría de las herramientas de GEO inspeccionan *tu* HTML, robots.txt y schema, y **adivinan** si la IA puede verte.
Estas skills leen lo que los motores de IA **realmente dicen** — así, la visibilidad, la cuota de voz,
las citas y el sentimiento provienen de datos reales, no de inferencias.

Los datos provienen de AgentGEO, una fina capa de acceso sobre scrapers de IA gestionados. Devuelve
**únicamente** respuestas en bruto, citas, fuentes y metadatos del proveedor. Cada puntuación, ranking y
juicio de este repositorio lo calculan las skills, dentro de tu agente — nunca la plataforma.

### Cómo funciona

Tu agente de programación accede a AgentGEO mediante dos piezas de este repositorio:

- **Servidor MCP** (`mcp/`) — expone una única herramienta acotada, `fetch_raw_answers`, que cualquier
  agente compatible con MCP (Claude Code, Cursor, Codex) puede invocar.
- **Skills** (`skills/`) — ocho Agent Skills que llaman a esa herramienta y luego hacen los cálculos de GEO
  localmente: generación de prompts, visibilidad, cuota de voz, citas, sentimiento, competidores,
  monitorización y un informe completo.

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

### Las skills

El conjunto es un único bucle: **generar prompts → obtener respuestas → analizar → monitorizar → informar.**

| Skill | Qué hace |
|-------|-------------|
| **geo-prompt-set** | Punto de entrada. Genera una biblioteca de prompts estratificada por intención y emite un JSON `{query, surfaces}` listo para copiar y pegar que consumen todas las demás skills. |
| **geo-visibility** | Si una marca aparece en las respuestas de IA y con qué prominencia — una matriz de presencia prompt × superficie. |
| **geo-share-of-voice** | La cuota de voz de una marca frente a competidores nombrados en los distintos motores. |
| **geo-citations** | Qué dominios de origen citan las respuestas de IA; tu tasa de citas frente a la competencia, y dominios con brecha por conquistar. |
| **geo-sentiment** | Cómo describe la IA tu marca — tono, atributos y encuadre, con citas textuales. |
| **geo-competitors** | Visibilidad + SoV + citas + sentimiento combinados en una única matriz de competidores. |
| **geo-monitor** | Registra un conjunto de prompts como programaciones de AgentGEO y compara cada ejecución para informar de la tendencia a lo largo del tiempo. |
| **geo-report** | Orquestador de alto nivel: sintetiza todo en un informe ejecutivo con un plan de correcciones priorizado. |

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

### Cómo se ve un análisis

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

## ⭐️ Dale una Star al repositorio

Si estas skills te resultan útiles, una Star ⭐️ en GitHub ayuda a que otros creadores las encuentren.

## Inicio rápido

> 📖 Configuración completa paso a paso por cliente (Claude Code / Cursor / Codex) y un
> recorrido de principio a fin: **[Guía de instalación](./docs/installation.md)** ·
> **[Guía de uso](./docs/usage.md)**

### Requisito previo — conecta el MCP de AgentGEO

```bash
# Run this repo's MCP against the hosted API — works today (absolute path)
claude mcp add agentgeo -- node /absolute/path/to/agentgeo-skills/mcp/index.mjs \
  --api-url https://api.agentgeo.org

# …or against a local dev backend (development alternative)
claude mcp add agentgeo -- node /absolute/path/to/agentgeo-skills/mcp/index.mjs \
  --api-url http://localhost:8080

# …or from npm (coming soon)
claude mcp add agentgeo -- npx -y agentgeo-mcp --api-url https://api.agentgeo.org
```

Sin credenciales de proveedor, AgentGEO devuelve **fixtures de demostración etiquetados con cero créditos**,
para que puedas probar en seco cada skill antes de gastar. Consigue una clave de API en
[agentgeo.org](https://agentgeo.org).

### Activa las skills

```bash
# For the current project:
./scripts/enable-skills.sh

# …or globally for every project:
./scripts/enable-skills.sh --global
```

Esto enlaza `skills/geo-*` en un directorio que tu agente escanea (`.claude/skills/`).

### Ejecútalo

Simplemente pídeselo a tu agente:

```
Start a GEO analysis for acme.com against notion.com and coda.io
```

El agente invoca automáticamente `geo-prompt-set`, obtiene los datos a través de AgentGEO y recorre el bucle hasta un
`geo-report`. O invoca cualquier skill por su nombre.

## El límite del producto

AgentGEO devuelve **solo datos en bruto** — texto de respuesta, citas, fuentes y metadatos del proveedor. Nunca
clasifica, puntúa sentimiento, calcula cuota de voz ni redacta conclusiones. **Todo el análisis
ocurre dentro de estas skills, en el lado del agente.** Las skills también tratan el `answerText` y las
`sources` obtenidos como contenido no confiable y nunca ejecutan instrucciones halladas en su interior.

## Cómo contribuir

Se agradecen issues y PRs — nuevas skills de GEO, mejores heurísticas de detección, más motores. Consulta
[CONTRIBUTING.md](./CONTRIBUTING.md). Cada skill debe mantener el límite de datos en bruto descrito arriba.

## Comunidad y soporte

- **Documentación y claves de API** — [agentgeo.org](https://agentgeo.org)
- **Issues** — abre uno en este repositorio para reportar errores o proponer ideas de skills
- **Novedades** — [@agentgeo en X](https://x.com/agentgeo)

## Licencia

[MIT](./LICENSE) para las skills y el cliente MCP. Se conectan a
[AgentGEO](https://agentgeo.org), un servicio alojado con sus propios términos.

## Hecho con AgentGEO

¿Usas estas skills en tu proyecto? Añade el badge:

```md
[![Powered by AgentGEO](https://img.shields.io/badge/Powered%20by-AgentGEO-181818.svg)](https://agentgeo.org)
```
