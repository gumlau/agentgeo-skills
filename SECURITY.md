# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Email **security@agentgeo.org** with:

- a description of the issue and its impact,
- steps to reproduce (or a proof of concept),
- any suggested remediation.

We aim to acknowledge reports within 3 business days and to provide a remediation
timeline after triage. We'll credit reporters who wish to be named once a fix
ships.

## Scope

This repository contains the open-source **skills** (prompt/instruction files)
and the **MCP client** (`mcp/`). Relevant concerns include:

- The MCP client mishandling credentials passed via `--key` / `AGENTGEO_API_KEY`
  (e.g. leaking them into logs).
- A skill that could be steered by **untrusted answer content** into unsafe
  actions. Every skill treats fetched `answerText`/`sources` as data, never
  instructions — reports of prompt-injection bypasses are in scope.

The hosted AgentGEO API and console are covered separately; report those to the
same address.

## Supported versions

This project is pre-1.0. Security fixes land on the latest `main` and the most
recent tagged release.
