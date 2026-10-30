// Seed Cosmos DB from a SalesDesk live export (data/live.json: {exportedAt, collections:{coll:{id:doc}}}).
// Idempotent upserts. Run once at cutover, and again if you want to re-sync from the claude.ai artifact.
//   COSMOS_CONNECTION_STRING=... node deploy/azure-swa/infra/seed.mjs data/live.json
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { cosmosStore } = require('../api/src/shared/store.js');
const file = process.argv[2] || 'data/live.json';
const live = JSON.parse(fs.readFileSync(file, 'utf8'));
const store = cosmosStore();
let n = 0;
for (const [coll, docs] of Object.entries(live.collections || {})) {
  for (const [id, doc] of Object.entries(docs)) { await store.set(coll, id, doc, 'seed:' + (live.exportedAt || '')); n++; }
  console.log(coll, Object.keys(docs).length);
}
console.log('seeded', n, 'documents from', file);
