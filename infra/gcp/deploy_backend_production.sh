#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="fir-bestpg"
REGION="asia-south1"
SERVICE_NAME="pgbf-backend-production"
ENV_FILE="infra/gcp/env/production.backend.env"

gcloud config set project "${PROJECT_ID}"

gcloud run deploy "${SERVICE_NAME}" \
  --source ./server \
  --region "${REGION}" \
  --allow-unauthenticated \
  --set-env-vars-file "${ENV_FILE}" \
  --set-secrets "OPENAI_API_KEY=OPENAI_API_KEY_PRODUCTION:latest,WHATSAPP_TOKEN=WHATSAPP_TOKEN_PRODUCTION:latest,WHATSAPP_PHONE_NUMBER_ID=WHATSAPP_PHONE_NUMBER_ID_PRODUCTION:latest,WEBHOOK_VERIFY_TOKEN=WEBHOOK_VERIFY_TOKEN_PRODUCTION:latest"

echo "Deployed ${SERVICE_NAME} in ${REGION}"
