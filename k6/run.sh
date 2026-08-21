#!/bin/sh
TEST=${1:-smoke}
FILES="smoke=01-smoke load=02-load stress=03-stress spike=04-spike soak=05-soak breakpoint=06-breakpoint auth=07-auth-flow concurrency=08-booking-concurrency"

FILE=""
for pair in $FILES; do
  key=${pair%%=*}; val=${pair##*=}
  if [ "$key" = "$TEST" ]; then FILE=$val; break; fi
done

if [ -z "$FILE" ]; then
  echo "Unknown test: $TEST. Valid: smoke load stress spike soak breakpoint auth concurrency"
  exit 1
fi

RESULT_FILE="/k6-results/${TEST}_$(date +%Y%m%d_%H%M%S).json"
echo ">>> Running k6 test: $TEST"
echo "    Script : /scripts/tests/${FILE}.test.js"

exec k6 run \
  --out "json=$RESULT_FILE" \
  -e K6_BASE_URL=${K6_BASE_URL} \
  -e K6_SOAK_DURATION=${K6_SOAK_DURATION} \
  /scripts/tests/${FILE}.test.js