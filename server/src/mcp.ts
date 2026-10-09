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

function callTool(agent: CalendarAgent, name: string, a: Args): unknown {
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
