#!/bin/sh
# ─── Elasticsearch ILM & Template Setup ─────────────────────────────────────────
# This script runs once after Elasticsearch becomes healthy.
# It is idempotent — safe to run multiple times (PUT is upsert for policies/templates).
#
# What it does:
#   1. Creates an ILM policy that deletes indices older than LOG_RETENTION_DAYS
#   2. Creates an index template that attaches the policy to all booking-api-logs-* indices

set -e

ES_URL="${ELASTICSEARCH_URL:-http://elasticsearch:9200}"
RETENTION_DAYS="${LOG_RETENTION_DAYS:-30}"
POLICY_NAME="booking-logs-policy"
TEMPLATE_NAME="booking-api-logs-template"

echo "[setup] Elasticsearch URL: $ES_URL"
echo "[setup] Log retention: ${RETENTION_DAYS} days"

# ── Step 1: Create / update the ILM policy ───────────────────────────────────────
# The policy has a single DELETE phase: any index older than RETENTION_DAYS is deleted.
# You can add hot/warm/cold phases here later for tiered storage.
echo "[setup] Creating ILM policy '${POLICY_NAME}'..."

curl -sf -X PUT "${ES_URL}/_ilm/policy/${POLICY_NAME}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"policy\": {
      \"phases\": {
        \"delete\": {
          \"min_age\": \"${RETENTION_DAYS}d\",
          \"actions\": {
            \"delete\": {}
          }
        }
      }
    }
  }"

echo ""
echo "[setup] ILM policy '${POLICY_NAME}' applied."

# ── Step 2: Create / update the index template ───────────────────────────────────
# The template matches every index whose name starts with "booking-api-logs-".
# It injects the lifecycle.name setting so Elasticsearch knows which ILM policy
# governs the index — this happens automatically at index creation time.
echo "[setup] Creating index template '${TEMPLATE_NAME}'..."

curl -sf -X PUT "${ES_URL}/_index_template/${TEMPLATE_NAME}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"index_patterns\": [\"booking-api-logs-*\"],
    \"priority\": 100,
    \"template\": {
      \"settings\": {
        \"number_of_shards\": 1,
        \"number_of_replicas\": 0,
        \"lifecycle.name\": \"${POLICY_NAME}\"
      }
    }
  }"

echo ""
echo "[setup] Index template '${TEMPLATE_NAME}' applied."
echo "[setup] ✅ Setup complete. Indices matching 'booking-api-logs-*' will be deleted after ${RETENTION_DAYS} days."
