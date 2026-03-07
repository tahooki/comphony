# Linear + Symphony 운영 가이드

이 문서는 다음 두 가지를 설명한다.

1. Linear 이슈를 통해 Symphony가 어떻게 코드를 수정하는지
2. 여러 레포를 Linear 프로젝트별로 나누어 workflow를 구성하는 방법

## 1. Symphony는 무엇을 하는가

Symphony는 Linear를 주기적으로 확인하면서, 특정 프로젝트의 이슈를 잡아 작업용 workspace를 만들고 그 안에서 Codex를 실행하는 오케스트레이터다.

핵심은 다음과 같다.

- Linear 이슈는 "무슨 작업을 할지"를 설명한다.
- Workflow 파일은 "어느 프로젝트를 볼지", "어느 레포에서 작업할지", "workspace를 어디에 만들지"를 정한다.
- 실제 코드 수정은 원본 레포가 아니라 이슈별 workspace에서 일어난다.

## 2. 코드 수정은 어디에서 일어나는가

Symphony는 보통 원본 레포를 직접 수정하지 않는다. 대신 이슈마다 별도 작업 폴더를 만든다.

현재 데모 기준 예시는 다음과 같다.

- Symphony 원본 레포: `/Users/tahooki/Documents/default/symphony`
- Workflow 파일: `/Users/tahooki/Documents/default/symphony/elixir/WORKFLOW.demo.md`
- Workspace 루트: `/Users/tahooki/Documents/default/symphony-workspaces`
- 이슈 `TAH-5`의 실제 작업 폴더: `/Users/tahooki/Documents/default/symphony-workspaces/TAH-5`

즉 흐름은 다음과 같다.

1. Symphony가 Linear 프로젝트를 본다.
2. `Todo` 같은 active state의 이슈를 찾는다.
3. 이슈별 폴더를 만든다.
4. Workflow에 적힌 repo bootstrap 명령을 실행한다.
5. 그 작업 폴더 안에서 Codex가 코드를 수정한다.
6. 테스트, 상태 변경, 코멘트 업데이트 같은 후속 작업을 진행한다.

## 3. "이슈로 코드를 수정한다"는 뜻

의미는 단순하다.

- 이슈 제목과 설명이 작업 지시서 역할을 한다.
- Symphony는 이슈 내용을 prompt에 넣어서 Codex에게 전달한다.
- Codex는 해당 이슈 전용 workspace 안에서 파일을 수정한다.

예를 들면 이런 이슈가 가능하다.

```md
Title: Add last refresh time to dashboard

Goal:
Show the latest snapshot generation time in the dashboard.

Scope:
- Update the LiveView template
- Keep the change small

Validation:
- Dashboard renders at /
- Focused dashboard tests pass
```

이 경우 Symphony는 이슈를 잡고, workspace 안의 코드에서 관련 파일을 수정한다.

## 4. Workflow 파일이 하는 일

Workflow 파일은 Symphony의 작업 환경 설정서다.

대표적으로 아래를 정한다.

- 어떤 Linear 프로젝트를 볼지
- 어떤 상태를 active state로 볼지
- workspace를 어디에 만들지
- 새 workspace를 만들 때 어떤 레포를 가져올지
- Codex를 어떤 명령으로 실행할지

현재 데모 파일의 핵심 부분은 이런 의미다.

```yaml
tracker:
  kind: linear
  project_slug: "4c698d74273e"

workspace:
  root: /Users/tahooki/Documents/default/symphony-workspaces

hooks:
  after_create: |
    git clone --depth 1 file:///Users/tahooki/Documents/default/symphony .
```

의미:

- `project_slug`: Linear의 어떤 프로젝트 이슈를 볼지
- `workspace.root`: 이슈별 작업 폴더를 어디에 만들지
- `after_create`: 새 workspace 안에 어떤 레포를 어떻게 준비할지

## 5. 프로젝트와 workflow는 어떻게 연결되는가

연결은 Linear 쪽에 저장되는 것이 아니라 workflow 파일이 직접 정한다.

정확한 연결 방식은 다음과 같다.

- `Linear 프로젝트 -> workflow`
  - `tracker.project_slug`로 결정
- `workflow -> 대상 repo`
  - `hooks.after_create`로 결정
- `실제로 어떤 workflow를 쓸지`
  - Symphony 실행 시 넘기는 workflow 파일 경로로 결정

예:

```bash
./bin/symphony ./WORKFLOW.repo_a.md
./bin/symphony ./WORKFLOW.repo_b.md
```

## 6. Workflow 파일은 여러 개 만들 수 있는가

가능하다.

보통은 repo 또는 프로젝트 단위로 분리한다.

예:

- `WORKFLOW.repo_a.md`
- `WORKFLOW.repo_b.md`
- `WORKFLOW.repo_c.md`

중요한 점:

- workflow 파일은 여러 개 만들 수 있다.
- 하지만 Symphony 프로세스 하나는 실행 시 하나의 workflow 파일만 사용한다.
- 여러 repo를 동시에 운영하려면 workflow도 여러 개 두고, 프로세스도 분리하는 것이 일반적이다.

## 7. 여러 레포를 프로젝트별로 운영하는 권장 방식

가장 안전한 구조는 `1 repo = 1 Linear 프로젝트 = 1 workflow`이다.

예:

- `repo_a` <-> Linear Project A <-> `WORKFLOW.repo_a.md`
- `repo_b` <-> Linear Project B <-> `WORKFLOW.repo_b.md`

이 방식의 장점:

- 어떤 이슈가 어느 레포로 가는지 명확하다.
- repo마다 설치 방식, 테스트 명령, bootstrap 방식을 다르게 둘 수 있다.
- 서로 다른 프로젝트 설정이 섞이지 않는다.

## 8. 예시: repo_a 전용 workflow

대상 레포:

- `/Users/tahooki/Documents/git/repo_a`

예시 workflow:

```yaml
---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "repo-a-project-slug"
  active_states:
    - Todo
    - In Progress
    - Rework
  terminal_states:
    - Done
    - Canceled
    - Duplicate

workspace:
  root: /Users/tahooki/Documents/symphony-workspaces/repo_a

hooks:
  after_create: |
    git clone --depth 1 file:///Users/tahooki/Documents/git/repo_a .
    corepack enable
    pnpm install --frozen-lockfile

codex:
  command: codex app-server
---

You are working on a Linear issue {{ issue.identifier }}.
```

이 설정은:

- Linear의 `repo-a-project-slug` 프로젝트를 본다.
- 이슈가 들어오면 `repo_a` 전용 workspace를 만든다.
- 그 안에 `repo_a`를 복제하고 의존성을 설치한다.

## 9. 예시: repo_b 전용 workflow

```yaml
---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "repo-b-project-slug"

workspace:
  root: /Users/tahooki/Documents/symphony-workspaces/repo_b

hooks:
  after_create: |
    git clone --depth 1 file:///Users/tahooki/Documents/git/repo_b .
    bundle install

codex:
  command: codex app-server
---

You are working on a Linear issue {{ issue.identifier }}.
```

이렇게 하면 repo마다 다른 bootstrap 방식을 둘 수 있다.

## 10. 이슈는 어떻게 작성하면 되는가

이슈에는 보통 폴더 경로나 레포 경로를 적지 않는다. 그건 workflow가 이미 알고 있기 때문이다.

이슈에는 아래 내용을 적는 것이 좋다.

- 목표
- 범위
- 변경 대상
- 검증 방법

예:

```md
Title: Add settings summary card

Goal:
Add a small settings summary card to the dashboard.

Scope:
- show current environment
- show API base URL
- keep UI minimal

Validation:
- dashboard renders at /
- related tests pass
```

즉 이슈는 "무엇을 할지", workflow는 "어디서 어떻게 할지"를 정의한다.

## 11. 매 이슈마다 clone/install 하면 비효율적인가

그럴 수 있다. 그래서 실전에서는 `after_create`를 더 똑똑하게 설계한다.

대표적인 개선 방법:

- `git clone` 대신 `git worktree` 사용
- `npm` 대신 `pnpm`처럼 공유 캐시가 강한 도구 사용
- lockfile이 바뀌지 않으면 install 생략
- 로컬 mirror repo 또는 canonical checkout 사용
- 재시도 시 같은 workspace 재사용

즉 비효율성은 Symphony 자체보다는 workflow bootstrap 전략의 문제다.

## 12. 실무용 추천 구조

추천:

1. repo별로 Linear 프로젝트를 나눈다.
2. repo별로 workflow 파일을 만든다.
3. repo별로 workspace 루트를 분리한다.
4. repo별로 Symphony 프로세스를 따로 띄운다.

예:

```bash
./bin/symphony --port 4000 ./WORKFLOW.repo_a.md
./bin/symphony --port 4001 ./WORKFLOW.repo_b.md
```

## 13. 요약

- Symphony는 Linear 이슈를 읽고 작업을 시작한다.
- 실제 코드는 원본 폴더가 아니라 이슈별 workspace에서 수정된다.
- 어떤 프로젝트를 볼지는 workflow의 `project_slug`가 정한다.
- 어떤 repo를 작업할지는 workflow의 `hooks.after_create`가 정한다.
- 여러 레포를 운영하려면 workflow 파일을 여러 개 만들면 된다.
- 보통 `repo별 Linear 프로젝트`, `repo별 workflow`, `repo별 workspace` 구조가 가장 안전하다.
