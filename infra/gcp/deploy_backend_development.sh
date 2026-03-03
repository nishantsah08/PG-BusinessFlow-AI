#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="fir-bestpg"
REGION="asia-south1"
SERVICE_NAME="pgbf-backend-development"
ENV_FILE="infra/gcp/env/development.backend.env"

gcloud config set project "${PROJECT_ID}"

gcloud run deploy "${SERVICE_NAME}" \
  --source ./server \
  --region "${REGION}" \
  --allow-unauthenticated \
  --set-env-vars-file "${ENV_FILE}" \
  --set-secrets "OPENAI_API_KEY=OPENAI_API_KEY_DEVELOPMENT:latest,WHATSAPP_TOKEN=WHATSAPP_TOKEN_DEVELOPMENT:latest,WHATSAPP_PHONE_NUMBER_ID=WHATSAPP_PHONE_NUMBER_ID_DEVELOPMENT:latest,WEBHOOK_VERIFY_TOKEN=WEBHOOK_VERIFY_TOKEN_DEVELOPMENT:latest"

echo "Deployed ${SERVICE_NAME} in ${REGION}"
