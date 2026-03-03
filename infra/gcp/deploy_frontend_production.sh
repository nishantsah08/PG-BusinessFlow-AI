#!/usr/bin/env bash
set -euo pipefail

PROJECT_ALIAS="production"
BACKEND_URL="${1:-}"

if [[ -z "${BACKEND_URL}" ]]; then
  echo "Usage: $0 <backend-url>"
  exit 1
fi

pushd client >/dev/null
VITE_APP_ENV=production \
VITE_API_BASE_URL="${BACKEND_URL}" \
npm run build
popd >/dev/null

firebase use "${PROJECT_ALIAS}"
firebase deploy --only hosting:production

echo "Deployed frontend production to Firebase Hosting target 'production'"
