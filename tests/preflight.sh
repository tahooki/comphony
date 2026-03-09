#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILURES=0

check_file() {
  local path="$1"
  if [[ -f "${ROOT_DIR}/${path}" ]]; then
    echo "OK   file ${path}"
  else
    echo "FAIL missing file ${path}"
    FAILURES=$((FAILURES + 1))
  fi
}

check_dir() {
  local path="$1"
  if [[ -d "${ROOT_DIR}/${path}" ]]; then
    echo "OK   dir  ${path}"
  else
    echo "FAIL missing dir ${path}"
    FAILURES=$((FAILURES + 1))
  fi
}

check_ignore_rule() {
  local pattern="$1"
  if grep -qxF "${pattern}" "${ROOT_DIR}/.gitignore"; then
    echo "OK   ignore ${pattern}"
  else
    echo "FAIL missing ignore rule ${pattern}"
    FAILURES=$((FAILURES + 1))
  fi
}

check_file "README.md"
check_file "AGENTS.md"
check_file "MISSION.template.md"
check_file "company.yaml"
check_file "package.json"
check_file "tsconfig.json"
check_file ".gitignore"
check_file ".env.example"
check_file "docs/START_WITH_CODEX.md"
check_file "docs/LOCAL_LAYOUT.md"
check_file "scripts/init-local-setup.sh"
check_file "scripts/reset-local-state.sh"
check_file "tests/validate-setup.sh"
check_file "tests/README.md"
check_file "src/cli.ts"
check_file "src/config.ts"
check_file "src/server.ts"
check_file "src/state.ts"
check_file "agents/desk_coordinator/agent.yaml"
check_file "agents/product_dev_01/agent.yaml"
check_file "agents/design_planner_01/agent.yaml"
check_file "agents/frontend_publisher_01/agent.yaml"

check_dir "agents"
check_dir "repos"
check_dir "runtime-data"
check_dir "workspaces"
check_dir "workflows"
check_dir "docs"
check_dir "scripts"
check_dir "tests"

check_ignore_rule ".env"
check_ignore_rule "MISSION.md"
check_ignore_rule "repos/*"
check_ignore_rule "runtime-data/*"
check_ignore_rule "workspaces/*"
check_ignore_rule "workflows/*"
check_ignore_rule "node_modules/"
check_ignore_rule "dist/"

if [[ "${FAILURES}" -gt 0 ]]; then
  echo
  echo "Preflight failed with ${FAILURES} problem(s)." >&2
  exit 1
fi

echo
echo "Preflight passed."
