#!/usr/bin/env bash
# Applies the "My Listings" tab patch to AgentDashboard.jsx
#
# Usage:
#   ./apply-my-listings.sh path/to/AgentDashboard.jsx
#
# Example:
#   ./apply-my-listings.sh src/components/AgentDashboard.jsx

set -euo pipefail

TARGET="${1:-}"
PATCH_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/AgentDashboard.jsx.patch"

if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 path/to/AgentDashboard.jsx"
  exit 1
fi

if [[ ! -f "$TARGET" ]]; then
  echo "File not found: $TARGET"
  exit 1
fi

if [[ ! -f "$PATCH_FILE" ]]; then
  echo "Patch file not found next to this script: $PATCH_FILE"
  exit 1
fi

# Back up the original first
cp "$TARGET" "$TARGET.bak"
echo "Backed up original to $TARGET.bak"

# Try git apply first (works even outside a git repo with --unsafe-paths),
# fall back to classic `patch` if git isn't available.
if command -v git >/dev/null 2>&1; then
  if git apply --unsafe-paths --directory="$(dirname "$TARGET")" \
      -p1 --include="*AgentDashboard.jsx" "$PATCH_FILE" 2>/tmp/git-apply-err; then
    echo "Patch applied successfully via git apply."
    exit 0
  else
    echo "git apply failed, trying 'patch' instead..."
    cat /tmp/git-apply-err
  fi
fi

if command -v patch >/dev/null 2>&1; then
  patch -p1 "$TARGET" < "$PATCH_FILE" && {
    echo "Patch applied successfully via patch."
    exit 0
  }
fi

echo "Automatic patch failed — your file's content likely diverged from what the patch expects."
echo "Restoring backup and exiting. You can apply the changes manually, or paste your current"
echo "AgentDashboard.jsx back to me and I'll regenerate a matching patch."
cp "$TARGET.bak" "$TARGET"
exit 1
