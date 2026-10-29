import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url)).slice(0, -1);
const require = createRequire(`${root}/package.json`);
const ts = require('typescript');
const { addDays, startOfDay, endOfDay, addMinutes } = require('date-fns');
const mod = (p) => import(pathToFileURL(`${root}/${p}`).href);
const { expandEvent } = await mod('src/services/occurrences.ts');
const { atMinutes, parseTimestamp } = await mod('src/utils/dates.ts');
const { parseICS, toICS } = await mod('src/services/ical.ts');
const { Store } = await mod('server/src/store.ts');
const { CalendarAgent } = await mod('server/src/agent.ts');
const calendar = { id: 'c', name: 'Personal', color: '#123456', sortOrder: 0, pauseWindows: [] };
const event = (patch = {}) => ({ id: 'e', title: 'Event', startDate: '2026-03-01T00:00:00.000', endDate: '2026-03-01T23:59:59.999', isAllDay: true, floating: true, calendarId: 'c', recurrenceRule: 'FREQ=DAILY;COUNT=40', pauseWindows: [], skippedDates: [], reminders: [], tags: [], ...patch });
const findings = [];
function found(name, evidence) { findings.push({ name, evidence }); console.log(`PASS regression ${findings.length}: ${JSON.stringify(evidence)}`); }

process.env.TZ = 'Europe/Berlin';
const dst = expandEvent(event(), calendar, new Date(2026, 2, 29), new Date(2026, 2, 30));
const transition = dst.find((o) => o.start.getDate() === 29);
assert.equal(transition.end.getDate(), 29);
found('Recurring all-day event spills into next date at DST', { start: transition.start.toString(), end: transition.end.toString() });

const tapped = atMinutes(new Date(2026, 2, 29), 9 * 60);
assert.equal(tapped.getHours(), 9);
found('Time-grid 09:00 tap becomes 10:00 on DST day', tapped.toString());

const store = new Store(':memory:');
const agent = new CalendarAgent(store);
store.write([{ kind: 'calendar', id: calendar.id, record: calendar }], 'test', 'seed');
const created = agent.createEvent({ title: 'Five sessions', start: '2026-11-01T09:00', calendar: 'c', repeat: 'FREQ=DAILY;COUNT=5' });
agent.updateEvent({ eventId: created.created.eventId, occurrenceDate: '2026-11-03', scope: 'following', title: 'Renamed sessions' });
const count = agent.findEvents({ from: '2026-11-01', to: '2026-11-15', limit: 100 });
assert.equal(count.total, 5);
found('Updating following removes COUNT', { expectedTotal: 5, actualTotal: count.total });

const utc = parseICS('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:utc-series\r\nSUMMARY:UTC series\r\nDTSTART:20260301T090000Z\r\nDTEND:20260301T100000Z\r\nRRULE:FREQ=DAILY;COUNT=40\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n', 540).events[0];
const utcExpanded = expandEvent(utc, calendar, new Date('2026-03-30T00:00:00Z'), new Date('2026-03-31T00:00:00Z'));
assert.equal(utcExpanded[0].start.toISOString(), '2026-03-30T09:00:00.000Z');
found('UTC ICS series changes its UTC hour after DST', { importedTimeZone: utc.timeZone, expected: '2026-03-30T09:00:00.000Z', actual: utcExpanded[0].start.toISOString() });

const rdate = parseICS('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:rdate-series\r\nSUMMARY:Extra date\r\nDTSTART:20261101T090000\r\nDTEND:20261101T100000\r\nRDATE:20261103T090000,20261105T090000\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n', 540);
const rdateCount = rdate.events.flatMap((e) => expandEvent(e, calendar, new Date(2026,10,1), new Date(2026,10,10))).length;
assert.equal(rdateCount, 3);
found('ICS RDATE additional occurrences are dropped', { expected: 3, actual: rdateCount, skipped: rdate.skipped });

function loadCommonJs(relative, dependencies = {}, globals = {}) {
  const source = ts.transpileModule(readFileSync(`${root}/${relative}`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (name) => name in dependencies ? dependencies[name] : name === './syncEqual' ? loadCommonJs('src/services/syncEqual.ts') : require(name), console, Date, URL, Buffer, setTimeout, clearTimeout, AbortController, ...globals }, { filename: relative });
  return exports;
}
const storage = new Map();
const db = loadCommonJs('src/services/database.web.ts', {}, { window: { localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } } });
db.saveCalendar(calendar);
const bulkSource = readFileSync(`${root}/src/screens/CalendarScreen.tsx`, 'utf8').replace(/\r\n/g, '\n');
const start = bulkSource.indexOf('(plain: Event[], repeating: RepeatItem[], choices: RepeatDeleteChoice[]) => {');
const stop = bulkSource.indexOf('\n    },\n    [deleteEvents, saveEvents, showToast]', start);
assert(start > 0 && stop > start);
const fnTs = `const apply = ${bulkSource.slice(start, stop + 6).replace(/,$/, '')};`;
const fnJs = ts.transpileModule(fnTs, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const recurring = event({ isAllDay: false, floating: false, startDate: '2026-11-01T09:00:00Z', endDate: '2026-11-01T10:00:00Z', recurrenceRule: 'FREQ=DAILY;COUNT=5' });
db.saveEvent(recurring);
const { occurrenceDayKey } = await mod('src/services/eventTimes.ts');
const { parseDayKey, dayKey } = await mod('src/utils/dates.ts');
const { endRuleBefore } = await mod('src/utils/recurrence.ts');
vm.runInNewContext(`${fnJs}\napply([], [{event, day: new Date(2026,10,2)}, {event, day: new Date(2026,10,3)}], ['this','this']);`, { event: recurring, Date, Map, Set, occurrenceDayKey, parseTimestamp, parseDayKey, dayKey, endRuleBefore, saveEvents: db.saveEvents, deleteEvents: db.deleteEvents, showToast: () => {} });
const after = db.loadEvents().filter((e) => e.id === 'e');
const bulkCount = after.flatMap((e) => expandEvent(e, calendar, new Date(2026,10,1), new Date(2026,10,7))).length;
assert.equal(bulkCount, 3);
found('Web bulk deletion duplicates series instead of merging skips', { skippedDates: after.map((e) => e.skippedDates), expectedOccurrences: 3, actualOccurrences: bulkCount });

const { DatabaseSync } = require('node:sqlite');
const sqlite = new DatabaseSync(':memory:');
const nativeDb = loadCommonJs('src/services/database.ts', {'expo-sqlite': {openDatabaseSync: () => ({
  execSync: (sql) => sqlite.exec(sql),
  runSync: (sql, params=[]) => sqlite.prepare(sql).run(...params),
  getFirstSync: (sql, params=[]) => sqlite.prepare(sql).get(...params),
  getAllSync: (sql, params=[]) => sqlite.prepare(sql).all(...params),
  withTransactionSync: (fn) => { sqlite.exec('BEGIN'); try { fn(); sqlite.exec('COMMIT'); } catch (e) { sqlite.exec('ROLLBACK'); throw e; } },
})}});
nativeDb.initDatabase(); nativeDb.saveCalendar(calendar); nativeDb.saveEvent(recurring);
vm.runInNewContext(`${fnJs}\napply([], [{event, day: new Date(2026,10,2)}, {event, day: new Date(2026,10,3)}], ['this','this']);`, { event: recurring, Date, Map, Set, occurrenceDayKey, parseTimestamp, parseDayKey, dayKey, endRuleBefore, saveEvents: nativeDb.saveEvents, deleteEvents: nativeDb.deleteEvents, showToast: () => {} });
assert.deepEqual([...nativeDb.loadEvents()[0].skippedDates], ['2026-11-02', '2026-11-03']);
found('Native bulk delete loses first skipped date', nativeDb.loadEvents()[0].skippedDates);

const permissionStub = { remindersSupported: false };
const notifications = loadCommonJs('src/services/notifications.ts', { '../../modules/opencal-notifications': permissionStub, '../utils/dates': await mod('src/utils/dates.ts'), '../utils/format': await mod('src/utils/format.ts'), './focus': await mod('src/services/focus.ts'), './occurrences': await mod('src/services/occurrences.ts') });
const prefs = { enabled: true, mutedCalendarIds: [], horizonDays: 30, focusWindows: [], allDayTime: 540, sound: true };
const dayEvent = event({ recurrenceRule: undefined, startDate: '2026-03-29T00:00:00.000', endDate: '2026-03-29T23:59:59.999', reminders: [0] });
const reminder = notifications.planReminders([dayEvent], {c:calendar}, prefs, new Date(2026,2,28,12));
assert.equal(reminder[0].date.getHours(), 9);
found('All-day reminder configured 09:00 fires 10:00 on DST day', reminder[0].date.toString());

// Exercise main.ts's actual request handler with in-memory storage and a response recorder.
let handler;
class MemoryStore extends Store { constructor() { super(':memory:'); } }
loadCommonJs('server/src/main.ts', {
  'node:fs': { mkdirSync: () => {} },
  'node:http': { createServer: (fn) => { handler = fn; return { listen: () => {}, close: () => {}, closeAllConnections: () => {} }; } },
  './agent.ts': { CalendarAgent },
  './mcp.ts': await mod('server/src/mcp.ts'),
  './store.ts': { ...await mod('server/src/store.ts'), Store: MemoryStore },
}, { process: { env: { OPENCAL_API_KEY: 'test-key-only-for-local-review' }, on: () => {}, exit: () => { throw Error('unexpected exit'); } } });
const preflight = await new Promise((resolve) => {
  const res = { status: null, headers: {}, setHeader(k,v) { this.headers[k]=v; }, writeHead(status, headers) { this.status = status; Object.assign(this.headers,headers); return this; }, end(body) { resolve({ status: this.status, headers: this.headers, body }); } };
  handler({ method: 'OPTIONS', url: '/api/sync', headers: { origin: 'http://localhost:8081', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } }, res);
});
assert.equal(preflight.status, 204);
assert.equal(preflight.headers['Access-Control-Allow-Origin'], 'http://localhost:8081');
assert.match(preflight.headers['Access-Control-Allow-Headers'], /Authorization/);
found('Web sync preflight is rejected and lacks CORS headers', preflight);

const withDefaults = { ...calendar, id: 'defaults', name: 'Defaults', defaults: { recurrenceRule: 'FREQ=DAILY;COUNT=3', reminders: [5] } };
store.write([{ kind: 'calendar', id: withDefaults.id, record: withDefaults }], 'test', 'calendar defaults');
const defaultEvent = agent.createEvent({ title: 'Use defaults', start: '2026-11-01T09:00', calendar: 'defaults' }).created;
assert.equal(defaultEvent.repeat, 'FREQ=DAILY;COUNT=3');
found('Agent-created events omit calendar default repeat', { expectedRepeat: withDefaults.defaults.recurrenceRule, actualRepeat: defaultEvent.repeat ?? null, inheritedReminders: defaultEvent.reminders });

// A shared timestamp must have one deterministic winner, but server/client currently keep opposite versions.
const tieStore = new Store(':memory:');
const tieEvent = { ...recurring, id: 'tie', title: 'Server version' };
const empty = () => ({ calendars: [], events: [], templates: [], settings: [], deletions: [] });
tieStore.push({ ...empty(), calendars: [{record:calendar,updatedAt:100}], events: [{record:tieEvent,updatedAt:200}] });
db.applyChanges({ ...empty(), events: [{record:{...tieEvent,title:'Client version'},updatedAt:200}] });
tieStore.push(db.getChangesSince(-1));
db.applyChanges(tieStore.pull(0));
const clientTie = db.loadEvents().find((e)=>e.id==='tie');
assert.equal(clientTie.title, 'Server version');
assert.equal(tieStore.get('event','tie').title, 'Server version');
found('Equal-stamped conflicting edits never converge', {client:clientTie.title,server:tieStore.get('event','tie').title});

const connectStorage = new Map();
const connectDb = loadCommonJs('src/services/database.web.ts', {}, { window: { localStorage: { getItem: (k) => connectStorage.get(k) ?? null, setItem: (k,v) => connectStorage.set(k,v) } } });
connectDb.saveCalendar({...calendar,id:'custom-empty',name:'My custom empty calendar'});
const remote = new Store(':memory:');
remote.write([{kind:'calendar',id:'server-calendar',record:{...calendar,id:'server-calendar',name:'Remote'}}], 'test','seed remote');
const sync = loadCommonJs('src/services/sync.ts', {'./database':connectDb}, {fetch: async (url, options) => {
  if(url.endsWith('/api/health')) return {json:async()=>({app:'opencal',serverId:remote.serverId})};
  const body=JSON.parse(options.body);
  remote.push(body.changes);
  const cursor=body.serverId===remote.serverId?body.cursor:0;
  return {ok:true,status:200,json:async()=>({serverId:remote.serverId,cursor:remote.cursor,changes:remote.pull(cursor)})};
}});
await sync.connect({url:'https://review.example',apiKey:'fixture-only'});
assert(connectDb.loadCalendars().some((c)=>c.id==='custom-empty'));
found('Connecting event-free device deletes custom empty calendars', {remaining:connectDb.loadCalendars().map((c)=>c.name), tombstones:connectDb.getChangesSince(-1).deletions});

const rejected = parseICS('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:secondly\r\nDTSTART:20260101T090000\r\nRRULE:FREQ=SECONDLY\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',540);
assert.equal(rejected.events.length,0); assert.equal(rejected.skipped,1);
// Replaying the server winner must not trigger another reload on either platform.
assert.equal(db.applyChanges(tieStore.pull(0)), 0);
nativeDb.applyChanges(tieStore.pull(0));
assert.equal(nativeDb.loadEvents(['tie'])[0].title, 'Server version');
assert.equal(nativeDb.applyChanges(tieStore.pull(0)), 0);
// A counted series splits correctly west of UTC too, including excluded positions.
process.env.TZ = 'America/New_York';
const west = agent.createEvent({ title:'West', start:'2026-11-01T09:00', calendar:'c', repeat:'FREQ=DAILY;COUNT=5' }).created;
agent.updateEvent({eventId:west.eventId,occurrenceDate:'2026-11-03',scope:'following',title:'West changed'});
assert.equal(agent.findEvents({from:'2026-11-01',to:'2026-11-15',query:'West'}).total,5);
const foldedGrid = atMinutes(new Date(2026,10,1),540);
assert.equal(foldedGrid.getHours(),9);
const combined = parseICS('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:combined\r\nDTSTART:20261101T090000\r\nRRULE:FREQ=DAILY;COUNT=3\r\nRDATE:20261102T090000,20261105T090000\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',540);
assert.equal(combined.events.length,2);
// Prompt dismissal is explicit; a repeated tap must not answer the next queued prompt.
const prompts = await mod('src/utils/confirm.ts');
const confirmOne = prompts.confirmAsync('Delete?', 'Fixture', 'Delete', true);
const firstPrompt = prompts.getPrompt();
prompts.notify('Notice', 'Second queued prompt');
prompts.answerPrompt(firstPrompt.id, false);
assert.equal(await confirmOne, false);
const notice = prompts.getPrompt();
prompts.answerPrompt(firstPrompt.id, true);
assert.equal(prompts.getPrompt().id, notice.id);
prompts.answerPrompt(notice.id, true);
assert.equal(prompts.getPrompt(), null);

// Execute the editor's actual deletion handler for each scope and repeated presses.
const editorSource = readFileSync(`${root}/src/screens/EventEditScreen.tsx`, 'utf8').replace(/\r\n/g, '\n');
const deletionStart = editorSource.indexOf('  const removeRepeat =');
const deletionEnd = editorSource.indexOf('  const saveAsStamp', deletionStart);
const deletionJs = ts.transpileModule(editorSource.slice(deletionStart, deletionEnd), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
for (const choice of ['this','following','all']) {
  let savedEvent; let deletedId; let closes=0;
  vm.runInNewContext(`${deletionJs}\nremoveRepeat(choice); removeRepeat(choice);`, {
    choice, existing:recurring, selectedStart:parseTimestamp('2026-11-03T09:00:00Z'), removed:{current:false},
    setDeletingRepeat:()=>{}, occurrenceDayKey, parseTimestamp, parseDayKey, endRuleBefore,
    saveEvent:(e)=>{savedEvent=e;}, deleteEvent:(id)=>{deletedId=id;}, navigation:{goBack:()=>{closes++;}},
  });
  assert.equal(closes,1);
  if(choice==='this') assert.deepEqual([...savedEvent.skippedDates],['2026-11-03']);
  if(choice==='following') assert.match(savedEvent.recurrenceRule,/UNTIL=20261102T235959Z/);
  if(choice==='all') assert.equal(deletedId,recurring.id);
}
console.log('All regression assertions passed, including themed prompt queue and editor deletion scopes');
