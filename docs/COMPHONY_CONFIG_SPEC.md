# Comphony Config Spec

This document defines the recommended configuration model for `Comphony`.

The purpose is to replace scattered manual setup with a structured company configuration.

## 1. Goal

The config should describe:

- who the company is
- which runtime it uses
- which projects exist
- which agents exist
- which sync targets exist
- which permissions and policies apply

## 2. Recommended Main File

Recommended root config:

- `company.yaml`

This file should be the human-editable source of truth for company structure.

## 3. Recommended Top-Level Sections

Suggested structure:

```yaml
company:
runtime:
sync:
auth:
policies:
projects:
agents:
connectors:
```

## 4. Company Section

Suggested fields:

```yaml
company:
  name: Comphony
  slug: comphony
  description: Local-first AI company operating system
```

## 5. Runtime Section

Defines local execution behavior.

Suggested fields:

```yaml
runtime:
  mode: local_first
  data_dir: ./runtime-data
  repo_root: ./repos
  workspace_root: ./workspaces
  workflow_root: ./workflows
  local_server:
    host: 127.0.0.1
    port: 43110
```

## 6. Sync Section

Defines external sync behavior.

Suggested fields:

```yaml
sync:
  default_mode: mirror_out
  providers:
    linear:
      enabled: true
      team_key: TAH
    supabase:
      enabled: true
      project_ref: your-project
```

## 7. Auth Section

Defines who can use the company and how sessions are handled.

Suggested fields:

```yaml
auth:
  local_users:
    - id: owner_01
      role: owner
      display_name: Tahooki
  require_auth_for_remote_clients: true
```

## 8. Policies Section

Defines trust, autonomy, and defaults.

Suggested fields:

```yaml
policies:
  autonomy_mode: balanced
  external_sync_requires_auth: true
  repo_creation_requires_approval: true
  deploy_requires_approval: true
```

## 9. Projects Section

Projects should be declared explicitly.

Suggested shape:

```yaml
projects:
  - id: product_core
    name: Product - Core
    purpose: Main product execution
    repo:
      mode: canonical
      slug: product-core
      default_branch: main
    lanes:
      - planning
      - research
      - design
      - build
      - review
    tracker_sync:
      provider: linear
      mode: mirror_out
      project_name: Product - Core
```

## 10. Agents Section

Agents may be inline-defined or imported.

Suggested shape:

```yaml
agents:
  - id: designer_01
    name: Mina
    role: design
    source:
      kind: local_package
      ref: ./agents/designer_01
    capabilities:
      - design_system
      - ux_review
    permissions:
      write_repo: guarded
      request_review: allow
    assigned_projects:
      - product_core
```

## 11. Agent Source Resolution

`agents[].source` should resolve through a small fixed set of source kinds.

Recommended kinds:

- `local_package`
  - a tracked agent package stored under `./agents/<agent-id>/`
- `registry_package`
  - an installed package fetched from a registry and stored under `./runtime-data/registry/agents/<agent-id>/`
- `codex_skill`
  - a Codex skill referenced from `./.codex/skills/<skill-name>/`

Recommended rule:

- `local_package` should point at an agent package with `agent.yaml`
- `registry_package` should resolve to an installed cached package, not a live remote URL
- `codex_skill` is a tool dependency, not a full agent package by itself

Important boundary:

- `./agents/` = first-class installable agent packages for this company
- `./.codex/skills/` = Codex execution skills
- `./runtime-data/registry/agents/` = imported package cache

This avoids ambiguity between package installation and Codex skill loading.

## 12. Connectors Section

Future external channels should live here.

Suggested shape:

```yaml
connectors:
  telegram:
    enabled: false
  discord:
    enabled: false
  slack:
    enabled: false
```

## 13. Config Rule

The config should define company structure and durable policy.

It should not become the place where volatile runtime state lives.

Runtime state belongs in:

- database tables
- event logs
- generated runtime cache

## 14. Validation

The CLI should provide:

- schema validation
- missing-field validation
- dependency validation
- sync target validation
- tool availability validation

Recommended command:

```bash
comphony validate config
```

## 15. Relationship To Generated Files

The config should generate:

- runtime workflows
- local runtime bootstrap files
- sync adapters
- approval defaults

It should reduce hand-editing, not add another disconnected source of truth.
