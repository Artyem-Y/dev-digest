#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
for candidate in "${DEPENDENCIES_CHECKER_NODE:-}" "$(command -v node 2>/dev/null || true)" /usr/local/opt/node/bin/node /Users/*/.nvm/versions/node/*/bin/node; do
  test -n "$candidate" && test -x "$candidate" || continue
  version=$($candidate --version 2>/dev/null || true)
  major=${version#v}
  major=${major%%.*}
  case "$major" in
    ''|*[!0-9]*) continue ;;
  esac
  if test "$major" -ge 16; then
    exec "$candidate" "$script_dir/analyze-dependencies.mjs" "$@"
  fi
done

echo "dependencies-checker requires an already-installed Node.js 16+ runtime" >&2
exit 1
