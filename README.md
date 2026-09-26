<p align="center">
  <img src="assets/icon.png" width="112" alt="OpenCal logo" />
</p>

<h1 align="center">OpenCal</h1>

<p align="center">
  A calm, local-first calendar for Android (and iOS/web) built with Expo.<br/>
  No accounts, no sync, no ads: your calendar lives on your phone.
</p>

<p align="center">
  <a href="https://github.com/BoazCohenJ/OpenCal/releases/latest"><b>Download the latest Android APK</b></a>
</p>

<p align="center">
  <b>The 45-second tour</b> (sound on): Quick Add, stamps, pausing a repeat, scheduled Do Not Disturb,<br/>
  reminders to the minute, calendar defaults and custom colors, all real footage from the app.
</p>

https://github.com/user-attachments/assets/96c68291-76bc-4ca8-a030-11c235435344

<p align="center">
  <img src="docs/screenshots/month.png" width="24%" alt="Month view" />
  <img src="docs/screenshots/week.png" width="24%" alt="Week view" />
  <img src="docs/screenshots/day.png" width="24%" alt="Day view" />
  <img src="docs/screenshots/schedule.png" width="24%" alt="Schedule view" />
</p>
<p align="center">
  <img src="docs/screenshots/month-dark.png" width="24%" alt="Month view in dark mode" />
  <img src="docs/screenshots/event-editor.png" width="24%" alt="Event editor" />
</p>

## Features

- **Four views:** Schedule (agenda), Day, Week and Month. Swipe left/right to move between days, weeks and months, with the next one sliding in under your finger; the header tells you where you are ("Tomorrow", "In 3 weeks", "Next month"). Tap the month or year to jump to any month, scrolling year by year.
- **Quick Add:** type "Lunch with John Fri 1pm at Cafe X" and review the parsed event before saving; go back and edit the text anytime.
- **Stamps:** save events you repeat (coffee, gym, calls) and drop them on any empty time slot in one tap, with Undo. Hold a stamp in the stamp menu to delete it.
- **Birthdays:** add a name and date of birth in Settings and it shows up every year as "Dana's 36th birthday", with its own show/hide chip.
- **Repeating events** with pauses: skip a date range for one event or a whole calendar, and it resumes on its own.
- **Calendars with defaults:** each calendar has a color plus default reminders, repeat, location and tags that new events inherit.
- **Floating or fixed time:** a floating event keeps its clock time in any time zone (a 9:00 run stays at 9:00 when you travel), a fixed one keeps the same moment and remembers its time zone, so a repeating 9:00 meeting stays at 9:00 there across daylight-saving changes wherever you are. Set the default for new events in Settings and change it on any event; all-day events always float. This follows the iCalendar / JSCalendar (RFC 8984) model used by Google and Apple.
- **Reminders down to the minute,** with presets and custom values; all-day reminders fire at a time you choose.
- **Quiet time and Do Not Disturb** scheduled like events (e.g. every Monday 17:00–18:00): quiet delivers reminders silently, DND skips them.
- **Multi-select in Day and Week view:** long-press events, then drag them together (in Week view sideways to another day too) or nudge by 15 minutes / 1 hour / 1 day, and tap Done to save. Moving one day of a repeating event splits it off into its own event. You can also delete everything selected at once, with Undo. For each repeating event it asks whether to delete only that occurrence, it and the following ones, or the whole series.
- **Colors:** 20 named swatches, a color wheel, hex input, and your own saved colors by name.
- **Icons instead of emoji** for events and stamps, **dark mode** (System / Light / Dark), smooth animations.
- **Import & export:** back up everything (calendars, events, stamps, birthdays, settings) to one file and restore or merge it on another phone, or move events to and from Google Calendar, Apple Calendar and Outlook with standard .ics files (a whole calendar, or any filtered set of events).
- **Private by design:** everything is stored locally (SQLite on device, localStorage on web).

## Install on Android

1. Open the [latest release](https://github.com/BoazCohenJ/OpenCal/releases/latest) on your phone and download the `.apk`.
2. Open it and allow installing from your browser when Android asks.
3. The app updates itself over the air: when a new version is published it shows "A new version of OpenCal is ready" with a Restart button.

Releases that change native parts of the app (icons, splash, new native modules) need a new APK from the Releases page; everything else arrives automatically.

## Development

Requirements: Node 22+ and npm.

```bash
npm install
npx expo start          # press "w" for web, or scan the QR code with Expo Go
npx tsc --noEmit        # typecheck
npx expo lint           # lint
```

Build an installable Android APK in the cloud with [EAS](https://docs.expo.dev/eas/):

```bash
npx eas-cli@latest build -p android --profile preview
```

Every push to `main` runs the typecheck and lint, then publishes an over-the-air update to installed preview builds (`.github/workflows/eas-update.yml`). The release rules (when a version bump and a new build are required) are documented in [AGENTS.md](AGENTS.md).

## Tech stack

- [Expo](https://expo.dev) SDK 57, React Native, TypeScript
- React Navigation (native stack)
- expo-sqlite for storage, expo-notifications for reminders, expo-updates for over-the-air updates
- expo-document-picker, expo-file-system and expo-sharing for importing and exporting files
- rrule for recurrence, chrono-node for natural-language parsing, date-fns
- react-native-svg + lucide icons, Fraunces display font

## Project structure

```
App.tsx                 navigation, theme and providers
src/screens/            screens (calendar, editors, settings, notifications…)
src/views/              schedule, day, week and month views
src/components/         shared UI (pickers, sheets, toast, logo…)
src/context/            app state (CalendarContext)
src/services/           database, occurrences/recurrence, notifications, focus windows
src/models/             data types
src/navigation/         route and param types
src/utils/              dates, recurrence, colors, formatting helpers
scripts/make-logo.js    generates the app icon, splash and favicon
docs/screenshots/       README screenshots
promo/                  renders the promo video from code (see promo/README.md)
```

## License

[MIT](LICENSE) © Boaz Cohen
