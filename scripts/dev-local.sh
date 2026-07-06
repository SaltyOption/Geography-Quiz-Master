#!/bin/bash
# Run the full stack locally on macOS without the Clerk secret key.
#
# Requires: Homebrew postgresql@16 running (brew services start postgresql@16)
# with a `geo_quiz` database (createdb geo_quiz; pnpm --filter @workspace/db run push).
#
# Clerk: only the PUBLISHABLE key is needed. The api-server's clerkMiddleware
# normally fetches the instance JWKS with the secret key to resolve the
# dev-browser handshake; dev instances expose the same JWKS publicly at the
# frontend API, so we fetch it, convert to PEM, and hand it to @clerk/backend
# via CLERK_JWT_KEY. Anonymous browsing and sign-in work; server-side Clerk
# Backend API calls (e.g. newsletter email lookup) still need the real
# CLERK_SECRET_KEY — export it before running to enable those.
set -euo pipefail
cd "$(dirname "$0")/.."

# Local secrets (CLERK_SECRET_KEY etc.) live in the gitignored .env.local.
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

PK="${VITE_CLERK_PUBLISHABLE_KEY:-pk_test_cmljaC1lZnQtMTkuY2xlcmsuYWNjb3VudHMuZGV2JA}"
FAPI_HOST=$(echo "${PK#pk_test_}" | base64 -d 2>/dev/null | tr -d '$')
DB_URL="${DATABASE_URL:-postgresql://$(whoami)@localhost:5432/geo_quiz}"

JWT_KEY=$(curl -sf "https://${FAPI_HOST}/.well-known/jwks.json" | node -e '
let d = "";
process.stdin.on("data", (c) => (d += c)).on("end", () => {
  const jwks = JSON.parse(d);
  const pem = require("crypto")
    .createPublicKey({ key: jwks.keys[0], format: "jwk" })
    .export({ type: "spki", format: "pem" });
  process.stdout.write(pem);
});')

echo "Clerk instance: ${FAPI_HOST}"
echo "Database:       ${DB_URL}"

PORT=26064 BASE_PATH=/ VITE_CLERK_PUBLISHABLE_KEY="$PK" \
  pnpm --filter @workspace/geo-quiz run dev &
VITE_PID=$!
trap 'kill $VITE_PID 2>/dev/null' EXIT

PORT=8080 \
  DATABASE_URL="$DB_URL" \
  CLERK_PUBLISHABLE_KEY="$PK" \
  VITE_CLERK_PUBLISHABLE_KEY="$PK" \
  CLERK_SECRET_KEY="${CLERK_SECRET_KEY:-sk_test_localdevplaceholder}" \
  CLERK_JWT_KEY="$JWT_KEY" \
  ADMIN_USER_IDS="${ADMIN_USER_IDS:-}" \
  pnpm --filter @workspace/api-server run dev

# Browse http://localhost:8080
