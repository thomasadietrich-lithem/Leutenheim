#!/usr/bin/env bash
# Installe ou met à jour les statistiques anonymes de Cave Roller sur AWS, en une commande, avec CloudFormation
# (modèle : cloudformation.yaml). Il faut l'AWS CLI connectée au compte (aws configure).
#   bash aws/telemetry/deploy.sh
# À la fin : l'adresse à coller dans src/data/telemetry.ts (champ url).
set -euo pipefail
REGION="${REGION:-eu-west-3}"     # Paris
STACK="${STACK:-caveroller-stats}"
HERE="$(cd "$(dirname "$0")" && pwd)"

aws cloudformation deploy \
  --template-file "$HERE/cloudformation.yaml" \
  --stack-name "$STACK" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset

echo
echo "C'est prêt. Adresse à coller dans src/data/telemetry.ts (champ url) :"
aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='StatsUrl'].OutputValue" --output text
echo "Lire les chiffres : console AWS > Athena (région Paris) > groupe de travail « caveroller » > Requêtes enregistrées."
