#!/usr/bin/env bash
# Applies the addedByAgentId attribution fix to App.jsx and VendorDashboard.jsx
#
# Usage (run from the folder containing both .jsx files):
#   ./apply-agent-attribution.sh
#
# Or point it at a specific src folder:
#   ./apply-agent-attribution.sh /workspaces/Stall-App/src

set -euo pipefail

TARGET_DIR="${1:-.}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APP_FILE="$TARGET_DIR/App.jsx"
VENDOR_FILE="$TARGET_DIR/VendorDashboard.jsx"
APP_PATCH="$SCRIPT_DIR/App.jsx.patch"
VENDOR_PATCH="$SCRIPT_DIR/VendorDashboard.jsx.patch"

for f in "$APP_FILE" "$VENDOR_FILE"; do
  if [[ ! -f "$f" ]]; then
    echo "File not found: $f"
    echo "Run this script from your src/ folder, or pass the folder as an argument."
    exit 1
  fi
done

cp "$APP_FILE" "$APP_FILE.bak"
cp "$VENDOR_FILE" "$VENDOR_FILE.bak"
echo "Backed up:"
echo "  $APP_FILE.bak"
echo "  $VENDOR_FILE.bak"

apply_one() {
  local target="$1" patch="$2"
  if command -v git >/dev/null 2>&1; then
    if git apply --unsafe-paths --directory="$(dirname "$target")" \
        -p1 --include="*$(basename "$target")" "$patch" 2>/tmp/git-apply-err; then
      echo "$(basename "$target"): patched via git apply."
      return 0
    else
      echo "$(basename "$target"): git apply failed, trying 'patch'..."
      cat /tmp/git-apply-err
    fi
  fi
  if command -v patch >/dev/null 2>&1; then
    if patch -p1 "$target" < "$patch"; then
      echo "$(basename "$target"): patched via patch."
      return 0
    fi
  fi
  return 1
}

FAILED=0
apply_one "$APP_FILE" "$APP_PATCH" || FAILED=1
apply_one "$VENDOR_FILE" "$VENDOR_PATCH" || FAILED=1

if [[ "$FAILED" -eq 1 ]]; then
  echo ""
  echo "One or more patches failed to apply — your files likely differ from"
  echo "what these patches expect. Restoring both originals from backup."
  cp "$APP_FILE.bak" "$APP_FILE"
  cp "$VENDOR_FILE.bak" "$VENDOR_FILE"
  echo "Paste me your current App.jsx and VendorDashboard.jsx and I'll regenerate matching patches."
  exit 1
fi

echo ""
echo "Done. Both files patched successfully."
