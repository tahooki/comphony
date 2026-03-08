#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 4 ]]; then
  echo "Usage: $0 <parent_issue_id> <parent_identifier> <parent_url> <parent_title>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

PARENT_ID="$1"
PARENT_IDENTIFIER="$2"
PARENT_URL="$3"
PARENT_TITLE="$4"

graphql() {
  curl -s https://api.linear.app/graphql \
    -H "Content-Type: application/json" \
    -H "Authorization: ${LINEAR_API_KEY}" \
    --data-binary @-
}

payload=$(
  jq -n \
    --arg team "${LINEAR_TEAM_ID}" \
    --arg project "${PROJECT_MANAGING_PROJECT_ID}" \
    --arg state "${LINEAR_STATE_ID_TODO}" \
    --arg title "[Desk ${PARENT_IDENTIFIER}] Project Managing follow-up" \
    --arg desc "Goal
Create one lightweight local-only setup artifact for the Desk handoff smoke test.

Desk Parent
- ID: ${PARENT_ID}
- Identifier: ${PARENT_IDENTIFIER}
- URL: ${PARENT_URL}
- Title: ${PARENT_TITLE}

Return Report
- add a completion comment back to the Desk parent issue
- move the Desk parent issue to Reported when done
- include the exact local artifact path

Scope
- create one planning note under the workspace only
- do not push code
- do not make durable remote repo changes

Validation
- update the Codex Workpad
- move this child issue to Human Review when complete
" \
    '{query:"mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }", variables:{input:{teamId:$team, projectId:$project, stateId:$state, title:$title, description:$desc}}}'
)

response="$(printf '%s' "${payload}" | graphql)"
child_id="$(printf '%s' "${response}" | jq -r '.data.issueCreate.issue.id // empty')"
child_identifier="$(printf '%s' "${response}" | jq -r '.data.issueCreate.issue.identifier // empty')"
child_url="$(printf '%s' "${response}" | jq -r '.data.issueCreate.issue.url // empty')"

if [[ -z "${child_id}" || -z "${child_identifier}" || -z "${child_url}" ]]; then
  echo "Failed to create Project Managing child issue" >&2
  printf '%s\n' "${response}" >&2
  exit 1
fi

comment_body=$(cat <<EOF
## Codex Workpad
- Status: \`Waiting\`
- Request type: \`Project Managing handoff\`
- Delegated child issue: \`${child_identifier}\`
- Child URL: ${child_url}
- Next step: wait for the child issue to complete and report back here

## Delegation Plan
- Project Managing / Todo
  - reason: lightweight local-only setup smoke test
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
