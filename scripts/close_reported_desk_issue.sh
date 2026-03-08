#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <parent_issue_id> <summary> [artifact_paths] [next_action]" >&2
  exit 1
fi

PARENT_ID="$1"
SUMMARY="$2"
ARTIFACT_PATHS="${3:-none recorded}"
NEXT_ACTION="${4:-No further action required.}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

graphql() {
  curl -s https://api.linear.app/graphql \
    -H "Content-Type: application/json" \
    -H "Authorization: ${LINEAR_API_KEY}" \
    --data-binary @-
}

comment_body=$(cat <<EOF
## Desk Summary
- Status: \`Done\`
- Summary: ${SUMMARY}
- Artifact paths: ${ARTIFACT_PATHS}
- Next action: ${NEXT_ACTION}
EOF
)

payload=$(
  jq -n \
    --arg issue "${PARENT_ID}" \
    --arg body "${comment_body}" \
    '{query:"mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id } } }", variables:{input:{issueId:$issue, body:$body}}}'
)
printf '%s' "${payload}" | graphql >/dev/null

payload=$(
  jq -n \
    --arg id "${PARENT_ID}" \
    --arg state "${LINEAR_STATE_ID_DONE}" \
    '{query:"mutation($id:String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { identifier state { name } } } }", variables:{id:$id, input:{stateId:$state}}}'
)
printf '%s' "${payload}" | graphql >/dev/null
