# OpenCal Emulator Rapid-Input QA Report

No app source was edited, committed or instrumented. Only this report was written. Existing issues in `docs/QA-REPORT.md` (ISSUE-01 to ISSUE-11) were not re-reported.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 2 |
| Medium | 3 |
| Low | 0 |

**Reproduced on emulator:** 1 (EMU-05). **Code-inspection only:** EMU-01 to EMU-04.

### What was and wasn't tested

**Not tested: the rapid-input scenarios themselves.** The emulator booted and the app launched, but it was too slow to drive reliably:
- Attempt 1 (default `-gpu` settings): the app failed its first launch with `timeout publishing content providers`, and `system_server` aborted (`Fatal signal 6 ... system_server`, logcat 14:41:11). The emulator then stopped answering `dumpsys window` and `screencap`.
- Attempt 2 (`-gpu swiftshader_indirect -memory 3072 -cores 4`): the emulator booted, and the app was focused and drawn, but it stayed on the splash screen. Logcat showed `Displayed ... +59s910ms`.
- Because of this, no tap, swipe, back, rotation, background or import scenario was driven. No crashes, ANRs or duplicate-event repros could be observed at runtime. Adding a `console.log` for instrumentation was forbidden, so timing was not measured beyond logcat.
- Hazards below are from reading handlers and effects (Code-inspection only), except EMU-05.

**Device/build:** Pixel 7 AVD `pixel` (`sdk_gphone64_x86_64`), Android 15, software GL (gfxstream fallback, `opengl32sw` not found). Debug APK `android/app/build/outputs/apk/debug/app-debug.apk` (63.8 MB, already built), installed as `com.boazcohen.opencal`. Metro was run on port 8090 and mapped to the device with `adb reverse tcp:8081 tcp:8090`. Port 8081 was held by an unrelated Python static server, so it was not used or stopped. Commit under test: branch `claude/eloquent-dijkstra-hk2fed`, HEAD `979909f`.

**Cleanup:** my Metro server was stopped, and the emulator (not running at start) was shut down. Other node.exe and python.exe processes on the machine belong to other sessions and were left alone.

---

## Issues

### EMU-01: "Add to calendar" on a Stamp can create duplicate events on double-tap
- **Severity:** High
- **Status:** Code-inspection only
- **Area:** Stamp screen (drop a stamp onto a date)
- **Location:** `src/screens/StampScreen.tsx:81-85` (`add`), button `:127`; id generation in `src/services/templates.ts:36` (`eventFromTemplate` calls `newId()`).
- **Repro (intended):** Open a stamp from Settings or the Stamp route. Tap "Add to calendar" twice quickly (or 3 times). Check the calendar for the day.
- **Expected:** Exactly one event is added and the screen closes once.
- **Actual:** `add` has no in-flight guard. Each call builds a new event with a new id (`eventFromTemplate` → `newId()`) and calls `saveEvent`, which inserts a separate row. Then `navigation.goBack()` is called once per tap, so a fast second tap can also pop the screen underneath.
- **Fix direction:** Add a `useRef` busy flag (or disable the button after the first press) so `add` runs once. Also consider generating the event id once per screen mount, the same way EventEdit does (`useState` at `EventEditScreen.tsx:52`/`:81`).

### EMU-02: Dropping a stamp on a calendar slot can create duplicate events on rapid taps
- **Severity:** High
- **Status:** Code-inspection only
- **Area:** Calendar screen, stamp drop mode
- **Location:** `src/screens/CalendarScreen.tsx:421-426` (`dropStamp`) → `eventFromTemplate` (`src/services/templates.ts:36`) → `saveEvent`. The Undo toast is set up right after `:426`.
- **Repro (intended):** In stamp mode, tap the same empty time slot 2-3 times quickly.
- **Expected:** One event is created per deliberate drop. Repeated taps on the same slot should not silently add copies.
- **Actual:** Every call creates a new id and saves it (`dropStamp` has no guard or de-duplication). The toast offers a single Undo. I did not confirm that the Undo closure removes every created copy, so Undo may leave duplicates behind.
- **Fix direction:** Ignore taps on the same slot while a drop is in progress, or de-duplicate by (template, start). Make the Undo action remove all events created by that drop.

### EMU-03: "Save as stamp" creates duplicate stamps on rapid taps
- **Severity:** Medium
- **Status:** Code-inspection only
- **Area:** Event editor, stamp template creation
- **Location:** `src/screens/EventEditScreen.tsx:195-200` (`saveAsStamp`), button `:325`; `src/services/templates.ts:13` (`templateFromEvent` → `newId()`); `src/context/CalendarContext.tsx:439-446` (`saveTemplate`).
- **Repro (intended):** Open an event, tap "Save as stamp" twice quickly, then open Settings › Stamps.
- **Expected:** One stamp with that name.
- **Actual:** Each tap builds a template with a fresh id. In `saveTemplate`, `isNew` is computed from the `templates` value in the closure, which is still stale for a second tap in the same frame, so both taps are treated as new. Two identical stamps are saved. The notify alert also shows twice.
- **Fix direction:** Guard the handler as in EMU-01. Compute the template id once per editor mount, so the second save overwrites instead of inserting.

### EMU-04: Event Save called twice runs `goBack()` twice and can pop a screen underneath
- **Severity:** Medium
- **Status:** Code-inspection only
- **Area:** Event editor, navigation
- **Location:** `src/screens/EventEditScreen.tsx:156-163` (`save`), header button `:178` (`saveRef.current()`).
- **Repro (intended):** Open an event from a non-Quick-Add entry point (e.g., Day view, tap a slot). Tap the header "Save" twice before the editor animates out.
- **Expected:** The editor closes once and the underlying screen stays.
- **Actual:** There is no guard. Both taps run `saveEvent` (safe, since the id is stable per mount at `:52`/`:81`, so it upserts rather than duplicating) but both call `navigation.goBack()`. The second pop can remove the screen underneath (for example, the calendar screen when it is not the root). The `fromQuickAdd` path uses `popToTop` and is not affected.
- **Fix direction:** Add a `saving` ref that makes `save` a no-op after the first call, and only navigate once.

### EMU-05: Medium: App cold start takes about 60 seconds on the emulator, with a 9.8 s JS block
- **Severity:** Medium
- **Status:** Reproduced (emulator; the 9.8 s JS block is in the app code path, the wall-clock time may be emulator-specific)
- **Area:** App startup
- **Location:** startup path in `App.tsx` and the initial data load in `src/context/CalendarContext.tsx`; the PERF instrumentation already in the code reports the block.
- **Repro:** `adb shell am force-stop com.boazcohen.opencal`, then `adb shell am start -n com.boazcohen.opencal/.MainActivity`, with Metro running and reversed.
- **Expected:** Splash is replaced by the calendar within a few seconds.
- **Actual:** logcat from the second launch:
  - `ReactNativeJS: Running "main"` at 11:44:39.
  - `ReactNativeJS: PERF cold: blocks>50ms=3 total=10197ms max=9771ms lastBlockEnd=10246ms 16+9771 9803+127 9947+299`
  - `ActivityTaskManager: Displayed com.boazcohen.opencal/.MainActivity for user 0: +59s910ms` at 11:45:08.
  The splash screen was visible for the whole interval. The first launch attempt was killed with `start timeout` and `timeout publishing content providers`.
- **Evidence:** logcat lines above; screenshots `01-launch.png` and `03-after.png` show only the splash icon on a beige background.
- **Fix direction:** Confirm on a real device before optimising. Break up the 9.8 s synchronous block at startup (the `16+9771` entry is the first JS task). Defer non-critical loading (widgets, reminder planning, database warm-up) until after the first render.

---

## Checked and not reported
- **Event Save id stability:** Event ids are created once per editor mount (`useState` at `EventEditScreen.tsx:52` and `:81`), and `saveEvent` upserts. Rapid Save therefore does not duplicate events. Only the navigation issue in EMU-04 applies.
- **Delete event:** `remove` awaits `confirmAsync`, which uses a modal `Alert.alert`, so a second tap cannot reach the button while the dialog is up. No issue found.
- **Quick Add review:** `review` pushes `EventEdit` with `fromQuickAdd`, and that Save path uses `popToTop`, so it cannot stack duplicate screens from a single save.

## Not tested (because the emulator could not drive input)
Rapid tabs between Schedule/Day/Week/Month, rapid date swipes, Today during scroll, hardware Back mashing, rotation mid-action, HOME/relaunch mid-edit, School.ics import under load, logcat for ANR/`Maximum update depth` during interaction. These are open and need a stable emulator run or a physical device.

## Prioritized fix order
1. **EMU-01** and **EMU-02** (High): guard Stamp "Add" and calendar stamp drop against repeat taps, and make Undo cover every copy. These create real duplicate data.
2. **EMU-03** (Medium): guard "Save as stamp" and keep the template id stable per mount.
3. **EMU-04** (Medium): run `save` once and navigate once.
4. **EMU-05** (Medium): reduce the startup JS block, after confirming on a physical device that it is not emulator-only.
