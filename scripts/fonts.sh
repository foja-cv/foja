#!/usr/bin/env bash
# Copy the fonts the template uses into the web app. Until their licences are checked they are
# not committed (see docs/plan.md, phase 0): this takes them from a local TeX distribution.
#   scripts/fonts.sh [dir containing XCharter-*.otf and lmmono9-regular.otf]
set -euo pipefail
src=${1:-$(dirname "$(find "$HOME/.cache/tectonic" /usr/share/texmf-dist -name XCharter-Roman.otf -print -quit 2>/dev/null)")}
dest=$(dirname "$0")/../apps/web/public/fonts
mkdir -p "$dest"
for f in XCharter-Roman XCharter-Bold XCharter-Italic XCharter-BoldItalic lmmono9-regular; do
    cp "$src/$f.otf" "$dest/"
done
echo "fonts copied to $dest"
