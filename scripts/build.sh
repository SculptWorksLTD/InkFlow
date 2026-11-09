#!/usr/bin/env bash
# Prepara la cartella _site da pubblicare, con una versione nuova a ogni pubblicazione:
# la versione cambia il service worker e le app installate si aggiornano da sole.
# Usato da Cloudflare Pages (comando di build: bash scripts/build.sh, cartella: _site).
set -euo pipefail
cd "$(dirname "$0")/.."

SHA="${CF_PAGES_COMMIT_SHA:-${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo local)}}"
V="$(date -u +%Y.%m.%d)-${SHA:0:7}"

rm -rf _site
mkdir _site
cp -r index.html richiesta.html manifest.webmanifest sw.js css js icons _site/
[ -f _headers ] && cp _headers _site/

sed -i "s/const VERSION = 'dev';/const VERSION = '$V';/" _site/sw.js
sed -i "s/export const VERSION = 'dev';/export const VERSION = '$V';/" _site/js/version.js
grep -q "$V" _site/sw.js
grep -q "$V" _site/js/version.js
echo "Versione $V pronta in _site"
