#!/usr/bin/env bash
# Rouvre l'adresse des statistiques après une fermeture par le coupe-circuit (trop d'appels).
# À ne lancer qu'après avoir compris pourquoi il s'est déclenché (journal : caveroller-stats-coupe-circuit).
#   bash aws/telemetry/rouvrir.sh
set -euo pipefail
export AWS_PROFILE="${AWS_PROFILE:-lth}"
REGION="${REGION:-eu-west-3}"
MAX="${MAX:-0}"   # 0 = pas de réserve (compte neuf) ; sinon le nombre d'appels simultanés à réserver
if [ "$MAX" = "0" ]; then
  aws lambda delete-function-concurrency --function-name caveroller-stats --region "$REGION"
  echo "Adresse rouverte."
else
  aws lambda put-function-concurrency --function-name caveroller-stats --reserved-concurrent-executions "$MAX" --region "$REGION" \
    --query ReservedConcurrentExecutions --output text
  echo "Adresse rouverte ($MAX appels simultanés au plus)."
fi
