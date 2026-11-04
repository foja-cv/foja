#!/usr/bin/env bash
# The production build as GitHub Pages serves it (under /foja/), checked offline: builds the site into a volume,
# serves it with `astro preview` in a container and runs the PWA tests from that container's network.
set -euo pipefail
cd "$(dirname "$0")/.."
vols=(-v "$PWD":/app:ro -v foja_node_modules:/app/node_modules -v foja_web_node_modules:/app/apps/web/node_modules
      -v foja_pwa_dist:/app/apps/web/dist:U --tmpfs /app/apps/web/.astro:mode=1777,notmpcopyup)
env=(-e HOME=/tmp -e FOJA_BASE=/foja -e FOJA_VITE_CACHE=/app/node_modules/.vite-build -e npm_config_cache=/tmp/npm)
podman run --rm -u 1000:1000 "${vols[@]}" "${env[@]}" -w /app docker.io/library/node:24-alpine npm run build -w apps/web
name=foja-preview-$$
podman run -d --rm --name "$name" -u 1000:1000 "${vols[@]}" "${env[@]}" -w /app/apps/web \
    docker.io/library/node:24-alpine npx astro preview --host 127.0.0.1 --port 4400 --force >/dev/null
trap 'podman stop "$name" >/dev/null 2>&1 || true' EXIT
E2E_NETWORK="container:$name" PWA_URL=http://127.0.0.1:4400/foja/ scripts/e2e.sh tests/e2e/pwa.spec.ts "$@"
