# Resubmitting OpenCal to F-Droid

The first merge request (fdroiddata !54221, 2026-10-25) was closed on 2026-10-26 by a maintainer, for three reasons:

1. The merge request template was not followed.
2. The app has not been maintained for 3 months.
3. The app does not provide unique features.

This file holds everything needed to resubmit, and what to do until then.

## When

The inclusion policy asks for at least 3 months of active development, unless the app has proven users or its
author already maintains other apps on F-Droid. OpenCal's first commit is 2026-09-22, so the earliest honest
date is **2026-12-22**. Until then:

- Keep developing and cut regular releases (the policy also wants the author to commit to ongoing maintenance).
- Collect evidence of real users: GitHub release downloads, issues from people other than the author, stars,
  mentions. A short note in the merge request about the number of users helps with reason 2 as well.
- IzzyOnDroid was ruled out (it rejects AI-written code); Obtainium and Accrescent are in `OTHER-STORES.md`.
- The self-hosted repo at https://gigaserver.taila02557.ts.net:2293/repo works in the meantime (tailnet only).

## Merge request description (fills in the repository's `Default.md` template)

Keep the template's headings and tick boxes; replace the two prompts with the text below. Title: `New app: OpenCal`.

### Please introduce the functions and usage of your app in summary, and also attach some screenshots.

> OpenCal is a calendar for Android that keeps everything on the phone and has no accounts, ads or trackers. It has
> Schedule, Day, Week and Month views, home-screen widgets, repeating events with pauses, per-calendar defaults,
> reminders down to the minute with scheduled quiet time and Do Not Disturb, a "Quick Add" bar that turns
> "Lunch with John Fri 1pm at Cafe X" into an event you review before saving, reusable event "stamps",
> birthdays, color rules, floating or fixed time zones, .ics import/export and one-file backups.
>
> Optionally, you can run the small OpenCal server at home (one Docker command) to keep several phones in step.
> The same server exposes the calendar over MCP, so a self-hosted assistant can read and change your schedule.
>
> Screenshots are in `metadata/android/en-US/images/phoneScreenshots/` of the upstream repository.

### Please elaborate why you wrote this app. Please highlight the unique functions it provides over other similar apps in F-Droid.

> (Write this in your own words; it is the part reviewers weigh most. Draft: I wanted a calendar that is as
> pleasant as the Google, Apple and Outlook ones but where my data stays on hardware I own, and that I can hand to
> a personal assistant. Comparison against the F-Droid calendars below.)

| | OpenCal | Fossify Calendar | Etar | Calendula | SayWhen | Tuta Calendar |
|---|---|---|---|---|---|---|
| Full calendar (views, editor) | yes | yes | yes | yes | no, adds events only | yes |
| Where data lives | own SQLite database | Android calendar provider | Android calendar provider | Android calendar provider | writes into the system calendar | Tuta's servers |
| Needs calendar permissions | no (only notifications/alarms) | read/write calendar, contacts | read/write calendar | read/write calendar | read/write calendar | account |
| Natural-language Quick Add with review | yes | no | no | no | yes | no |
| Reusable event templates ("stamps") | yes | no | no | no | no | no |
| Home-screen widgets | Schedule, Today, Week, Month | yes | agenda | not listed | one | not listed |
| Floating vs fixed time zone per event | yes | no | no | no | no | no |
| Scheduled quiet time / Do Not Disturb for reminders | yes | no | no | no | no | no |
| Self-hosted sync | own server, one container | via CalDAV (needs a CalDAV server and a sync adapter) | via CalDAV (same) | via CalDAV (same) | no | no (Tuta cloud) |
| MCP tools for an AI agent | yes | no | no | no | no | no |

Honest limits (state these in the merge request rather than let a reviewer find them):

- CalDAV (Nextcloud, Radicale, Baikal with DAVx5) is the established way to sync the calendars above, and it is a
  standard. OpenCal's sync is its own protocol with last-change-wins merging, and it only talks to the OpenCal
  server. The pitch is not "sync exists" but "sync without running a CalDAV stack, from the same calendar app",
  together with the MCP tools.
- Etar and Fossify read the phone's shared calendar, so they show every account the phone already syncs. OpenCal
  deliberately does not; it keeps its own data. State this as a trade-off (privacy and no calendar permission, but
  no automatic view of other apps' calendars).
- Searching F-Droid on 2026-10-26 for "calendar" and "MCP" found no other calendar that exposes MCP tools, and no
  other calendar with a built-in self-hosted sync server of its own. The only self-hostable organizer found was
  solyto, which is a different kind of app (all-in-one, DAV sync, "no AI"). Re-run the search before submitting.

Sources for the table: the F-Droid package pages of org.fossify.calendar, ws.xsoh.etar, de.jeanlucmakiola.calendula,
com.dmi3dmi3.saywhen, de.tutao.calendar and app.solyto (read 2026-10-26). A "no" means the F-Droid page does not
list the feature, not that it was verified absent in the app.

## Checklist from the template, and where OpenCal stands

- Inclusion criteria: MIT, no proprietary dependencies, no tracking. Quality point 6 (unique value) is argued above;
  the 3-month rule is what the wait is for.
- Original author notified: you are the author. Say so in the description.
- Fastlane metadata in the upstream repo: done (`metadata/android/en-US`: title, short and full description,
  changelogs, icon, 6 screenshots). Add a feature graphic if you like.
- Title format `New app: OpenCal`: use it.
- Fork public and branch not protected: yes.
- One app per merge request: yes.
- Metadata file `metadata/com.boazcohen.opencal.yml`, valid YAML, LF line endings: yes (`.gitattributes` in the fork
  clone; check before pushing on Windows).
- No summary/description/changelog in fdroiddata: correct, they come from fastlane.
- Releases tagged and auto update enabled: `UpdateCheckMode: Tags`, `AutoUpdateMode: Version`. Consider
  `UpdateCheckMode: Tags ^v[0-9.]+$` like other apps.
- **The `commit` field must be the full hash, not a tag.** The first submission used `v1.5.0`; use the 40-character
  hash of the release commit.
- Issue tracker and contact: GitHub issues are set. AuthorName is set.
- External repos as submodules instead of srclibs: the `hermes` srclib was used, but the existing recipe
  `com.scariflabs.horus` (React Native, Hermes built from source) also uses `hermes@<tag>` as a srclib, so there is
  precedent. Mention it in the merge request and ask if a submodule is preferred.
- Reproducible builds: see below.
- ABI split if the APK is large: the APK is about 90 MB because it carries all four ABIs. Consider an ABI split
  (`reactNativeArchitectures` / `splits` in Gradle) so each APK is smaller; F-Droid asks for this.
- Only the latest version in the metadata, no disabled versions: yes.
- Pipeline passes: it did on the first submission (all 9 jobs).
- Add `/label ~"New App"` at the end of the description.

## Recipe changes worth making before resubmitting

The `horus` recipe shows what reviewers accepted for another React Native app. Compared with ours:

- It installs Node from Debian's `forky` repository (`apt-get install -y -t forky nodejs npm`) instead of
  downloading a tarball, and builds with JDK 21 by patching the React Native Gradle plugin's JDK 17 requirement with
  `sed`. That removes both checksummed downloads we were unsure about. `ndk: 27.1.12297006` is used instead of `r27b`.
- It deletes the whole `node_modules` from the scanner's view with `scandelete: - node_modules`, instead of our long
  list of paths and `scanignore` entries. Try the same: it is much shorter.

`docs/fdroid/com.boazcohen.opencal.v2.yml` is a draft with these changes. It has been tested only if the section
"Test results" below says so.

## Reproducible builds

F-Droid signs the APK with its own key unless the recipe has `AllowedAPKSigningKeys` and the build is reproducible
against a developer-signed APK. This is a one-way choice ("you can't enable it later"), so decide on purpose.
Two builds of the same tag were compared (see "Test results"). If they are not bit-identical, say in the merge
request that reproducibility could not be enabled and why, which the template explicitly allows.

## Test results

(Filled in below as the checks are run.)
