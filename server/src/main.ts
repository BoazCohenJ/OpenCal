import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { CalendarAgent } from './agent.ts';
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
  throw new HttpError(404, 'Not found');
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
