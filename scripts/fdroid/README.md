# Local F-Droid build check

Runs `fdroid build` for the recipe in `docs/fdroid/` inside F-Droid's own buildserver image, so a
recipe can be tested before it goes to fdroiddata. It runs on the home server in `~/fdroid/`
(Docker, Linux needed); nothing here is part of the app.

Set up once on the server:

```bash
mkdir -p ~/fdroid/metadata ~/fdroid/srclibs ~/fdroid/build ~/fdroid/tmp ~/fdroid/unsigned
cp scripts/fdroid/{Dockerfile,docker-compose.yml,config.yml,rebuild.sh} ~/fdroid/
cp -r scripts/fdroid/config ~/fdroid/
cp docs/fdroid/com.boazcohen.opencal.yml ~/fdroid/metadata/
cp docs/fdroid/hermes.srclib.yml ~/fdroid/srclibs/hermes.yml
cd ~/fdroid && docker compose --profile build build
```

Then `~/fdroid/rebuild.sh [tag]` clones the tag fresh and builds (about 20 minutes). The log is
`~/fdroid/build.log` and the APK lands in `~/fdroid/unsigned/`. Lint the recipe with
`docker run --rm -v "$PWD":/repo opencal-fdroid-build fdroid lint com.boazcohen.opencal`.

Notes from getting it to build: `--on-server` is needed so the NDK is installed, which means the
source must be cloned beforehand (rebuild.sh does that); use `gradle`, not `./gradlew`, because the
scanner removes the wrapper jar; `config/categories.yml` only exists so `fdroid lint` accepts the
`Time` category, which fdroiddata already defines.

## Self-hosted repo

`publish.sh` signs the APK from `unsigned/` with the repo key (`keystore.p12`, created once with
`fdroid update --create-key`; its passwords live only in the server's `config.yml`), rebuilds the index and
copies `repo/` to `~/caddy/www/fdroid`. Caddy serves it on the tailnet at
`https://gigaserver.taila02557.ts.net:2293/repo`; add that URL (or scan its QR code from `index.html`) in
F-Droid's repository settings. Back up `keystore.p12` and `config.yml`: losing the key means every user has to
reinstall. The repo signing key is not the app's: F-Droid's own signing would replace it on the official repo.
