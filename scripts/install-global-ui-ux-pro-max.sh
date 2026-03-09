#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_SKILL_DIR="${ROOT_DIR}/.codex/skills/ui-ux-pro-max"
GLOBAL_CODEX_HOME="${CODEX_HOME:-${HOME}/.codex}"
GLOBAL_SKILLS_DIR="${GLOBAL_CODEX_HOME}/skills"
DEST_SKILL_DIR="${GLOBAL_SKILLS_DIR}/ui-ux-pro-max"
FORCE=0
COPY_MODE=0

usage() {
  cat <<'EOF'
Usage:
  ./scripts/install-global-ui-ux-pro-max.sh [--force] [--copy]

Registers this repository's ui-ux-pro-max skill in the global Codex skills directory.

Options:
  --force  Replace an existing global ui-ux-pro-max entry
  --copy   Copy files instead of creating a symlink
EOF
}

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --copy) COPY_MODE=1 ;;
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

if [[ ! -d "${SOURCE_SKILL_DIR}" ]]; then
  echo "Source skill directory not found: ${SOURCE_SKILL_DIR}" >&2
  exit 1
fi

mkdir -p "${GLOBAL_SKILLS_DIR}"

if [[ -L "${DEST_SKILL_DIR}" ]]; then
  current_target="$(readlink "${DEST_SKILL_DIR}")"
  if [[ "${current_target}" == "${SOURCE_SKILL_DIR}" ]]; then
    echo "Global skill is already linked:"
    echo "  ${DEST_SKILL_DIR} -> ${SOURCE_SKILL_DIR}"
    if command -v uipro >/dev/null 2>&1; then
      echo "uipro CLI: $(command -v uipro)"
    fi
    echo "Restart Codex to pick up newly added global skills if it is already running."
    exit 0
  fi
fi

if [[ -e "${DEST_SKILL_DIR}" ]]; then
  if [[ "${FORCE}" -ne 1 ]]; then
    echo "Global skill path already exists: ${DEST_SKILL_DIR}" >&2
    echo "Re-run with --force to replace it." >&2
    exit 1
  fi
  rm -rf "${DEST_SKILL_DIR}"
fi

if [[ "${COPY_MODE}" -eq 1 ]]; then
  cp -R "${SOURCE_SKILL_DIR}" "${DEST_SKILL_DIR}"
  echo "Copied ui-ux-pro-max into global Codex skills:"
else
  ln -s "${SOURCE_SKILL_DIR}" "${DEST_SKILL_DIR}"
  echo "Linked ui-ux-pro-max into global Codex skills:"
fi

echo "  ${DEST_SKILL_DIR}"
echo "  source: ${SOURCE_SKILL_DIR}"

if command -v uipro >/dev/null 2>&1; then
  echo "uipro CLI: $(command -v uipro)"
else
  echo "uipro CLI was not found on PATH."
fi

echo "Restart Codex to pick up newly added global skills."
