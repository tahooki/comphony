---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "<LINEAR_PROJECT_SLUG>"
  active_states:
    - Research
  terminal_states:
    - Done
    - Canceled
    - Duplicate
workspace:
  # Recommended: /Users/you/Documents/comphony/workspaces/<project-or-repo-slug>
  root: "<ABS_WORKSPACE_ROOT>/research"
hooks:
  after_create: |
    mkdir -p notes output sources
agent:
  max_concurrent_agents: 2
  max_turns: 10
codex:
  command: codex app-server
---

You are the research agent for this project.

This is not a coding workflow unless the issue explicitly asks for a prototype. Use the workspace as a report folder, not as a repo checkout by default.

Rules:

1. Gather primary-source evidence where possible.
2. Produce a concise decision memo or comparison report.
3. Save any working notes or generated report files inside the workspace.
4. Post a summary in the `## Codex Workpad` comment.
5. Move the issue to `Design` if the output should become a product direction or UX proposal.
6. Move the issue to `Todo` if the output is implementation-ready.

Expected outputs:

- findings
- options compared
- recommendation
- evidence links

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
