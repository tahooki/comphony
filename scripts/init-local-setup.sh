#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p \
  "${ROOT_DIR}/repos" \
  "${ROOT_DIR}/workspaces" \
  "${ROOT_DIR}/workflows" \
  "${ROOT_DIR}/tests" \
  "${ROOT_DIR}/scripts"

if [[ ! -f "${ROOT_DIR}/.env" && -f "${ROOT_DIR}/.env.example" ]]; then
  cp "${ROOT_DIR}/.env.example" "${ROOT_DIR}/.env"
  echo "Created ${ROOT_DIR}/.env from .env.example"
fi

if [[ ! -f "${ROOT_DIR}/MISSION.md" && -f "${ROOT_DIR}/MISSION.template.md" ]]; then
  cp "${ROOT_DIR}/MISSION.template.md" "${ROOT_DIR}/MISSION.md"
  echo "Created ${ROOT_DIR}/MISSION.md from MISSION.template.md"
fi

echo "Local layout is ready:"
echo "  - ${ROOT_DIR}/repos"
echo "  - ${ROOT_DIR}/workspaces"
echo "  - ${ROOT_DIR}/workflows"
echo
echo "Next steps:"
echo "  1. Fill in ${ROOT_DIR}/.env"
echo "  2. Ask Codex to set up the current Comphony runtime foundation end-to-end"
echo "  3. Run ./tests/validate-setup.sh"
