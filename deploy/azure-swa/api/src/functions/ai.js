'use strict';
// AI proxy: the page's assistant, coach, scope writer and merge checker call this instead of the
// claude.ai `sample` capability. The API key lives in the Static Web App settings, never in the browser.
// Tools stay client-side: the browser sends tool definitions (no code), the model's tool_use blocks are
// returned to the page, the page executes them and posts the results back for the next turn.
const { app } = require('@azure/functions');
const Anthropic = require('@anthropic-ai/sdk');
const { parsePrincipal, domainAllowed } = require('../shared/auth');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const QUICK_MODEL = process.env.ANTHROPIC_QUICK_MODEL || 'claude-haiku-5-5';
let client = null;

async function aiHandler(req) {
  const principal = parsePrincipal(req);
  if (!principal) return { status: 401, jsonBody: { error: 'not_signed_in' } };
  if (!domainAllowed(principal.email)) return { status: 403, jsonBody: { error: 'domain_not_allowed' } };
  if (!process.env.ANTHROPIC_API_KEY) return { status: 503, jsonBody: { error: 'ai_not_configured' } };
  client = client || new Anthropic();
  let body; try { body = await req.json(); } catch (e) { return { status: 400, jsonBody: { error: 'bad_json' } }; }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-40) : [];
  if (!messages.length) return { status: 400, jsonBody: { error: 'messages_required' } };
  const tools = Array.isArray(body.tools) ? body.tools.map(t => ({ name: String(t.name).slice(0, 64), description: String(t.description || '').slice(0, 1000), input_schema: t.inputSchema || t.input_schema || { type: 'object', properties: {} } })) : undefined;
  const model = body.modelTier === 'quick' ? QUICK_MODEL : MODEL;
  try {
    const stream = client.messages.stream({
      model,
      max_tokens: body.maxTokens && body.maxTokens <= 16000 ? body.maxTokens : 4096,
      system: [{ type: 'text', text: `You are the assistant inside FSP SalesDesk, the sales system of Flow Service Partners (commercial HVAC, plumbing and mechanical). The signed-in user is ${principal.name || principal.email}. Answer briefly and concretely; never invent customers or numbers; when a tool can answer, call it.` + (body.system ? '\n\n' + String(body.system).slice(0, 6000) : '') }],
      messages,
      tools,
      output_config: { effort: body.modelTier === 'complex' ? 'high' : 'medium' },
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') return { status: 200, jsonBody: { text: '', content: [], stop_reason: 'refusal', refused: true } };
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return { status: 200, jsonBody: { text, content: msg.content.filter(b => b.type === 'text' || b.type === 'tool_use'), stop_reason: msg.stop_reason, model: msg.model, usage: msg.usage } };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { status: 429, jsonBody: { error: 'rate_limited', message: 'The assistant is busy; try again in a moment.' } };
    if (e instanceof Anthropic.AuthenticationError) return { status: 503, jsonBody: { error: 'ai_not_configured', message: 'AI key rejected.' } };
    if (e instanceof Anthropic.APIError) return { status: 502, jsonBody: { error: 'ai_error', message: e.message } };
    return { status: 500, jsonBody: { error: 'ai_error', message: e.message || String(e) } };
  }
}

if (process.env.SALESDESK_NO_REGISTER !== '1') {
  app.http('ai', { route: 'ai', methods: ['POST'], authLevel: 'anonymous', handler: aiHandler });
}
module.exports = { aiHandler };
