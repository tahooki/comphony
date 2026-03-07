# Comphony Mission Template

이 파일은 Codex에게 "이번에 무엇을 끝까지 세팅해야 하는지" 알려주는 목표 문서 템플릿이다.

실사용 시 이 파일을 `MISSION.md`로 복사해서 값을 채우면 된다.

## 1. Mission

- Company or workspace name:
- Primary objective:
- Desired end state:

예:

- Company or workspace name: `Comphony`
- Primary objective: `Symphony와 Linear를 연결해서 이슈만 만들면 작업이 시작되는 구조 만들기`
- Desired end state: `Idea Lab, Project Managing, Product - Core 프로젝트와 dev/research/project-admin workflow가 작동`

## 2. Linear Setup

- Linear workspace/team:
- Use existing workspace or create new projects:
- Projects to prepare:
  - `Idea Lab`
  - `Project Managing`
  - `Product - Core`
- Preferred states per project:

예:

- Idea Lab: `Inbox`, `Planning`, `Research`, `Approved`, `Rejected`
- Project Managing: `Requested`, `Provisioning`, `Verification`, `Done`
- Product - Core: `Planning`, `Research`, `Design`, `Todo`, `In Progress`, `Rework`, `Human Review`, `Merging`, `Done`

## 3. Repo Targets

- Symphony repo path:
- Product repo path(s):
- Research-only project without repo?:
- Project-admin repo path:

예:

- Symphony repo path: `/Users/you/Documents/symphony`
- Product repo path(s):
  - `/Users/you/Documents/git/product-core`
- Research-only project without repo?: `yes`
- Project-admin repo path: `/Users/you/Documents/git/project-admin`

## 4. Workflow Strategy

- Do you want single-repo dev only, or role relay?:
- Roles to enable:
  - `PM`
  - `Research`
  - `Design`
  - `Dev`
  - `Project Admin`
- Workspace root:
- Clone strategy:
  - `git clone`
  - `git worktree`
- Package/bootstrap strategy:

## 5. Runtime

- Where should workflow files live?:
- How should Symphony be started?:
- Preferred dashboard port:
- Where should run scripts live?:

## 6. Smoke Test

- Create a verification issue automatically?:
- Example issue title:
- Expected first visible behavior:

예:

- Create a verification issue automatically?: `yes`
- Example issue title: `Add verification marker to dashboard`
- Expected first visible behavior: `issue moves from Todo to In Progress and dashboard shows a running agent`

## 7. Acceptance Criteria

Codex should not stop until these are complete.

- [ ] Symphony runs locally
- [ ] Linear API connection works
- [ ] Linear projects and states are prepared
- [ ] Workflow files are created for the chosen setup
- [ ] Run scripts or commands are documented
- [ ] At least one smoke-test issue path is verified
- [ ] Final docs reflect the actual local paths and project names

## 8. Constraints

- Avoid changing unrelated repos:
- Prefer private or public GitHub repos:
- Any repositories or projects to exclude:
- Any secrets handling rule:

## 9. Notes For Codex

- Make reasonable defaults if information is missing.
- Ask only when blocked by permissions, credentials, or organization-specific naming.
- Prefer a small working setup first, then expand.
