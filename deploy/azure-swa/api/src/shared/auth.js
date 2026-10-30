// Identity from Azure Static Web Apps (Entra ID). SWA validates the sign-in and forwards the
// principal to the API in the x-ms-client-principal header (base64 JSON). Nothing here trusts the
// browser: the header is set by the SWA edge after a successful Microsoft login.
'use strict';

const OWNER_EMAILS = (process.env.OWNER_EMAILS || '').toLowerCase().split(/[,;\s]+/).filter(Boolean);
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || '').toLowerCase().split(/[,;\s]+/).filter(Boolean);

function parsePrincipal(req) {
  const raw = req.headers.get ? req.headers.get('x-ms-client-principal') : req.headers['x-ms-client-principal'];
  if (!raw) return null;
  try {
    const p = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    const claims = Object.fromEntries((p.claims || []).map(c => [c.typ, c.val]));
    const email = (claims['preferred_username'] || claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || claims['emails'] || p.userDetails || '').toLowerCase();
    const name = claims['name'] || [claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'], claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname']].filter(Boolean).join(' ') || p.userDetails || '';
    return { id: p.userId, provider: p.identityProvider, email, name, tenant: claims['tid'] || claims['http://schemas.microsoft.com/identity/claims/tenantid'] || null, roles: p.userRoles || [] };
  } catch (e) { return null; }
}

function domainAllowed(email) {
  if (!ALLOWED_DOMAINS.length) return true;
  const d = (email.split('@')[1] || '').toLowerCase();
  return ALLOWED_DOMAINS.includes(d);
}

// Role resolution mirrors the page's computeRole: owner emails from config, then settings/main.roles
// (by email or display name), then the users roster (email, then display name / aliases), else viewer.
function resolveRole(principal, settings, users) {
  if (!principal) return { role: 'viewer', user: null };
  const email = principal.email, name = (principal.name || '').toLowerCase().trim();
  if (OWNER_EMAILS.includes(email)) return { role: 'owner', user: matchUser(users, principal) };
  const roles = (settings && settings.roles) || {};
  for (const [k, r] of Object.entries(roles)) {
    const kk = String(k).toLowerCase().trim();
    if (kk === email || kk === name) return { role: r, user: matchUser(users, principal) };
  }
  const u = matchUser(users, principal);
  if (u) return { role: u.role || 'sales', user: u };
  return { role: 'viewer', user: null };
}

function matchUser(users, principal) {
  const email = principal.email, name = (principal.name || '').toLowerCase().trim();
  return users.find(u => u.uid && u.uid === principal.id)
    || users.find(u => email && (u.email || '').toLowerCase() === email)
    || users.find(u => name && ((u.name || '').toLowerCase().trim() === name || (u.displayNames || []).some(n => String(n).toLowerCase().trim() === name)))
    || null;
}

const MGMT = ['owner', 'admin', 'platform', 'brandmgr'];
const ADMIN = ['owner', 'admin', 'platform'];
const ADMIN_COLLS = ['settings', 'brands', 'product', 'users'];

// Write rules mirror the artifact db rules: admin-only collections, viewers never write,
// sales may write everything else (the page enforces per-deal ownership; the API enforces role).
function canWrite(role, coll, id, user) {
  if (!role || role === 'viewer') return false;
  if (ADMIN_COLLS.includes(coll)) {
    if (ADMIN.includes(role)) return true;
    if (coll === 'product' && MGMT.includes(role)) return true;
    // a rep may update their own roster record (uid link, onboardedAt, display names), nothing else
    if (coll === 'users' && user && id && user.id === id) return true;
    return false;
  }
  return true;
}

module.exports = { parsePrincipal, domainAllowed, resolveRole, canWrite, MGMT, ADMIN, ADMIN_COLLS };
