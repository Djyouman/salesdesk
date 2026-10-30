'use strict';
// Mail for the hosted build: the same two actions the claude.ai page gets from the Microsoft 365
// connector, here through Microsoft Graph with application permissions (client credentials on the
// SalesDesk app registration), acting on the signed-in user's own mailbox only.
//   Graph permissions (admin consent): Mail.Send, Mail.Read (Application). Restrict them to the sales
//   mailboxes with an Exchange application access policy (New-ApplicationAccessPolicy) so the app can
//   never touch other mailboxes. Settings: AAD_TENANT_ID, AAD_CLIENT_ID, AAD_CLIENT_SECRET.
const { app } = require('@azure/functions');
const { parsePrincipal, domainAllowed } = require('../shared/auth');

let tokenCache = { token: null, exp: 0 };
async function graphToken() {
  const { AAD_TENANT_ID, AAD_CLIENT_ID, AAD_CLIENT_SECRET } = process.env;
  if (!AAD_TENANT_ID || !AAD_CLIENT_ID || !AAD_CLIENT_SECRET) { const e = new Error('mail_not_configured'); e.code = 'mail_not_configured'; throw e; }
  if (tokenCache.token && Date.now() < tokenCache.exp - 60000) return tokenCache.token;
  const body = new URLSearchParams({ client_id: AAD_CLIENT_ID, client_secret: AAD_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' });
  const r = await fetch(`https://login.microsoftonline.com/${AAD_TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', body });
  if (!r.ok) { const e = new Error('token ' + r.status); e.code = 'mail_not_configured'; throw e; }
  const j = await r.json(); tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }; return tokenCache.token;
}
async function graph(method, path, body) {
  const token = await graphToken();
  const r = await fetch('https://graph.microsoft.com/v1.0' + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ConsistencyLevel: 'eventual' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 403) { const e = new Error('Mailbox access is not permitted for this account (application access policy).'); e.code = 'mail_forbidden'; e.status = 403; throw e; }
  if (r.status === 429) { const e = new Error('Graph rate limit'); e.status = 429; throw e; }
  if (!r.ok) { const t = await r.text(); const e = new Error('Graph ' + r.status + ': ' + t.slice(0, 300)); e.status = r.status >= 500 ? 502 : 400; throw e; }
  return r.status === 202 || r.status === 204 ? {} : r.json();
}
function who(req) { const p = parsePrincipal(req); if (!p) return { error: { status: 401, jsonBody: { error: 'not_signed_in' } } }; if (!domainAllowed(p.email)) return { error: { status: 403, jsonBody: { error: 'domain_not_allowed' } } }; return { p }; }
function fail(e) { return { status: e.status || (e.code === 'mail_not_configured' ? 503 : 500), jsonBody: { error: e.code || 'mail_error', message: e.message } }; }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function status(req) { const w = who(req); if (w.error) return w.error; try { await graphToken(); return { status: 200, jsonBody: { status: 'ready', mode: 'graph' } }; } catch (e) { return { status: 200, jsonBody: { status: 'not_configured' } }; } }

async function send(req) {
  const w = who(req); if (w.error) return w.error; let b; try { b = await req.json(); } catch (e) { return { status: 400, jsonBody: { error: 'bad_json' } }; }
  const to = (b.to || []).filter(x => EMAIL.test(x)).slice(0, 50), cc = (b.cc || []).filter(x => EMAIL.test(x)).slice(0, 50);
  if (!to.length || !b.subject) return { status: 400, jsonBody: { error: 'bad_request', message: 'to and subject are required' } };
  const message = { subject: String(b.subject).slice(0, 255), body: { contentType: b.bodyType === 'html' ? 'HTML' : 'Text', content: String(b.body || '').slice(0, 500000) }, toRecipients: to.map(a => ({ emailAddress: { address: a } })), ccRecipients: cc.map(a => ({ emailAddress: { address: a } })) };
  try { await graph('POST', `/users/${encodeURIComponent(w.p.email)}/sendMail`, { message, saveToSentItems: true }); return { status: 200, jsonBody: { ok: true } }; } catch (e) { return fail(e); }
}

// Mirrors the connector's result items so the page's mailItems() needs no changes.
async function search(req) {
  const w = who(req); if (w.error) return w.error; let b; try { b = await req.json(); } catch (e) { return { status: 400, jsonBody: { error: 'bad_json' } }; }
  const limit = Math.min(Math.max(Number(b.limit) || 10, 1), 25); const me = encodeURIComponent(w.p.email);
  let path;
  if (b.query) path = `/users/${me}/messages?$search=${encodeURIComponent('"' + String(b.query).replace(/"/g, '') + '"')}&$top=${limit}&$select=id,subject,sender,toRecipients,receivedDateTime,sentDateTime,bodyPreview,webLink,internetMessageId`;
  else if (b.sender) path = `/users/${me}/messages?$filter=${encodeURIComponent(`from/emailAddress/address eq '${String(b.sender).replace(/'/g, "''")}'`)}&$top=${limit}&$orderby=receivedDateTime desc&$select=id,subject,sender,toRecipients,receivedDateTime,sentDateTime,bodyPreview,webLink,internetMessageId`;
  else if (b.recipient) path = `/users/${me}/messages?$search=${encodeURIComponent(`"to:${String(b.recipient).replace(/"/g, '')}"`)}&$top=${limit}&$select=id,subject,sender,toRecipients,receivedDateTime,sentDateTime,bodyPreview,webLink,internetMessageId`;
  else path = `/users/${me}/mailFolders/inbox/messages?$top=${limit}&$orderby=receivedDateTime desc&$select=id,subject,sender,toRecipients,receivedDateTime,sentDateTime,bodyPreview,webLink,internetMessageId`;
  try {
    const j = await graph('GET', path);
    const messages = (j.value || []).map(m => ({ uri: 'mail:///messages/' + m.id, id: m.id, subject: m.subject || '', sender: m.sender && m.sender.emailAddress ? m.sender.emailAddress.address : '', senderName: m.sender && m.sender.emailAddress ? m.sender.emailAddress.name : '', recipients: (m.toRecipients || []).map(r => r.emailAddress && r.emailAddress.address).filter(Boolean), receivedDateTime: m.receivedDateTime, sentDateTime: m.sentDateTime, summary: m.bodyPreview || '', webLink: m.webLink || '', internetMessageId: m.internetMessageId || '' }));
    return { status: 200, jsonBody: { messages, moreResults: !!j['@odata.nextLink'] } };
  } catch (e) { return fail(e); }
}

if (process.env.SALESDESK_NO_REGISTER !== '1') {
  app.http('mailStatus', { route: 'mail/status', methods: ['GET'], authLevel: 'anonymous', handler: status });
  app.http('mailSend', { route: 'mail/send', methods: ['POST'], authLevel: 'anonymous', handler: send });
  app.http('mailSearch', { route: 'mail/search', methods: ['POST'], authLevel: 'anonymous', handler: search });
}
module.exports = { status, send, search };
