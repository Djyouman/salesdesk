#!/usr/bin/env bash
# Build and publish FSP SalesDesk to the Static Web App created by deploy.sh, and load the data.
# Run from the repository root in Azure Cloud Shell after deploy.sh. Re-run any time to publish a new
# version (the nightly build can also deploy through GitHub Actions once the repo secrets are set).
set -euo pipefail
ENVF="$HOME/.salesdesk/env"
if [ -f "$ENVF" ]; then set -a; . "$ENVF"; set +a; fi
: "${RG:=rg-fsp-salesdesk}"; : "${SWA:=fsp-salesdesk}"
TENANT_ID=${TENANT_ID:-$(az account show --query tenantId -o tsv)}
HOST=${HOST:-$(az staticwebapp show -n "$SWA" -g "$RG" --query defaultHostname -o tsv)}
COSMOS=${COSMOS:-$(az cosmosdb list -g "$RG" --query "[0].name" -o tsv)}

cd "$(dirname "$0")/../../.."   # repository root
echo "Building the web app…"
python3 deploy/azure-swa/tools/build_web.py salesdesk.html data deploy/azure-swa/app
sed "s/__TENANT_ID__/$TENANT_ID/" deploy/azure-swa/staticwebapp.config.json > deploy/azure-swa/app/staticwebapp.config.json

echo "Publishing to https://$HOST (2–4 minutes)…"
TOKEN=$(az staticwebapp secrets list -n "$SWA" -g "$RG" --query properties.apiKey -o tsv)
npx --yes @azure/static-web-apps-cli@2.0.10 deploy deploy/azure-swa/app --api-location deploy/azure-swa/api --deployment-token "$TOKEN" --env production --verbose silly 2>&1 | grep -viE "token|secret" | tail -15

echo "Loading the data into Cosmos DB…"
if [ ! -d deploy/azure-swa/api/node_modules ]; then (cd deploy/azure-swa/api && npm install --no-audit --no-fund --silent); fi
COSMOS_CS=$(az cosmosdb keys list -n "$COSMOS" -g "$RG" --type connection-strings --query "connectionStrings[0].connectionString" -o tsv)
COSMOS_CONNECTION_STRING="$COSMOS_CS" node deploy/azure-swa/infra/seed.mjs data/live.json

echo
echo "Done. Open https://$HOST and sign in with your Microsoft account."
echo "If the page says 'not signed in' or loops, wait two minutes (the first deploy warms up) and reload."
