# Symphony Playbook

이 디렉터리는 Symphony를 운영할 때 바로 복사해서 쓸 수 있는 샘플 workflow와 운영 가이드를 모아둔 곳이다.

## 이 디렉터리의 목적

- 어떤 상황에 어떤 workflow를 만들어야 하는지 빠르게 판단하기
- repo, Linear 프로젝트, 역할(PM/Research/Design/Dev)을 어떻게 분리할지 결정하기
- 실제로 수정 가능한 샘플 파일을 바로 가져다 쓰기

## 먼저 이해할 핵심

Symphony는 보통 다음 세 가지를 조합해서 운영한다.

1. `Linear 프로젝트`
   - 어떤 이슈 큐를 볼지 결정한다.
2. `Workflow 파일`
   - 어떤 repo를 어떻게 준비할지, 어떤 역할로 일할지 결정한다.
3. `Workspace`
   - 실제 작업이 일어나는 이슈별 작업 폴더다.

즉 이슈는 "무슨 일"을 설명하고, workflow는 "어디서 어떻게 일할지"를 설명한다.

## 가장 추천하는 운영 방식

### 1. 사람과 한 창구로만 소통하고 싶다

- 사람이 요청을 넣는 곳을 하나로 통일하고 싶을 때 적합하다.
- `Comphony Desk`가 intake, triage, delegation, reporting을 맡는다.
- 샘플:
  - [COMPHONY_DESK_MODEL.md](COMPHONY_DESK_MODEL.md)
  - [WORKFLOW.desk.md](workflows/WORKFLOW.desk.md)

### 2. 일반적인 코드 작업

- `repo 1개 = Linear 프로젝트 1개 = dev workflow 1개`
- 가장 단순하고 안전하다.
- 샘플: [WORKFLOW.dev.single-repo.md](workflows/WORKFLOW.dev.single-repo.md)

### 3. 역할 분리 릴레이

- 같은 Linear 프로젝트 안에서 상태를 나눠 `PM -> Research -> Design -> Dev` 순서로 넘긴다.
- 충돌 없이 역할을 나누고 싶을 때 적합하다.
- 샘플:
  - [WORKFLOW.pm.md](workflows/WORKFLOW.pm.md)
  - [WORKFLOW.research.md](workflows/WORKFLOW.research.md)
  - [WORKFLOW.design.md](workflows/WORKFLOW.design.md)
  - [WORKFLOW.dev.relay.md](workflows/WORKFLOW.dev.relay.md)

### 4. 설치 비용이 큰 무거운 repo

- 매 이슈마다 fresh clone/install이 부담될 때 `git worktree`와 shared cache를 사용한다.
- 샘플: [WORKFLOW.dev.worktree.md](workflows/WORKFLOW.dev.worktree.md)

### 5. 코드 작업이 아닌 리서치/문서 작업

- repo clone 없이 workspace를 조사 폴더로만 쓴다.
- 샘플: [WORKFLOW.research.md](workflows/WORKFLOW.research.md)

### 6. 새 프로젝트 생성/초기화 자동화

- 새 repo 생성, Linear 프로젝트 생성, workflow 발급 같은 메타 작업을 처리한다.
- 샘플: [WORKFLOW.project-admin.md](workflows/WORKFLOW.project-admin.md)

## 읽는 순서

1. [START_WITH_CODEX.md](START_WITH_CODEX.md)
2. [LOCAL_LAYOUT.md](LOCAL_LAYOUT.md)
3. [SYMPHONY_BASICS.md](SYMPHONY_BASICS.md)
4. [UI_UX_PRO_MAX_GUIDE.md](UI_UX_PRO_MAX_GUIDE.md)
5. [OPERATING_LEVEL_DEVELOPMENT_PLAN.md](OPERATING_LEVEL_DEVELOPMENT_PLAN.md)
6. [COMPHONY_DESK_MODEL.md](COMPHONY_DESK_MODEL.md)
7. [COMPHONY_COMPANY_MODEL.md](COMPHONY_COMPANY_MODEL.md)
8. [SCENARIO_MATRIX.md](SCENARIO_MATRIX.md)
9. [ISSUE_LIFECYCLE.md](ISSUE_LIFECYCLE.md)
10. [WORKFLOW_PARTS.md](WORKFLOW_PARTS.md)
11. 필요한 샘플 workflow 파일

## 주의할 점

- 같은 `project_slug`와 같은 `active_states`를 두 개의 Symphony가 동시에 보면 충돌 위험이 있다.
- 역할 분리는 "같은 이슈를 동시에 여러 에이전트가 본다"보다 "상태 기반 릴레이"가 더 안정적이다.
- repo 경로는 이슈가 아니라 workflow의 `hooks.after_create`가 결정한다.
- 실제 코드 수정은 원본 repo가 아니라 workspace 안에서 일어난다.
- 사람이 어디에 이슈를 만들지 헷갈리면 `Comphony Desk`를 앞단에 두는 편이 가장 운영하기 쉽다.

## 빠른 추천

- "그냥 repo 하나 자동 코딩" -> `WORKFLOW.dev.single-repo.md`
- "사람과 소통하는 단일 창구가 필요" -> `COMPHONY_DESK_MODEL.md`, `WORKFLOW.desk.md`
- "PM/Research/Design/Dev 역할 분리" -> `WORKFLOW.pm.md`, `WORKFLOW.research.md`, `WORKFLOW.design.md`, `WORKFLOW.dev.relay.md`
- "디자이너가 레퍼런스 조사와 디자인 시스템 초안을 만들게 하고 싶다" -> `UI_UX_PRO_MAX_GUIDE.md`, `WORKFLOW.design.md`
- "npm install이 너무 무겁다" -> `WORKFLOW.dev.worktree.md`
- "리서치 티켓 처리" -> `WORKFLOW.research.md`
- "새 repo와 Linear 프로젝트까지 자동 생성" -> `WORKFLOW.project-admin.md`
