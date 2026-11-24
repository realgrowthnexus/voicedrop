#!/usr/bin/env bash
# Builds a ZIP of the web app for Hostinger "Node.js Web App" upload.
# Hostinger runs: npm ci -> npm run build -> npm run start -- -p $PORT
# Only git-tracked files are included (never .env*, node_modules, .next, models).
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-dist/VOICEDROP-HOSTINGER-UPLOAD.zip}"
mkdir -p "$(dirname "$OUT")"
LIST="$(mktemp)"

# Everything the web app needs at build/run time. Tests, the Python worker and dev tooling stay out
# (Next type-checks every .ts file it can see, and dev-only types may not be installed there).
git ls-files \
  | grep -vE '^(tests/|worker/|docs/|assets/|scripts/brand-assets\.cjs$|\.github/|playwright\.config\.ts$|vitest\.config\.ts$|drizzle\.config\.ts$|AGENTS\.md$)' \
  > "$LIST"

if grep -qE '(^|/)\.env' "$LIST"; then
  echo "refusing to package: an .env file is tracked by git" >&2
  exit 1
fi

rm -f "$OUT"
zip -q -X "$OUT" -@ < "$LIST"

# Optional owner settings (admin login, RunPod key): SETTINGS_FILE=/path/to/file adds it as voicedrop.env.
# Kept out of git; lives only inside the ZIP the owner uploads.
if [ -n "${SETTINGS_FILE:-}" ]; then
  TMPD="$(mktemp -d)"
  cp "$SETTINGS_FILE" "$TMPD/voicedrop.env"
  (cd "$TMPD" && zip -q -X "$OLDPWD/$OUT" voicedrop.env)
  rm -rf "$TMPD"
  echo "added owner settings as voicedrop.env"
fi
echo "wrote $OUT ($(wc -l < "$LIST") files, $(du -h "$OUT" | cut -f1))"
