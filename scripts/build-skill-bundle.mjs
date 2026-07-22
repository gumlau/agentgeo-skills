#!/usr/bin/env node

/**
 * Regenerates mcp/skills.generated.mjs from skills/<name>/SKILL.md.
 *
 * The MCP server ships the eight GEO skills inside the npm package so
 * list_geo_skills / get_geo_skill / prompts keep working when the API is
 * unreachable; the live copies served by GET /v1/skills win when available.
 * Run after any SKILL.md change:
 *
 *   node scripts/build-skill-bundle.mjs
 *
 * CI fails when the committed bundle is stale (regenerate-and-diff check).
 * Node.js built-ins only, matching the server itself.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "mcp", "skills.generated.mjs");

/**
 * Recommended pipeline order, not alphabetical: geo-prompt-set builds the
 * prompt library every other skill consumes; the four dimension skills each
 * analyze one axis; geo-competitors joins them; geo-monitor tracks over time;
 * geo-report synthesizes everything. list_geo_skills and prompts/list present
 * the skills in exactly this order.
 */
const ORDER = [
  "geo-prompt-set",
  "geo-visibility",
  "geo-share-of-voice",
  "geo-citations",
  "geo-sentiment",
  "geo-competitors",
  "geo-monitor",
  "geo-report",
];

/** Pull one single-line scalar out of the frontmatter block. */
function frontmatterValue(frontmatter, key, file) {
  const match = frontmatter.match(new RegExp(`^${key}:[ \\t]*(.+)$`, "m"));
  if (!match || !match[1].trim()) {
    throw new Error(`${file}: missing frontmatter key "${key}"`);
  }
  return match[1].trim();
}

const skills = ORDER.map((name) => {
  const file = join(ROOT, "skills", name, "SKILL.md");
  const raw = readFileSync(file, "utf8");
  const fence = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fence) throw new Error(`${file}: no frontmatter block`);
  const frontmatter = fence[1];

  const declared = frontmatterValue(frontmatter, "name", file);
  if (declared !== name) {
    throw new Error(`${file}: frontmatter name "${declared}" != directory "${name}"`);
  }

  return {
    name,
    description: frontmatterValue(frontmatter, "description", file),
    version: frontmatterValue(frontmatter, "version", file),
    content: raw,
  };
});

const banner = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Built by scripts/build-skill-bundle.mjs from skills/<name>/SKILL.md, in the
 * recommended pipeline order. This is the offline fallback the MCP server
 * uses when GET /v1/skills is unreachable; the live API copies win otherwise.
 */

`;

writeFileSync(OUT, `${banner}export const GEO_SKILLS = ${JSON.stringify(skills, null, 2)};\n`);

const total = skills.reduce((sum, skill) => sum + skill.content.length, 0);
console.log(
  `wrote ${relative(ROOT, OUT)}: ${skills.length} skills, ${(total / 1024).toFixed(1)} KiB of SKILL.md content`,
);
