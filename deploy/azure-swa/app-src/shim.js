/* FSP SalesDesk web shim. Loaded before the page script when SalesDesk is hosted on Azure Static Web
   Apps. It provides window.claude.use(name) with the same contract the claude.ai viewer offers, backed by
   the SalesDesk API (/api/*), so salesdesk.html runs unchanged:
     db        -> /api/db/<coll>[/<id>] with 15 s polling for onSnapshot
     user      -> /api/me (Microsoft identity from Entra ID via Static Web Apps)
     sample    -> /api/ai (Claude through the server; tools run in the browser)
     downloads -> Blob + anchor (a normal browser can save files) */
(function () {
  'use strict';
  const POLL_MS = 15000;
  const api = async (path, opts) => {
    const r = await fetch('/api' + path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(opts && opts.headers || {}) }, ...opts });
    if (r.status === 401) { location.href = '/.auth/login/aad?post_login_redirect_uri=' + encodeURIComponent(location.pathname + location.hash); throw Object.assign(new Error('not signed in'), { code: 'not_signed_in' }); }
    let body = null; try { body = await r.json(); } catch (e) { }
    if (!r.ok) { const err = new Error((body && (body.message || body.error)) || ('HTTP ' + r.status)); err.code = (body && body.error) || ('http_' + r.status); err.status = r.status; throw err; }
    return body;
  };

  // ---- db ----
  const snapDoc = (id, doc) => ({ id, data: () => doc, exists: !!doc });
  const db = Object.freeze({
    doc(path) {
      const [coll, id] = String(path).split('/');
      return {
        async get() { try { const r = await api(`/db/${coll}/${encodeURIComponent(id)}`); return snapDoc(r.id, r.doc); } catch (e) { if (e.status === 404) return snapDoc(id, null); throw e; } },
        async set(doc) { const r = await api(`/db/${coll}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(doc) }); notify(coll); return r; },
        async update(patch) { const r = await api(`/db/${coll}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }); notify(coll); return r; },
        async delete() { const r = await api(`/db/${coll}/${encodeURIComponent(id)}`, { method: 'DELETE' }); notify(coll); return r; },
      };
    },
    collection(coll) {
      return {
        async get() { const r = await api(`/db/${coll}`); return { docs: r.docs.filter(d => !d.deleted).map(d => snapDoc(d.id, d.doc)) }; },
        onSnapshot(cb, onErr) {
          const state = { docs: new Map(), since: 0, timer: null, stopped: false };
          const pull = async () => {
            if (state.stopped) return;
            try {
              const r = await api(`/db/${coll}` + (state.since ? `?since=${state.since}` : ''));
              let changed = !state.since;
              for (const d of r.docs) { changed = true; if (d.deleted) state.docs.delete(d.id); else state.docs.set(d.id, d.doc); }
              state.since = r.now || state.since;
              if (changed) cb({ docs: [...state.docs.entries()].map(([id, doc]) => snapDoc(id, doc)) });
            } catch (e) { if (onErr) onErr(e); }
            if (!state.stopped) state.timer = setTimeout(pull, document.hidden ? POLL_MS * 4 : POLL_MS);
          };
          listeners.add(state); state.pull = pull; pull();
          return () => { state.stopped = true; clearTimeout(state.timer); listeners.delete(state); };
        },
      };
    },
  });
  const listeners = new Set();
  function notify(coll) { for (const l of listeners) { clearTimeout(l.timer); l.pull && l.pull(); } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) for (const l of listeners) { clearTimeout(l.timer); l.pull && l.pull(); } });

  // ---- user ----
  let mePromise = null; const getMe = () => (mePromise = mePromise || api('/me'));
  const user = Object.freeze({
    async id() { return (await getMe()).id; },
    async me() { const m = await getMe(); return { id: m.id, name: m.name, email: m.email, isOwner: m.isOwner, canEdit: m.canEdit, role: m.role }; },
    isOwner() { return !!(cachedMe && cachedMe.isOwner); },
    canEdit() { return !!(cachedMe && cachedMe.canEdit); },
    async can(what) { const m = await getMe(); return what === 'data.write' ? !!m.writes : m.canEdit; },
    async profiles(ids) { const m = await getMe(); const o = {}; for (const i of ids || []) o[i] = { name: i === m.id ? m.name : '' }; return o; },
    async search() { return []; },
  });
  let cachedMe = null; getMe().then(m => { cachedMe = m; }).catch(() => { });

  // ---- sample (AI) ----
  async function sample(input, opts) {
    opts = opts || {};
    let messages = typeof input === 'string' ? [{ role: 'user', content: input }] : input.map(m => ({ role: m.role, content: m.content }));
    const tools = (opts.tools || []).map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
    const exec = Object.fromEntries((opts.tools || []).map(t => [t.name, t.execute]));
    let text = '';
    for (let turn = 0; turn < 8; turn++) {
      if (opts.onText && turn === 0) opts.onText({ text: 'Thinking…', delta: '' });
      const r = await api('/ai', { method: 'POST', body: JSON.stringify({ messages, tools: tools.length ? tools : undefined, modelTier: opts.modelTier, system: opts.system }) });
      if (r.refused) { const e = new Error('The assistant declined this request.'); e.code = 'refused'; throw e; }
      text = r.text || '';
      const uses = (r.content || []).filter(b => b.type === 'tool_use');
      if (!uses.length || r.stop_reason !== 'tool_use') break;
      messages = messages.concat([{ role: 'assistant', content: r.content }]);
      const results = [];
      for (const u of uses) {
        let out; try { out = exec[u.name] ? await exec[u.name](u.input) : { error: 'unknown tool' }; } catch (e) { out = { error: e.message || String(e) }; }
        results.push({ type: 'tool_result', tool_use_id: u.id, content: typeof out === 'string' ? out : JSON.stringify(out).slice(0, 20000) });
      }
      messages = messages.concat([{ role: 'user', content: results }]);
    }
    if (opts.onText) opts.onText({ text, delta: text });
    return { text, truncated: false };
  }
  sample.json = async function (input, opts) { const r = await sample(input, opts); const m = r.text.match(/\{[\s\S]*\}|\[[\s\S]*\]/); return JSON.parse(m ? m[0] : r.text); };
  sample.limits = async () => ({ images: false });

  // ---- downloads ----
  const downloads = Object.freeze({
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.csv$/i.test(filename) ? 'text/csv' : /\.json$/i.test(filename) ? 'application/json' : 'text/html' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return { saved: true };
    },
  });

  // ---- mcp (Microsoft 365 emulation over Microsoft Graph via the API) ----
  const mcpErr = (code, message) => Object.assign(new Error(message || code), { code });
  const mcp = Object.freeze({
    async listTools(server) { let st = 'unknown'; try { st = (await api('/mail/status')).status; } catch (e) { st = 'unknown'; } const sv = { server: 'Microsoft 365', authStatus: st === 'ready' ? 'connected' : 'unknown', tools: [{ name: 'outlook_send_mail', description: '' }, { name: 'outlook_email_search', description: '' }] }; return { servers: !server || server === 'Microsoft 365' ? [sv] : [] }; },
    async callTool(server, tool, input) {
      if (server !== 'Microsoft 365') throw mcpErr('not_in_manifest', 'Unknown connector');
      let r; try { r = await api(tool === 'outlook_send_mail' ? '/mail/send' : tool === 'outlook_email_search' ? '/mail/search' : '/mail/unknown', { method: 'POST', body: JSON.stringify(input || {}) }); }
      catch (e) { if (e.code === 'mail_not_configured') throw mcpErr('server_not_connected', 'Mail is not configured on the server'); if (e.code === 'mail_forbidden') throw mcpErr('blocked_by_policy', e.message); if (e.status === 429) throw mcpErr('rate_limited', e.message); if (e.status >= 500) throw mcpErr('server_unavailable', e.message); throw mcpErr('tool_error', e.message); }
      const content = (r.messages || []).map(m => ({ type: 'text', text: JSON.stringify(m) })); if (r.moreResults) content.push({ type: 'text', text: JSON.stringify({ moreResults: true, nextOffset: r.nextOffset }) });
      return { content: tool === 'outlook_send_mail' ? [{ type: 'text', text: JSON.stringify({ ok: true }) }] : content, payload: tool === 'outlook_send_mail' ? { ok: true } : (r.messages || [])[0] };
    },
    async server(name) { if (name !== 'Microsoft 365') throw mcpErr('server_not_connected'); return Object.freeze({ outlook_send_mail: i => mcp.callTool(name, 'outlook_send_mail', i).then(x => x.payload), outlook_email_search: i => mcp.callTool(name, 'outlook_email_search', i).then(x => x.payload) }); },
  });

  const caps = { db, user, sample, downloads, mcp };
  window.claude = Object.freeze({ use: async (name) => { if (name === 'sample') { try { const m = await getMe(); if (m && m.ai === false) return null; } catch (e) { } } return caps[name] || null; } });
  window.SALESDESK_WEB = true;
})();
