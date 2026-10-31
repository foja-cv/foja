#!/usr/bin/env bash
# The production build as GitHub Pages serves it (under /foja/), checked offline: builds the site,
# serves it with `astro preview` in the node container (127.0.0.1:4400) and runs the PWA tests.
set -euo pipefail
cd "$(dirname "$0")/.."
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/app -w /app -e FOJA_BASE=/foja -e FOJA_VITE_CACHE=/app/node_modules/.vite-build -e npm_config_cache=/tmp/npm \
    node:24-alpine npm run build -w apps/web
name=foja-preview-$$
docker run -d --rm --name "$name" --network host -u "$(id -u):$(id -g)" -v "$PWD":/app -w /app/apps/web \
    -e FOJA_BASE=/foja -e FOJA_VITE_CACHE=/app/node_modules/.vite-build node:24-alpine npx astro preview --host 127.0.0.1 --port 4400 --force >/dev/null
trap 'docker stop "$name" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 60); do curl -sf http://127.0.0.1:4400/foja/ >/dev/null && break; sleep 0.5; done
PWA_URL=http://127.0.0.1:4400/foja/ scripts/e2e.sh tests/e2e/pwa.spec.ts "$@"
