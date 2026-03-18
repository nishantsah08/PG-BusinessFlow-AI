#!/usr/bin/env bash
set -euo pipefail

PROJECT_ALIAS="development"
PROJECT_ID="fir-bestpg"
BACKEND_URL="${1:-}"

if [[ -z "${BACKEND_URL}" ]]; then
  echo "Usage: $0 <backend-url>"
  exit 1
fi

resolve_google_client_id() {
  local client_id="${VITE_GOOGLE_CLIENT_ID:-${GOOGLE_CLIENT_ID:-}}"

  if [[ -z "${client_id}" && -f .env ]]; then
    client_id="$(awk -F= '/^(VITE_GOOGLE_CLIENT_ID|GOOGLE_CLIENT_ID)=/ { print substr($0, index($0, "=") + 1) }' .env | tail -n 1)"
  fi

  if [[ -z "${client_id}" ]]; then
    local access_token
    access_token="$(gcloud auth print-access-token)"
    client_id="$(
      curl -fsS \
        -H "Authorization: Bearer ${access_token}" \
        -H "x-goog-user-project: ${PROJECT_ID}" \
        "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com" \
        | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);if(!j.clientId)process.exit(1);process.stdout.write(j.clientId);});"
    )"
  fi

  if [[ -z "${client_id}" ]]; then
    echo "Unable to resolve Google client ID for frontend deploy" >&2
    exit 1
  fi

  printf '%s' "${client_id}"
}

GOOGLE_CLIENT_ID_VALUE="$(resolve_google_client_id)"

pushd client >/dev/null
VITE_APP_ENV=preprod \
VITE_API_BASE_URL="${BACKEND_URL}" \
VITE_DOCS_URL="https://docs.fir-bestpg-development-public.web.app/" \
VITE_GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID_VALUE}" \
npm run build
popd >/dev/null

firebase use "${PROJECT_ALIAS}"
firebase deploy --only hosting:development

echo "Deployed frontend development/preprod to Firebase Hosting target 'development'"
