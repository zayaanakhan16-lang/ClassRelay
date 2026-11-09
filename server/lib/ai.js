/**
 * The modular AI service layer.
 *
 * One interface, two providers:
 *   - `openai`  : any /chat/completions endpoint (OpenAI, Featherless, OpenRouter, Groq, Ollama…)
 *   - `gemini`  : Google Generative Language API
 *
 * When no key is configured, `resolveProvider()` returns null and every task falls back
 * to the deterministic demo engine. The API key never leaves this process: the browser
 * only ever sends a task name and its data.
 */

export class AiError extends Error {
  constructor(message, status = 502, kind = 'error') {
    super(message);
    this.status = status;
    this.kind = kind; // 'auth' | 'rate-limit' | 'timeout' | 'context' | 'error'
  }
}

const TIMEOUT_MS = 60_000;

/** A key left as an example value counts as no key at all. */
function realKey(value) {
  const key = String(value || '').trim();
  return /paste|your[-_ ]?key|^x+$|<.*>/i.test(key) ? '' : key;
}

/**
 * Some hosts (OpenHands Cloud workspaces, managed gateways) hand out a short-lived key
 * instead of a static one. When that is the case, the workspace exposes a refresh URL and
 * a session key; the real API key is fetched on demand and never written to disk.
 */
function managedConfig(env) {
  const refreshUrl = String(env.OH_LLM_API_KEY_REFRESH_URL || '').trim();
  const sessionKey = String(env.SESSION_API_KEY || '').trim();
  if (!refreshUrl || !sessionKey) return null;
  const baseUrl =
    String(env.OH_LLM_API_KEY_REFRESH_BASE_URLS || '')
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)[0] || 'https://llm-proxy.app.all-hands.dev';
  return { refreshUrl, sessionKey, baseUrl };
}

export function resolveProvider(env = process.env) {
  const forced = String(env.AI_PROVIDER || '').trim().toLowerCase();
  const explicitStyle = String(env.AI_API_STYLE || '').trim().toLowerCase();
  const style = explicitStyle === 'completions' || explicitStyle === 'chat' ? explicitStyle : '';

  const groqKey = realKey(env.GROQ_API_KEY);
  const openaiKey = realKey(env.OPENAI_API_KEY);
  const geminiKey = realKey(env.GEMINI_API_KEY);
  const managed = managedConfig(env);
  const wants = (name) => forced === '' || forced === name;

  // How long the class may take to raise a hand before the demo engine steps in. Hosted
  // Groq endpoints usually answer well inside this; a slower self-hosted or reasoning model
  // can be given more room with CLASS_TURN_TIMEOUT_MS.
  const classTurnTimeoutMs = Math.max(2000, Number(env.CLASS_TURN_TIMEOUT_MS) || 12_000);

  // Groq is OpenAI-compatible: it has its own base URL and speaks chat completions.
  if (wants('groq') && (groqKey || forced === 'groq')) {
    if (!groqKey) return null;
    return {
      name: 'groq',
      kind: 'openai',
      style: style || 'chat',
      key: groqKey,
      managed: null,
      base: String(env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
      model: String(env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim(),
      classTurnTimeoutMs,
      env,
    };
  }

  if (wants('openai') && (openaiKey || forced === 'openai')) {
    if (!openaiKey) return null;
    return {
      name: 'openai',
      kind: 'openai',
      style: style || 'chat',
      key: openaiKey,
      managed: null,
      base: String(env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
      model: String(env.OPENAI_MODEL || 'gpt-4o-mini').trim(),
      classTurnTimeoutMs,
      env,
    };
  }

  if (wants('gemini') && (geminiKey || forced === 'gemini')) {
    if (!geminiKey) return null;
    return { name: 'gemini', kind: 'gemini', key: geminiKey, classTurnTimeoutMs, env };
  }

  // No explicit key: fall back to the workspace's managed gateway, which issues a
  // short-lived key on demand. That gateway only accepts the completions style.
  if (wants('openai') && managed) {
    return {
      name: 'openai',
      kind: 'openai',
      style: style || 'completions',
      key: '',
      managed,
      base: String(env.OPENAI_BASE_URL || managed.baseUrl).replace(/\/+$/, ''),
      model: String(env.OPENAI_MODEL || 'deepseek-v4.1-flash').trim(),
      // The workspace gateway runs a reasoning model; the classroom needs a fast first
      // reply, so reasoning is dialled down here (see OPENAI_REASONING_EFFORT to override).
      reasoningEffort: String(env.OPENAI_REASONING_EFFORT || 'minimal').trim(),
      classTurnTimeoutMs,
      env,
    };
  }

  return null;
}

/** Fetches and caches the short-lived key from a managed gateway. */
const managedKeys = new Map();

async function managedKey(managed, { force = false } = {}) {
  const cached = managedKeys.get(managed.refreshUrl);
  if (!force && cached && cached.expires > Date.now()) return cached.key;
  const res = await fetch(managed.refreshUrl, { headers: { 'X-Session-API-Key': managed.sessionKey } });
  const text = (await res.text()).trim();
  if (!res.ok || !/^sk-/.test(text)) {
    throw new AiError('The AI key could not be refreshed for this workspace.', 502, 'auth');
  }
  managedKeys.set(managed.refreshUrl, { key: text, expires: Date.now() + 5 * 60 * 1000 });
  return text;
}

async function authKey(provider, opts) {
  if (provider.key) return provider.key;
  if (provider.managed) return managedKey(provider.managed, opts);
  throw new AiError('No AI key is configured.', 502, 'auth');
}

/**
 * Sends one completion request. `messages` is a list of {role, content} pairs.
 * Returns the raw text of the model's reply.
 */
export async function complete(provider, opts) {
  const { signal, timeoutMs } = opts;
  const controller = new AbortController();
  // Per-task budgets let a slow gateway be abandoned in favour of the demo engine, so the
  // classroom always reacts promptly instead of hanging.
  const timer = setTimeout(() => controller.abort(), timeoutMs || TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await run(provider, { ...opts, signal: controller.signal });
  } catch (err) {
    if (err instanceof AiError) {
      // A managed key may have expired mid-session; refresh once and retry.
      if (err.kind === 'auth' && provider.managed && !opts.__retried) {
        managedKeys.delete(provider.managed.refreshUrl);
        return complete(provider, { ...opts, __retried: true });
      }
      throw err;
    }
    if (err?.name === 'AbortError') throw new AiError('The AI took too long to answer. Try again.', 504, 'timeout');
    throw new AiError(`The AI request failed: ${err?.message || 'unknown error'}`, 502, 'error');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function run(provider, { system, prompt, temperature = 0.7, maxTokens = 2000, json = true, signal, extra }) {
  // The managed gateway is a reasoning model: pass its effort knob unless the caller overrides.
  const tuned =
    provider.reasoningEffort && !extra?.reasoning_effort
      ? { ...extra, reasoning_effort: provider.reasoningEffort }
      : extra;
  return provider.kind === 'openai'
    ? callOpenAi(provider, { system, prompt, temperature, maxTokens, json, signal, extra: tuned })
    : callGemini(provider, { system, prompt, temperature, maxTokens, json, signal, extra: tuned });
}

async function callOpenAi(provider, { system, prompt, temperature, maxTokens, json, signal, extra }) {
  const key = await authKey(provider);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  if (provider.managed) headers['X-Session-API-Key'] = provider.managed.sessionKey;
  const base = String(provider.base || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = String(provider.model || 'gpt-4o-mini').trim();

  // Some managed gateways reject chat requests but allow text completions. In that style the
  // whole conversation is flattened into one prompt, which every text model understands.
  const completions = provider.style === 'completions';
  const url = `${base}/${completions ? 'completions' : 'chat/completions'}`;
  // Reasoning models spend part of the budget thinking before they write, so give them room.
  const budget = completions ? Math.max(maxTokens, 6000) : maxTokens;
  // `extra` carries provider-specific knobs (e.g. reasoning_effort) from the task layer.
  const body = completions
    ? {
        model,
        prompt: `${system}\n\n${prompt}\n\nAnswer:`,
        temperature,
        max_tokens: budget,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        ...extra,
      }
    : {
        model,
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        ...extra,
      };

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
  if (!res.ok) throw httpError(res.status, await safeText(res));
  const data = await res.json().catch(() => null);
  const choice = data?.choices?.[0];
  const content = completions ? choice?.text : choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new AiError('The AI returned an unreadable answer.', 502, 'error');
  }
  return content;
}

async function callGemini(provider, { system, prompt, temperature, maxTokens, json, signal }) {
  // Gemini has no reasoning_effort knob; the parameter is simply ignored here.
  const model = String(provider.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': provider.key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
    signal,
  });
  if (!res.ok) throw httpError(res.status, await safeText(res));
  const data = await res.json().catch(() => null);
  const parts = data?.candidates?.[0]?.content?.parts;
  const content = Array.isArray(parts) ? parts.map((p) => p?.text || '').join('') : '';
  if (!content) throw new AiError('The AI returned an empty answer.', 502, 'error');
  return content;
}

function httpError(status, body) {
  const snippet = String(body || '').slice(0, 300);
  if (status === 401 || status === 403) return new AiError('The AI key was rejected. Check your .env file.', 502, 'auth');
  if (status === 429) return new AiError('The AI is rate limited right now. Wait a moment and try again.', 429, 'rate-limit');
  if (status === 413 || /context|too long|maximum/i.test(snippet)) {
    return new AiError('The lesson was too long for the AI plan. Try again with fewer slides.', 502, 'context');
  }
  return new AiError(`The AI service returned an error (${status}).`, 502, 'error');
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * Models sometimes wrap JSON in a code fence or add a sentence before it. This pulls the
 * first balanced JSON object out of the reply and parses it, or throws a clean AiError.
 */
export function parseJson(text) {
  const raw = String(text || '').trim();
  const candidates = [raw];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) candidates.push(raw.slice(firstBrace, lastBrace + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try the next shape */
    }
  }
  throw new AiError('The AI answer was not valid JSON. Try again.', 502, 'error');
}
