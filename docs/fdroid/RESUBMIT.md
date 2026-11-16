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
- The private self-hosted F-Droid repo works in the meantime.

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
- ABI split if the APK is large: done in the v2 recipe (one build block per ABI, 25-33 MB each instead of about
  90 MB); see "Test results".
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

`docs/fdroid/com.boazcohen.opencal.v2.yml` has these changes plus the ABI split, and was built and scanned on
2026-11-16 (see "Test results"). Submit it instead of `com.boazcohen.opencal.yml`, with the header comments removed
(`fdroid rewritemeta` drops them anyway) and `versionName`/`commit`/`Current*` moved to the release being submitted.

## Reproducible builds

F-Droid signs the APK with its own key unless the recipe has `AllowedAPKSigningKeys` and the build is reproducible
against a developer-signed APK. This is a one-way choice ("you can't enable it later"), so decide on purpose.
Two builds of the same tag were compared (see "Test results"). If they are not bit-identical, say in the merge
request that reproducibility could not be enabled and why, which the template explicitly allows.

## Test results

All builds ran `fdroid build --on-server` in F-Droid's buildserver image (a local build container, see
`scripts/fdroid/`). APKs were compared entry by entry with Python's `zipfile` (names, order, offsets, CRC, SHA-256).

### 1. Reproducibility (checked 2026-11-16)

- **v1.5.0, old recipe, two builds (2026-10-25 and 2026-10-26, same container and path):** all 1276 ZIP entries
  outside the v1 signature files are identical (content, order, 1981-01-01 timestamps, compression). A third build
  that used the npm `hermesc` instead of the one built from the srclib is identical too, so the Hermes bytecode does
  not depend on which `hermesc` built it. The only bytes that differ sit in the APK Signing Block: Gradle signs the
  release with the template's debug key and adds Google's encrypted dependency-metadata block (ID `0x504b4453`),
  which changes every build. The v2 recipe now turns that block off (`dependenciesInfo`); F-Droid strips the debug
  signature anyway.
- **v1.7.0, v2 recipe, arm64 built twice in different directories (2026-11-16):** dex, Hermes bundle, resources,
  manifest and prebuilt libraries are identical. Seven `.so` files compiled from source here (`libappmodules`,
  `libexpo-modules-core`, `libexpo-sqlite`, `librnscreens`, three `libreact_codegen_*`) differ in 20 bytes each:
  the GNU build-id, which the linker hashes over the unstripped binary including debug info with absolute build
  paths. Same directory gives identical builds; a different directory does not.
- **Against the developer-signed `OpenCal-1.7.0-fdroid-arm64.apk` from the GitHub release:** 15 of 1089 entries
  differ: built with JDK 17 instead of 21 (`kotlin-tooling-metadata.json`, dex), a different JS bundle hash in the
  Hermes header, different `.so` build-ids, versionCode 10700 instead of 107003, baseline profile and
  `resources.arsc`.

**Conclusion:** not bit-reproducible today, so leave `AllowedAPKSigningKeys`/`Binaries` out and say so in the merge
request. Enabling it later would need all of: (a) build the developer APK with the exact v2 recipe (same image, JDK
21, hermesc from source, per-ABI versionCode), not the local Gradle setup; (b) make the native build path-independent,
for example `-ffile-prefix-map=<source root>=.` in `CFLAGS`/`CXXFLAGS` for the CMake builds, or the same build
directory as F-Droid's server (`/home/vagrant/build/com.boazcohen.opencal`), untested; (c) sign with v2/v3 using
the permanent release key. Remember the choice is one-way.

### 2. v2 recipe (2026-11-16, commit `0c7de94c7fbe75d6e94ef6b851006068c029d02d` = `v1.7.0`, the latest tag)

- `fdroid lint` and `fdroid rewritemeta` pass; the committed file is in rewritemeta's format.
- Node from Debian forky, JDK 21 patch, no downloads in `sudo`: works. `scandelete: node_modules` works (93 files
  removed: prebuilt AARs/JARs, iOS/web binaries, `fb-dotslash`, sqlite extensions, gradle wrapper jar). The
  `scanignore` entries were kept: under `scandelete` the scanner removes flagged files rather than ignoring them, so
those `build.gradle` files (flagged for local maven repos) would most likely be deleted (not tested). Remaining
  scanner output is warnings only (Windows DLLs in `node_modules/hermes-compiler/hermesc/win64-bin`); adding
  `rm -rf node_modules/hermes-compiler/hermesc` to `prebuild` as horus does would silence them (not tested).
- Fixes needed on the way: `expo-sqlite` and other library modules set no `ndkVersion`, so Gradle silently
  downloaded AGP's default NDK 27.0.12077973 during every build (also in the first submission). The recipe now gives
  every library module the app's NDK (`subprojects { ... ndkVersion ... }` appended to `android/build.gradle`), and
  that download is gone. Gradle still installs SDK CMake 3.22.1 itself, as in all earlier builds.
- The first universal attempt failed on a temporary DNS error in the build container (not the recipe); the per-ABI
  builds below passed scanning and `BUILD SUCCESSFUL` (about 16 minutes of Gradle each).

### 3. ABI split (2026-11-16)

One build block per ABI with `gradle assembleRelease -PreactNativeArchitectures=<abi>`; the versionCode in the
generated `android/app/build.gradle` is replaced by `$$VERCODE$$` (= 10 × app versionCode + 1 armeabi-v7a, 2 x86,
3 arm64-v8a, 4 x86_64, the usual F-Droid order so arm64 phones get the arm64 APK), and `VercodeOperation` keeps
auto-update working from `app.json`. Everything is recipe-level: no change to the repo's `app.config.js`, metro
config or native config, so the OTA build is untouched. The built arm64 APK contains only `lib/arm64-v8a`, no
`expo/modules/updates` classes (the stub is used) and no Firebase/GMS classes.

| ABI | versionCode | APK size |
|---|---|---|
| armeabi-v7a | 107001 | 25.6 MB (built) |
| x86 | 107002 | about 33.3 MB (estimated from library sizes, not built) |
| arm64-v8a | 107003 | 31.9 MB (built twice) |
| x86_64 | 107004 | about 32.5 MB (estimated, not built) |

The universal APK was about 90 MB. Open points: fastlane changelogs are looked up by versionCode, so
`changelogs/10700.txt` will not match `107003`; check whether F-Droid falls back to `default.txt` or add per-ABI
copies. Phones that installed the self-hosted repo's 10600 build upgrade fine, since 10700N is higher.
