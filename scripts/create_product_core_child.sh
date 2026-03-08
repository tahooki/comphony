#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 5 ]]; then
  echo "Usage: $0 <planning|research|todo> <parent_issue_id> <parent_identifier> <parent_url> <parent_title>" >&2
  exit 1
fi

MODE="$1"
PARENT_ID="$2"
PARENT_IDENTIFIER="$3"
PARENT_URL="$4"
PARENT_TITLE="$5"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

case "${MODE}" in
  planning)
    CHILD_STATE_ID="${LINEAR_STATE_ID_PLANNING}"
    CHILD_ROUTE_LABEL="Product - Core / Planning"
    GOAL_TEXT="Clarify the product requirement before implementation starts."
    ;;
  research)
    CHILD_STATE_ID="${LINEAR_STATE_ID_RESEARCH}"
    CHILD_ROUTE_LABEL="Product - Core / Research"
    GOAL_TEXT="Research the product request and return a concrete recommendation."
    ;;
  todo)
    CHILD_STATE_ID="${LINEAR_STATE_ID_TODO}"
    CHILD_ROUTE_LABEL="Product - Core / Todo"
    GOAL_TEXT="Implement the request with the smallest correct change."
    ;;
  *)
    echo "Unsupported mode: ${MODE}" >&2
    exit 1
    ;;
esac

CHILD_TITLE="[Desk ${PARENT_IDENTIFIER}] Product Core follow-up"

graphql() {
  curl -s https://api.linear.app/graphql \
    -H "Content-Type: application/json" \
    -H "Authorization: ${LINEAR_API_KEY}" \
    --data-binary @-
}

payload=$(
  jq -n \
    --arg team "${LINEAR_TEAM_ID}" \
    --arg project "${PRODUCT_CORE_PROJECT_ID}" \
    --arg state "${CHILD_STATE_ID}" \
    --arg title "${CHILD_TITLE}" \
    --arg desc "Goal
${GOAL_TEXT}

Desk Parent
- ID: ${PARENT_ID}
- Identifier: ${PARENT_IDENTIFIER}
- URL: ${PARENT_URL}
- Title: ${PARENT_TITLE}

Return Report
- add a completion comment back to the Desk parent issue
- move the Desk parent issue to Reported when the child is complete
- include validation result, artifact paths, and the next suggested action
" \
    '{query:"mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }", variables:{input:{teamId:$team, projectId:$project, stateId:$state, title:$title, description:$desc}}}'
)

response="$(printf '%s' "${payload}" | graphql)"
child_id="$(printf '%s' "${response}" | jq -r '.data.issueCreate.issue.id // empty')"
child_identifier="$(printf '%s' "${response}" | jq -r '.data.issueCreate.issue.identifier // empty')"
child_url="$(printf '%s' "${response}" | jq -r '.data.issueCreate.issue.url // empty')"

if [[ -z "${child_id}" || -z "${child_identifier}" || -z "${child_url}" ]]; then
  echo "Failed to create Product - Core child issue" >&2
  printf '%s\n' "${response}" >&2
  exit 1
fi

comment_body=$(cat <<EOF
## Codex Workpad
- Status: \`Waiting\`
- Request type: \`Product - Core handoff\`
- Delegated child issue: \`${child_identifier}\`
- Child URL: ${child_url}
- Route: \`${CHILD_ROUTE_LABEL}\`
- Next step: wait for the product execution result and validation summary

## Delegation Plan
- ${CHILD_ROUTE_LABEL}
  - reason: request is ready for product-level planning, research, or implementation
  - child issue: ${child_identifier}
  - child url: ${child_url}
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
    --arg state "${LINEAR_STATE_ID_WAITING}" \
    '{query:"mutation($id:String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { identifier state { name } } } }", variables:{id:$id, input:{stateId:$state}}}'
)
printf '%s' "${payload}" | graphql >/dev/null

printf '%s\t%s\t%s\n' "${child_id}" "${child_identifier}" "${child_url}"
