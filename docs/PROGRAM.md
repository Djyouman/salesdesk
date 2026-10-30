# FSP SalesDesk — continuous improvement program

Live app: https://claude.ai/artifact/CjUGn4U13rhVBhruLh89SS (private; owner Daniel Youman, signs in to claude.ai with Microsoft).
Pattern: same as FSP FieldOps (ServiceTitan replacement). Three agent roles, one engineer, a persistent backlog in the app's own database, a hard clock, a written log every cycle, an email to the CEO.

## Architecture (do not change without a backlog item)
- Single-file page `salesdesk.html` published as the artifact. Capabilities: db (rules: settings/brands/product/users write admin), user (profile scope), sample, downloads.
- Published data files beside the page (fetched with relative URLs): `data/history.json` (7,034 Pipedrive deals, compact; `site` = index into the account's names list), `data/orgs.json` (2,379 accounts clustered from 2,681 Pipedrive org names; `mergeStatus` proposed|single), `data/plans.json` (FY2026 rep goals, company plans, roster), `data/quality.json` (import flags). Republishing the page alone keeps these files; pass `files` only to replace them.
- `data/live.json` is a snapshot of every shared db collection (`{exportedAt, collections:{coll:{id:doc}}}`), built by `tools/live_export.py` from an ArtifactData dump (`list` each collection in COLLS with `out_dir=data/dbdump`). The page loads it whenever `claude.use('db')` resolves null (direct visit outside the claude.ai frame) and layers localStorage edits on top; rail badge shows "snapshot MM-DD". **Every build (nightly and day loop) ends by refreshing it**: dump → `python3 tools/live_export.py data/dbdump data/live.json` → publish with `root: /home/user/salesdesk`, `files: {"data/live.json":"data/live.json"}`. Never publish a stale snapshot over a newer one; dump immediately before the final publish.
- Shared database collections: deals (live edits overlay history by id; new deals `d_*`), orgs (overrides/new), quotes, proposals, activities, users (74 reps + leadership), contacts, brands (overrides of built-in defaults), settings (doc `main`), product (doc `backlog`, plus `day-YYYY-MM-DD` / `night-YYYY-MM-DD` logs).
- Local mode: when `claude.use('db')` is null (local file or signed out) the page persists to localStorage and reports "local mode". Headless tests run in this mode; serve the folder over http (python3 -m http.server) so `fetch('data/...')` works.
- Roles: owner → admin → platform → brandmgr → sales → viewer; matched by linked viewer id, email, then display name (Settings › Roles, Team). No invitations are ever sent.
- Hash routes: home, pipeline, accounts, quotes, plan, analytics, team, assistant, setup, deal, account, quote, proposal. Never use reserved names (settings, sidebar, customize, upgrade, downloads).

## Roles
1. Product manager (subagent, fresh context). Reads CHANGELOG, product/backlog, last three logs; walks the app as a rep on a phone at 7am, a brand GM at month-end, the CRO on Friday, the CEO on Sunday night. Scores backlog items on value to a rep's day, value to the platform thesis (PM flywheel, 35% GM, GPMD discipline, enterprise reporting across brands, replacing Pipedrive), effort (S/M/L), risk to existing flows. Picks 2-4 items with acceptance criteria an engineer can test headless. Writes product/backlog (statuses, priorities, new items). Reviews at the end: met / partly / not met.
2. Sales agent (subagent, fresh context). Plays a working salesperson and a VP of Sales. Uses the live page source to answer: can I log a call in 10 seconds on a phone, can I quote a chiller in 5 minutes, does the proposal look like something I would hand a hospital facilities director, does the GPMD verdict help me or lecture me. Returns a ranked list of friction and missing workflows with a one-line business reason each. Feeds the PM.
3. Engineer (main session). Cycle: read the page → implement one item → headless Playwright at 1400px and 400px, light and dark, zero console errors, no horizontal scroll → republish to the same URL → one ArtifactData read → next item. Surgical edits; never remove a module; never store secrets; never invent records that look like real customers; never change the URL.

## Records every cycle
- CHANGELOG comment at the end of the page: date, cycle, what changed, what was verified, what is next.
- product/backlog updated by the PM.
- product/day-<date> (daytime) or product/night-<date> (nightly): {date, headline, plan, shipped[{item,result,businessReason,acceptance,verdict}], notShipped[{item,why}], defectsFixed, verification, couldNotVerify, backlogTop5, recommendation, strategicObservation, minutesUsed}. Written as text the CEO can read cold; the email relay sends it.

## Schedule (America/New_York)
- Day 1 (today): Fable session runs cycles through the evening; wind-down 7:45pm; final day log.
- Nightly from tonight: fresh Opus session 8:51pm–11:50pm ("FSP SalesDesk nightly build"); email relay 12:25am from the owner's session ("FSP SalesDesk nightly email to Daniel").

## Standards
Every shipped item is explainable in one sentence as money found, time saved for a rep, or risk removed for the platform. If that sentence cannot be written, do not build it.

## Data sources found on day 1 (for the nightly build)
- Full Pipedrive deals export (115 columns, June 23 2026, stages, contact persons, lost reasons, lead comments, estimated man hours, parent organization, vertical, service address): SharePoint site BudgetPlanning › Shared Documents › FY2026 H2 Forecast › Support › Pipedrive Support › "Deals All Entities.csv". Merged into data/history.json by the day-1 session (see tools/enrich.py). "Leads All Entities.xlsx" in the same folder could not be read through the connector (sensitivity label).
- Older full exports (Oct 2025 and mid-2025) under BudgetPlanning FY2026 zz_Historical and FlowServicePartners › KPI Report - Weekly Repository.
- Brand logos: fetched from FSPDreamTeam › Marketing › <Brand> › Logos and stored as compact data URLs in the `brands` collection (10–38 KB each).
- The Pipedrive API is not reachable from the cloud environment (network policy); a token reference exists in DataIngestion-MGMT › Data Lake Key Ids.xlsx but was not read.


## Hosted web app (added 2026-10-30)
`deploy/azure-swa/` packages the same page for Azure Static Web Apps behind Entra ID (Microsoft) sign-in: `tools/build_web.py salesdesk.html data app` wraps the page and injects `app-src/shim.js` (window.claude.use → /api/*); `api/` is a Node 20 Functions app over Cosmos DB with the artifact's write rules (plus self-update of a rep's own roster record); `infra/deploy.sh` is the one-time Azure setup; `tools/mock-server.mjs` + `tools/test_web.js` run the real handlers in memory for headless end-to-end tests. Every build should keep `node deploy/azure-swa/tools/test_web.js` green (start three mock servers first, see README). The page must keep working with `window.claude.use()` returning null (artifact outside the frame), the artifact capabilities (inside claude.ai) and the shim (hosted).

## UI conventions (added 2026-10-30, CEO direction)
Pipedrive's look: Source Sans 3 (Google Fonts), 14 px base, 600 headings, sentence-case labels and pills (no uppercase tracking), 4 px radii, thin rounded line icons via `ico()`/`ICONS` (1.5 px stroke, round caps). Brand fonts and colours apply only inside proposals.

## Connector capability (added 2026-10-30)
The page declares `mcp` with the viewer's **Microsoft 365** connector (tools `outlook_send_mail`, `outlook_email_search`, `read_resource`). "Send email" on a deal sends from the rep's Outlook with the deal tag `[SD-<pd or id>]` and logs an email activity; "Sync inbox" searches for the tag and for mail to/from the contact and files it (deduped by message id, `via:'outlook-sync'`, `link` = Outlook webLink). Real result shape verified 2026-10-30: one text content block per message `{uri,id,subject,sender,senderName,recipients:null,receivedDateTime,sentDateTime,summary,webLink,internetMessageId}` plus a trailing `{moreResults,nextOffset}` block; `sender` may be a legacy `/O=` DN for the user's own mail. On publish, pass the full `capabilities` set including mcp (omitting keeps the stored declaration). Hosted build: P70 (Microsoft Graph).

## Proposal document (rebuilt 2026-10-30)
Letter format per the brand docx skills: letterhead, cover letter, prepared-for / details blocks, numbered sections (summary, existing conditions, scope, equipment schedule with make/model/capacity/efficiency/electrical, investment with tax/total/alternates/clarifications/payment, schedule with milestones, inclusions/exclusions, warranty table, qualifications & safety, references, terms, acceptance). Brand-level content lives in `brands.<key>.profile` (Setup › Brands › Proposal profile); defaults in DEFAULT_SETTINGS (coverLetter, warrantyByComponent, standardMilestones, paymentTerms, proposalWarranty). Never invent qualifications, insurance or references: sections render only from stored data.

## Estimate import (added 2026-10-30)
Quotes › Import estimate: .xlsx (SheetJS 0.18.5 loaded on demand from cdnjs), .csv or pasted cells → `estFindHeader`, `estGuessCols`, `estParse`, `estType`; preview with mapping/type overrides → new quote (or current option). Tests: tools/test30.js.
