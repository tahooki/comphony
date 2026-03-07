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
  root: "<ABS_WORKTREE_ROOT>"
hooks:
  after_create: |
    ROOT_REPO="<ABS_CANONICAL_REPO_PATH>"
    BRANCH="symphony-$(basename "$PWD")"
    git -C "$ROOT_REPO" fetch origin
    git -C "$ROOT_REPO" worktree add "$PWD" -b "$BRANCH" origin/main
    if command -v corepack >/dev/null 2>&1; then
      corepack enable || true
    fi
    if [ -f pnpm-lock.yaml ]; then
      pnpm install --frozen-lockfile
    elif [ -f package-lock.json ]; then
      npm ci --cache "${HOME}/.npm" --prefer-offline
    fi
  before_remove: |
    ROOT_REPO="<ABS_CANONICAL_REPO_PATH>"
    git -C "$ROOT_REPO" worktree remove --force "$PWD" || true
agent:
  max_concurrent_agents: 3
  max_turns: 20
codex:
  command: codex app-server
---

You are the engineering agent for a heavy repository.

This workflow exists to reduce repeated clone and install costs by using a canonical checkout plus issue-specific worktrees.

Rules:

1. Work only in the provided worktree.
2. Keep installs minimal and avoid unnecessary full rebuilds.
3. Run focused validation for the exact scope of the issue.
4. Keep one `## Codex Workpad` comment updated in Linear.
5. Move to `Human Review` only after validation is green.

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
