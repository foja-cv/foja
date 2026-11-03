#!/bin/sh
# Runs inside the test container (scripts/e2e.sh): starts a headless Chromium on the container's own loopback, waits
# for it and for the site, then hands over to Playwright.
set -eu
chromium-browser --headless=new --no-sandbox --remote-debugging-address=127.0.0.1 --remote-debugging-port=9223 \
    --user-data-dir=/tmp/profile --no-first-run --no-default-browser-check about:blank >/dev/null 2>&1 &
for _ in $(seq 60); do wget -qO /dev/null http://127.0.0.1:9223/json/version 2>/dev/null && break; sleep 0.5; done
site=${PWA_URL:-$BASE_URL}
for _ in $(seq 60); do wget -qO /dev/null "$site" 2>/dev/null && break; sleep 0.5; done
exec npx playwright test --output=/tmp/test-results "$@"
