import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { ChangeSet, SyncKind } from '../../src/models/Sync.ts';

/*
 * The server's copy: every record as opaque JSON with the stamp it was last changed at, and a
 * sequence number for the order the server accepted changes in. Clients pull by sequence number
 * (their "cursor"), so nothing accepted after a client's last pull is missed whatever its stamp.
 * The same rule as the app decides what to keep: the newer stamp wins, ties keep what's here.
 */

const KINDS: readonly SyncKind[] = ['calendar', 'event', 'template'];
const LIST_OF: Record<SyncKind, 'calendars' | 'events' | 'templates'> = {
  calendar: 'calendars',
  event: 'events',
  template: 'templates',
};

type Row = Record<string, unknown>;

export class Store {
  private db: DatabaseSync;
  readonly serverId: string;

  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records (
        kind TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT,
        updatedAt INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        seq INTEGER NOT NULL,
        PRIMARY KEY (kind, id)
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        seq INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_records_seq ON records(seq);
      CREATE INDEX IF NOT EXISTS idx_settings_seq ON settings(seq);
    `);
    // Identifies this copy, so a client can tell when it's pointed at a new or reset server.
    let id = this.meta('serverId');
    if (!id) {
      id = randomUUID();
      this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('serverId', id);
    }
    this.serverId = id;
  }

  private meta(key: string): string | undefined {
    return (this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as Row | undefined)?.value as string | undefined;
  }

  get cursor(): number {
    const row = this.db.prepare(
      'SELECT MAX(m) AS m FROM (SELECT MAX(seq) AS m FROM records UNION ALL SELECT MAX(seq) FROM settings)',
    ).get() as Row;
    return (row.m as number | null) ?? 0;
  }

  /** Takes in a client's changes; returns how many were newer than what's here. */
  push(changes: ChangeSet): number {
    let seq = this.cursor;
    let accepted = 0;
    const getRecord = this.db.prepare('SELECT updatedAt FROM records WHERE kind = ? AND id = ?');
    const putRecord = this.db.prepare(
      `INSERT INTO records (kind, id, data, updatedAt, deleted, seq) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(kind, id) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt,
         deleted = excluded.deleted, seq = excluded.seq`,
    );
    const newer = (kind: SyncKind, id: string, at: number) => {
      const row = getRecord.get(kind, id) as Row | undefined;
      return !row || at > (row.updatedAt as number);
    };

    this.db.exec('BEGIN');
    try {
      for (const kind of KINDS) {
        for (const { record, updatedAt } of changes[LIST_OF[kind]]) {
          if (!newer(kind, record.id, updatedAt)) continue;
          putRecord.run(kind, record.id, JSON.stringify(record), updatedAt, 0, ++seq);
          accepted++;
        }
      }
      for (const { kind, id, deletedAt } of changes.deletions) {
        if (!newer(kind, id, deletedAt)) continue;
        putRecord.run(kind, id, null, deletedAt, 1, ++seq);
        accepted++;
      }
      const getSetting = this.db.prepare('SELECT updatedAt FROM settings WHERE key = ?');
      const putSetting = this.db.prepare(
        `INSERT INTO settings (key, value, updatedAt, seq) VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt, seq = excluded.seq`,
      );
      for (const { key, value, updatedAt } of changes.settings) {
        const row = getSetting.get(key) as Row | undefined;
        if (row && updatedAt <= (row.updatedAt as number)) continue;
        putSetting.run(key, JSON.stringify(value), updatedAt, ++seq);
        accepted++;
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    return accepted;
  }

  /** Everything accepted after `cursor`. */
  pull(cursor: number): ChangeSet {
    const out: ChangeSet = { calendars: [], events: [], templates: [], settings: [], deletions: [] };
    for (const r of this.db.prepare('SELECT * FROM records WHERE seq > ? ORDER BY seq').all(cursor) as Row[]) {
      const kind = r.kind as SyncKind;
      const updatedAt = r.updatedAt as number;
      if (r.deleted) out.deletions.push({ kind, id: r.id as string, deletedAt: updatedAt });
      else (out[LIST_OF[kind]] as { record: unknown; updatedAt: number }[]).push({ record: JSON.parse(r.data as string), updatedAt });
    }
    for (const r of this.db.prepare('SELECT * FROM settings WHERE seq > ? ORDER BY seq').all(cursor) as Row[]) {
      out.settings.push({ key: r.key as string, value: JSON.parse(r.value as string), updatedAt: r.updatedAt as number });
    }
    return out;
  }

  counts(): Record<string, number> {
    const rows = this.db.prepare('SELECT kind, COUNT(*) AS n FROM records WHERE deleted = 0 GROUP BY kind').all() as Row[];
    return Object.fromEntries(rows.map((r) => [r.kind as string, r.n as number]));
  }
}

/** Throws unless `body` has the shape of a ChangeSet; the records themselves are kept as sent. */
export function checkChangeSet(body: unknown): ChangeSet {
  const fail = (what: string): never => {
    throw new Error(`Invalid changes: ${what}`);
  };
  if (!body || typeof body !== 'object') fail('not an object');
  const c = body as Record<string, unknown>;
  const isStamp = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  for (const list of ['calendars', 'events', 'templates'] as const) {
    if (!Array.isArray(c[list])) fail(`${list} missing`);
    for (const item of c[list] as Row[]) {
      const record = item?.record as Row | undefined;
      if (!record || typeof record.id !== 'string' || !record.id || !isStamp(item.updatedAt)) fail(`bad item in ${list}`);
    }
  }
  if (!Array.isArray(c.settings)) fail('settings missing');
  for (const s of c.settings as Row[]) {
    if (typeof s?.key !== 'string' || !isStamp(s.updatedAt) || s.value === undefined) fail('bad setting');
  }
  if (!Array.isArray(c.deletions)) fail('deletions missing');
  for (const d of c.deletions as Row[]) {
    if (!KINDS.includes(d?.kind as SyncKind) || typeof d.id !== 'string' || !isStamp(d.deletedAt)) fail('bad deletion');
  }
  return c as unknown as ChangeSet;
}
