#!/usr/bin/env bash
#
# Fails fast when the generated API code (React Query hooks + Zod schemas) is
# out of sync with the OpenAPI spec. Regenerates from the spec and errors if
# that produces any git diff — i.e. someone changed the spec without running
# codegen, or committed stale generated files.
set -euo pipefail

cd "$(dirname "$0")/.."

# Paths owned by codegen (orval outputs + the api-zod barrel re-export).
GENERATED_PATHS=(
  "lib/api-client-react/src/generated"
  "lib/api-zod/src/generated"
  "lib/api-zod/src/index.ts"
)

echo "Regenerating API code from lib/api-spec/openapi.yaml ..."
pnpm --filter @workspace/api-spec run codegen

# Catches both modified tracked files and newly created (untracked) files.
DRIFT="$(git status --porcelain -- "${GENERATED_PATHS[@]}")"

if [ -n "$DRIFT" ]; then
  echo ""
  echo "ERROR: Generated API code is out of sync with lib/api-spec/openapi.yaml." >&2
  echo "The following generated files changed after running codegen:" >&2
  echo "" >&2
  echo "$DRIFT" >&2
  echo "" >&2
  echo "Fix: run 'pnpm --filter @workspace/api-spec run codegen' and commit the result." >&2
  exit 1
fi

echo "Generated API code is in sync with the OpenAPI spec."
