import { getSyncConfig, post, ServerError, syncNow, type SyncConfig } from './sync';

/*
 * The assistant inbox: changes an AI assistant made through the sync server's calendar tools (MCP),
 * listed in the app so each one can be kept or undone. The server logs every such change with what
 * it replaced; this only reads that log and asks the server to undo. Needs a server from this
 * version on; older ones answer 404 and the inbox just stays empty.
 */

export interface InboxItem {
  kind: 'calendar' | 'event' | 'template' | 'setting';
  id: string;
  /** The record before the change (null: it was added). */
  before: any;
  /** The record after the change (null: it was deleted). */
  after: any;
}

export interface InboxChange {
  id: number;
  at: number;
  summary: string;
  items: InboxItem[];
  /** Set when the change was already undone (by the assistant or another phone). */
  undoneBy: number | null;
}

/** An undo the server refused because the records were edited again since. */
export class UndoConflict extends Error {}

let count = 0;
const listeners = new Set<() => void>();

const setCount = (n: number) => {
  if (n === count) return;
  count = n;
  listeners.forEach((l) => l());
};

export const getInboxCount = (): number => count;

export function subscribeInboxCount(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const tooOld = (e: unknown) => e instanceof ServerError && e.status === 404;

export async function loadInbox(config: SyncConfig): Promise<InboxChange[]> {
  try {
    const res = await post(config, '/api/inbox', { limit: 50 }, 20000);
    setCount(res.unreviewed ?? 0);
    return res.changes as InboxChange[];
  } catch (e) {
    if (!tooOld(e)) throw e;
    setCount(0);
    throw new Error('Your OpenCal server is too old for the inbox. Update it to see what the assistant changed.');
  }
}

/** Updates the badge count quietly (after a sync); errors only mean the count stays as it was. */
export async function refreshInboxCount(): Promise<void> {
  const config = getSyncConfig();
  if (!config) return setCount(0);
  try {
    const res = await post(config, '/api/inbox', { limit: 1 }, 15000);
    setCount(res.unreviewed ?? 0);
  } catch (e) {
    if (tooOld(e)) setCount(0);
  }
}

/** Keeps changes as they are; without ids, every change waiting in the inbox. */
export async function keepChanges(config: SyncConfig, ids?: number[]): Promise<void> {
  const res = await post(config, '/api/inbox/review', ids ? { ids } : {}, 20000);
  setCount(res.unreviewed ?? 0);
}

/** Undoes a change on the server, then syncs so this phone gets the result straight away. */
export async function undoChange(config: SyncConfig, changeId: number, force = false): Promise<void> {
  try {
    const res = await post(config, '/api/inbox/undo', { changeId, force }, 20000);
    setCount(res.unreviewed ?? 0);
  } catch (e) {
    if (e instanceof ServerError && e.status === 409 && e.body?.conflict) throw new UndoConflict(e.message);
    throw e;
  }
  await syncNow(config).catch(() => undefined);
}
