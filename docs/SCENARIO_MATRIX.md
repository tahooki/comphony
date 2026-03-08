# Symphony Scenario Matrix

이 문서는 "어떤 상황에 어떤 workflow 구성이 맞는지"를 빠르게 고르기 위한 매트릭스다.

## 요약표

| 상황 | 추천 구조 | Linear 구성 | repo 준비 방식 | 추천 샘플 |
| --- | --- | --- | --- | --- |
| 사람은 한 프로젝트에만 요청하고 나머지는 자동 분류 | Desk + downstream lanes | `Comphony Desk` + child projects | Desk는 무복제, child workflow가 각자 repo 전략 사용 | `COMPHONY_DESK_MODEL.md`, `WORKFLOW.desk.md` |
| repo 하나를 계속 개발 | repo별 dev workflow 1개 | 프로젝트 1개 | clone 또는 worktree | `WORKFLOW.dev.single-repo.md` |
| 같은 프로젝트 안에서 PM/Research/Design/Dev 분리 | 역할별 workflow 4개 | 프로젝트 1개, 상태 분리 | PM/Research는 무복제 가능, Dev만 repo 준비 | `WORKFLOW.pm.md`, `WORKFLOW.research.md`, `WORKFLOW.design.md`, `WORKFLOW.dev.relay.md` |
| 설치가 무거운 Node repo | worktree 기반 dev workflow | 프로젝트 1개 | `git worktree` + shared cache | `WORKFLOW.dev.worktree.md` |
| 코드가 아닌 조사/문서 정리 | research workflow | 프로젝트 1개 | 빈 workspace 또는 자료 템플릿만 준비 | `WORKFLOW.research.md` |
| 새 repo, 새 프로젝트, 새 workflow 생성 자동화 | project-admin workflow | 관리용 프로젝트 1개 | 관리용 repo clone | `WORKFLOW.project-admin.md` |
| 여러 repo를 동일한 패턴으로 운영 | repo별 workflow 세트 | repo별 프로젝트 분리 권장 | repo별 bootstrap 분리 | 모든 샘플 조합 |

## 케이스별 추천

## A. 사람과 하나의 창구로만 소통하고 싶다

이런 경우:

- 사용자가 어느 프로젝트에 이슈를 넣어야 할지 고민하기 싫다
- AI가 요청을 보고 알아서 `Idea Lab`, `Project Managing`, `Product`로 보내길 원한다
- 작업 결과도 다시 하나의 부모 이슈로 보고받고 싶다

추천:

- `Comphony Desk` 프로젝트 1개
- `Idea Lab`, `Project Managing`, `Product - Foo` 같은 downstream project
- Desk workflow 1개
- child workflow는 각 프로젝트 역할대로 유지

사용 샘플:

- [COMPHONY_DESK_MODEL.md](COMPHONY_DESK_MODEL.md)
- [WORKFLOW.desk.md](workflows/WORKFLOW.desk.md)

## B. 가장 기본적인 코드 작업

이런 경우:

- repo가 하나다
- 이슈는 전부 코드 수정 중심이다
- 역할 분리보다 바로 개발 자동화가 중요하다

추천:

- Linear 프로젝트 1개
- dev workflow 1개
- workspace root 1개

사용 샘플:

- [WORKFLOW.dev.single-repo.md](workflows/WORKFLOW.dev.single-repo.md)

## C. 역할을 나누고 싶다

이런 경우:

- PM이 요구사항을 먼저 정리해야 한다
- Research/Design/Dev가 각자 다른 방식으로 일한다
- 같은 프로젝트에서 단계별로 넘기고 싶다

추천:

- 같은 Linear 프로젝트 1개
- 상태 분리
  - `Planning`
  - `Research`
  - `Design`
  - `Todo`
  - `In Progress`
  - `Human Review`
  - `Done`
- workflow는 역할별로 분리

사용 샘플:

- [WORKFLOW.pm.md](workflows/WORKFLOW.pm.md)
- [WORKFLOW.research.md](workflows/WORKFLOW.research.md)
- [WORKFLOW.design.md](workflows/WORKFLOW.design.md)
- [WORKFLOW.dev.relay.md](workflows/WORKFLOW.dev.relay.md)

## D. 설치 비용이 너무 크다

이런 경우:

- `npm install` 또는 `pnpm install`이 무겁다
- monorepo라 clone/install 비용이 아깝다
- 이슈 재시도 시 bootstrap 비용을 줄이고 싶다

추천:

- canonical checkout 1개 유지
- per-issue workspace는 `git worktree`로 생성
- package manager cache 공유

사용 샘플:

- [WORKFLOW.dev.worktree.md](workflows/WORKFLOW.dev.worktree.md)

## E. 리서치 작업만 처리하고 싶다

이런 경우:

- 코드 수정이 없다
- 조사 결과, 비교표, 제안 문서가 산출물이다
- repo clone이 필요 없다

추천:

- research workflow
- 빈 workspace 또는 notes/output 폴더만 준비
- Linear workpad 또는 markdown report를 남긴다

사용 샘플:

- [WORKFLOW.research.md](workflows/WORKFLOW.research.md)

## F. 운영 자동화/프로젝트 생성 자동화

이런 경우:

- 새 repo를 만들고 싶다
- Linear 프로젝트를 자동 생성하고 싶다
- workflow 템플릿도 같이 생성하고 싶다

추천:

- 별도 관리용 repo 하나
- 별도 관리용 Linear 프로젝트 하나
- meta 작업 전용 workflow 하나

사용 샘플:

- [WORKFLOW.project-admin.md](workflows/WORKFLOW.project-admin.md)

## 설계 원칙

### repo 관심사와 역할 관심사를 분리하라

- repo는 `after_create`가 정한다
- 역할은 workflow의 prompt가 정한다
- 어떤 이슈를 잡을지는 `project_slug`, `active_states`, 필요 시 `assignee`가 정한다

### 같은 프로젝트를 여러 workflow가 볼 수는 있지만, 같은 상태를 겹치게 보지 마라

좋은 예:

- PM workflow -> `Planning`
- Research workflow -> `Research`
- Design workflow -> `Design`
- Dev workflow -> `Todo`, `In Progress`, `Rework`

나쁜 예:

- PM workflow와 Dev workflow 둘 다 `Todo`를 동시에 봄

### 가장 단순한 구조부터 시작하라

처음에는 보통 이것만으로 충분하다.

- `Comphony Desk`
- repo 1개
- Linear 프로젝트 1개
- dev workflow 1개

그 다음 필요할 때 PM/Research/Design workflow를 추가하는 편이 안정적이다.

### 로컬 폴더 이름은 `repos`로 고정하라

추천:

- `repos/` = 원본 저장소
- `workspaces/` = 이슈별 작업공간
- `workflows/` = 실행용 workflow 파일
- `projects` = Linear 프로젝트 이름

이렇게 두면 파일 시스템 개념과 업무 관리 개념이 섞이지 않는다.
