# Comphony Refactoring Execution Plan

이 문서는 현재 `comphony` 코드베이스의 다음 리팩터링을 어떤 순서와 기준으로 진행할지 정리한 실행 계획서다.

기존 체크리스트는 [docs/COMPHONY_REFACTORING_TODO.md](/Users/tahooki/Documents/git/comphony/docs/COMPHONY_REFACTORING_TODO.md)에 유지하고, 이 문서는 그 Todo를 실제로 어떤 묶음으로 나눠서 처리할지 설명한다.

## 1. 목표

목표는 기능 추가가 아니라 구조 단순화다.

구체적으로는 아래를 달성해야 한다.

- `src/state.ts`에 과도하게 몰린 책임을 도메인별로 분리한다.
- 상태 전이 규칙을 한곳에서 이해할 수 있게 만든다.
- HTTP, CLI, Web 진입점의 중복과 거대 함수를 줄인다.
- 외부 연동을 코어 런타임 로직과 분리한다.
- 기존 동작과 테스트는 유지한다.

## 2. 현재 상태 요약

이미 완료되었거나 상당히 진척된 항목:

- `thread/message` 도메인 분리
- `memory/recommendation` 도메인 분리
- `session/actor` 도메인 분리
- `task workflow helper` 일부 분리
- `task lifecycle` 일부 분리

아직 가장 큰 복잡도가 남아 있는 지점:

- `src/state.ts`
  - `intakeRequest`
  - `respondToThread`
  - `runTaskWorkTurn`
  - `continueThread`
  - `handoff/review/consult/approval` 흐름
- `src/server.ts`
  - 단일 `handleRequest` 중심 구조
- `src/cli.ts`
  - 수동 `parseArgs` 체인
- `src/web.ts`
  - HTML, CSS, 상태, 렌더링, 이벤트, API 호출이 한 파일에 집중
- `Linear` / `Supabase` 연동 코드
  - 아직 코어 상태 모듈과 결합

## 3. 리팩터링 원칙

- 공개 CLI 명령과 `/v1/*` HTTP API는 가능한 한 유지한다.
- 먼저 추출하고, 그다음 단순화한다.
- 한 번에 큰 재설계를 하지 않는다.
- 각 Phase는 독립적으로 검증 가능한 단위로 자른다.
- 각 Phase가 끝날 때마다 테스트를 돌리고 커밋 가능한 상태를 만든다.

## 4. 실행 순서

### Phase 1. `state.ts`의 남은 task workflow 코어 분리

Status:

- completed

목적:

- task lifecycle과 workflow 협업 흐름을 `state.ts` 바깥으로 이동시킨다.

대상:

- `handoffTask`
- `requestConsultation`
- `resolveConsultation`
- `requestTaskReview`
- `completeTaskReview`
- `requestApproval`
- `decideApproval`
- `runTaskWorkTurn`

결과물:

- 예: `src/state/task-collaboration.ts`
- 예: `src/state/task-execution.ts`
- `src/state.ts`는 export/호환 레이어 역할만 수행

주의:

- 이 단계에서는 대화 오케스트레이션까지 같이 건드리지 않는다.
- exported API를 옮기더라도 함수 이름과 외부 시그니처는 유지한다.

완료 기준:

- task workflow 관련 exported 함수가 분리된 파일에서 구현된다.
- `src/state.ts`는 위 함수들의 thin wrapper만 유지한다.

### Phase 2. Task state machine / policy 정리

Status:

- completed

목적:

- 상태 전이 규칙을 한곳에 모은다.

대상:

- lane별 상태 전이
- review/approval/consulting/waiting 규칙
- design handoff prerequisite
- parent/child task graph 상태 반영 규칙

결과물:

- 예: `src/state/task-policy.ts`
- 상태 전이 함수와 guard 함수 집합

주의:

- 단순 추출에서 끝내지 말고, 분산된 상태 문자열 사용을 줄인다.
- 가능하면 상태 문자열 상수나 타입 집합을 도입한다.

완료 기준:

- `nextStatusForWorkTurn`, `requiresDesignHandoff`, `refreshTaskGraphState` 계열 규칙이 정책 모듈에서 이해 가능하다.
- 핵심 전이에 대한 테스트가 보강된다.

### Phase 3. Conversation orchestration 분리

Status:

- completed

목적:

- `Comphony`의 대화 처리 로직을 상태 저장 로직과 분리한다.

대상:

- `intakeRequest`
- `respondToThread`
- `resolveConversationAction`
- `continueThread`
- `continueThreadUntilPause`
- `compose*Reply` 계열

결과물:

- 예: `src/orchestrator/thread-orchestrator.ts`
- 예: `src/orchestrator/conversation-intents.ts`

주의:

- 이 단계는 결합도가 높으므로 Phase 1, 2가 끝난 뒤 진행한다.
- direct agent mention과 auto-continue 동작은 유지해야 한다.

완료 기준:

- `state.ts`는 저장소/도메인 연산 위주로 남고, 대화 판단 로직은 orchestrator 계층으로 분리된다.

### Phase 4. `server.ts` 라우팅 구조 단순화

Status:

- completed

목적:

- `handleRequest`의 거대 if-chain을 정리한다.

대상:

- route registry
- 공통 mutation wrapper
- 공통 auth / save / broadcast 패턴

결과물:

- 예: `src/server/routes.ts`
- 예: `src/server/mutation-wrapper.ts`

완료 기준:

- `handleRequest`가 route dispatch 수준으로 줄어든다.
- save/broadcast/auth 중복 코드가 정리된다.

### Phase 5. `cli.ts` 명령 레지스트리화

목적:

- `parseArgs`와 `main`의 수동 분기를 줄인다.

대상:

- command registry
- option schema
- command handler 매핑

결과물:

- 예: `src/cli/commands.ts`
- 예: `src/cli/parser.ts`

완료 기준:

- 새 명령을 추가할 때 한 군데만 수정해도 되게 만든다.
- 기존 명령과 플래그 호환성은 유지한다.

### Phase 6. `web.ts` 분리

목적:

- 단일 HTML 문자열 내부에 있는 app 전체 로직을 분리한다.

대상:

- shell/template
- client state
- render 함수
- fetch/API wrapper
- event binding / EventSource 연결

결과물:

- 예: `src/web/shell.ts`
- 예: `src/web/render.ts`
- 예: `src/web/client.ts`

완료 기준:

- UI 구조와 동작 로직을 따로 읽을 수 있다.
- 탭, task action, event stream은 유지된다.

### Phase 7. 외부 연동 adapter 분리

목적:

- Linear / Supabase 연동을 코어 상태 모듈에서 분리한다.

대상:

- Linear GraphQL helper
- Supabase snapshot push
- sync retry / provider config 접근

결과물:

- 예: `src/integrations/linear.ts`
- 예: `src/integrations/supabase.ts`
- 예: `src/integrations/sync-adapters.ts`

완료 기준:

- provider별 로직이 `state.ts` 밖으로 이동한다.
- provider 테스트와 코어 테스트의 경계가 명확해진다.

## 5. Phase별 검증 규칙

모든 Phase에서 공통으로 아래를 수행한다.

- `npm run check`
- `npm test`
- `npm run validate:config`

추가 스모크 포인트:

- thread intake 생성
- task auto-assign 동작
- work turn artifact 생성
- review / approval 상태 전이
- project 생성
- agent 설치
- Linear sync 테스트
- Supabase push 테스트

## 6. 중단 조건

아래 중 하나가 발생하면 현재 Phase를 멈추고 설계를 다시 확인한다.

- 테스트는 통과하지만 public behavior가 달라짐
- exported 함수 시그니처를 무리하게 바꿔야만 분리가 가능함
- 한 Phase 안에서 server, cli, web까지 같이 바꾸고 싶어짐
- task workflow와 conversation orchestration이 서로 강하게 얽혀 분리 경계가 흐려짐

## 7. 추천 커밋 단위

- Commit 1: task collaboration / execution 분리
- Commit 2: task state machine / policy 정리
- Commit 3: conversation orchestrator 분리
- Commit 4: server route registry 도입
- Commit 5: cli registry 도입
- Commit 6: web 분리
- Commit 7: integration adapter 분리

## 8. Todo List

### Immediate Todo

- [ ] `handoff/review/consult/approval/work turn` 흐름을 `state.ts` 밖으로 분리한다.
- [ ] task 상태 전이 정책 모듈을 만든다.
- [ ] 분산된 상태 문자열 사용을 줄인다.
- [ ] task workflow 관련 테스트를 보강한다.

### Short-Term Todo

- [ ] `respondToThread`와 `continueThread`를 orchestrator 계층으로 분리한다.
- [ ] 대화 intent 해석 로직을 독립 모듈로 분리한다.
- [ ] manager reply / direct agent reply 생성 로직을 정리한다.
- [ ] `server.ts`의 mutation wrapper를 도입한다.

### Mid-Term Todo

- [ ] `server.ts` route registry를 도입한다.
- [ ] `cli.ts` command registry를 도입한다.
- [ ] `web.ts`를 shell/render/client/api 단위로 분리한다.

### Long-Term Todo

- [ ] Linear 연동을 adapter로 분리한다.
- [ ] Supabase 연동을 adapter로 분리한다.
- [ ] sync provider 테스트 경계를 정리한다.

## 9. 완료 기준

이 계획이 완료되었다고 보려면 아래를 만족해야 한다.

- `src/state.ts`가 더 이상 모든 도메인의 구현 본체가 아니다.
- task workflow 규칙이 하나의 정책 계층으로 정리되어 있다.
- conversation orchestration이 별도 계층으로 분리되어 있다.
- server / cli / web entrypoint가 현재보다 더 얇고 선언적이다.
- 외부 provider 로직이 코어 상태 모듈 밖에 있다.
- 기존 테스트가 계속 통과한다.
