#!/usr/bin/env bash
# Builds a ZIP of the web app for Hostinger "Node.js Web App" upload.
# Hostinger runs: npm ci -> npm run build -> npm run start -- -p $PORT
# Only git-tracked files are included (never .env*, node_modules, .next, models).
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-dist/voiceoverdrop-web.zip}"
mkdir -p "$(dirname "$OUT")"
LIST="$(mktemp)"

# Everything the web app needs at build/run time. Tests, the Python worker and dev tooling stay out
# (Next type-checks every .ts file it can see, and dev-only types may not be installed there).
git ls-files \
  | grep -vE '^(tests/|worker/|docs/|\.github/|playwright\.config\.ts$|vitest\.config\.ts$|drizzle\.config\.ts$|AGENTS\.md$)' \
  > "$LIST"

if grep -qE '(^|/)\.env' "$LIST"; then
  echo "refusing to package: an .env file is tracked by git" >&2
  exit 1
fi

[ -f "$OUT" ] && mv -f "$OUT" "$OUT.old"
zip -q -X "$OUT" -@ < "$LIST"
echo "wrote $OUT ($(wc -l < "$LIST") files, $(du -h "$OUT" | cut -f1))"
