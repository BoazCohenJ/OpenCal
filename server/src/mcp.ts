import { AgentError, type CalendarAgent } from './agent.ts';

/*
 * A Model Context Protocol endpoint (Streamable HTTP, JSON responses only) exposing the calendar
 * tools in agent.ts. Small enough to implement directly: initialize, ping, tools/list, tools/call.
 */

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = `OpenCal calendar tools. Changes show up on the user's phone on its next sync (within seconds of opening the app).
- Call list_calendars first: it gives the calendar names, today's date and the time zone.
- Times without an offset are read in that time zone. Use 2026-10-12T14:00 for timed events, 2026-10-12 for all-day ones, or just 14:00 to keep an event's date.
- Repeating events: find_events gives each occurrence an occurrenceDate. To change or delete one day only, pass occurrenceDate with scope "this"; "following" for that day and after; "all" for the whole series.
- Calendars: create_calendar, update_calendar (rename, recolor, defaults), delete_calendar (say what happens to its events).
- Unknown or misspelled fields are rejected with the list of allowed ones; fix the call and retry.
- Every change returns a changeId; undo puts it back. Check recent_changes if unsure what was done.`;

const str = (description: string) => ({ type: 'string', description });
const TIME =
  'Local time like 2026-10-12T14:00 (or with an offset), a date like 2026-10-12 for all-day events, or just 14:00 to keep the date.';

const FIELDS = {
  title: str('Event title.'),
  start: str(`Start. ${TIME}`),
  end: str(`End. ${TIME} For all-day events, the last day (inclusive). Defaults to 1 hour after the start (or the same day).`),
  durationMinutes: { type: 'integer', minimum: 1, description: 'Length in minutes, instead of end.' },
  allDay: { type: 'boolean', description: 'All-day event. Defaults to true when start is a date only.' },
  calendar: str('Calendar name (from list_calendars).'),
  location: { type: ['string', 'null'], description: 'Location; null or "" clears it.' },
  description: { type: ['string', 'null'], description: 'Notes; null or "" clears it.' },
  repeat: {
    type: ['string', 'null'],
    description: 'Repeat rule as an RRULE body, e.g. FREQ=WEEKLY;BYDAY=MO,WE or FREQ=DAILY;COUNT=5 or FREQ=WEEKLY;UNTIL=20270701T235959Z. "none" stops repeating.',
  },
  reminders: { type: 'array', items: { type: 'integer', minimum: 0 }, description: 'Minutes before the start, e.g. [10, 60]. [] for none.' },
  color: {
    type: ['string', 'null'],
    description: 'Event color: a palette name from list_calendars (e.g. Cherry, Teal) or a hex like #EF4444. null uses the calendar color.',
  },
  tags: { type: 'array', items: { type: 'string' } },
};

const CALENDAR_FIELDS = {
  color: str('Calendar color: a palette name from list_calendars or a hex like #EF4444.'),
  defaults: {
    type: ['object', 'null'],
    description: 'What new events in this calendar start with. Omitted fields stay as they are; null clears all defaults.',
    properties: {
      reminders: { type: 'array', items: { type: 'integer', minimum: 0 }, description: 'Minutes before the start.' },
      location: { type: ['string', 'null'] },
      tags: { type: 'array', items: { type: 'string' } },
      repeat: { type: ['string', 'null'], description: 'Default RRULE body; "none" clears it.' },
    },
  },
};

const OCCURRENCE = {
  occurrenceDate: str('For repeating events: the occurrence to change, as yyyy-MM-dd (from find_events).'),
  scope: {
    type: 'string',
    enum: ['this', 'following', 'all'],
    description: 'For repeating events: only this occurrence, this and following ones, or the whole series. Required with occurrenceDate.',
  },
};

const TOOLS = [
  {
    name: 'list_calendars',
    description: 'Lists the calendars (names, colors, event counts, defaults), plus the current date/time, the time zone and the color names.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'find_events',
    description:
      'Finds events between two dates, with repeating events expanded into their occurrences. Use it to check the schedule, find an event to change, or look for clashes.',
    inputSchema: {
      type: 'object',
      properties: {
        from: str('First day, yyyy-MM-dd. Defaults to today.'),
        to: str('Last day (inclusive), yyyy-MM-dd. Defaults to 6 days after from.'),
        query: str('Only events whose title, notes, location or tags contain this text.'),
        calendar: str('Only this calendar.'),
        limit: { type: 'integer', minimum: 1, maximum: 300, description: 'Most occurrences to return (default 50).' },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_event',
    description: 'Full details of one event: its first occurrence, repeat rule, skipped dates, reminders, color.',
    inputSchema: { type: 'object', properties: { eventId: str('From find_events.') }, required: ['eventId'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_event',
    description: 'Adds an event. Reminders, location and tags default to the calendar\'s defaults (10 minutes before for timed events otherwise).',
    inputSchema: { type: 'object', properties: FIELDS, required: ['title', 'start', 'calendar'] },
  },
  {
    name: 'update_event',
    description:
      'Changes an event; only the fields given change, and the length is kept when only the start moves. For a repeating event, pass occurrenceDate + scope to change one day or the ones after it.',
    inputSchema: {
      type: 'object',
      properties: { eventId: str('From find_events.'), ...OCCURRENCE, ...FIELDS },
      required: ['eventId'],
    },
  },
  {
    name: 'delete_event',
    description: 'Deletes an event. For a repeating event, pass occurrenceDate + scope to delete one day or the ones after it.',
    inputSchema: { type: 'object', properties: { eventId: str('From find_events.'), ...OCCURRENCE }, required: ['eventId'] },
    annotations: { destructiveHint: true },
  },
  {
    name: 'create_calendar',
    description: 'Adds a calendar. The color defaults to the next palette color.',
    inputSchema: { type: 'object', properties: { name: str('Calendar name.'), ...CALENDAR_FIELDS }, required: ['name'] },
  },
  {
    name: 'update_calendar',
    description:
      'Changes a calendar: rename it (name), recolor it (color) or change what new events in it start with (defaults). Only the fields given change. Events keep their calendar.',
    inputSchema: {
      type: 'object',
      properties: { calendar: str('Current calendar name or id (from list_calendars).'), name: str('New name.'), ...CALENDAR_FIELDS },
      required: ['calendar'],
    },
  },
  {
    name: 'delete_calendar',
    description:
      'Deletes a calendar. If it has events, say what happens to them: moveEventsTo another calendar, or deleteEvents: true to delete them too. Undoable.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar: str('Calendar name or id.'),
        moveEventsTo: str('Calendar to move its events to.'),
        deleteEvents: { type: 'boolean', description: 'Delete its events too.' },
      },
      required: ['calendar'],
    },
    annotations: { destructiveHint: true },
  },
  {
    name: 'find_series_copies',
    description:
      'Finds one-off events that are really one day of a repeating series (typical after importing from Google: a renamed occurrence arrives as a skipped day plus a separate event, so lessons stop showing as repeating). For each series: how many copies differ only in title, the suggested title, and the copies that differ in more (often real one-day changes).',
    inputSchema: {
      type: 'object',
      properties: { calendar: str('Only this calendar (recommended).'), seriesId: str('Only this repeating event.') },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'fold_into_series',
    description:
      'Puts copies back into their repeating series as ONE undoable change: deletes the copies, un-skips those days, and optionally renames the series. Without copyIds it folds exactly the copies that differ only in title. Every copy is re-checked; only exact matches are folded.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              seriesId: str('The repeating event (from find_series_copies).'),
              copyIds: { type: 'array', items: { type: 'string' }, description: 'Copies to fold; omit to fold the ones that differ only in title.' },
              title: str('New series title, e.g. the suggestedTitle.'),
            },
            required: ['seriesId'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'recent_changes',
    description: 'The latest changes made with these tools (newest first), with their changeIds.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'undo',
    description: 'Undoes a change made with these tools, putting back exactly what it replaced.',
    inputSchema: {
      type: 'object',
      properties: {
        changeId: { type: 'integer' },
        force: { type: 'boolean', description: 'Undo even if the event was edited again since (e.g. on the phone).' },
      },
      required: ['changeId'],
    },
  },
];

type Args = Record<string, any>;

/** Names agents tend to use for a field, mapped to the real one, per tool. */
const ALIASES: Record<string, Record<string, string>> = {
  update_calendar: { newName: 'name', new_name: 'name', title: 'name', calendarName: 'calendar', calendarId: 'calendar' },
  create_calendar: { title: 'name', calendarName: 'name' },
  delete_calendar: { calendarName: 'calendar', calendarId: 'calendar', moveTo: 'moveEventsTo' },
  create_event: { name: 'title', summary: 'title', calendarId: 'calendar', startDate: 'start', endDate: 'end', notes: 'description', rrule: 'repeat', recurrence: 'repeat' },
  update_event: { name: 'title', summary: 'title', id: 'eventId', calendarId: 'calendar', startDate: 'start', endDate: 'end', notes: 'description', rrule: 'repeat', recurrence: 'repeat' },
  delete_event: { id: 'eventId' },
  get_event: { id: 'eventId' },
};

/** Parses a value an agent may have sent as the wrong JSON type (numbers and booleans as text, lists as one value). */
function coerce(value: unknown, schema: Args, path: string): unknown {
  const types: string[] = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (value === null) {
    if (types.includes('null')) return null;
    throw new AgentError(`${path} can't be null.`);
  }
  if (types.includes('integer') && typeof value === 'string' && /^\s*-?\d+\s*$/.test(value)) value = Number(value);
  if (types.includes('boolean') && typeof value === 'string' && /^(true|false)$/i.test(value.trim())) value = value.trim().toLowerCase() === 'true';
  if (types.includes('array') && !Array.isArray(value)) {
    if (typeof value === 'string' && value.trim().startsWith('[')) {
      try {
        value = JSON.parse(value);
      } catch {
        /* reported below */
      }
    } else if (value !== undefined && !types.includes('string') && !types.includes('object')) value = [value];
  }
  if (types.includes('object') && typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      value = JSON.parse(value);
    } catch {
      /* reported below */
    }
  }
  const actual = Array.isArray(value) ? 'array' : typeof value;
  const ok = types.some((t) => (t === 'integer' ? Number.isInteger(value) : t === 'number' ? typeof value === 'number' : t === actual));
  if (!ok) throw new AgentError(`${path} must be ${types.join(' or ')}, got ${actual === 'string' ? JSON.stringify(value) : actual}.`);
  if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) throw new AgentError(`${path} must be at least ${schema.minimum}.`);
  if (schema.enum && !schema.enum.includes(value)) throw new AgentError(`${path} must be one of: ${schema.enum.join(', ')}.`);
  if (Array.isArray(value) && schema.items) value = value.map((v, i) => coerce(v, schema.items, `${path}[${i}]`));
  if (value && typeof value === 'object' && !Array.isArray(value) && schema.properties) value = checkObject(value as Args, schema, path);
  return value;
}

/** Unknown fields are errors (a silently ignored "newName" is how a rename goes missing). */
function checkObject(args: Args, schema: Args, path: string, aliases: Record<string, string> = {}): Args {
  const props: Record<string, Args> = schema.properties ?? {};
  const out: Args = {};
  for (const [rawKey, value] of Object.entries(args)) {
    const key = props[rawKey] ? rawKey : (aliases[rawKey] ?? rawKey);
    if (!props[key]) {
      const near = Object.keys(props).find((p) => p.toLowerCase() === rawKey.toLowerCase());
      throw new AgentError(
        `Unknown field "${rawKey}"${path ? ` in ${path}` : ''}.${near ? ` Did you mean "${near}"?` : ''} Allowed: ${Object.keys(props).join(', ') || 'none'}.`,
      );
    }
    if (value === undefined) continue;
    if (key in out) throw new AgentError(`"${key}" was given twice (as ${rawKey} too).`);
    out[key] = coerce(value, props[key]!, path ? `${path}.${key}` : key);
  }
  for (const req of schema.required ?? []) {
    if (out[req] === undefined) throw new AgentError(`Missing required field "${req}".`);
  }
  return out;
}

function callTool(agent: CalendarAgent, name: string, raw: Args): unknown {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new AgentError(`Unknown tool ${name}. Tools: ${TOOLS.map((t) => t.name).join(', ')}`);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new AgentError('Tool arguments must be an object.');
  const a = checkObject(raw, tool.inputSchema, '', ALIASES[name]);
  switch (name) {
    case 'list_calendars':
      return agent.listCalendars();
    case 'find_events':
      return agent.findEvents(a);
    case 'get_event':
      return agent.getEvent(String(a.eventId));
    case 'create_event':
      return agent.createEvent(a as Parameters<CalendarAgent['createEvent']>[0]);
    case 'update_event':
      return agent.updateEvent(a as Parameters<CalendarAgent['updateEvent']>[0]);
    case 'delete_event':
      return agent.deleteEvent(a as Parameters<CalendarAgent['deleteEvent']>[0]);
    case 'create_calendar':
      return agent.createCalendar(a as Parameters<CalendarAgent['createCalendar']>[0]);
    case 'update_calendar':
      return agent.updateCalendar(a as Parameters<CalendarAgent['updateCalendar']>[0]);
    case 'delete_calendar':
      return agent.deleteCalendar(a as Parameters<CalendarAgent['deleteCalendar']>[0]);
    case 'find_series_copies':
      return agent.findSeriesCopies(a);
    case 'fold_into_series':
      return agent.foldIntoSeries(a as Parameters<CalendarAgent['foldIntoSeries']>[0]);
    case 'recent_changes':
      return agent.recentChanges(a.limit);
    case 'undo':
      return agent.undo(Number(a.changeId), a.force === true);
    default:
      throw new AgentError(`Unknown tool ${name}`);
  }
}

interface RpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Args;
}

const result = (id: RpcRequest['id'], value: unknown) => ({ jsonrpc: '2.0', id, result: value });
const error = (id: RpcRequest['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

function handleOne(agent: CalendarAgent, req: RpcRequest, version: string): object | null {
  if (!req || req.jsonrpc !== '2.0' || typeof req.method !== 'string') return error(req?.id, -32600, 'Invalid request');
  // Notifications (no id) get no response.
  if (req.id === undefined) return null;
  switch (req.method) {
    case 'initialize': {
      const asked = req.params?.protocolVersion;
      return result(req.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'opencal', title: 'OpenCal calendar', version },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return result(req.id, {});
    case 'tools/list':
      return result(req.id, { tools: TOOLS });
    case 'tools/call': {
      const name = String(req.params?.name ?? '');
      try {
        const value = callTool(agent, name, (req.params?.arguments ?? {}) as Args);
        const structured = value && typeof value === 'object' && !Array.isArray(value) ? { structuredContent: value } : {};
        return result(req.id, { content: [{ type: 'text', text: JSON.stringify(value, null, 1) }], ...structured });
      } catch (e) {
        // Mistakes the agent can fix come back as tool errors it can read and retry.
        if (!(e instanceof AgentError)) console.error(`Tool ${name} failed`, e);
        const message = e instanceof Error ? e.message : String(e);
        return result(req.id, { content: [{ type: 'text', text: message }], isError: true });
      }
    }
    default:
      return error(req.id, -32601, `Method not found: ${req.method}`);
  }
}

/** Handles one POSTed JSON-RPC message or batch; returns the response body, or null for 202. */
export function handleMcp(agent: CalendarAgent, body: unknown, version: string): unknown {
  if (Array.isArray(body)) {
    const out = body.map((r) => handleOne(agent, r as RpcRequest, version)).filter(Boolean);
    return out.length ? out : null;
  }
  return handleOne(agent, body as RpcRequest, version);
}
