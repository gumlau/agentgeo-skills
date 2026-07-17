#!/usr/bin/env bash
# Link the AgentGEO GEO skills into a directory your coding agent scans.
#
#   ./scripts/enable-skills.sh            # this project only  -> ./.claude/skills
#   ./scripts/enable-skills.sh --global   # every project      -> ~/.claude/skills
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "${1:-}" = "--global" ]; then
  DEST="$HOME/.claude/skills"
else
  DEST="$(pwd)/.claude/skills"
fi

mkdir -p "$DEST"

count=0
for d in "$ROOT"/skills/geo-*/; do
  [ -d "$d" ] || continue
  name="$(basename "$d")"
  ln -sfn "$d" "$DEST/$name"
  echo "  linked $name"
  count=$((count + 1))
done

echo "Done — $count skills enabled in $DEST"
echo "Ask your agent: \"start a GEO analysis for <your-domain>\""
