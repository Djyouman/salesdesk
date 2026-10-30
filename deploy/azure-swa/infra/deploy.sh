#!/usr/bin/env bash
# One-time Azure setup for FSP SalesDesk. Run in Azure Cloud Shell (Bash) or any machine with the Azure
# CLI signed in to the FSP tenant, by someone with Contributor on a subscription and Application
# Administrator in Entra. Safe to re-run: every step finds what already exists before creating anything.
#
# In Azure Cloud Shell the built-in sign-in cannot talk to Entra ID (Microsoft Graph). Before running,
# sign in once more with Graph in scope (device code; follow the link it prints):
#   az login --scope "https://graph.microsoft.com/.default"
set -euo pipefail

: "${RG:=rg-fsp-salesdesk}"
: "${LOC:=eastus2}"
: "${SWA:=fsp-salesdesk}"
: "${DOMAIN:=salesdesk.flowservice.com}"
: "${OWNER_EMAILS:=daniel.youman@flowservice.com}"
: "${ALLOWED_EMAIL_DOMAINS:=flowservice.com}"
: "${ANTHROPIC_API_KEY:=}"

TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Tenant $TENANT_ID · resource group $RG · region $LOC"

# 0. A new subscription must register the services it will use (one-time, a few minutes, idempotent)
for ns in Microsoft.DocumentDB Microsoft.Web Microsoft.Storage; do
  state=$(az provider show -n "$ns" --query registrationState -o tsv 2>/dev/null || echo "NotRegistered")
  if [ "$state" != "Registered" ]; then echo "Registering $ns…"; az provider register --namespace "$ns" --wait -o none; fi
done

az group create -n "$RG" -l "$LOC" -o none

# 1. Cosmos DB (NoSQL, serverless). Reuse an existing account in the resource group.
COSMOS=$(az cosmosdb list -g "$RG" --query "[0].name" -o tsv 2>/dev/null || true)
if [ -z "$COSMOS" ]; then
  COSMOS="fspsalesdesk$RANDOM"
  echo "Creating Cosmos DB account $COSMOS (3–8 minutes)…"
  az cosmosdb create -n "$COSMOS" -g "$RG" --capabilities EnableServerless --default-consistency-level Session -o none
else
  echo "Cosmos DB account $COSMOS already exists."
fi
az cosmosdb sql database create -a "$COSMOS" -g "$RG" -n salesdesk -o none 2>/dev/null || true
az cosmosdb sql container create -a "$COSMOS" -g "$RG" -d salesdesk -n docs --partition-key-path /coll -o none 2>/dev/null || true
COSMOS_CS=$(az cosmosdb keys list -n "$COSMOS" -g "$RG" --type connection-strings --query "connectionStrings[0].connectionString" -o tsv)

# 2. Static Web App (Standard: needed for custom Entra ID auth locked to this tenant)
if ! az staticwebapp show -n "$SWA" -g "$RG" -o none 2>/dev/null; then
  az staticwebapp create -n "$SWA" -g "$RG" -l "$LOC" --sku Standard -o none
fi
HOST=$(az staticwebapp show -n "$SWA" -g "$RG" --query defaultHostname -o tsv)
echo "Default host: https://$HOST"

# 3. Entra ID app registration (sign-in restricted to this tenant). Reuse by display name.
GRAPH_OK=1
APP_ID=$(az ad app list --display-name "FSP SalesDesk" --query "[0].appId" -o tsv 2>/dev/null) || GRAPH_OK=0
if [ "$GRAPH_OK" = "0" ]; then
  cat <<'MSG'

Cloud Shell's sign-in cannot reach Entra ID. Run this, follow the link it prints, then re-run deploy.sh:
  az login --scope "https://graph.microsoft.com/.default"
MSG
  exit 2
fi
if [ -z "$APP_ID" ]; then
  echo "Creating the FSP SalesDesk app registration…"
  APP_ID=$(az ad app create --display-name "FSP SalesDesk" --sign-in-audience AzureADMyOrg \
    --web-redirect-uris "https://$HOST/.auth/login/aad/callback" "https://$DOMAIN/.auth/login/aad/callback" \
    --enable-id-token-issuance true --required-resource-accesses '[{"resourceAppId":"00000003-0000-0000-c000-000000000000","resourceAccess":[{"id":"b633e1c5-b582-4048-a93e-9f11b44c7e96","type":"Role"},{"id":"810c84a8-4a9e-49e6-bf7d-12d183f40d01","type":"Role"},{"id":"e1fe6dd8-ba31-4d61-89e7-88639da4683d","type":"Scope"}]}]' --query appId -o tsv)
  az ad app update --id "$APP_ID" --set optionalClaims='{"idToken":[{"name":"email","essential":false},{"name":"preferred_username","essential":false}]}' -o none || true
else
  echo "App registration already exists ($APP_ID)."
fi
# Graph application permissions: Mail.Send (b633e1c5…), Mail.Read (810c84a8…); User.Read delegated.
az ad app permission admin-consent --id "$APP_ID" -o none 2>/dev/null || echo "Admin consent not granted automatically: an Entra admin grants it in Entra ID › App registrations › FSP SalesDesk › API permissions (needed for email only)."
# A fresh client secret each run; the previous one keeps working until it expires.
SECRET=$(az ad app credential reset --id "$APP_ID" --display-name "swa-$(date +%Y%m%d)" --years 2 --query password -o tsv --only-show-errors)

# 4. App settings (read by the API and by the auth block of staticwebapp.config.json)
az staticwebapp appsettings set -n "$SWA" -g "$RG" --setting-names \
  AAD_CLIENT_ID="$APP_ID" AAD_CLIENT_SECRET="$SECRET" AAD_TENANT_ID="$TENANT_ID" \
  COSMOS_CONNECTION_STRING="$COSMOS_CS" COSMOS_DB=salesdesk COSMOS_CONTAINER=docs \
  OWNER_EMAILS="$OWNER_EMAILS" ALLOWED_EMAIL_DOMAINS="$ALLOWED_EMAIL_DOMAINS" \
  ${ANTHROPIC_API_KEY:+ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"} -o none --only-show-errors

# 5. Remember what publish.sh needs (local to this shell session; nothing secret is written to disk)
mkdir -p "$HOME/.salesdesk"
cat > "$HOME/.salesdesk/env" <<EOF
RG=$RG
SWA=$SWA
HOST=$HOST
TENANT_ID=$TENANT_ID
COSMOS=$COSMOS
DOMAIN=$DOMAIN
EOF

echo
echo "Setup complete."
echo "  Site:        https://$HOST"
echo "  Database:    $COSMOS"
echo "  Sign-in app: $APP_ID (tenant $TENANT_ID)"
echo
echo "Next: publish the app and load the data:"
echo "  bash deploy/azure-swa/infra/publish.sh"
echo
echo "Later, for the custom domain: create CNAME  ${DOMAIN%%.*}  ->  $HOST  then run:"
echo "  az staticwebapp hostname set -n $SWA -g $RG --hostname $DOMAIN"
