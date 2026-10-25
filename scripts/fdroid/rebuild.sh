#!/bin/sh
# Fresh clone of a tag, then one F-Droid build. Usage: ./rebuild.sh [tag]
cd "$(dirname "$0")" || exit 1
rm -rf build/com.boazcohen.opencal
git clone -q --branch "${1:-v1.5.0}" https://github.com/BoazCohenJ/OpenCal.git build/com.boazcohen.opencal || exit 1
docker compose --profile build run --rm build > build.log 2>&1
echo "exit=$?" >> build.log
tail -1 build.log
