#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ID="fir-bestpg"
ENV_FILE="${PROJECT_ROOT}/infra/gcp/env/development.backend.env"
CONFIRMATION_TOKEN="RESET_PREPROD_FROM_SCRATCH"

if [[ "${1:-}" != "--force" ]]; then
  echo "Usage: ./reset_preprod.sh --force" >&2
  echo "This clears application-owned preprod data and resets the shared development environment to a blank start." >&2
  exit 1
fi

export GOOGLE_CLOUD_PROJECT="${PROJECT_ID}"

while IFS='=' read -r key value; do
  [[ -z "${key}" || "${key}" =~ ^[[:space:]]*# ]] && continue
  export "${key}=${value}"
done < "${ENV_FILE}"

export RESET_PREPROD_CONFIRM="${CONFIRMATION_TOKEN}"

cd "${PROJECT_ROOT}/server"
node scripts/reset_preprod_state.js --force
