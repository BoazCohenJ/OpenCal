# Local F-Droid build check

Runs `fdroid build` for the recipe in `docs/fdroid/` inside F-Droid's own buildserver image, so a
recipe can be tested before it goes to fdroiddata. It runs on the home server in `~/fdroid/`
(Docker, Linux needed); nothing here is part of the app.

Set up once on the server:

```bash
mkdir -p ~/fdroid/metadata ~/fdroid/build ~/fdroid/tmp ~/fdroid/unsigned
cp scripts/fdroid/{Dockerfile,docker-compose.yml,config.yml,rebuild.sh} ~/fdroid/
cp -r scripts/fdroid/config ~/fdroid/
cp docs/fdroid/com.boazcohen.opencal.yml ~/fdroid/metadata/
cd ~/fdroid && docker compose --profile build build
```

Then `~/fdroid/rebuild.sh [tag]` clones the tag fresh and builds (about 20 minutes). The log is
`~/fdroid/build.log` and the APK lands in `~/fdroid/unsigned/`. Lint the recipe with
`docker run --rm -v "$PWD":/repo opencal-fdroid-build fdroid lint com.boazcohen.opencal`.

Notes from getting it to build: `--on-server` is needed so the NDK is installed, which means the
source must be cloned beforehand (rebuild.sh does that); use `gradle`, not `./gradlew`, because the
scanner removes the wrapper jar; `config/categories.yml` only exists so `fdroid lint` accepts the
`Time` category, which fdroiddata already defines.
