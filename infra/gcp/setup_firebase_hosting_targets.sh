#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="fir-bestpg"
DEV_SITE_ID="pgbf-web-development"
PROD_SITE_ID="pgbf-web-production"

firebase use "${PROJECT_ID}"

firebase hosting:sites:create "${DEV_SITE_ID}" || true
firebase hosting:sites:create "${PROD_SITE_ID}" || true

firebase target:apply hosting development "${DEV_SITE_ID}"
firebase target:apply hosting production "${PROD_SITE_ID}"

echo "Firebase hosting targets configured:"
echo "  development -> ${DEV_SITE_ID}"
echo "  production  -> ${PROD_SITE_ID}"
