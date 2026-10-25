# Submitting OpenCal to F-Droid

1. Sign in at gitlab.com, fork https://gitlab.com/fdroid/fdroiddata and clone the fork (use `--depth 1`).
2. `cp docs/fdroid/com.boazcohen.opencal.yml <fork>/metadata/com.boazcohen.opencal.yml`
   (`srclibs/hermes.yml` already exists upstream; nothing else to add).
3. In the fork run `fdroid lint com.boazcohen.opencal` and `fdroid rewritemeta com.boazcohen.opencal`.
4. Commit as `New app: com.boazcohen.opencal`, push a branch and open a merge request using the
   "App inclusion" template. Suggested description:

   > OpenCal is a local-first calendar for Android (MIT, https://github.com/BoazCohenJ/OpenCal).
   > No tracking, no Google/Firebase services. Reminders use a local AlarmManager module.
   > The F-Droid build is a separate variant (`OPENCAL_VARIANT=fdroid`): clean application id,
   > no expo-updates (stubbed out and uninstalled in prebuild), Hermes compiler built from the
   > hermes srclib, Expo modules compiled from source, prebuilt npm binaries removed via scandelete.
   > Built and tested with `fdroid build --on-server` from the v1.5.0 tag.
   > Open question for reviewers: Node 22 and Temurin JDK 17 are fetched in `sudo` (checksummed)
   > because trixie's packages are too old / missing; happy to change if there is a preferred way.

5. Answer reviewer feedback; CI runs lint and a build.
