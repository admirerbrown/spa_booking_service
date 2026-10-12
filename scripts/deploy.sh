#!/usr/bin/env bash
# Verifies the build, then publishes dist/ to the gh-pages branch.
# Usage: ./scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Building and checking (GitHub Pages base path)..."
GITHUB_ACTIONS=true ./scripts/check-build.sh

# GitHub Pages serves 404.html for unknown paths, so this lets a refresh on
# /treatments/... load the app instead of a 404 page.
cp dist/index.html dist/404.html
echo "Added dist/404.html"

echo "Publishing to gh-pages..."
npx gh-pages -d dist

echo
echo "Deployed. Pages can take a minute or two to update, then hard refresh (Ctrl+Shift+R)."
