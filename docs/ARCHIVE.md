# SalesDesk record archive strategy (P12)

Limits: the shared database holds 25,000 documents. History (7,034 deals, 2,379 accounts) lives in published JSON files and costs nothing against that limit. Live documents today: users 74, settings 1, product logs, brands 2, plus every deal edit, quote, proposal, task, contact and activity.

Growth estimate at full adoption (60 reps): ~150 activities/day, ~30 tasks/day, ~15 quotes/day → ~50,000 documents/year. The ceiling is reached in roughly six months of platform-wide use.

Plan:
1. Activities and completed tasks older than 24 months are the archive candidates; deals, quotes, proposals, contacts and accounts stay live.
2. Nightly build adds (when counts pass 15,000): Setup › Data shows per-collection counts and an "Archive closed-out activity" action for admins that exports the candidates as JSON (downloads capability), writes a summary stub per deal (`activityArchive: {count, lastAt, file}`), then deletes the archived documents.
3. Quarterly, the Pipedrive-style history file is regenerated from live + archive so analytics keep full history without live documents: a build step in the nightly run, published as `data/history.json` with `files`.
4. Hard rule: never delete a deal, quote or proposal document; archive only activity-type records.
