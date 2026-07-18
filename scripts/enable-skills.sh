#!/usr/bin/env bash
# Link the AgentGEO GEO skills into a directory your coding agent scans.
#
#   ./scripts/enable-skills.sh            # this project only  -> ./.claude/skills
#   ./scripts/enable-skills.sh --global   # every project      -> ~/.claude/skills
# -eu only: dash (Ubuntu's sh) has no pipefail, and this script has no
# pipelines whose failure could otherwise slip through.
set -eu

# ${BASH_SOURCE:-$0}, unsubscripted: bash resolves it to BASH_SOURCE[0]; dash
# and zsh (no BASH_SOURCE) fall back to $0. The [0] form is a dash "Bad
# substitution" that silently yields an empty ROOT.
ROOT="$(cd "$(dirname "${BASH_SOURCE:-$0}")/.." && pwd)"

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
