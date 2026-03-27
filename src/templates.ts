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
  repo_bootstrap_strategy: clone
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
      enabled: true
      project_ref: bgiwrjvhylumcziwcbwk

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

routing:
  default_project: comphony_desk
  default_lane: planning
  lane_keywords:
    research:
      - research
      - investigate
      - analyze
      - analysis
      - 리서치
      - 조사
      - 탐색
      - 분석
    design:
      - design
      - redesign
      - ux
      - ui
      - wireframe
      - layout
      - dashboard
      - 디자인
      - 설계
      - 화면
      - 레이아웃
      - 대시보드
    planning:
      - plan
      - scope
      - spec
      - define
      - 기획
      - 계획
      - 범위
      - 정의
      - 명세
      - 로드맵
    build:
      - implement
      - build
      - code
      - develop
      - publish
      - fix
      - patch
      - hotfix
      - 구현
      - 개발
      - 코드
      - 제작
      - 배포
      - 수정
      - 패치
    review:
      - review
      - qa
      - check
      - 리뷰
      - 검토
      - 확인
      - 테스트
  preferred_roles:
    planning:
      - coordination
      - design
    research:
      - coordination
      - design
    design:
      - design
      - coordination
    build:
      - build
      - publishing
    review:
      - publishing
      - build
      - coordination

projects:
  - id: comphony_desk
    name: Comphony Desk
    purpose: Front door intake, triage, and downstream coordination
    lanes:
      - planning
      - research
      - review
    tracker_sync:
      provider: linear
      mode: mirror_out
      project_name: Comphony Desk

  - id: idea_lab
    name: Idea Lab
    purpose: Shape ideas, plans, and exploratory research
    repo:
      mode: canonical
      slug: idea-lab
      default_branch: main
    lanes:
      - planning
      - research
      - review
    tracker_sync:
      provider: linear
      mode: mirror_out
      project_name: Idea Lab

  - id: project_managing
    name: Project Managing
    purpose: Provision repos, workflows, and operating lanes
    repo:
      mode: canonical
      slug: project-admin
      default_branch: main
    lanes:
      - planning
      - build
      - review
    tracker_sync:
      provider: linear
      mode: mirror_out
      project_name: Project Managing

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

  - id: ops_maintenance
    name: Ops / Maintenance
    purpose: Handle maintenance, operational fixes, and follow-up tasks
    repo:
      mode: canonical
      slug: ops-maintenance
      default_branch: main
    lanes:
      - planning
      - build
      - review
    tracker_sync:
      provider: linear
      mode: mirror_out
      project_name: Ops / Maintenance

agents:
  - id: project_admin_01
    name: Project Admin
    role: project_admin
    source:
      kind: local_package
      ref: ./agents/project_admin_01
    capabilities:
      - provisioning
      - workflow_generation
      - repo_bootstrap
    permissions:
      read_repo: allow
      write_repo: guarded
      run_commands: guarded
      request_review: allow
    assigned_projects:
      - project_managing

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
      - comphony_desk
      - idea_lab
      - project_managing
      - product_core
      - ops_maintenance

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
      - ops_maintenance

  - id: design_planner_01
    name: Product Design Planner
    role: design
    source:
      kind: local_package
      ref: ./agents/design_planner_01
    capabilities:
      - design_system
      - ui_direction
      - design_handoff
    permissions:
      read_repo: allow
      write_memory: allow
      request_review: allow
    assigned_projects:
      - product_core

  - id: frontend_publisher_01
    name: Frontend Publisher
    role: publishing
    source:
      kind: local_package
      ref: ./agents/frontend_publisher_01
    capabilities:
      - frontend_implementation
      - visual_qa
      - handoff_execution
    permissions:
      read_repo: allow
      write_repo: guarded
      run_commands: guarded
    assigned_projects:
      - product_core
      - ops_maintenance

connectors:
  telegram:
    enabled: false
  discord:
    enabled: false
  slack:
    enabled: false
`;
