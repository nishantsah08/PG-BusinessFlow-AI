#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="fir-bestpg"
REGION="asia-south1"
SERVICE_NAME="pgbf-backend-development"
ENV_FILE="infra/gcp/env/development.backend.env"
TMP_ENV_FILE="$(mktemp)"

trap 'rm -f "${TMP_ENV_FILE}"' EXIT

awk -F= '
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*$/ { next }
    {
        key = $1
        sub(/^[^=]+=*/, "", $0)
        gsub(/"/, "\\\"", $0)
        printf "%s: \"%s\"\n", key, $0
    }
' "${ENV_FILE}" > "${TMP_ENV_FILE}"

resolve_google_client_id() {
  local client_id="${GOOGLE_AUTH_ALLOWED_CLIENT_IDS:-${GOOGLE_CLIENT_ID:-}}"

  if [[ -z "${client_id}" && -f .env ]]; then
    client_id="$(awk -F= '/^(GOOGLE_AUTH_ALLOWED_CLIENT_IDS|GOOGLE_CLIENT_ID|VITE_GOOGLE_CLIENT_ID)=/ { print substr($0, index($0, "=") + 1) }' .env | tail -n 1)"
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

  if [[ -n "${client_id}" ]]; then
    printf 'GOOGLE_AUTH_ALLOWED_CLIENT_IDS: "%s"\n' "${client_id}" >> "${TMP_ENV_FILE}"
  fi
}

append_env_value() {
  local key="$1"
  local value="$2"
  if [[ -n "${value}" ]]; then
    printf '%s: "%s"\n' "${key}" "${value}" >> "${TMP_ENV_FILE}"
  fi
}

read_env_value() {
  local key="$1"
  awk -F= -v target="${key}" '
    $1 == target {
      sub(/^[^=]+=*/, "", $0)
      print $0
    }
  ' "${ENV_FILE}" | tail -n 1
}

ensure_service_identity() {
  local service_name="$1"
  local project_number access_token response
  project_number="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
  access_token="$(gcloud auth print-access-token)"
  response="$(
    curl -fsS -X POST \
      -H "Authorization: Bearer ${access_token}" \
      -H "Content-Type: application/json" \
      "https://serviceusage.googleapis.com/v1beta1/projects/${project_number}/services/${service_name}:generateServiceIdentity"
  )"
  printf '%s' "${response}" | node -e "
let raw = '';
process.stdin.on('data', (chunk) => raw += chunk);
process.stdin.on('end', () => {
  const json = JSON.parse(raw);
  const email = json?.response?.email || '';
  if (!email) {
    console.error('Could not resolve generated service identity email for ${service_name}.');
    process.exit(1);
  }
  process.stdout.write(email);
});
"
}

ensure_pubsub_push_infra() {
  local event_backend topic_name subscription_name backend_url push_path push_audience push_service_account project_number pubsub_service_agent
  event_backend="$(read_env_value COMMUNICATIONS_EVENT_BACKEND)"
  if [[ "${event_backend}" != "pubsub" ]]; then
    return
  fi

  topic_name="$(read_env_value PUBSUB_COMMUNICATIONS_TOPIC)"
  subscription_name="$(read_env_value PUBSUB_COMMUNICATIONS_PUSH_SUBSCRIPTION)"
  backend_url="$(read_env_value BACKEND_PUBLIC_BASE_URL)"
  push_path="/api/internal/events/whatsapp"
  push_audience="${backend_url}${push_path}"
  push_service_account="pgbf-pubsub-push@${PROJECT_ID}.iam.gserviceaccount.com"
  project_number="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
  pubsub_service_agent="$(ensure_service_identity pubsub.googleapis.com)"

  if [[ -z "${topic_name}" || -z "${subscription_name}" || -z "${backend_url}" ]]; then
    echo "Pub/Sub communications config is incomplete in ${ENV_FILE}" >&2
    exit 1
  fi

  gcloud services enable pubsub.googleapis.com --project "${PROJECT_ID}" --quiet >/dev/null

  if ! gcloud iam service-accounts describe "${push_service_account}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud iam service-accounts create "pgbf-pubsub-push" \
      --project "${PROJECT_ID}" \
      --display-name "PG BusinessFlow Pub/Sub Push"
  fi

  gcloud iam service-accounts add-iam-policy-binding "${push_service_account}" \
    --project "${PROJECT_ID}" \
    --member="serviceAccount:${pubsub_service_agent}" \
    --role="roles/iam.serviceAccountTokenCreator" \
    --quiet >/dev/null

  gcloud pubsub topics describe "${topic_name}" --project "${PROJECT_ID}" >/dev/null 2>&1 \
    || gcloud pubsub topics create "${topic_name}" --project "${PROJECT_ID}" --quiet >/dev/null

  if gcloud pubsub subscriptions describe "${subscription_name}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud pubsub subscriptions update "${subscription_name}" \
      --project "${PROJECT_ID}" \
      --push-endpoint="${push_audience}" \
      --push-auth-service-account="${push_service_account}" \
      --push-auth-token-audience="${push_audience}" \
      --ack-deadline=20 \
      --quiet >/dev/null
  else
    gcloud pubsub subscriptions create "${subscription_name}" \
      --project "${PROJECT_ID}" \
      --topic="${topic_name}" \
      --push-endpoint="${push_audience}" \
      --push-auth-service-account="${push_service_account}" \
      --push-auth-token-audience="${push_audience}" \
      --ack-deadline=20 \
      --quiet >/dev/null
  fi

  append_env_value "PUBSUB_PUSH_AUDIENCE" "${push_audience}"
  append_env_value "PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL" "${push_service_account}"
}

resolve_google_client_id
ensure_pubsub_push_infra

gcloud config set project "${PROJECT_ID}"

gcloud run deploy "${SERVICE_NAME}" \
  --quiet \
  --source ./server \
  --region "${REGION}" \
  --allow-unauthenticated \
  --env-vars-file "${TMP_ENV_FILE}" \
  --set-secrets "OPENAI_API_KEY=OPENAI_API_KEY_DEVELOPMENT:latest,WHATSAPP_TOKEN=WHATSAPP_TOKEN_DEVELOPMENT:latest,WHATSAPP_PHONE_NUMBER_ID=WHATSAPP_PHONE_NUMBER_ID_DEVELOPMENT:latest,WEBHOOK_VERIFY_TOKEN=WEBHOOK_VERIFY_TOKEN_DEVELOPMENT:latest"

if [[ "$(read_env_value COMMUNICATIONS_EVENT_BACKEND)" == "pubsub" ]]; then
  gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --member="serviceAccount:pgbf-pubsub-push@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/run.invoker" \
    --quiet >/dev/null
fi

echo "Deployed ${SERVICE_NAME} in ${REGION}"
