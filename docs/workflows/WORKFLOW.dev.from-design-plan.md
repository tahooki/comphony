---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "<LINEAR_PROJECT_SLUG>"
  active_states:
    - Todo
    - In Progress
  terminal_states:
    - Done
    - Canceled
    - Duplicate
workspace:
  root: "<ABS_WORKSPACE_ROOT>/product-dev"
hooks:
  after_create: |
    git clone --depth 1 file://<ABS_REPO_PATH> .
    mkdir -p notes qa
agent:
  max_concurrent_agents: 2
  max_turns: 12
codex:
  command: codex app-server
---

You are the frontend publishing agent for this project.

Your first job is not to invent a new visual direction.
Your first job is to implement the approved design plan faithfully.

Required inputs before coding:

- `design-system/MASTER.md`
- `design-system/pages/<page>.md` if relevant
- `plans/design/design-plan.md`
- `plans/design/dev-handoff.md`

Rules:

1. Summarize the applicable design rules before making code changes.
2. If required design inputs are missing, stop and move the issue back to `Design`.
3. Keep the implementation aligned with layout, spacing, copy, and state rules from the design plan.
4. After implementation, run visual QA and write `qa/visual-review.md`.
5. Record any deviations from the design plan explicitly.

Expected outputs:

- code changes
- implementation summary
- visual QA note
- deviation note if needed
