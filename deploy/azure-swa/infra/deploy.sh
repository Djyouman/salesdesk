#!/usr/bin/env bash
# One-time Azure setup for FSP SalesDesk. Run from a machine with the Azure CLI signed in to the FSP
# tenant (az login) by someone with Contributor on a subscription and Application Administrator in Entra.
# Takes about 15 minutes. Idempotent: re-running updates in place.
set -euo pipefail

: "${RG:=rg-fsp-salesdesk}"
: "${LOC:=eastus2}"
: "${SWA:=fsp-salesdesk}"
: "${COSMOS:=fspsalesdesk$RANDOM}"
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

# 1. Cosmos DB (NoSQL, serverless: pay per request, no idle cost; free tier if the subscription has none yet)
az cosmosdb create -n "$COSMOS" -g "$RG" --capabilities EnableServerless --default-consistency-level Session -o none
az cosmosdb sql database create -a "$COSMOS" -g "$RG" -n salesdesk -o none
az cosmosdb sql container create -a "$COSMOS" -g "$RG" -d salesdesk -n docs --partition-key-path /coll -o none
COSMOS_CS=$(az cosmosdb keys list -n "$COSMOS" -g "$RG" --type connection-strings --query "connectionStrings[0].connectionString" -o tsv)

# 2. Static Web App (Standard: needed for custom Entra ID auth locked to this tenant)
az staticwebapp create -n "$SWA" -g "$RG" -l "$LOC" --sku Standard -o none
HOST=$(az staticwebapp show -n "$SWA" -g "$RG" --query defaultHostname -o tsv)
echo "Default host: https://$HOST"

# 3. Entra ID app registration (sign-in restricted to this tenant)
APP_ID=$(az ad app create --display-name "FSP SalesDesk" --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://$HOST/.auth/login/aad/callback" "https://$DOMAIN/.auth/login/aad/callback" \
  --enable-id-token-issuance true --required-resource-accesses '[{"resourceAppId":"00000003-0000-0000-c000-000000000000","resourceAccess":[{"id":"b633e1c5-b582-4048-a93e-9f11b44c7e96","type":"Role"},{"id":"810c84a8-4a9e-49e6-bf7d-12d183f40d01","type":"Role"},{"id":"e1fe6dd8-ba31-4d61-89e7-88639da4683d","type":"Scope"}]}]' --query appId -o tsv)
# Graph application permissions above: Mail.Send (b633e1c5…), Mail.Read (810c84a8…), User.Read delegated. Grant admin consent: az ad app permission admin-consent --id $APP_ID
az ad app permission admin-consent --id "$APP_ID" -o none || echo "Grant admin consent in Entra ID › App registrations › FSP SalesDesk › API permissions"
SECRET=$(az ad app credential reset --id "$APP_ID" --display-name swa --years 2 --query password -o tsv)
az ad app update --id "$APP_ID" --set optionalClaims='{"idToken":[{"name":"email","essential":false},{"name":"preferred_username","essential":false}]}' -o none || true

# 4. App settings (read by the API and by the auth block of staticwebapp.config.json)
az staticwebapp appsettings set -n "$SWA" -g "$RG" --setting-names \
  AAD_CLIENT_ID="$APP_ID" AAD_CLIENT_SECRET="$SECRET" AAD_TENANT_ID="$TENANT_ID" \
  COSMOS_CONNECTION_STRING="$COSMOS_CS" COSMOS_DB=salesdesk COSMOS_CONTAINER=docs \
  OWNER_EMAILS="$OWNER_EMAILS" ALLOWED_EMAIL_DOMAINS="$ALLOWED_EMAIL_DOMAINS" \
  ${ANTHROPIC_API_KEY:+ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"} -o none

# 5. Deployment token for GitHub Actions (store as repo secret AZURE_STATIC_WEB_APPS_API_TOKEN; also AAD_TENANT_ID)
TOKEN=$(az staticwebapp secrets list -n "$SWA" -g "$RG" --query properties.apiKey -o tsv)
echo
echo "GitHub secrets to add:"
echo "  AZURE_STATIC_WEB_APPS_API_TOKEN = $TOKEN"
echo "  AAD_TENANT_ID = $TENANT_ID"
echo
echo "DNS: create CNAME  ${DOMAIN%%.*}  ->  $HOST   then run:"
echo "  az staticwebapp hostname set -n $SWA -g $RG --hostname $DOMAIN"
echo
echo "Seed the database once (from the repo root, with the latest artifact export):"
echo "  COSMOS_CONNECTION_STRING='<from portal>' node deploy/azure-swa/infra/seed.mjs data/live.json"
