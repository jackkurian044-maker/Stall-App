#!/usr/bin/env bash
set -euo pipefail

FILE="src/DiscoverNearby.jsx"   # adjust path if different in your repo

if [ ! -f "$FILE" ]; then
  echo "File not found: $FILE — update the FILE path and re-run."
  exit 1
fi

cp "$FILE" "$FILE.bak"

python3 - "$FILE" << 'PY'
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = '''<div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>
                  <span>Radius</span>
                  <span className="font-mono">{radiusKm} km</span>
                </div>'''

new = '''<div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5, color: COLORS.ink }}>
                  <span>Radius</span>
                  <span className="font-mono" style={{ color: COLORS.ink }}>{radiusKm} km</span>
                </div>'''

if old not in content:
    print("Exact block not found — whitespace/indentation may differ from expected. No changes made.")
    sys.exit(1)

content = content.replace(old, new)
with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Patched {path}. Backup saved as {path}.bak")
PY
