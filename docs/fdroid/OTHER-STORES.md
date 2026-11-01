# Other stores: Obtainium and Accrescent

Channels used while the F-Droid resubmission waits (see `RESUBMIT.md`). Checked 2026-11-01.

## State (2026-11-01)

The v1.5.1 GitHub release carries `OpenCal-1.5.1-fdroid-arm64.apk` (`com.boazcohen.opencal`, no `expo-updates`, 31.8 MB),
signed with a release key kept in `C:\Users\admin\OpenCal-signing\`. That key is permanent for this app id, so keep it
backed up. Not yet tested on a real ARM64 phone. Each later release must attach a matching `-fdroid` APK.

## IzzyOnDroid (decided against, 2026-11-01)

Its policy is "strongly opposed to apps which are fully or in part created by generative AI tools" and wants the code
free of AI output. OpenCal is largely written with Claude Code, so it would not qualify. Not worth filing.

## Obtainium

No submission. Users add `https://github.com/BoazCohenJ/OpenCal` in Obtainium and it follows the GitHub releases.
The README has the instructions: set the APK filter to `fdroid` so Obtainium skips the OTA APK.

## Accrescent

Requirements: https://accrescent.app/docs/guide/appendix/requirements/. It does not require open source, but it does
require an APK set signed with scheme v2 or later (no debug key, one certificate), a target SDK that meets Google
Play's, no self-updater, and manual review of sensitive permissions. Sign up for the Developer Console, then follow
"Submitting a new app". The `fdroid` variant should qualify; its signing key follows the same permanence rule as above.
