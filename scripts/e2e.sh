#!/usr/bin/env bash
# End-to-end tests: Playwright and a headless Chromium run together in one container that shares the network of the
# dev stack's nginx, so the site is http://127.0.0.1 and nothing on the host is reachable from the container.
# Needs the dev stack: `podman compose up`.
#   scripts/e2e.sh [playwright args]
#   E2E_NETWORK=container:<name> PWA_URL=… scripts/e2e.sh …   (another server, as scripts/e2e-pwa.sh does)
set -euo pipefail
cd "$(dirname "$0")/.."
podman build -q -t foja-e2e tests/e2e >/dev/null
podman run --rm --network "${E2E_NETWORK:-container:foja_nginx_1}" -u 1000:1000 \
    -v "$PWD":/app:ro -v foja_node_modules:/app/node_modules -v foja_web_node_modules:/app/apps/web/node_modules -w /app \
    -e HOME=/tmp -e npm_config_cache=/tmp/npm -e CDP_URL=http://127.0.0.1:9223 \
    -e BASE_URL="${BASE_URL:-http://127.0.0.1}" -e PWA_URL="${PWA_URL:-}" \
    foja-e2e sh tests/e2e/run-in-container.sh "$@"
