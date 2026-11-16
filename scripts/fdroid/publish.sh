#!/bin/sh
# Sign the freshly built APK in ./unsigned, regenerate the F-Droid index and copy the repo into the
# directory the web server serves (https://your-server.example:2293/repo). Run after rebuild.sh.
cd "$(dirname "$0")" || exit 1
docker compose --profile build run --rm build sh -c "fdroid publish && fdroid update" || exit 1
rm -rf ~/caddy/www/fdroid/repo && mkdir -p ~/caddy/www/fdroid && cp -r repo ~/caddy/www/fdroid/ && rm -rf ~/caddy/www/fdroid/repo/status
