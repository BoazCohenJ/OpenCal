Build a custom calendar app for me. This is a solo project — keep the stack
simple, local-first (local storage/SQLite, no backend or sync unless I ask
for it later), and avoid external API dependencies unless a feature below
explicitly needs one. Extend the data model incrementally rather than
over-engineering it up front.

Start with a normal calendar app: day/week/month views, create/edit/delete
events, recurring events, reminders/notifications, multi-day and all-day
events, event descriptions and location fields. Use an existing recurrence
library (e.g. rrule.js if you're working in JS) instead of writing
recurrence math from scratch — everything below builds on top of it.

Then add these features:

1. **Hidden events list.** A separate screen under Settings — not the main
   calendar view. It's purely a list of events (not a calendar grid), so I
   can find and edit events without hunting for them visually. Needs
   filters: only repeating events, by calendar, by date range, by tag.
   Tapping an entry opens the normal edit screen.

2. **Pauses on repeating events.** Let me add one or more date ranges during
   which a recurring event skips its occurrences, then resumes
   automatically afterward — e.g. "repeat every week" but paused Aug 1–31.
   Model this as an exclusion window (a date range) stored alongside the
   recurrence rule, not a single excluded date. Support multiple pause
   windows per event.

3. **Saved event templates ("stamps").** Let me save a reusable template
   with all of an event's properties (title, duration, color, reminders,
   calendar, location) — for things that happen often but not on a fixed
   schedule, like "coffee with John." I should be able to drop a saved
   template onto any date/time and only need to confirm the date/time;
   everything else pre-fills. Templates are manageable in Settings (create,
   edit, delete, reorder).

4. **Multi-select and drag to change time, daily view only.** Long-press an
   event to enter selection mode, tap others to add to the selection, then
   drag vertically to shift all selected events' times together, preserving
   their relative offsets. This only applies to the daily/time-grid view.
   Gesture disambiguation (select vs. drag-single-event vs. scroll) is the
   hard part — if a pure-gesture approach turns out fragile, fall back to
   long-press toggling a checkbox/selection-mode UI, then drag applies to
   whatever's checked.

5. **Custom event color.** A color picker plus manual hex input, so any
   event's color can override whatever it inherits from its calendar.

6. **Calendars.** Let me create multiple named calendars (Work, Personal,
   etc.), each with a default color. Every event belongs to a calendar and
   inherits its color unless the event has a custom color set. Events can
   be reassigned to a different calendar later.

7. **Pauses on whole calendars.** Same exclusion-window mechanism as #2, but
   applied at the calendar level — pausing a calendar pauses every
   recurring event under it for that date range, without setting it per
   event. This should compose with per-event pauses: an occurrence is
   paused if it falls in either its own pause window or its calendar's.

8. **Independent calendar visibility toggles.** On the main calendar view,
   give each calendar its own show/hide toggle, combinable in any
   combination, without altering underlying data.

9. **Emoji tagging.** Let me attach an emoji to any event, shown next to its
   title in all views, for quick visual scanning.

10. **Natural language event creation.** A single text input where I can
    type something like "lunch with John Fri 1pm at Cafe X" and it parses
    out date, time, title, and location into a new event for me to review
    and confirm before saving. Use a parsing library (e.g. chrono-node) for
    the date/time extraction rather than a custom parser; pull title and
    location from whatever text it doesn't consume, and let me correct any
    misparse before confirming.

Suggested build order — please follow this unless you see a good reason not
to:
1. Core data model: events, calendars, recurrence, with pause-window support
   built in from the start (retrofitting it later is painful).
2. Calendars + color inheritance + visibility toggles (features 5, 6, 8).
3. Hidden events list with filters (feature 1).
4. Templates/stamps (feature 3).
5. Natural language input (feature 10).
6. Emoji tagging (feature 9) — trivial, can slot in anytime.
7. Multi-select + drag gesture (feature 4) — save for last, it's the
   highest-risk, most isolated piece.

Ask me clarifying questions before starting if anything above is ambiguous,
especially platform choice (web/mobile/desktop) and language/framework
preference if I haven't specified one.
