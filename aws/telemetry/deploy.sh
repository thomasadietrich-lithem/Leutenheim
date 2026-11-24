#!/usr/bin/env bash
# Installe ou met à jour les statistiques anonymes de Cave Roller sur AWS, en une commande, avec CloudFormation
# (modèle : cloudformation.yaml). Il faut l'AWS CLI connectée au compte LTH : aws login --region eu-west-3 --profile lth
#   bash aws/telemetry/deploy.sh
#   ALERT_EMAIL=adresse bash aws/telemetry/deploy.sh    (pour recevoir les alertes ; l'adresse n'est jamais écrite ici)
# À la fin : l'adresse à coller dans src/data/telemetry.ts (champ url).
set -euo pipefail
export AWS_PROFILE="${AWS_PROFILE:-lth}"   # compte dédié LTH, jamais celui de l'association
EXPECTED_ACCOUNT="${EXPECTED_ACCOUNT:-906515679954}"
REGION="${REGION:-eu-west-3}"     # Paris
STACK="${STACK:-caveroller-stats}"
HERE="$(cd "$(dirname "$0")" && pwd)"

# Garde-fou : on ne déploie que sur le compte LTH.
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
if [ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]; then
  echo "ARRÊT : le profil « $AWS_PROFILE » pointe sur le compte $ACCOUNT, pas sur le compte LTH ($EXPECTED_ACCOUNT). Rien n'a été fait."
  exit 1
fi
echo "Compte AWS : $ACCOUNT (LTH), région $REGION."

PARAMS=()
if [ -n "${ALERT_EMAIL:-}" ]; then PARAMS=(--parameter-overrides "AlertEmail=$ALERT_EMAIL"); fi

aws cloudformation deploy \
  --template-file "$HERE/cloudformation.yaml" \
  --stack-name "$STACK" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  "${PARAMS[@]}"

echo
echo "C'est prêt. Adresse à coller dans src/data/telemetry.ts (champ url) :"
aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='StatsUrl'].OutputValue" --output text
echo "Lire les chiffres : console AWS > Athena (région Paris) > groupe de travail « caveroller » > Requêtes enregistrées."
if [ -n "${ALERT_EMAIL:-}" ]; then echo "Alertes : AWS envoie un courriel de confirmation, il faut cliquer sur le lien."; fi
