# OpenCal QA Report

Tested commit: `979909f` (branch `claude/eloquent-dijkstra-hk2fed`). No app source was edited or committed. The only files touched are this report and the git-ignored `dist/` build output.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 5 |
| Low | 5 |

**Reproduced in the web build:** 1 (ISSUE-02). **Code-inspection only:** all others.

### What was tested
- **Typecheck:** `npx tsc --noEmit` crashes with `RangeError: Maximum call stack size exceeded` under default Node settings. With `node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit` it passes (exit 0), so there are no type errors.
- **Lint:** `npx expo lint` exits 0 with no warnings or errors.
- **Unit tests:** no test script exists in `package.json`, so none were run.
- **Web build and runtime:** `npx expo export -p web` succeeded (exit 0). The output was served on localhost and driven in the built-in browser. Verified: app boots with no console errors (two expected warnings: expo-notifications on web, and Animated `useNativeDriver`), Quick Add parsing, saving a new event, and the Month grid showing it. Screenshots time out in this environment, so visual checks were not possible. Native-only paths (Android widgets, notifications, SQLite file, sync against a live server) were not exercised.
- **Code review:** read `src/utils/{dates,recurrence,timeZones}.ts`, `src/services/{occurrences,eventTimes,ical,database,database.web,sync,notifications,focus,naturalLanguage,templates}.ts`, `src/context/CalendarContext.tsx`, `src/views/{layout,ScheduleView}.tsx`, `src/screens/{EventEditScreen,QuickAddScreen}.tsx`, `src/components/{RecurrenceEditor,DateTimeField}.tsx`, and `server/src/{main,store}.ts`. Not reviewed in depth: `agent.ts`, `mcp.ts`, `backup.ts`, `WeekView`/`DayView`/`MonthView` rendering, `CalendarScreen.tsx`, `NotificationsScreen.tsx`, and the widgets.
- **Not feasible:** no School.ics stress fixture was located, and screenshot-based visual checks failed, so the Schedule view could not be opened in the browser pane.

---

## Issues

### ISSUE-01: Reminders whose lead time reaches the planning horizon are never scheduled
- **Severity:** High
- **Status:** Code-inspection only
- **Area:** Notifications / reminder planning
- **Location:** `src/services/notifications.ts:99` (`expandEvents(candidates, calendarsById, now, horizonEnd)`) combined with `:105` (`date <= now`); horizon default `src/models/NotificationPrefs.ts:50` (`horizonDays: 30`); editor limits `src/components/ReminderEditor.tsx:15` (`days: 60`, `weeks: 8`).
- **Repro:** Create an event 40 days from now with a reminder "5 weeks" (35 days) before. Open the app. The reminder is not scheduled.
- **Expected:** Reminder is queued (and fires at the right time) regardless of how far ahead the reminder is set.
- **Actual:** Planning includes only occurrences whose start is before `now + horizonDays`. A reminder fires at `start - lead`, so it is only planned when `start - lead > now` and `start < now + horizon`. Both can hold only if `lead < horizon`. For any lead ≥ 30 days, the reminder is never queued. Leads between roughly 28 and 30 days are queued for only about a one-day window and are missed if the app is not opened in that window. The horizon has no UI control, so users cannot raise it.
- **Evidence:** Derived from the code above. Not reproduced at runtime.
- **Fix direction:** Expand from `now` to `horizonEnd + maxLead` (where `maxLead` is the largest reminder in the candidate set), or plan each event's reminders against `anchor` rather than `occ.start`. Consider also re-planning on a timer or background task rather than only on foreground.

### ISSUE-02: Quick Add takes the first chrono match, so "Night" becomes the date and the real range is dropped
- **Severity:** Medium
- **Status:** Reproduced (web build)
- **Area:** Natural-language quick add
- **Location:** `src/services/naturalLanguage.ts:35` (`chrono.parse(input, reference, ...)[0]`).
- **Repro:** Open Quick Add. Type `Night shift Oct 20 11pm to Oct 21 1am`. The preview shows Title "Shift Oct 20 11pm to Oct 21 1am", When "Sun, Oct 18 · All day", and `from “Night”`.
- **Control:** Type `Party Oct 20 11pm to Oct 21 1am`. The preview correctly shows Title "Party", When "Tue, Oct 20 11 PM – Wed, Oct 21 1 AM".
- **Expected:** The real date/time range is used, and "night" is kept in the title (it is not a date).
- **Actual:** Only the first chrono fragment is used. "night" is parsed as a time-of-day phrase for today, all-day, and the explicit range is discarded and left in the title.
- **Fix direction:** Prefer the match with the most specific information (explicit dates or times over bare time-of-day words), or consider all matches and pick the best. Also treat "night"/"morning"/"evening" alone as non-date text unless adjacent to an explicit date.

### ISSUE-03: Dragging an all-day event onto a DST-transition day extends it into the next day
- **Severity:** Medium
- **Status:** Code-inspection only
- **Area:** Event editor, all-day dates
- **Location:** `src/screens/EventEditScreen.tsx:112-115` (`setStart` keeps `duration = end - start` in milliseconds); `:138-139` (`normalized` recomputes `endOfDay(end)`).
- **Repro:** On a phone in a DST zone (e.g., Europe/Berlin), create an all-day event on Mar 1. Change the start date to Mar 29 (a 23-hour day in Europe).
- **Expected:** Event stays on Mar 29 only.
- **Actual:** The end is set to start + (24h − 1ms), which lands at 00:59:59.999 on Mar 30. `normalized()` then calls `endOfDay`, so the event now covers Mar 29–30.
- **Fix direction:** For all-day events, keep the day count (`differenceInCalendarDays`) rather than a millisecond duration, and set the end with `endOfDay(addDays(newStart, days))`.

### ISSUE-04: Timed events that cross midnight are shown as "All day"
- **Severity:** Medium
- **Status:** Code-inspection only (the Month-view span rendering was observed in the browser)
- **Area:** Schedule, Day, Week, Month views
- **Location:** `src/views/layout.ts:34` (`isAllDayLike = o.event.isAllDay || isMultiDay(...)`); `src/views/ScheduleView.tsx:134-142` (renders the label "All day" when `isAllDayLike`); `src/views/DayView.tsx:89-90` and `src/views/WeekView.tsx` (route `isAllDayLike` occurrences into the all-day strip, so the timed block disappears).
- **Repro:** Create "Night shift" 23:00 Oct 20 to 01:00 Oct 21 (timed, not all-day). In Schedule view it shows "All day" instead of "11 PM / 1 AM". In Day/Week it appears in the all-day strip, not in the time grid.
- **Expected:** Timed overnight events show their start and end times and sit on the time grid (split across days if needed).
- **Actual:** Any range crossing midnight is classified as all-day.
- **Fix direction:** Use `event.isAllDay` alone for the "All day" label and strip routing. For multi-day timed events, show the times on each day's grid using the clipped segment.

### ISSUE-05: Editing a repeat option flattens a monthly "nth weekday" rule
- **Severity:** Medium
- **Status:** Code-inspection only
- **Area:** Recurrence editor / data integrity
- **Location:** `src/utils/recurrence.ts:65-74` (`buildRRule` writes BYDAY only for `freq === 'weekly'`); `src/utils/recurrence.ts:52-53` (`parseRRule` reads BYDAY for any frequency); `src/components/RecurrenceEditor.tsx:44` (`update` rebuilds the whole rule from config on any change).
- **Repro:** Import (or set via ICS) a rule `FREQ=MONTHLY;BYDAY=1MO` (first Monday). Open the event and change "Every" from 1 to 2 (or tap "Monthly" again).
- **Expected:** Rule stays "first Monday of every 2 months".
- **Actual:** The saved rule becomes `FREQ=MONTHLY;INTERVAL=2`, which repeats on the start date's day-of-month.
- **Fix direction:** Round-trip the BYDAY/BYSETPOS/other parts for monthly rules (or preserve unknown parts), or show the rule as read-only when it uses features the editor can't express.

### ISSUE-06: ICS import silently drops events that share a UID (or DTSTART+SUMMARY when UID is missing)
- **Severity:** Medium
- **Status:** Code-inspection only
- **Area:** ICS import
- **Location:** `src/services/ical.ts:350` (uid fallback `${dtstart}-${summary}`), `:389` (`baseId`), `:411` (`masters.set(baseId, event)`).
- **Repro:** Import an .ics file with two distinct VEVENTs that have the same UID (common in some exports) or no UID with the same start and summary.
- **Expected:** Both events are imported (or the second gets a unique id).
- **Actual:** `masters` is a `Map` keyed by `baseId`, so the second event overwrites the first. The `skipped` counter does not record it, so the import summary is misleading.
- **Fix direction:** When a UID already exists as a master, disambiguate (e.g., append a counter or DTSTART) and keep both, or report duplicates in the result.

### ISSUE-07: Server stores client records opaquely and has no rate limit
- **Severity:** Low
- **Status:** Code-inspection only
- **Area:** Sync server
- **Location:** `server/src/store.ts:246-269` (`checkChangeSet` validates list shapes but "keeps records as sent"); `server/src/main.ts:28` (`MAX_BODY = 50MB`), `:98-109` (no rate limiting).
- **Repro/Concern:** Any holder of the API key can store arbitrary JSON per record, up to 50 MB per request, with unlimited request rate.
- **Expected:** Records are validated against the event/calendar shape, or at least size-capped per record; requests are rate-limited.
- **Fix direction:** Validate required fields and types per kind; lower `MAX_BODY`; add basic rate limiting at the Caddy layer (see `SERVER.md`).

### ISSUE-08: `importEvents` reports inflated counts when the file contains duplicate IDs
- **Severity:** Low
- **Status:** Code-inspection only
- **Area:** Import summary
- **Location:** `src/context/CalendarContext.tsx:556-562`.
- **Repro:** Import an .ics where two events share an id (see ISSUE-06, or a duplicated event in the file).
- **Expected:** Count reflects unique events.
- **Actual:** `added` counts both entries, though one row is written.
- **Fix direction:** De-duplicate `incoming` by id before counting.

### ISSUE-09: Side effects inside React state updaters
- **Severity:** Low
- **Status:** Code-inspection only
- **Area:** Context state management
- **Location:** `src/context/CalendarContext.tsx:278-296, 298-324, 331-353, 355-361, 374-378` (`db.setSetting(...)` called inside `setX(prev => ...)`).
- **Concern:** Updaters are supposed to be pure. Under React StrictMode (or concurrent re-runs) the write happens twice. Idempotent here, but fragile.
- **Fix direction:** Compute `next` from the current state outside the updater, then write and set.

### ISSUE-10: Imported RRULEs the editor cannot express (e.g., HOURLY) show as "Never"
- **Severity:** Low
- **Status:** Code-inspection only
- **Area:** Recurrence parsing
- **Location:** `src/utils/recurrence.ts:46-47` (unknown FREQ returns config with `freq: 'none'`); `src/services/ical.ts:387` (such rules are still accepted by `createRule`).
- **Repro:** Import an event with `RRULE:FREQ=HOURLY;COUNT=5`. The editor shows "Never", but occurrences still expand.
- **Expected:** Editor shows the rule, or the import rejects/warns about unsupported frequencies.
- **Fix direction:** Mark such events as "custom rule" in the editor and keep them read-only for the repeat section.

### ISSUE-11: Overnight/timed day key uses phone clock for floating-time drags (informational)
- **Severity:** Low
- **Status:** Code-inspection only (design question)
- **Area:** Event editor display
- **Location:** `src/screens/EventEditScreen.tsx:245-247, 277` (times shown in phone local clock while the subtitle says "Fixed to <zone>").
- **Concern:** For a fixed event in another zone, the editor shows the phone's clock time, but the repeat clock (`eventClock`) uses the event's own zone. The displayed start and the repeat origin can disagree.
- **Fix direction:** Confirm intended behavior. If times should be shown in the event's zone, convert in the editor via `toZoneWallClock`.

---

## Fix order

1. **ISSUE-01** (High): reminders silently never fire for long lead times.
2. **ISSUE-04** and **ISSUE-02** (Medium, user-visible, easy): overnight label/layout and quick-add misparse.
3. **ISSUE-03** and **ISSUE-05** (Medium, data correctness): DST all-day extension and monthly rule loss.
4. **ISSUE-06** (Medium): ICS duplicate-UID data loss.
5. Low items: ISSUE-07 (server hardening), ISSUE-08 (count), ISSUE-09 (updater side effects), ISSUE-10 (unsupported RRULE display), ISSUE-11 (zone-display question).

## Tooling notes
- `npx tsc --noEmit` needs `--stack-size` on this machine (or a tsconfig/`typescript` update) because the default stack overflows. Worth checking whether this reproduces on CI.
