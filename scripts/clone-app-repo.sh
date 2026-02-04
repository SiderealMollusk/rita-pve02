#!/bin/bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <repo-url> [branch-or-tag]"
  exit 1
fi

REPO_URL="$1"
BRANCH="${2:-}"
DOWNLOADS_DIR="$(dirname "$0")/../downloads"
REPO_NAME=$(basename -s .git "$REPO_URL")
TARGET_DIR="$DOWNLOADS_DIR/$REPO_NAME"

if [ -d "$TARGET_DIR" ]; then
  echo "Removing existing directory: $TARGET_DIR"
  rm -rf "$TARGET_DIR"
fi

echo "Cloning $REPO_URL into $TARGET_DIR..."
if [ -n "$BRANCH" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$TARGET_DIR"
else
  git clone "$REPO_URL" "$TARGET_DIR"
fi

echo "Done. Repo is in $TARGET_DIR"
