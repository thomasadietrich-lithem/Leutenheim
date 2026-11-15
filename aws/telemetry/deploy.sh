#!/usr/bin/env bash
# Installe (ou met à jour) les statistiques anonymes de Cave Roller sur AWS, avec l'AWS CLI déjà connecté à ton compte.
#   bash aws/telemetry/deploy.sh
# Crée : un bucket S3 (les événements), un rôle, la Lambda « caveroller-stats » et son adresse publique (Function URL),
# puis affiche l'adresse à coller dans src/data/telemetry.ts (champ `url`).
set -euo pipefail
REGION="${REGION:-eu-west-3}"                 # Paris
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${BUCKET:-caveroller-stats-$ACCOUNT}"
FN="caveroller-stats"
ROLE="caveroller-stats-role"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "Compte $ACCOUNT, région $REGION, bucket $BUCKET"

# 1. Le bucket (privé), et l'effacement automatique des événements après 2 ans.
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
fi
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{"Rules":[{"ID":"expire","Status":"Enabled","Filter":{"Prefix":"events/"},"Expiration":{"Days":730}}]}'

# 2. Le rôle : écrire dans ce bucket seulement, et ses journaux.
if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam attach-role-policy --role-name "$ROLE" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  sleep 10
fi
aws iam put-role-policy --role-name "$ROLE" --policy-name write-events --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"s3:PutObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/events/*\"}]}"
ROLE_ARN="arn:aws:iam::$ACCOUNT:role/$ROLE"

# 3. La Lambda.
TMP="$(mktemp -d)"
(cd "$HERE/lambda" && zip -q "$TMP/fn.zip" index.mjs)
if aws lambda get-function --function-name "$FN" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FN" --zip-file "fileb://$TMP/fn.zip" --region "$REGION" >/dev/null
else
  aws lambda create-function --function-name "$FN" --runtime nodejs20.x --handler index.handler --role "$ROLE_ARN" \
    --zip-file "fileb://$TMP/fn.zip" --timeout 5 --memory-size 128 --environment "Variables={BUCKET=$BUCKET}" --region "$REGION" >/dev/null
  aws lambda wait function-active --function-name "$FN" --region "$REGION"
fi
# Garde-fou contre les abus : 5 appels en même temps au plus (la facture ne peut pas s'emballer).
aws lambda put-function-concurrency --function-name "$FN" --reserved-concurrent-executions 5 --region "$REGION" >/dev/null

# 4. L'adresse publique, ouverte au site et à l'appli (pas de cookie, rien de personnel).
CORS='{"AllowOrigins":["*"],"AllowMethods":["POST"],"AllowHeaders":["content-type"],"MaxAge":86400}'
if aws lambda get-function-url-config --function-name "$FN" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-url-config --function-name "$FN" --auth-type NONE --cors "$CORS" --region "$REGION" >/dev/null
else
  aws lambda create-function-url-config --function-name "$FN" --auth-type NONE --cors "$CORS" --region "$REGION" >/dev/null
  aws lambda add-permission --function-name "$FN" --statement-id public-url --action lambda:InvokeFunctionUrl \
    --principal "*" --function-url-auth-type NONE --region "$REGION" >/dev/null
fi
URL="$(aws lambda get-function-url-config --function-name "$FN" --region "$REGION" --query FunctionUrl --output text)"
echo
echo "C'est prêt. Adresse à coller dans src/data/telemetry.ts (champ url) :"
echo "  $URL"
echo "Pour lire les statistiques : aws/telemetry/athena.sql (remplacer BUCKET par $BUCKET)."
