# FSP SalesDesk on Azure Static Web Apps (Microsoft sign-in)

The same single-file SalesDesk page, hosted on an FSP domain, behind Entra ID (Microsoft 365) sign-in,
with its data in Cosmos DB instead of the claude.ai artifact database. Anyone with an FSP Microsoft
account opens `https://salesdesk.flowservice.com`, signs in with the account they already use for
Outlook, and sees SalesDesk with their role (owner / platform / brand management / sales / viewer)
resolved from the roster. Nobody outside the FSP tenant can get past the sign-in page.

## What is in this folder

| Path | Purpose |
|---|---|
| `staticwebapp.config.json` | Routes, Entra ID auth locked to the FSP tenant, 401 → Microsoft login, API protected |
| `app-src/shim.js` | Gives the page `window.claude.use()` backed by the API, so `salesdesk.html` runs unchanged |
| `app-src/forbidden.html` | Shown to a Microsoft account outside the allowed domains |
| `tools/build_web.py` | Builds `app/` from `salesdesk.html` + `data/` (wraps the page, injects the shim, copies the data files) |
| `api/` | Azure Functions (Node 20): `/api/me`, `/api/roles`, `/api/db/{coll}/{id}`, `/api/batch`, `/api/ai`, `/api/mail/*` |
| `api/src/shared/auth.js` | Reads the SWA principal, enforces the e-mail domain allowlist and the write rules |
| `api/src/shared/store.js` | Cosmos DB document store (and an in-memory twin for tests) |
| `infra/deploy.sh` | One-time Azure setup: resource group, Cosmos DB serverless, Static Web App, Entra app registration, settings |
| `infra/seed.mjs` | Loads `data/live.json` (the artifact export) into Cosmos once at cutover |
| `tools/mock-server.mjs`, `tools/test_web.js` | Local stand-in for SWA + headless end-to-end test (owner, sales, guest) |
| `.github/workflows/azure-static-web-apps.yml` | Deploys on every push to `main` |

## Architecture

```
Browser ──(Microsoft login via Entra ID, FSP tenant only)──> Azure Static Web Apps
   │  index.html = salesdesk.html + shim.js                 │
   │  data/*.json (history, accounts, contacts, plans)      │ x-ms-client-principal
   └──/api/* ────────────────────────────────────────────> Azure Functions (api/)
                                                              ├─ roles from settings/main + users roster
                                                              ├─ Cosmos DB  (database salesdesk, container docs, partition /coll)
                                                              └─ Anthropic API (assistant, coach, scope writer; key server-side)
```

* **Identity**: Static Web Apps handles the OpenID Connect flow with Entra ID. The API receives the
  signed-in user's id, UPN/e-mail, display name and tenant; it never sees a password or token.
* **Tenant lock**: `openIdIssuer` is the FSP tenant, the app registration is single-tenant
  (`AzureADMyOrg`), and the API additionally checks `ALLOWED_EMAIL_DOMAINS`. Three independent gates.
* **Roles**: same rules as the artifact: owner e-mails from `OWNER_EMAILS`; `settings/main.roles` by
  e-mail or display name; the `users` roster (e-mail, then display name / aliases); otherwise viewer.
  Reps are recognised by display name on day one (the roster has no e-mails yet) and their Microsoft id
  is linked on first sign-in, so the match is exact from then on.
* **Write rules**: viewers never write; `settings`, `brands`, `product`, `users` are admin-only (a rep
  may update their own roster record); everything else is writable by sales and up. Per-deal ownership
  is enforced in the page as before.
* **Live updates**: the shim polls each collection every 15 s (slower when the tab is hidden) and after
  every local write. No websockets needed; Cosmos `_ts` drives the delta query.
* **Email**: `/api/mail/send`, `/api/mail/search` and `/api/mail/status` give the page the same "Send email" and
  "Sync inbox" actions it has on claude.ai (the shim presents them as the Microsoft 365 connector). They call
  Microsoft Graph with application permissions on the SalesDesk app registration (`Mail.Send`, `Mail.Read`,
  admin consent once) and act only on the signed-in user's own mailbox. Restrict the app to the sales
  mailboxes with an Exchange application access policy:
  `New-ApplicationAccessPolicy -AppId <AAD_CLIENT_ID> -PolicyScopeGroupId sales-mailboxes@flowservice.com -AccessRight RestrictAccess`.
* **AI**: `/api/ai` calls Claude (`claude-opus-5-5`; `claude-haiku-5-5` for quick calls) with the key
  in app settings. Tools stay in the browser: the page executes them and posts results back.

## Go-live runbook (about 30 minutes, needs an Azure subscription in the FSP tenant)

1. **Repository**. Put this repo (`salesdesk.html`, `data/`, `deploy/`) in GitHub (private). Connect
   GitHub to claude.ai (Settings → Connectors) and Claude can push the nightly builds itself.
2. **Azure**. Someone with Contributor on a subscription and Application Administrator in Entra runs:
   ```bash
   az login
   ANTHROPIC_API_KEY=sk-ant-... bash deploy/azure-swa/infra/deploy.sh
   ```
   It prints two GitHub secrets (`AZURE_STATIC_WEB_APPS_API_TOKEN`, `AAD_TENANT_ID`) and the default
   host name. Add the secrets to the repo; push to `main`; the workflow deploys in about 3 minutes.
3. **Domain**. In the flowservice.com DNS, add `CNAME salesdesk → <default host>.azurestaticapps.net`,
   then `az staticwebapp hostname set -n fsp-salesdesk -g rg-fsp-salesdesk --hostname salesdesk.flowservice.com`.
   Certificates are automatic.
4. **Data**. Export the artifact database (the nightly build already produces `data/live.json`) and seed:
   ```bash
   COSMOS_CONNECTION_STRING='...' node deploy/azure-swa/infra/seed.mjs data/live.json
   ```
5. **Admin consent** (one click): the first sign-in asks for the standard `openid profile email`
   permissions. An Entra admin grants them once for the tenant so reps never see the prompt. For email,
   add the application permissions `Mail.Send` and `Mail.Read` to the SalesDesk app registration, grant
   admin consent, and apply the Exchange application access policy above.
6. **Brand e-mail domains**. If reps sign in with brand domains (e.g. `@cortezmech.com`), add them to the
   `ALLOWED_EMAIL_DOMAINS` app setting (comma-separated). Guest accounts in the tenant are blocked
   unless their domain is listed.

Monthly cost: Static Web Apps Standard about $9; Cosmos serverless a few dollars at this volume; the
assistant's usage is metered through the Anthropic key.

## Local development and tests

```bash
python3 deploy/azure-swa/tools/build_web.py salesdesk.html data deploy/azure-swa/app
cd deploy/azure-swa/api && npm install && cd ..
SEED_LIVE_JSON=../../data/live.json node tools/mock-server.mjs app 8790          # as the owner
node tools/mock-server.mjs app 8791 steve.dobbins@flowservice.com "Steve Dobbins"  # as a rep
node tools/test_web.js                                                            # headless end-to-end
```

The mock server reuses the real API handlers with an in-memory store and a fake Microsoft principal,
so what passes here is what runs on Azure, minus Cosmos and the Entra round trip.

## Cutover from the claude.ai artifact

Both can run side by side: the artifact keeps the shared database for the skunk-works period; the web
app has its own Cosmos store. Seed Cosmos from the latest `live.json` on cutover day, point reps at the
domain, and stop writing to the artifact. The page code is identical, so every nightly improvement
ships to both until the artifact is retired.
