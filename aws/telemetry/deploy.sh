#!/usr/bin/env bash
# Installe ou met à jour les statistiques anonymes de Cave Roller sur AWS, en une commande, avec CloudFormation
# (modèle : cloudformation.yaml). Il faut l'AWS CLI connectée au compte LTH : aws login --region eu-west-3 --profile lth
#   bash aws/telemetry/deploy.sh
#   ALERT_EMAIL=adresse bash aws/telemetry/deploy.sh     pour recevoir les alertes (coupe-circuit, budget)
#   bash aws/telemetry/deploy.sh --tableau               met en ligne le tableau de bord ; demande un mot de passe
# L'adresse de courriel et le mot de passe ne sont jamais écrits dans le dépôt. Une fois donnés, AWS les garde :
# inutile de les redonner aux déploiements suivants.
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

OVERRIDES=()
if [ -n "${ALERT_EMAIL:-}" ]; then OVERRIDES+=("AlertEmail=$ALERT_EMAIL"); fi
if [ "${1:-}" = "--tableau" ]; then
  read -r -s -p "Mot de passe du tableau de bord (12 caractères au moins, rien ne s'affiche) : " PASS1; echo
  read -r -s -p "Encore une fois : " PASS2; echo
  if [ "$PASS1" != "$PASS2" ]; then echo "ARRÊT : les deux mots de passe sont différents. Rien n'a été fait."; exit 1; fi
  if [ "${#PASS1}" -lt 12 ]; then echo "ARRÊT : il faut au moins 12 caractères. Rien n'a été fait."; exit 1; fi
  OVERRIDES+=("DashboardPassword=$PASS1")
fi
PARAMS=()
if [ "${#OVERRIDES[@]}" -gt 0 ]; then PARAMS=(--parameter-overrides "${OVERRIDES[@]}"); fi

aws cloudformation deploy \
  --template-file "$HERE/cloudformation.yaml" \
  --stack-name "$STACK" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  "${PARAMS[@]}"

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

# La page du tableau de bord (jamais les données d'exemple), puis un premier calcul des chiffres.
BUCKET="$(output DashboardBucketName)"
aws s3 cp "$HERE/dashboard/index.html" "s3://$BUCKET/index.html" --region "$REGION" --content-type "text/html; charset=utf-8" --cache-control no-store --only-show-errors
aws s3 cp "$HERE/dashboard/logo_studio.png" "s3://$BUCKET/logo_studio.png" --region "$REGION" --only-show-errors
aws s3 cp "$HERE/dashboard/logo_titre.png" "s3://$BUCKET/logo_titre.png" --region "$REGION" --only-show-errors
TMP="$(mktemp)"
aws lambda invoke --function-name caveroller-stats-bilan --region "$REGION" "$TMP" --query StatusCode --output text >/dev/null
echo "Chiffres du tableau de bord recalculés : $(cat "$TMP")"
rm -f "$TMP"

echo
echo "C'est prêt. Adresse à coller dans src/data/telemetry.ts (champ url) :"
output StatsUrl
DASH="$(output DashboardUrl)"
if [ -n "$DASH" ] && [ "$DASH" != "None" ]; then
  echo "Tableau de bord : $DASH   (utilisateur : lth, mot de passe : celui que tu as choisi)"
  echo "La première mise en ligne peut demander quelques minutes."
else
  echo "Tableau de bord : pas encore en ligne. Pour l'ouvrir : bash aws/telemetry/deploy.sh --tableau"
fi
if [ -n "${ALERT_EMAIL:-}" ]; then echo "Alertes : AWS envoie un courriel de confirmation, il faut cliquer sur le lien."; fi
