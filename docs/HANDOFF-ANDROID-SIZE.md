# Android size reduction handoff

Updated: 2026-10-30 (Asia/Jerusalem).

## Objective and current state

Reduce OpenCal's Android APK size without removing features. Implementation is committed locally, an EAS-signed ARM64 APK is finished, and an isolated native x86_64 release passed emulator smoke checks. The signed ARM64 APK still needs a real ARM64 phone check. Nothing has been pushed, tagged, or released on GitHub during this work.

- Workspace: `D:\VS_code\OpenCal`
- Current branch: `agent-birthdays` (pre-existing branch; do not assume it is a dedicated size-reduction branch).
- Size-reduction commit: `5d9e70d9397092e6c030d9b320c249205cba5565` — `Reduce Android release size and add ARM64 preview builds`.
- Parent: `8a9373a`, which contains separate MCP birthday-tool work. Review branch ancestry before proposing publication or merging.
- Version: **1.5.1**, Android versionCode **10501**, runtime policy remains **appVersion**.

## Changes in the commit

1. Added SDK-compatible `expo-build-properties` `~57.0.22` using Expo's installer.
2. Enabled `enableMinifyInReleaseBuilds` and `enableShrinkResourcesInReleaseBuilds` in `app.json`.
3. Added EAS profile `preview-arm64`, extending `preview`, with Gradle command `:app:assembleRelease -PreactNativeArchitectures=arm64-v8a`.
4. Kept `preview` as the universal APK profile and `production` as the existing AAB profile. F-Droid retains the default architecture list.
5. Bumped `app.json`, `package.json`, and lockfile to 1.5.1; added `metadata/android/en-US/changelogs/10501.txt`.
6. Updated README build instructions.
7. Added `.easignore`, preserving `.gitignore` exclusions and excluding QA reports, server files, promo tooling, scripts, metadata, and local build output from EAS uploads. Inspected the archive: required app/native-module sources remain; excluded folders contain no files. Upload was approximately 1.7 MB.

No font-import or Chrono locale optimization was implemented. Those were identified as possible later improvements.

## Signed ARM64 artifact

- [EAS build](https://expo.dev/accounts/boazcohen/projects/opencal/builds/52e1f888-9e68-4de3-9cec-03411652954f): **FINISHED**.
- Build ID: `52e1f888-9e68-4de3-9cec-03411652954f`.
- [Download APK](https://expo.dev/artifacts/eas/3pO97Ha3-7bF5q2fpyYGPwtREQ-_B9d7asoyx5jeAMo.apk).
- Local copy: `D:\VS_code\OpenCal\.expo\OpenCal-1.5.1-arm64.apk`.
- Size: **33,358,717 bytes / 31.81 MiB**.
- Published 1.5.0 universal APK: **99,019,813 bytes / 94.43 MiB**. The new ARM64 artifact is **66.3% smaller**. This compares different versions and architecture coverage; it does not isolate R8's contribution.
- SHA-256: `609676cc410bd9660adf5e38394356fa7cb379f16d47b373530ccf588c9cc5e6`.
- Package: `com.boazcohen.opencal.ota`; channel/environment: `preview`; version/runtime: `1.5.1`; versionCode: `10501`.
- Existing remote EAS keystore was reused with `--freeze-credentials`.
- Signing certificate SHA-256 matches the published 1.5.0 APK: `27bd27026be2bd68137b40d5adcf4d35891cab9b9e2b7af30f4e43e58277e860`.
- Verified package/version, ARM64-only libraries, three widget fonts, four widget receivers, reminder receiver, and boot receiver in the final signed APK.
- **A signed universal 1.5.1 APK has not been built.** The universal profile is available; do not claim both downloadable artifacts exist.

## Validation and emulator findings

Lint and typecheck passed. Local ARM64 and x86_64 release builds passed, including R8/resource shrinking. Clean native generation confirmed shrinking, version metadata, and the default universal architecture list. F-Droid public config preserved its clean application ID and absence of OTA/runtime settings.

The signed ARM64 APK installed on the Android 15 x86_64 Pixel emulator but crashed before JavaScript under ARM translation. SoLoader searched `base.apk!/lib/x86_64` for `libreactnative.so`. This is a translation compatibility failure; it does not establish whether the signed APK works on native ARM64 hardware.

To test shrinking without translation, built a native x86_64 release from the same app source/dependencies under isolated package `com.boazcohen.opencal.smoketest`, with local debug signing. Existing `com.boazcohen.opencal` data was preserved. Passed:

- Cold launch without Metro; save and cold-restart persistence.
- Quick Add parsing, event review/save, and SQLite storage.
- Day, Week, Month, and Schedule views displaying the synthetic event.
- Schedule home-screen widget rendering the saved event, fonts, and icons.
- Exact event reminder queued in AlarmManager.
- Built-in three-second test notification delivered through AlarmManager and visible in the notification shade.
- No runtime crash in the native x86_64 test app during these checks.

Limitations:

- Widget event tap opened Android's chooser because installed variants share `opencal://`. Do not mark widget event navigation as passed.
- Only Schedule widget was exercised interactively; the other widget providers were checked statically.
- Audio was disabled; audible notification playback was not verified.
- Local test build had no EAS channel and logged an expected update-check failure; OTA delivery was not tested.
- Windows PowerShell's default input encoding garbled an apostrophe in the isolated test configuration's native widget description. Production `app.json` and JS files were not changed by this test setup. Use explicit UTF-8 when reading/writing JSON in follow-up scripts.
- Expo's dependency check flagged six pre-existing SDK patch-version advisories; no unrelated SDK upgrades were made.

## Local test assets and environment

Everything below is ignored under `.expo/`; it will not survive a fresh clone:

- `emulator-smoke-report.md`: detailed smoke results and evidence inventory.
- `smoke-week.png`, `smoke-schedule.png`, `smoke-month.png`, `smoke-widget.png`, `smoke-notification.png`.
- `smoke-runtime.log`, `smoke-alarms.log`.
- `OpenCal-1.5.1-x86_64-smoketest.apk`: isolated test APK, **not** a production artifact.
- `verify-signed-apk.ps1`: static APK/signature checks against the published certificate.
- `eas-build-1.5.1-arm64-status.json`: completed build metadata.
- `size-native/build-arm64.log`, `size-native/build-emulator.log`: local release build logs.

**Do not use `.expo/size-native` for a production build:** its copied config now targets the smoke-test package and its latest APK is x86_64/debug-signed. The signed production ARM64 artifact is the separate file listed above.

Android SDK: `D:\Android\Sdk`; AVD home: `D:\Android\avd`; AVD: `pixel`; device: `emulator-5554`. Emulator was started headlessly with audio disabled. Recheck running state before continuing. Test event and Schedule widget remain in the isolated test app. Test app was granted notification permission.

## Remaining work

1. Install the signed ARM64 APK on an actual ARM64 phone over the existing OTA installation. Check launch, views, persistence, widget interaction, and reminder delivery. No physical phone check has been performed.
2. If shipping both downloads, build the signed universal 1.5.1 APK from the same intended source commit using `preview`, then verify its signature and metadata too.
3. Prepare release notes covering changes since v1.5.0, including previous OTA changes where relevant. Resolve how the current branch's unrelated parent work should reach the release branch.
4. Show the concrete artifacts/results and obtain approval before pushing, tagging, or creating the GitHub release, unless a new user instruction explicitly authorizes those actions. Release tag must target the commit actually built.
5. A new APK must be installed: OTA cannot shrink an existing native binary, and appVersion runtime isolation means 1.5.1 updates do not reach installed 1.5.0 builds.

## Follow-up commands (PowerShell 5.1)

```powershell
rtk npx eas-cli@latest build:view 52e1f888-9e68-4de3-9cec-03411652954f
rtk npx eas-cli@latest build -p android --profile preview
rtk npx eas-cli@latest build -p android --profile preview-arm64
rtk npm run lint
rtk npm run typecheck
```

Read live AGENTS.md and imported-memory instructions before continuing. Consult matching Expo SDK 57 documentation before Expo/EAS/React Native changes. Never hand-edit generated native folders. Keep OTA and F-Droid variants compatible; no proprietary dependencies. The user authorized emulator checks in this conversation; that does not grant general desktop automation or publication permission.

## Unrelated working files to preserve

At handoff creation, these files were already untracked and were not part of the size-reduction commit:

- `docs/QA-REPORT-EMULATOR-RAPID.md`
- `docs/QA-REPORT.md`
- `docs/fdroid/RESUBMIT.md`
- `docs/fdroid/com.boazcohen.opencal.v2.yml`

This handoff is newly written and has not been committed or published.
