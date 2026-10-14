# Handoff: the app won't respond to taps for a few seconds after it opens

## The problem
After OpenCal opens (most noticeable when a home-screen widget opens the Schedule view), taps don't work for a few seconds. The View menu button is the one that gets noticed. Scrolling still works because it runs natively, so the JS thread is the thing that's busy. The user wants it to be responsive right away, like Google Calendar, where you can scroll about 3 months immediately and events fill in afterwards.

## Already done (on `main`, commit `31d0f02`)
`src/views/ScheduleView.tsx`: a short schedule list makes `onEndReached` fire over and over. Each time, the list used to expand the whole range again, adding 60 days per round up to 730 days. Now each 60-day page is worked out once and kept (`dayPages`), and loading more runs inside `startTransition`. **The user says the lock is still there**, so the remaining cost is in other startup work.

## Suspects, not yet measured (measure before fixing)
Times are measured from when the first screen appears:
1. **Widget refresh after 1 s** (`src/widgets/WidgetWatcher.tsx` → `refreshWidgets` → `src/widgets/render.tsx` → `loadOccurrences` in `src/widgets/data.ts`). Each widget instance:
   - reads **every event from SQLite again** (`db.loadEvents()`), synchronously on the JS thread;
   - produces new `Event` objects, so the expansion cache in `src/services/occurrences.ts` misses. That cache is a `WeakMap` keyed by event object, and a miss means the `rrule` work runs again from scratch for every repeating event;
   - then renders the whole widget tree, twice when the theme follows the system (light and dark).

   This is the main suspect. Likely fixes: when the app is running, render widgets from CalendarContext's `events` and other in-memory data instead of re-reading the database. If that's not possible, load the data once per `refreshWidgets` call rather than once per widget. Also run it after interactions, or on a longer delay at startup.
2. **Rescheduling reminders after 800 ms** (`CalendarContext.tsx` around line 221 → `rescheduleReminders` in `src/services/notifications.ts`). This expands every event over `horizonDays`, cancels all scheduled notifications and schedules each one again, one native call at a time, on every launch and every return to the foreground.
3. **Sync at launch** (`src/components/SyncWatcher.tsx` → `syncIfSetUp`), and `reloadSyncedData` if the sync changed anything. A reload replaces every `Event` object, which clears the expansion cache and re-renders the calendar.
4. **The first `rrule` expansion** for the 3 month pages that `CalendarScreen` keeps mounted (`pages` memo, `getOccurrences`). The first `rule.between` for each repeating event for each year is slow in the `rrule` package. How slow depends on how many repeating events there are (the user may have imported a lot from Google).

## Goal and possible direction
Taps should work as soon as the app appears. Ideas:
- Push all non-UI startup work (widgets, reminders, sync) back with `InteractionManager.runAfterInteractions`, or schedule it after the first frames. Split it into chunks so it doesn't run as one long block.
- Show the current page first and build the neighbouring pages afterwards, as the deferred value already does.
- Optionally show events progressively, the way Google Calendar does.

## How to test
- Run it on an Android emulator or device (the cloud session couldn't: no KVM, and the Android SDK downloads were blocked).
- Use a realistic dataset: many events, including dozens of repeating ones.
- Profile with the React Native DevTools (Performance tab) or Hermes sampling profiler. Find what runs in the first ~5 s after launch from the widget (`opencal://calendar?mode=schedule&date=YYYY-MM-DD`), e.g. `adb shell am start -a android.intent.action.VIEW -d "opencal://calendar?mode=schedule&date=2026-10-14" com.boazcohen.opencal`.
- Check both a cold start and a warm return to the foreground.

## Project rules (see AGENTS.md)
- Run `npx tsc --noEmit` and `npx expo lint` before you're done. The React Compiler lint rejects caches mutated inside a component, so keep caches in module-level functions, as `dayPages` does.
- A JS-only change ships over the air when pushed to `main`. Any native change needs a `version` bump and a rebuild.
- Develop on branch `claude/eloquent-dijkstra-hk2fed`. The user approves merges to `main`.
