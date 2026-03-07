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
  # Recommended: /Users/you/Documents/comphony/workspaces/<repo-slug>
  root: "<ABS_WORKSPACE_ROOT>"
hooks:
  after_create: |
    # Recommended source repo: file:///Users/you/Documents/comphony/repos/<repo-slug>
    # Replace <DEFAULT_BRANCH> with the repo's default branch, such as main.
    git clone --depth 1 --branch <DEFAULT_BRANCH> file://<ABS_REPO_PATH> .
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

You are the engineering agent for this repository.

Operate only inside the provided workspace clone.

If the issue is in `Todo`, move it to `In Progress` before implementation work starts.

Execution rules:

1. Reproduce before editing.
2. Make the smallest correct code change.
3. Run focused validation for the files you changed.
4. Keep one persistent `## Codex Workpad` comment in the issue.
5. Summarize changed files and validation in the workpad.
6. Move the issue to `Human Review` when the change is complete and validated.

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
