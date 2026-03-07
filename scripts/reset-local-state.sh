#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WITH_REPOS=0
WITH_ENV=0
CONFIRMED=0

usage() {
  cat <<'EOF'
Usage:
  ./scripts/reset-local-state.sh --confirm [--with-repos] [--with-env]

Default behavior removes:
  - MISSION.md
  - contents of workspaces/
  - contents of workflows/
  - tmp/ and *.log under the repo root

Optional flags:
  --with-repos   also remove contents of repos/
  --with-env     also remove .env
  --confirm      required safety flag
EOF
}

for arg in "$@"; do
  case "$arg" in
    --with-repos) WITH_REPOS=1 ;;
    --with-env) WITH_ENV=1 ;;
    --confirm) CONFIRMED=1 ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$CONFIRMED" -ne 1 ]]; then
  echo "Refusing to reset without --confirm" >&2
  usage >&2
  exit 1
fi

find "${ROOT_DIR}/workspaces" -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} +
find "${ROOT_DIR}/workflows" -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} +

if [[ -f "${ROOT_DIR}/MISSION.md" ]]; then
  rm -f "${ROOT_DIR}/MISSION.md"
fi

if [[ -d "${ROOT_DIR}/tmp" ]]; then
  rm -rf "${ROOT_DIR}/tmp"
fi

find "${ROOT_DIR}" -maxdepth 1 -type f -name '*.log' -delete

if [[ "$WITH_REPOS" -eq 1 ]]; then
  find "${ROOT_DIR}/repos" -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} +
fi

if [[ "$WITH_ENV" -eq 1 && -f "${ROOT_DIR}/.env" ]]; then
  rm -f "${ROOT_DIR}/.env"
fi

echo "Local Comphony state reset complete."
