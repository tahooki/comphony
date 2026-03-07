# Start With Codex

이 문서는 `comphony`를 클론한 뒤, Codex가 이 저장소만 읽고도 `Symphony + Linear`를 실제로 연결하고 작동 가능한 구조로 세팅할 수 있게 만드는 시작 가이드다.

목표는 단순하다.

- 문서만 읽고 끝나는 것이 아니라
- Linear 프로젝트를 준비하고
- workflow 파일을 만들고
- Symphony를 실행할 수 있게 하고
- 최종적으로는 Linear 이슈만 만들면 작업이 시작되도록 만든다

## 1. 가장 먼저 해야 할 일

### 사람

1. 이 저장소를 클론한다.
2. [MISSION.template.md](../MISSION.template.md)를 참고해 `MISSION.md`를 만든다.
3. Codex에게 아래처럼 요청한다.

```text
Read AGENTS.md, docs/START_WITH_CODEX.md, and MISSION.md.
Set up Symphony + Linear end-to-end for this machine.
Continue until the acceptance criteria in MISSION.md are satisfied.
Only stop if you are blocked by missing credentials, permissions, or a required naming decision.
```

### Codex

Codex는 아래 우선순위로 문서를 읽어야 한다.

1. [../AGENTS.md](../AGENTS.md)
2. [../MISSION.md](../MISSION.md) 또는 [../MISSION.template.md](../MISSION.template.md)
3. [SYMPHONY_BASICS.md](SYMPHONY_BASICS.md)
4. [COMPHONY_COMPANY_MODEL.md](COMPHONY_COMPANY_MODEL.md)
5. 필요한 경우 [SCENARIO_MATRIX.md](SCENARIO_MATRIX.md), [WORKFLOW_PARTS.md](WORKFLOW_PARTS.md), [ISSUE_LIFECYCLE.md](ISSUE_LIFECYCLE.md)

## 2. Codex가 실제로 수행해야 하는 단계

### Phase 1. 목표 확정

Codex는 먼저 이번 셋업의 범위를 명확히 해야 한다.

최소 확인 항목:

- 어떤 Linear workspace/team을 쓸지
- 어떤 Linear 프로젝트들을 만들지
- 어떤 repo들을 작업 대상으로 연결할지
- 어떤 역할 workflow를 활성화할지
- 어떤 경로에 workspace를 만들지

`MISSION.md`가 없으면, Codex는 [MISSION.template.md](../MISSION.template.md)를 기준으로 초안을 만들고 부족한 정보만 보완하면 된다.

### Phase 2. 환경 검증

Codex는 아래를 확인한다.

- Symphony 설치 여부
- `LINEAR_API_KEY` 유무
- GitHub / Git / package manager 사용 가능 여부
- 대상 repo 경로 존재 여부
- Symphony 실행 명령과 포트 계획

이 단계에서는 "설치가 필요한지"와 "바로 실행 가능한지"를 판단해야 한다.

### Phase 3. Linear 연동

Codex는 아래를 맞춘다.

- Linear API 키가 안전하게 설정되어 있는지
- 필요한 Linear 프로젝트가 있는지
- 필요한 상태 구조가 있는지

추천 기본 구조:

- `Idea Lab`
- `Project Managing`
- `Product - Core`

추천 기본 역할:

- `PM`
- `Research`
- `Dev`
- 필요하면 `Design`
- 필요하면 `Project Admin`

### Phase 4. Workflow 생성

Codex는 역할과 repo 전략에 맞는 workflow 파일을 만든다.

예:

- `WORKFLOW.pm.md`
- `WORKFLOW.research.md`
- `WORKFLOW.dev.md`
- `WORKFLOW.project-admin.md`

이때 workflow는 반드시 아래를 포함해야 한다.

- `project_slug`
- `active_states`
- `workspace.root`
- `hooks.after_create`
- `codex.command`

### Phase 5. 실행 경로 구성

Codex는 실제로 사람이 다시 실행할 수 있게 만들어야 한다.

최소 결과물:

- 실행 스크립트 또는 실행 명령
- 실제 workflow 파일 경로
- workspace 루트 경로
- 필요한 환경 변수 설명
- 대시보드 접근 URL

### Phase 6. 스모크 테스트

Codex는 최소 한 번은 실제 작동 경로를 검증해야 한다.

검증 방식 예:

- Linear에 테스트 이슈 생성
- Symphony가 이슈를 잡는지 확인
- 상태가 `Todo -> In Progress`로 이동하는지 확인
- workspace 폴더가 생성되는지 확인
- dashboard에서 running agent가 보이는지 확인

### Phase 7. 문서 마감

마지막에는 문서를 실제 설정값 기준으로 맞춘다.

반영해야 하는 내용:

- 실제 Linear 프로젝트 이름
- 실제 repo 경로
- 실제 workflow 파일 경로
- 실제 workspace 루트
- 실제 실행 명령
- 실제 검증 결과

## 3. Codex가 멈추면 안 되는 지점

아래는 "문서만 읽고 설명만 하고 끝내면 안 되는" 작업들이다.

- workflow 예시만 보여주고 실제 파일은 만들지 않는 것
- Linear 구조만 제안하고 프로젝트/상태는 준비하지 않는 것
- Symphony 실행법만 설명하고 실제 실행 검증은 하지 않는 것
- smoke test 없이 "아마 작동할 것"이라고 끝내는 것

즉 이 가이드의 목적은 `설계 설명`이 아니라 `실제 가동되는 초기 상태`를 만드는 데 있다.

## 4. 권장 기본 셋업

처음 시작할 때 가장 추천하는 최소 구성은 아래다.

### Linear 프로젝트

- `Idea Lab`
- `Project Managing`
- `Product - Core`

### Workflow

- `PM workflow`
- `Research workflow`
- `Dev workflow`
- `Project-admin workflow`

### 역할 분리 방식

- `Idea Lab`
  - `Planning`, `Research`, `Approved`
- `Project Managing`
  - `Requested`, `Provisioning`, `Verification`, `Done`
- `Product - Core`
  - `Planning`, `Research`, `Todo`, `In Progress`, `Rework`, `Human Review`, `Done`

이 정도면 아이디어 수집, 메타 세팅, 실제 개발까지 연결되는 최소 회사 구조가 된다.

## 5. Definition of Done

Codex는 아래가 모두 참일 때까지 계속 도와야 한다.

1. Symphony가 이 머신에서 실행 가능하다.
2. Linear와 API 수준으로 연결된다.
3. 필요한 Linear 프로젝트와 상태가 준비되어 있다.
4. 적어도 하나의 실제 workflow가 repo 또는 research 작업과 연결되어 있다.
5. 실행 스크립트 또는 실행 명령이 남아 있다.
6. 테스트 이슈 경로가 검증되었다.
7. 사용자가 "이제 이슈만 만들면 된다"는 상태를 이해할 수 있게 문서가 정리되어 있다.

## 6. 기본 산출물

셋업이 끝나면 최소 아래가 남아야 한다.

- `MISSION.md`
- 실제 workflow 파일들
- 실행 스크립트
- 프로젝트 구조 문서
- smoke test 결과 또는 확인 로그

## 7. 같이 읽으면 좋은 문서

- [SYMPHONY_BASICS.md](SYMPHONY_BASICS.md)
- [COMPHONY_COMPANY_MODEL.md](COMPHONY_COMPANY_MODEL.md)
- [SCENARIO_MATRIX.md](SCENARIO_MATRIX.md)
- [ISSUE_LIFECYCLE.md](ISSUE_LIFECYCLE.md)
- [WORKFLOW_PARTS.md](WORKFLOW_PARTS.md)
