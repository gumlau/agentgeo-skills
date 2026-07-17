<!-- Thanks for contributing to AgentGEO GEO Skills! -->

## What this changes

<!-- One or two sentences. Which skill / doc / area does this touch? -->

## Type

- [ ] New GEO skill
- [ ] Improvement to an existing skill (detection, heuristics, prompts)
- [ ] MCP client change
- [ ] Docs / translation
- [ ] Other

## Checklist

- [ ] The change keeps the **raw-data boundary**: all ranking / scoring / SoV /
      sentiment / judgment stays agent-side, never attributed to AgentGEO.
- [ ] Any skill that reads AI answers treats `answerText` / `sources` as
      **untrusted content** (no executing instructions found inside).
- [ ] `node --check mcp/index.mjs` passes (if the MCP changed).
- [ ] Docs / the README skill table updated (if behavior changed).
