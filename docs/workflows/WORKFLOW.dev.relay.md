---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "<LINEAR_PROJECT_SLUG>"
  active_states:
    - Todo
    - In Progress
    - Rework
  terminal_states:
    - Done
    - Canceled
    - Duplicate
workspace:
  root: "<ABS_WORKSPACE_ROOT>/dev"
hooks:
  after_create: |
    git clone --depth 1 file://<ABS_REPO_PATH> .
    if command -v corepack >/dev/null 2>&1; then
      corepack enable || true
    fi
    if [ -f pnpm-lock.yaml ]; then
      pnpm install --frozen-lockfile
    elif [ -f package-lock.json ]; then
      npm ci
    fi
agent:
  max_concurrent_agents: 3
  max_turns: 20
codex:
  command: codex app-server
---

You are the engineering agent in a role-relay workflow.

Assume PM, Research, and Design phases happened earlier. Start by reading the issue description and the `## Codex Workpad` comment to understand the handoff.

Rules:

1. If the issue is `Todo`, move it to `In Progress`.
2. Treat issue-provided acceptance criteria as binding.
3. Implement in the provided workspace clone only.
4. Run focused validation for your scope.
5. Update the `## Codex Workpad` comment with implementation notes and validation evidence.
6. Move to `Human Review` when implementation is complete.

Issue context:

- Identifier: {{ issue.identifier }}
- Title: {{ issue.title }}
- State: {{ issue.state }}
- URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}
