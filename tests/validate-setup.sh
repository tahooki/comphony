#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVE_CHECKS=0
FAILURES=0
WARNINGS=0

for arg in "$@"; do
  case "$arg" in
    --live) LIVE_CHECKS=1 ;;
    -h|--help)
      cat <<'EOF'
Usage:
  ./tests/validate-setup.sh [--live]

Checks local Comphony setup after Codex finishes configuration.

--live
  also check the Symphony dashboard URL and validate the Linear API key
  with a lightweight GraphQL request.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
else
  echo "FAIL missing .env"
  FAILURES=$((FAILURES + 1))
fi

COMPHONY_ROOT="${COMPHONY_ROOT:-${ROOT_DIR}}"
COMPHONY_REPO_ROOT="${COMPHONY_REPO_ROOT:-${COMPHONY_ROOT}/repos}"
COMPHONY_WORKSPACE_ROOT="${COMPHONY_WORKSPACE_ROOT:-${COMPHONY_ROOT}/workspaces}"
COMPHONY_WORKFLOW_ROOT="${COMPHONY_WORKFLOW_ROOT:-${COMPHONY_ROOT}/workflows}"
SYMPHONY_DASHBOARD_URL="${SYMPHONY_DASHBOARD_URL:-http://127.0.0.1:4000/}"

ok() {
  echo "OK   $1"
}

warn() {
  echo "WARN $1"
  WARNINGS=$((WARNINGS + 1))
}

fail() {
  echo "FAIL $1"
  FAILURES=$((FAILURES + 1))
}

check_path() {
  local label="$1"
  local path="$2"
  if [[ -e "$path" ]]; then
    ok "${label}: ${path}"
  else
    fail "${label}: ${path}"
  fi
}

check_nonempty_var() {
  local name="$1"
  local value="${!name:-}"
  if [[ -n "${value}" ]]; then
    ok "env ${name}"
  else
    fail "env ${name} is empty"
  fi
}

check_path "repo root" "${COMPHONY_REPO_ROOT}"
check_path "workspace root" "${COMPHONY_WORKSPACE_ROOT}"
check_path "workflow root" "${COMPHONY_WORKFLOW_ROOT}"
check_path "mission file" "${ROOT_DIR}/MISSION.md"
check_path "company config" "${ROOT_DIR}/company.yaml"
check_path "package manifest" "${ROOT_DIR}/package.json"

check_nonempty_var "LINEAR_API_KEY"

if [[ -d "${ROOT_DIR}/node_modules" ]]; then
  ok "node_modules present"
else
  warn "node_modules missing; run npm install"
fi

if npm run --silent validate:config >/dev/null 2>&1; then
  ok "npm run validate:config"
else
  fail "npm run validate:config"
fi

if [[ -n "${SYMPHONY_BIN:-}" ]]; then
  if [[ -x "${SYMPHONY_BIN}" ]]; then
    ok "SYMPHONY_BIN executable"
  else
    fail "SYMPHONY_BIN not executable: ${SYMPHONY_BIN}"
  fi
else
  warn "SYMPHONY_BIN is not set"
fi

workflow_files=()
while IFS= read -r workflow; do
  workflow_files+=("${workflow}")
done < <(find "${COMPHONY_WORKFLOW_ROOT}" -maxdepth 1 -type f -name '*.md' 2>/dev/null | sort)

if [[ "${#workflow_files[@]}" -eq 0 ]]; then
  fail "no runnable workflow files found in ${COMPHONY_WORKFLOW_ROOT}"
else
  ok "found ${#workflow_files[@]} workflow file(s)"
fi

for workflow in "${workflow_files[@]}"; do
  if grep -q '^tracker:' "${workflow}" && \
     grep -q '^workspace:' "${workflow}" && \
     grep -q '^hooks:' "${workflow}" && \
     grep -q '^codex:' "${workflow}"; then
    ok "workflow structure $(basename "${workflow}")"
  else
    fail "workflow missing required sections: $(basename "${workflow}")"
  fi
done

if [[ -d "${COMPHONY_REPO_ROOT}" ]]; then
  repo_count="$(find "${COMPHONY_REPO_ROOT}" -mindepth 1 -maxdepth 1 ! -name '.gitkeep' | wc -l | tr -d ' ')"
  if [[ "${repo_count}" -gt 0 ]]; then
    ok "repo root contains ${repo_count} item(s)"
  else
    warn "repo root is still empty"
  fi
fi

if [[ -d "${COMPHONY_WORKSPACE_ROOT}" ]]; then
  workspace_count="$(find "${COMPHONY_WORKSPACE_ROOT}" -mindepth 1 -maxdepth 2 ! -name '.gitkeep' | wc -l | tr -d ' ')"
  if [[ "${workspace_count}" -gt 0 ]]; then
    ok "workspace root contains generated state"
  else
    warn "workspace root is empty; smoke test may not have run yet"
  fi
fi

if [[ "${LIVE_CHECKS}" -eq 1 ]]; then
  if curl -fsS "${SYMPHONY_DASHBOARD_URL}" >/dev/null 2>&1; then
    ok "dashboard reachable at ${SYMPHONY_DASHBOARD_URL}"
  else
    fail "dashboard not reachable at ${SYMPHONY_DASHBOARD_URL}"
  fi

  linear_response="$(curl -fsS https://api.linear.app/graphql \
    -H "Content-Type: application/json" \
    -H "Authorization: ${LINEAR_API_KEY}" \
    --data '{"query":"query Viewer { viewer { id name } }"}' 2>/dev/null || true)"

  if printf '%s' "${linear_response}" | grep -q '"viewer"'; then
    ok "Linear API key accepted"
  else
    fail "Linear API check failed"
  fi
fi

echo
echo "Summary: ${FAILURES} failure(s), ${WARNINGS} warning(s)"

if [[ "${FAILURES}" -gt 0 ]]; then
  exit 1
fi
