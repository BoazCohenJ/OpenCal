import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { AgentError, CalendarAgent } from './agent.ts';
import { handleMcp } from './mcp.ts';
import { checkChangeSet, Store } from './store.ts';

/*
 * OpenCal sync server. The app keeps working on its own copy and, when a server is set up,
 * exchanges changes with it; every device that syncs with the same server ends up with the same
 * calendars, events, stamps and shared settings.
 *
 *   GET  /api/health   no auth; is the server up, and which copy is it
 *   POST /api/sync     { serverId?, cursor, changes } → { serverId, cursor, changes, accepted }
 *   POST /mcp          calendar tools for an AI agent (Model Context Protocol, see mcp.ts)
 *   POST /api/inbox          { limit? } → the agent's changes the app hasn't reviewed yet
 *   POST /api/inbox/review   { ids? } → marks changes as kept (all of them without ids)
 *   POST /api/inbox/undo     { changeId, force? } → undoes one of them
 *   POST /api/fetch-ics      { url } → a subscribed calendar's file, for the web app (browsers
 *                            can't fetch most calendar URLs themselves because of CORS)
 *
 * /api/sync needs `Authorization: Bearer <OPENCAL_API_KEY>`. /mcp takes that key or
 * OPENCAL_AGENT_KEY, so an agent can have its own key that's revoked without touching the phones.
 * Times the agent tools read and write are in the TZ time zone (e.g. TZ=Asia/Jerusalem).
 */

const VERSION = '2';
const PORT = Number(process.env.PORT ?? 2290);
const DATA_DIR = process.env.DATA_DIR ?? './data';
const API_KEY = process.env.OPENCAL_API_KEY ?? '';
const AGENT_KEY = process.env.OPENCAL_AGENT_KEY ?? '';
const MAX_BODY = 50 * 1024 * 1024;
const MAX_ICS = 20 * 1024 * 1024;

if (API_KEY.length < 16) {
  console.error('Set OPENCAL_API_KEY to a random secret of at least 16 characters (e.g. `openssl rand -hex 24`).');
  process.exit(1);
}

if (AGENT_KEY && AGENT_KEY.length < 16) {
  console.error('OPENCAL_AGENT_KEY, when set, must be at least 16 characters.');
  process.exit(1);
}

mkdirSync(DATA_DIR, { recursive: true });
const store = new Store(join(DATA_DIR, 'opencal.db'));
const agent = new CalendarAgent(store);

const digest = (s: string) => createHash('sha256').update(s).digest();
const keyDigests = { sync: [digest(API_KEY)], agent: [digest(API_KEY), ...(AGENT_KEY ? [digest(AGENT_KEY)] : [])] };
const authorized = (req: IncomingMessage, scope: keyof typeof keyDigests): boolean => {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  if (!m) return false;
  const given = digest(m[1]!);
  return keyDigests[scope].some((k) => timingSafeEqual(given, k));
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'Request too large');
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Body is not JSON');
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  const origin = req.headers.origin;
  // Bearer auth still protects data; no cookies or browser credentials are accepted.
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  }
  if (req.method === 'OPTIONS' && path.startsWith('/api/')) { res.writeHead(204).end(); return; }

  if (req.method === 'GET' && path === '/api/health') {
    return send(res, 200, { ok: true, app: 'opencal', version: VERSION, serverId: store.serverId });
  }
  if (path === '/mcp') {
    if (!authorized(req, 'agent')) throw new HttpError(401, 'Wrong or missing API key');
    // JSON responses only: no server-initiated stream to open.
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST');
    const reply = handleMcp(agent, await readJson(req), VERSION);
    if (reply === null) {
      res.writeHead(202).end();
      return;
    }
    return send(res, 200, reply);
  }
  if (!path.startsWith('/api/')) throw new HttpError(404, 'Not found');
  if (!authorized(req, 'sync')) throw new HttpError(401, 'Wrong or missing API key');

  if (req.method === 'POST' && path === '/api/sync') {
    const body = (await readJson(req)) as Record<string, unknown> | null;
    const changes = checkChangeSet(body?.changes);
    // A client that last synced with another (or a reset) server starts over from the beginning.
    const cursor = body?.serverId === store.serverId && typeof body.cursor === 'number' ? body.cursor : 0;
    const accepted = store.push(changes);
    // The pull includes what this client just sent; it ignores those as already up to date.
    return send(res, 200, { serverId: store.serverId, cursor: store.cursor, changes: store.pull(cursor), accepted });
  }
  if (req.method === 'POST' && path === '/api/inbox') {
    const body = (await readJson(req)) as Record<string, unknown> | null;
    const limit = typeof body?.limit === 'number' ? Math.min(Math.max(Math.floor(body.limit), 1), 100) : 50;
    const changes = store.unreviewedChanges(limit).map(({ id, at, summary, items, undoneBy }) => ({ id, at, summary, items, undoneBy }));
    return send(res, 200, { changes, unreviewed: store.unreviewedCount() });
  }
  if (req.method === 'POST' && path === '/api/inbox/review') {
    const body = (await readJson(req)) as Record<string, unknown> | null;
    const ids = Array.isArray(body?.ids) ? body.ids.filter((n): n is number => Number.isInteger(n)) : undefined;
    const marked = store.markReviewed(ids);
    return send(res, 200, { marked, unreviewed: store.unreviewedCount() });
  }
  if (req.method === 'POST' && path === '/api/inbox/undo') {
    const body = (await readJson(req)) as Record<string, unknown> | null;
    const changeId = Number(body?.changeId);
    if (!Number.isInteger(changeId)) throw new HttpError(400, 'changeId is required');
    try {
      const result = agent.undo(changeId, body?.force === true, 'app');
      return send(res, 200, { ...result, unreviewed: store.unreviewedCount() });
    } catch (e) {
      if (!(e instanceof AgentError)) throw e;
      // Edited again since (on a phone or by a later change): the app asks before forcing it.
      return send(res, 409, { error: e.message, conflict: e.message.startsWith('Changed again') });
    }
  }
  if (req.method === 'POST' && path === '/api/fetch-ics') {
    const body = (await readJson(req)) as Record<string, unknown> | null;
    return send(res, 200, { text: await fetchIcs(String(body?.url ?? '')) });
  }
  throw new HttpError(404, 'Not found');
}

/** Downloads a calendar file for a subscribed calendar (http, https or webcal URLs only). */
async function fetchIcs(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/^webcals?:\/\//i, 'https://'));
  } catch {
    throw new HttpError(400, 'Not a valid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new HttpError(400, 'Only http and https URLs');
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { Accept: 'text/calendar, */*' } });
  } catch {
    throw new HttpError(502, 'Couldn’t download the calendar');
  }
  if (!res.ok) throw new HttpError(502, `The calendar's server answered ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_ICS) throw new HttpError(413, 'The calendar file is too large');
  return text;
}

const server = createServer((req, res) => {
  handle(req, res).catch((e: unknown) => {
    const status = e instanceof HttpError ? e.status : e instanceof Error && e.message.startsWith('Invalid') ? 400 : 500;
    if (status === 500) console.error(e);
    send(res, status, { error: e instanceof Error ? e.message : String(e) });
  });
});

server.listen(PORT, () => {
  console.log(`OpenCal server ${VERSION} (${store.serverId}) on port ${PORT}, data in ${DATA_DIR}, time zone ${agent.timeZone}`, store.counts());
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    server.closeAllConnections();
  });
}
