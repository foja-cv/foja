#!/usr/bin/env bash
# End-to-end tests: Playwright in the node container drives the Chrome installed on the host over
# the DevTools protocol (no browser download). Chrome listens on 127.0.0.1 only and uses a
# throw-away profile. Needs the dev stack: `docker compose up`.
#   scripts/e2e.sh [playwright args]
set -euo pipefail
cd "$(dirname "$0")/.."
chrome=${CHROME:-$(command -v google-chrome-stable || command -v google-chrome || command -v google-chrome-unstable || command -v chromium)}
port=${CDP_PORT:-9223}
profile=$(mktemp -d)
"$chrome" --headless=new --remote-debugging-address=127.0.0.1 --remote-debugging-port="$port" \
    --user-data-dir="$profile" --no-first-run --no-default-browser-check about:blank >/dev/null 2>&1 &
chrome_pid=$!
cleanup() {
    kill "$chrome_pid" 2>/dev/null || true
    wait "$chrome_pid" 2>/dev/null || true
    sleep 1 # Chrome's helpers can still be writing to the profile
    rm -rf "$profile" 2>/dev/null || true
}
trap cleanup EXIT
for _ in $(seq 50); do curl -sf "http://127.0.0.1:$port/json/version" >/dev/null && break; sleep 0.2; done
# The repository is mounted at the same path inside the container and Playwright's temporary
# files live in it: Chrome (on the host) saves downloads where Playwright (in the container)
# then reads them.
mkdir -p .out/playwright-tmp
docker run --rm --network host -u "$(id -u):$(id -g)" -v "$PWD":"$PWD" -w "$PWD" \
    -e TMPDIR="$PWD/.out/playwright-tmp" -e npm_config_cache=/tmp/npm \
    -e CDP_URL="http://127.0.0.1:$port" -e BASE_URL="${BASE_URL:-http://127.0.0.1:8090}" -e PWA_URL="${PWA_URL:-}" \
    node:24-alpine npx playwright test "$@"
