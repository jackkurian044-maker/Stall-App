#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "src/Header.jsx" ]; then
  echo "Run this from your repo root (couldn't find src/Header.jsx here)."
  exit 1
fi

cp src/Header.jsx src/Header.jsx.bak
echo "Backed up src/Header.jsx -> src/Header.jsx.bak"

python3 - << 'PYEOF'
import re

with open("src/Header.jsx", "r") as f:
    content = f.read()

content = content.replace(
    'export default function Header({ mode, setMode, user, isAdmin, onSignOut }) {',
    'export default function Header({ mode, setMode, user, isAdmin, isAgent, onSignOut }) {'
)

content = content.replace(
    '''    ...(isAdmin ? [{ id: "bulk", label: "Discover Nearby" }] : []),
    ...(user ? [] : [{ id: "auth", label: "Sign in" }]),''',
    '''    ...(isAdmin ? [{ id: "bulk", label: "Discover Nearby" }] : []),
    ...(isAdmin ? [{ id: "agents", label: "Agents" }] : []),
    ...(isAgent ? [{ id: "agent", label: "My Dashboard" }] : []),
    ...(user ? [] : [{ id: "auth", label: "Sign in" }]),'''
)

with open("src/Header.jsx", "w") as f:
    f.write(content)

print("Patched src/Header.jsx")
PYEOF

echo ""
echo "Diff:"
diff src/Header.jsx.bak src/Header.jsx || true
