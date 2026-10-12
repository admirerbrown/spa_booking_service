#!/usr/bin/env bash
# Builds the app with the values from .env.production and verifies the result.
# Usage: ./scripts/check-build.sh            (build and check)
#        ./scripts/check-build.sh --preview  (also start npm run preview)
set -euo pipefail

cd "$(dirname "$0")/.."

ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; exit 1; }

# Terminal-session values override .env files at build time, so drop them.
unset VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY

[ -f .env.production ] || fail ".env.production not found in $(pwd)"

# Read values without sourcing the file, and never print the key.
read_var() {
  grep -E "^$1=" .env.production | tail -n1 | cut -d= -f2- | tr -d "\"'\r "
}
URL=$(read_var VITE_SUPABASE_URL)
KEY=$(read_var VITE_SUPABASE_ANON_KEY)

echo "1. Checking .env.production"
[ -n "$URL" ] || fail "VITE_SUPABASE_URL is missing or empty"
[ -n "$KEY" ] || fail "VITE_SUPABASE_ANON_KEY is missing or empty"
case "$URL" in
  https://*.supabase.co) ok "URL looks like a hosted project: $URL" ;;
  *) fail "URL is not a hosted Supabase address: $URL" ;;
esac

echo "2. Testing the hosted API with those values"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 \
  "$URL/rest/v1/services?select=id&limit=1" -H "apikey: $KEY" || true)
[ "$STATUS" = "200" ] && ok "services request returned HTTP 200" \
  || fail "services request returned HTTP ${STATUS:-none} (check the URL and key)"

echo "3. Building"
npm run build --silent || fail "build failed"

echo "4. Inspecting dist/"
HOST=${URL#https://}
grep -q "$HOST" dist/assets/index-*.js \
  && ok "bundle contains $HOST" \
  || fail "bundle does not contain $HOST"
if grep -q "127.0.0.1:54321" dist/assets/index-*.js; then
  fail "bundle still contains the local Supabase URL"
fi
ok "bundle has no local Supabase URL"

echo
echo "All checks passed. dist/ is ready to deploy."

if [ "${1:-}" = "--preview" ]; then
  npm run preview
fi
