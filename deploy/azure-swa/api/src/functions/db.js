'use strict';
// REST surface that the page's db shim talks to. Every route requires a Microsoft-authenticated
// principal (SWA enforces the login; this code enforces the domain allowlist and the write rules).
const { app } = require('@azure/functions');
const { parsePrincipal, domainAllowed, resolveRole, canWrite } = require('../shared/auth');
const { cosmosStore } = require('../shared/store');

const COLLS = ['deals', 'orgs', 'quotes', 'proposals', 'activities', 'tasks', 'users', 'contacts', 'brands', 'settings', 'signins', 'product'];
const ID_RE = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;

function makeHandlers(store) {
  async function context(req) {
    const principal = parsePrincipal(req);
    if (!principal) return { error: json({ error: 'not_signed_in' }, 401) };
    if (!domainAllowed(principal.email)) return { error: json({ error: 'domain_not_allowed', email: principal.email }, 403) };
    const [settingsRow, userRows] = await Promise.all([store.get('settings', 'main'), store.list('users')]);
    const settings = settingsRow ? settingsRow.doc : {};
    const users = userRows.filter(u => !u.deleted).map(u => u.doc);
    const { role, user } = resolveRole(principal, settings, users);
    return { principal, role, user, settings };
  }

  async function me(req) {
    const ctx = await context(req); if (ctx.error) return ctx.error;
    const { principal, role, user } = ctx;
    return json({ id: principal.id, name: principal.name, email: principal.email, role, isOwner: role === 'owner', canEdit: ['owner', 'admin', 'platform'].includes(role), writes: role !== 'viewer', userId: user ? user.id : null, tenant: principal.tenant });
  }

  // SWA rolesSource: returns custom roles for the signed-in user (keeps "authenticated" as the gate).
  async function roles(req) {
    let body = {}; try { body = await req.json(); } catch (e) { }
    const claims = Object.fromEntries((body.claims || []).map(c => [c.typ, c.val]));
    const email = (claims['preferred_username'] || body.userDetails || '').toLowerCase();
    if (!domainAllowed(email)) return json({ roles: [] });
    return json({ roles: ['fsp'] });
  }

  async function dbRoute(req) {
    const ctx = await context(req); if (ctx.error) return ctx.error;
    const coll = req.params.coll, id = req.params.id;
    if (!COLLS.includes(coll)) return json({ error: 'unknown_collection' }, 404);
    if (id && !ID_RE.test(id)) return json({ error: 'bad_id' }, 400);
    const by = ctx.principal.name || ctx.principal.email;
    if (req.method === 'GET') {
      if (id) { const row = await store.get(coll, id); return row ? json({ id: row.id, doc: row.doc, ts: row.ts }) : json({ error: 'not_found' }, 404); }
      const since = Number(req.query.get('since') || 0) || 0;
      const rows = await store.list(coll, since);
      const now = Math.floor(Date.now() / 1000);
      return json({ coll, now, docs: rows.map(r => ({ id: r.id, doc: r.deleted ? null : r.doc, deleted: r.deleted, ts: r.ts })) });
    }
    if (!canWrite(ctx.role, coll, id, ctx.user)) return json({ error: 'permission_denied', role: ctx.role, coll }, 403);
    if (!id) return json({ error: 'id_required' }, 400);
    if (req.method === 'PUT') { const doc = await req.json(); const row = await store.set(coll, id, doc, by); return json({ id: row.id, ts: row.ts }); }
    if (req.method === 'PATCH') { const patch = await req.json(); const row = await store.update(coll, id, patch, by); return json({ id: row.id, ts: row.ts }); }
    if (req.method === 'DELETE') { const ok = await store.delete(coll, id, by); return json({ ok }); }
    return json({ error: 'method' }, 405);
  }

  async function batch(req) {
    const ctx = await context(req); if (ctx.error) return ctx.error;
    const body = await req.json(); const writes = Array.isArray(body.writes) ? body.writes.slice(0, 50) : [];
    const by = ctx.principal.name || ctx.principal.email; const out = [];
    for (const w of writes) {
      if (!COLLS.includes(w.coll) || !ID_RE.test(String(w.id || ''))) { out.push({ id: w.id, error: 'bad_target' }); continue; }
      if (!canWrite(ctx.role, w.coll, String(w.id), ctx.user)) { out.push({ id: w.id, error: 'permission_denied' }); continue; }
      if (w.op === 'delete') out.push({ id: w.id, ok: await store.delete(w.coll, w.id, by) });
      else if (w.op === 'update') out.push({ id: (await store.update(w.coll, w.id, w.doc || {}, by)).id });
      else out.push({ id: (await store.set(w.coll, w.id, w.doc || {}, by)).id });
    }
    return json({ results: out });
  }

  return { me, roles, dbRoute, batch };
}

function json(obj, status = 200) { return { status, jsonBody: obj, headers: { 'Cache-Control': 'no-store' } }; }

if (process.env.SALESDESK_NO_REGISTER !== '1') {
  const h = makeHandlers(cosmosStore());
  app.http('me', { route: 'me', methods: ['GET'], authLevel: 'anonymous', handler: h.me });
  app.http('roles', { route: 'roles', methods: ['POST'], authLevel: 'anonymous', handler: h.roles });
  app.http('db', { route: 'db/{coll}/{id?}', methods: ['GET', 'PUT', 'PATCH', 'DELETE'], authLevel: 'anonymous', handler: h.dbRoute });
  app.http('batch', { route: 'batch', methods: ['POST'], authLevel: 'anonymous', handler: h.batch });
}

module.exports = { makeHandlers, COLLS };
