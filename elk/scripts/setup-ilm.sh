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
INFRA_RETENTION_DAYS="${INFRA_LOG_RETENTION_DAYS:-7}"
POLICY_NAME="booking-logs-policy"
INFRA_POLICY_NAME="infra-logs-policy"
TEMPLATE_NAME="booking-api-logs-template"
INFRA_TEMPLATE_NAME="infra-logs-template"

echo "[setup] Elasticsearch URL: $ES_URL"
echo "[setup] App log retention:   ${RETENTION_DAYS} days  (booking-api-logs-*)"
echo "[setup] Infra log retention: ${INFRA_RETENTION_DAYS} days   (infra-logs-*)"

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

# ── Step 3: Backfill the policy onto any already-existing indices ────────────────
# The index template only applies to NEWLY created indices. If indices already exist
# (e.g., the stack was restarted after data was written), we need to explicitly
# attach the policy to them as well. This call is a no-op if no indices match.
echo "[setup] Applying policy to existing indices (backfill)..."

curl -sf -X PUT "${ES_URL}/booking-api-logs-*/_settings" \
  -H 'Content-Type: application/json' \
  -d "{\"lifecycle\": {\"name\": \"${POLICY_NAME}\"}}" || true

echo ""

# ── Step 4: ILM policy for infra-logs-* (shorter retention) ─────────────────────
echo "[setup] Creating ILM policy '${INFRA_POLICY_NAME}'..."

curl -sf -X PUT "${ES_URL}/_ilm/policy/${INFRA_POLICY_NAME}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"policy\": {
      \"phases\": {
        \"delete\": {
          \"min_age\": \"${INFRA_RETENTION_DAYS}d\",
          \"actions\": {
            \"delete\": {}
          }
        }
      }
    }
  }"

echo ""
echo "[setup] ILM policy '${INFRA_POLICY_NAME}' applied."

# ── Step 5: Index template for infra-logs-* ──────────────────────────────────────
echo "[setup] Creating index template '${INFRA_TEMPLATE_NAME}'..."

curl -sf -X PUT "${ES_URL}/_index_template/${INFRA_TEMPLATE_NAME}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"index_patterns\": [\"infra-logs-*\"],
    \"priority\": 100,
    \"template\": {
      \"settings\": {
        \"number_of_shards\": 1,
        \"number_of_replicas\": 0,
        \"lifecycle.name\": \"${INFRA_POLICY_NAME}\"
      }
    }
  }"

echo ""
echo "[setup] Index template '${INFRA_TEMPLATE_NAME}' applied."

# ── Step 6: Backfill policy onto any existing infra indices ──────────────────────
curl -sf -X PUT "${ES_URL}/infra-logs-*/_settings" \
  -H 'Content-Type: application/json' \
  -d "{\"lifecycle\": {\"name\": \"${INFRA_POLICY_NAME}\"}}" || true

echo ""
echo "[setup] ✅ Setup complete."
echo "[setup]    booking-api-logs-* → deleted after ${RETENTION_DAYS} days"
echo "[setup]    infra-logs-*       → deleted after ${INFRA_RETENTION_DAYS} days"
