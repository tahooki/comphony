# Comphony Mission Template

이 파일은 Codex에게 "이번에 무엇을 끝까지 세팅해야 하는지" 알려주는 목표 문서 템플릿이다.

실사용 시 사람은 이 파일을 직접 채울 필요가 없다.

기본 원칙:

- `MISSION.md`가 없으면 Codex가 이 템플릿을 기준으로 직접 생성한다.
- 사용자는 그냥 `셋팅해줘`라고 요청해도 된다.
- Codex는 기본값을 채운 뒤, 정말 필요한 정보만 추가로 확인한다.

즉 이 파일은 주로 `Codex가 MISSION.md를 생성할 때 참고하는 기준 문서`다.

## 1. Mission

- Company or workspace name:
- Primary objective:
- Desired end state:

예:

- Company or workspace name: `Comphony`
- Primary objective: `Symphony와 Linear를 연결해서 이슈만 만들면 작업이 시작되는 구조 만들기`
- Desired end state: `Idea Lab, Project Managing, Product - Core 프로젝트와 dev/research/project-admin workflow가 작동`

## 2. Local Layout

- Comphony root path:
- Repo root:
- Workspace root:
- Workflow root:

예:

- Comphony root path: `/Users/you/Documents/comphony`
- Repo root: `/Users/you/Documents/comphony/repos`
- Workspace root: `/Users/you/Documents/comphony/workspaces`
- Workflow root: `/Users/you/Documents/comphony/workflows`

## 3. Linear Setup

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

## 4. Repo Targets

- Symphony repo path:
- Product repo path(s):
- Research-only project without repo?:
- Project-admin repo path:

예:

- Symphony repo path: `/Users/you/Documents/symphony`
- Product repo path(s):
  - `/Users/you/Documents/comphony/repos/product-core`
- Research-only project without repo?: `yes`
- Project-admin repo path: `/Users/you/Documents/comphony/repos/project-admin`

## 5. Workflow Strategy

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

## 6. Runtime

- Where should workflow files live?:
- How should Symphony be started?:
- Preferred dashboard port:
- Where should run scripts live?:

## 7. Smoke Test

- Create a verification issue automatically?:
- Example issue title:
- Expected first visible behavior:

예:

- Create a verification issue automatically?: `yes`
- Example issue title: `Add verification marker to dashboard`
- Expected first visible behavior: `issue moves from Todo to In Progress and dashboard shows a running agent`

## 8. Acceptance Criteria

Codex should not stop until these are complete.

- [ ] Standard local layout exists under the Comphony root
- [ ] Symphony runs locally
- [ ] Linear API connection works
- [ ] Linear projects and states are prepared
- [ ] Workflow files are created for the chosen setup
- [ ] Run scripts or commands are documented
- [ ] At least one smoke-test issue path is verified
- [ ] Final docs reflect the actual local paths and project names

## 9. Constraints

- Avoid changing unrelated repos:
- Prefer private or public GitHub repos:
- Any repositories or projects to exclude:
- Any secrets handling rule:

## 10. Notes For Codex

- If `MISSION.md` does not exist, create it first from this template.
- Make reasonable defaults if information is missing.
- Ask only when blocked by permissions, credentials, or organization-specific naming.
- Prefer a small working setup first, then expand.
