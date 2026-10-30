// Document store over Azure Cosmos DB (NoSQL, serverless). One container, partitioned by collection.
// Item shape: { id, coll, doc, updatedAt, updatedBy, deleted, _ts }. The page never sees this envelope;
// it gets { ...doc, id } exactly as the artifact database returned it.
'use strict';
const { CosmosClient } = require('@azure/cosmos');

let container = null;
function cosmos() {
  if (container) return container;
  const cs = process.env.COSMOS_CONNECTION_STRING;
  if (!cs) throw new Error('COSMOS_CONNECTION_STRING is not set');
  const client = new CosmosClient(cs);
  container = client.database(process.env.COSMOS_DB || 'salesdesk').container(process.env.COSMOS_CONTAINER || 'docs');
  return container;
}

// In-memory store with the same interface, used by the mock server and tests.
function memoryStore() {
  const items = new Map(); // key coll/id
  const now = () => Math.floor(Date.now() / 1000);
  return {
    async list(coll, since) { return [...items.values()].filter(x => x.coll === coll && (!since || x._ts > since)).map(strip); },
    async get(coll, id) { const x = items.get(coll + '/' + id); return x ? strip(x) : null; },
    async set(coll, id, doc, by) { const x = { id, coll, doc: { ...doc, id }, updatedAt: new Date().toISOString(), updatedBy: by, deleted: false, _ts: now() }; items.set(coll + '/' + id, x); return strip(x); },
    async update(coll, id, patch, by) { const prev = items.get(coll + '/' + id); const doc = { ...(prev && !prev.deleted ? prev.doc : {}), ...patch, id }; return this.set(coll, id, doc, by); },
    async delete(coll, id, by) { const prev = items.get(coll + '/' + id); if (!prev) return false; items.set(coll + '/' + id, { ...prev, deleted: true, updatedAt: new Date().toISOString(), updatedBy: by, _ts: now() }); return true; },
  };
}

function strip(x) { return { id: x.id, coll: x.coll, doc: x.doc, deleted: !!x.deleted, updatedAt: x.updatedAt, updatedBy: x.updatedBy, ts: x._ts }; }

function cosmosStore() {
  const c = () => cosmos();
  return {
    async list(coll, since) {
      const q = since
        ? { query: 'SELECT * FROM c WHERE c.coll = @coll AND c._ts > @since', parameters: [{ name: '@coll', value: coll }, { name: '@since', value: since }] }
        : { query: 'SELECT * FROM c WHERE c.coll = @coll AND (NOT IS_DEFINED(c.deleted) OR c.deleted = false)', parameters: [{ name: '@coll', value: coll }] };
      const { resources } = await c().items.query(q, { partitionKey: coll }).fetchAll();
      return resources.map(strip);
    },
    async get(coll, id) {
      try { const { resource } = await c().item(id, coll).read(); return resource && !resource.deleted ? strip(resource) : null; }
      catch (e) { if (e.code === 404) return null; throw e; }
    },
    async set(coll, id, doc, by) {
      const item = { id, coll, doc: { ...doc, id }, updatedAt: new Date().toISOString(), updatedBy: by, deleted: false };
      const { resource } = await c().items.upsert(item);
      return strip(resource);
    },
    async update(coll, id, patch, by) {
      const prev = await this.get(coll, id);
      return this.set(coll, id, { ...(prev ? prev.doc : {}), ...patch }, by);
    },
    async delete(coll, id, by) {
      // Soft delete so pollers learn about removals; the page drops deleted ids.
      const prev = await this.get(coll, id); if (!prev) return false;
      await c().items.upsert({ id, coll, doc: prev.doc, updatedAt: new Date().toISOString(), updatedBy: by, deleted: true });
      return true;
    },
  };
}

module.exports = { cosmosStore, memoryStore };
