This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

This app uses **React Navigation** (native stack), not Expo Router. Don't migrate it or create `src/app/` routes.

- One stack navigator in `App.tsx` (`RootNavigator`). Pushed screens slide in from the right; editors (`EventEdit`, `QuickAdd`, `FocusEdit`, `Stamp`) live in a `presentation: 'modal'` group.
- Screens live in `src/screens/`, calendar views (schedule/day/week/month) in `src/views/`, shared UI in `src/components/`.
- Every route and its params are typed in `src/navigation/types.ts` (`RootStackParamList`). To add a screen: add it there, register it in `App.tsx`, and type the component as `ScreenProps<'Name'>`.
- Navigate with `navigation.navigate` / `push` / `goBack` / `popToTop` from the screen's props. Header buttons are set with `navigation.setOptions` in `useLayoutEffect`.
- Docs: https://reactnavigation.org/docs/native-stack-navigator

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Releases and over-the-air updates (how this project ships)

The phone runs an installed **preview** APK (`eas.json` → `preview` profile, channel `preview`, package `com.boazcohen.opencal`). Pushing to `main` updates it over the air:

- `.github/workflows/eas-update.yml` runs on every push to `main` (Markdown and `.claude/` changes are ignored): `npm ci` → `tsc --noEmit` → `expo lint` → `eas update --channel preview --environment preview --platform android`. A failing typecheck or lint blocks the update. It needs the `EXPO_TOKEN` repository secret and skips with a notice without it.
- The app checks for updates on launch and when it returns to the foreground (`src/components/UpdateWatcher.tsx`), downloads them, and offers a **Restart** toast.
- `--environment` is required by `eas update` for Expo SDK 55+; keep it in any manual command.

**Runtime version rule (important):** `app.json` uses `"runtimeVersion": { "policy": "appVersion" }`, so an update only reaches builds whose `version` matches. JS/asset-only changes (screens, logic, styles, images bundled by JS) ship automatically. Anything native does **not**:

- adding/upgrading a package with native code (check with `npx expo install` output or the package docs),
- changing native config in `app.json` (permissions, icons, splash, package id, plugins),
- upgrading the Expo SDK.

For those, in the same change: bump `version` in `app.json` (e.g. `1.0.0` → `1.1.0`), commit, then build and reinstall: `npx eas-cli@latest build -p android --profile preview`. Never ship JS that depends on new native code to an old version, since it would crash on the installed build.

App icon, Android adaptive/monochrome icons, splash image and favicon are all rendered from one geometry by `scripts/make-logo.js` (see its header for usage); the in-app `src/components/Logo.tsx` mirrors it. Regenerating them is a native change (version bump + rebuild).

### Keeping the GitHub page up to date

- **README.md:** when a change adds, removes or noticeably changes a user-facing feature, update the Features list (and screenshots in `docs/screenshots/` if a shown screen changed) in the same change. Keep the Development, Tech stack and Project structure sections accurate when tooling or folders change.
- **Releases (the APK "packages"):** every new build (i.e. every `version` bump) gets a GitHub Release named `vX.Y.Z` on the commit that was built, with the APK attached and short notes of what changed since the previous release:
  ```bash
  npx eas-cli@latest build -p android --profile preview          # wait for FINISHED, copy the .apk URL
  curl -L -o OpenCal-X.Y.Z.apk "<apk url from the build>"
  gh release create vX.Y.Z OpenCal-X.Y.Z.apk --target <built commit sha> --title "OpenCal X.Y.Z" --notes "<what changed>"
  ```
  Over-the-air-only changes don't get their own release; list them in the notes of the next release.

`fingerprint` was deliberately not used: Windows checkouts convert line endings (CRLF) while CI checks out LF, which can make fingerprints differ between builds and updates so updates would never apply.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md