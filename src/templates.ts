export const DEFAULT_COMPANY_YAML = `company:
  name: Comphony
  slug: comphony
  description: Local-first AI company operating system

runtime:
  mode: local_first
  data_dir: ./runtime-data
  repo_root: ./repos
  workspace_root: ./workspaces
  workflow_root: ./workflows
  local_server:
    host: 127.0.0.1
    port: 43110

sync:
  default_mode: mirror_out
  providers:
    linear:
      enabled: false
      team_key: TAH
    supabase:
      enabled: false
      project_ref: local-dev

auth:
  local_users:
    - id: owner_01
      role: owner
      display_name: Tahooki
  require_auth_for_remote_clients: true

policies:
  autonomy_mode: balanced
  external_sync_requires_auth: true
  repo_creation_requires_approval: true
  deploy_requires_approval: true

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

agents:
  - id: desk_coordinator
    name: Comphony Desk Coordinator
    role: coordination
    source:
      kind: local_package
      ref: ./agents/desk_coordinator
    capabilities:
      - intake
      - routing
      - reporting
    permissions:
      read_memory: allow
      write_memory: allow
      request_review: allow
    assigned_projects:
      - product_core

  - id: product_dev_01
    name: Product Core Developer
    role: build
    source:
      kind: local_package
      ref: ./agents/product_dev_01
    capabilities:
      - implementation
      - repo_changes
      - review_response
    permissions:
      read_repo: allow
      write_repo: guarded
      run_commands: guarded
    assigned_projects:
      - product_core

connectors:
  telegram:
    enabled: false
  discord:
    enabled: false
  slack:
    enabled: false
`;
