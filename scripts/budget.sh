#!/usr/bin/env bash
set -euo pipefail

cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

files() {
  git ls-files --cached --others --exclude-standard -- "$@" || true
}

count() {
  local n=0 f c
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    c=$(grep -cv '^[[:space:]]*$' "$f") || c=0
    n=$((n + c))
  done
  echo "$n"
}

fail=0
printf "%-40s %10s %10s\n" "Measure" "Actual" "Budget"
printf "%-40s %10s %10s\n" "-------" "------" "------"

fe=$(files 'src/' | { grep -E '\.(ts|tsx)$' || true; } | { grep -v '\.test\.' || true; } | { grep -v '\.gen\.ts$' || true; } | count)
fe_test=$(files 'src/' | { grep -E '\.test\.(ts|tsx)$' || true; } | count)

row() { printf "%-40s %10s %10s %s\n" "$1" "$2" "$3" "$4"; }
mark() { if [ "$1" -gt "$2" ]; then fail=1; echo "OVER"; fi; }

row "Frontend code (lines)" "$fe" "6000" "$(mark "$fe" 6000)"
row "Frontend tests (lines)" "$fe_test" "-" ""

if [ "$fail" -ne 0 ]; then
  echo "A budget is exceeded." >&2
  exit 1
fi
