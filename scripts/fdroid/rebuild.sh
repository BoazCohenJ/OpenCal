#!/bin/sh
# Fresh clone of a tag, then one F-Droid build. Usage: ./rebuild.sh [tag]
cd "$(dirname "$0")" || exit 1
rm -rf build/com.boazcohen.opencal
git clone -q --branch "${1:-v1.5.0}" https://github.com/BoazCohenJ/OpenCal.git build/com.boazcohen.opencal || exit 1
# srclibs are not fetched in --on-server mode, so clone them first (kept between runs).
[ -d build/srclib/hermes ] || {
  mkdir -p build/srclib
  git clone -q --depth 1 --branch hermes-v250829098.0.17 https://github.com/facebook/hermes.git build/srclib/hermes || exit 1
}
docker compose --profile build run --rm build > build.log 2>&1
build_status=$?
echo "exit=$build_status" >> build.log
tail -1 build.log
exit "$build_status"
