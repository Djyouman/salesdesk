// Local stand-in for Azure Static Web Apps: serves app/ and the same API handlers over an in-memory
// store, injecting a fake Microsoft principal. Used by the headless tests and for local development.
//   node tools/mock-server.mjs <appDir> [port] [principalEmail] [principalName]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
process.env.SALESDESK_NO_REGISTER = '1';
process.env.OWNER_EMAILS = process.env.OWNER_EMAILS || 'daniel.youman@flowservice.com';
process.env.ALLOWED_EMAIL_DOMAINS = process.env.ALLOWED_EMAIL_DOMAINS || 'flowservice.com';
const { makeHandlers } = require('../api/src/functions/db.js');
const { memoryStore } = require('../api/src/shared/store.js');

const appDir = path.resolve(process.argv[2] || 'app');
const port = Number(process.argv[3] || 8790);
const email = process.argv[4] || 'daniel.youman@flowservice.com';
const name = process.argv[5] || 'Daniel Youman';
const store = memoryStore(); const sentMail = []; const MOCK_INBOX = [{ uri: 'mail:///messages/inb-1', id: 'inb-1', subject: 'RE: pricing question [SD-TEST]', sender: 'pat@customer.org', senderName: 'Pat Customer', recipients: null, receivedDateTime: '2026-10-29T15:00:00Z', summary: 'Can you send the alternate?', webLink: 'https://outlook.office365.com/owa/?ItemID=inb-1' }];
const h = makeHandlers(store);
// Optional seed: data/live.json from the artifact export.
const seed = process.env.SEED_LIVE_JSON;
if (seed && fs.existsSync(seed)) {
  const live = JSON.parse(fs.readFileSync(seed, 'utf8'));
  for (const [coll, docs] of Object.entries(live.collections || {})) for (const [id, doc] of Object.entries(docs)) await store.set(coll, id, doc, 'seed');
  console.log('seeded from', seed);
}
const principal = Buffer.from(JSON.stringify({ identityProvider: 'aad', userId: 'u_' + Buffer.from(email).toString('hex').slice(0, 22), userDetails: email, userRoles: ['anonymous', 'authenticated'], claims: [{ typ: 'preferred_username', val: email }, { typ: 'name', val: name }, { typ: 'tid', val: 'mock-tenant' }] })).toString('base64');

function wrap(req, body) {
  const url = new URL(req.url, 'http://localhost');
  const headers = new Map(Object.entries(req.headers)); headers.set('x-ms-client-principal', req.headers['x-no-auth'] ? '' : principal);
  return { method: req.method, headers: { get: k => headers.get(k.toLowerCase()) || null }, query: url.searchParams, params: {}, json: async () => JSON.parse(body || '{}'), url: url.toString() };
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const r = wrap(req, body); let out;
      const m = url.pathname.match(/^\/api\/db\/([^/]+)(?:\/([^/]+))?$/);
      if (url.pathname === '/api/me') out = await h.me(r);
      else if (url.pathname === '/api/roles') out = await h.roles(r);
      else if (url.pathname === '/api/batch') out = await h.batch(r);
      else if (url.pathname === '/api/ai') out = { status: 503, jsonBody: { error: 'ai_not_configured' } };
      else if (url.pathname === '/api/mail/status') out = { status: 200, jsonBody: { status: 'ready', mode: 'mock' } };
      else if (url.pathname === '/api/mail/send') { const b = JSON.parse(body || '{}'); if (!b.to || !b.to.length || !b.subject) out = { status: 400, jsonBody: { error: 'bad_request', message: 'to and subject required' } }; else { sentMail.push({ ...b, from: email, at: new Date().toISOString() }); out = { status: 200, jsonBody: { ok: true, id: 'mock-' + sentMail.length } } } }
      else if (url.pathname === '/api/mail/search') { const b = JSON.parse(body || '{}'); const all = [...sentMail.map((m, i) => ({ uri: 'mail:///messages/mock-' + (i + 1), id: 'mock-' + (i + 1), subject: m.subject, sender: email, senderName: name, recipients: m.to, receivedDateTime: m.at, sentDateTime: m.at, summary: String(m.body || '').replace(/<[^>]+>/g, ' ').slice(0, 200), webLink: 'https://outlook.office365.com/owa/?ItemID=mock-' + (i + 1) })), ...MOCK_INBOX]; const q = (b.query || '').replace(/"/g, '').toLowerCase(); const hits = all.filter(m => (!q || (m.subject + ' ' + m.summary).toLowerCase().includes(q)) && (!b.sender || String(m.sender).toLowerCase().includes(String(b.sender).toLowerCase())) && (!b.recipient || (m.recipients || []).join(' ').toLowerCase().includes(String(b.recipient).toLowerCase()))); out = { status: 200, jsonBody: { messages: hits.slice(0, b.limit || 25), moreResults: false } } }
      else if (m) { r.params = { coll: m[1], id: m[2] ? decodeURIComponent(m[2]) : undefined }; out = await h.dbRoute(r); }
      else out = { status: 404, jsonBody: { error: 'no_route' } };
      res.writeHead(out.status || 200, { 'Content-Type': 'application/json', ...(out.headers || {}) }); res.end(JSON.stringify(out.jsonBody)); return;
    }
    let p = path.join(appDir, decodeURIComponent(url.pathname)); if (url.pathname === '/' || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(appDir, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(p).pipe(res);
  } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); }
}).listen(port, () => console.log(`mock SWA on http://localhost:${port} as ${email}`));
