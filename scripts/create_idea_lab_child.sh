#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 5 ]]; then
  echo "Usage: $0 <planning|research> <parent_issue_id> <parent_identifier> <parent_url> <parent_title>" >&2
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
    CHILD_ROUTE_LABEL="Idea Lab / Planning"
    CHILD_TITLE="[Desk ${PARENT_IDENTIFIER}] Idea Lab planning follow-up"
    GOAL_TEXT="Clarify the request, define scope, and decide whether more research is needed."
    ;;
  research)
    CHILD_STATE_ID="${LINEAR_STATE_ID_RESEARCH}"
    CHILD_ROUTE_LABEL="Idea Lab / Research"
    CHILD_TITLE="[Desk ${PARENT_IDENTIFIER}] Idea Lab research follow-up"
    GOAL_TEXT="Research the request, gather evidence, and produce an implementation-ready recommendation."
    ;;
  *)
    echo "Unsupported mode: ${MODE}" >&2
    exit 1
    ;;
esac

graphql() {
  curl -s https://api.linear.app/graphql \
    -H "Content-Type: application/json" \
    -H "Authorization: ${LINEAR_API_KEY}" \
    --data-binary @-
}

payload=$(
  jq -n \
    --arg team "${LINEAR_TEAM_ID}" \
    --arg project "${IDEA_LAB_PROJECT_ID}" \
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
- include created notes, recommendation, and the next suggested lane
" \
    '{query:"mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }", variables:{input:{teamId:$team, projectId:$project, stateId:$state, title:$title, description:$desc}}}'
)

response="$(printf '%s' "${payload}" | graphql)"
child_id="$(printf '%s' "${response}" | jq -r '.data.issueCreate.issue.id // empty')"
child_identifier="$(printf '%s' "${response}" | jq -r '.data.issueCreate.issue.identifier // empty')"
child_url="$(printf '%s' "${response}" | jq -r '.data.issueCreate.issue.url // empty')"

if [[ -z "${child_id}" || -z "${child_identifier}" || -z "${child_url}" ]]; then
  echo "Failed to create Idea Lab child issue" >&2
  printf '%s\n' "${response}" >&2
  exit 1
fi

comment_body=$(cat <<EOF
## Codex Workpad
- Status: \`Waiting\`
- Request type: \`Idea Lab handoff\`
- Delegated child issue: \`${child_identifier}\`
- Child URL: ${child_url}
- Route: \`${CHILD_ROUTE_LABEL}\`
- Next step: wait for the child issue to return a clearer recommendation

## Delegation Plan
- ${CHILD_ROUTE_LABEL}
  - reason: user request needs definition or research before downstream execution
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
