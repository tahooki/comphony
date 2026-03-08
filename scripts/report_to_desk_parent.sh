#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 5 ]]; then
  echo "Usage: $0 <parent_issue_id> <child_identifier> <child_url> <artifact_path> <summary>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

PARENT_ID="$1"
CHILD_IDENTIFIER="$2"
CHILD_URL="$3"
ARTIFACT_PATH="$4"
SUMMARY="$5"

graphql() {
  curl -s https://api.linear.app/graphql \
    -H "Content-Type: application/json" \
    -H "Authorization: ${LINEAR_API_KEY}" \
    --data-binary @-
}

comment_body=$(cat <<EOF
## Project Managing Report
- Source child issue: \`${CHILD_IDENTIFIER}\`
- Child URL: ${CHILD_URL}
- Artifact path: \`${ARTIFACT_PATH}\`
- Summary: ${SUMMARY}
- Next recommended action: review the artifact, then close or create the next downstream issue
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
    --arg state "${LINEAR_STATE_ID_REPORTED}" \
    '{query:"mutation($id:String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { identifier state { name } } } }", variables:{id:$id, input:{stateId:$state}}}'
)
printf '%s' "${payload}" | graphql >/dev/null
