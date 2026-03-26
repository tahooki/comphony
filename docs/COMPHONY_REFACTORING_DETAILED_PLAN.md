# Comphony Refactoring Detailed Plan

이 문서는 현재 코드베이스 상태를 기준으로, 다음 리팩터링을 어떤 순서와 기준으로 진행할지 상세하게 정리한 실행 문서다.

기존의 큰 방향과 체크리스트는 아래 문서를 참고한다.

- `docs/COMPHONY_REFACTORING_TODO.md`
- `docs/COMPHONY_REFACTORING_EXECUTION_PLAN.md`

이 문서는 그보다 더 구체적으로:

- 지금 무엇이 남아 있는지
- 어떤 파일과 함수가 대상인지
- 어떤 순서로 자를지
- 각 단계의 산출물과 검증 기준이 무엇인지
- 실제 Todo List가 무엇인지

를 정리한다.

## 1. 현재 상태

이미 정리된 영역:

- `thread/message` 도메인 분리
- `memory/recommendation` 도메인 분리
- `session/actor` 도메인 분리
- `task lifecycle` 일부 분리
- `task collaboration` 분리
- `task execution` 분리
- `task policy` 분리
- task policy 전용 테스트 추가

즉, `state.ts` 안의 순수 task workflow 코어는 상당 부분 정리되었다.

하지만 아직 아래 영역은 구조적으로 크다.

### 1.1 남은 큰 덩어리

- conversation orchestration
  - `respondToThread`
  - `intakeRequest`
  - `continueThread`
  - `resolveConversationAction`
  - `continueThreadUntilPause`
  - `compose*Reply`
- HTTP entrypoint
  - `server.ts`의 `handleRequest`
- CLI entrypoint
  - `cli.ts`의 `parseArgs`
- Web entrypoint
  - `web.ts`의 `renderWebAppHtml`
- external integrations
  - Linear
  - Supabase

### 1.2 현재 코드가 어려운 이유

- 대화 해석과 상태 변경이 아직 `state.ts`에 함께 있다.
- HTTP 계층이 resource router가 아니라 단일 giant handler다.
- CLI가 선언형 명령 스펙이 아니라 수동 if-chain이다.
- Web UI가 shell, state, render, effects, API 호출이 한 파일에 섞여 있다.
- provider integration이 core state module에 남아 있다.

## 2. 이번 수정의 핵심 목표

다음 리팩터링의 핵심 목표는 아래 다섯 가지다.

1. `Comphony`의 대화 판단 로직을 상태 저장 로직과 분리한다.
2. entrypoint 계층을 얇게 만든다.
3. provider 연동을 adapter 뒤로 숨긴다.
4. 기존 동작을 바꾸지 않는다.
5. 각 단계마다 테스트가 계속 통과하는 구조를 유지한다.

## 3. 비목표

이번 수정에서 하지 않을 것:

- 제품 기능 추가
- 데이터 모델 재설계
- API surface breaking change
- UI redesign
- tracker provider behavior 변경
- 상태 이름 전체 rename

## 4. 추천 실행 순서

추천 순서는 아래와 같다.

1. Conversation orchestration 분리
2. `server.ts` 라우팅 구조 정리
3. `cli.ts` command registry 도입
4. `web.ts` 분리
5. Linear / Supabase adapter 분리

이 순서가 좋은 이유:

- 현재 가장 큰 복잡도는 `state.ts`에 남아 있는 대화 오케스트레이션이다.
- 이걸 먼저 분리해야 server/cli/web이 같은 orchestration 경계를 공유할 수 있다.
- integration adapter는 마지막에 해도 제품 동작에는 영향이 적다.

## 5. Phase A. Conversation Orchestration 분리

Status:

- completed

### 5.1 목적

`Comphony`가 사용자 메시지를 해석하고, 일을 계속 진행할지, 프로젝트를 만들지, 에이전트를 설치할지, 단순 상태 응답을 줄지 판단하는 로직을 `state.ts`에서 분리한다.

### 5.2 현재 대상 함수

- `respondToThread`
- `intakeRequest`
- `continueThread`
- `resolveConversationAction`
- `continueThreadUntilPause`
- `composeContinueLoopReply`
- `composeProjectCreationReply`
- `composeAgentInstallReply`
- `composePeopleSummaryReply`
- `composeAgentDirectedReply`
- `composeManagerThreadReply`

### 5.3 목표 구조

추천 파일 구조:

- `src/orchestrator/thread-orchestrator.ts`
- `src/orchestrator/conversation-intents.ts`
- `src/orchestrator/reply-builder.ts`

역할 분리:

- `thread-orchestrator.ts`
  - thread 단위 실행 흐름
  - follow-up 처리
  - auto-continue loop
- `conversation-intents.ts`
  - 자연어 의도 해석
  - project create / agent install / continue / people summary 분기
- `reply-builder.ts`
  - user-facing 응답 텍스트 조립

### 5.4 세부 작업

- `respondToThread`를 thin wrapper로 바꾼다.
- intent 해석을 `conversation-intents.ts`로 이동한다.
- reply 생성 함수를 `reply-builder.ts`로 이동한다.
- `continueThreadUntilPause`를 orchestrator helper로 이동한다.
- `intakeRequest`가 orchestration 성격이면 orchestrator 계층으로 이동하고, pure task creation은 state/domain에 남긴다.

### 5.5 주의사항

- direct agent mention 동작은 그대로 유지해야 한다.
- `thread ask can continue work autonomously` 테스트가 깨지면 안 된다.
- project 생성과 agent 설치의 chat-trigger behavior는 유지해야 한다.

### 5.6 완료 기준

- `state.ts`에서 conversation intent 판단 로직이 사라진다.
- reply composition 함수가 `state.ts` 밖으로 이동한다.
- orchestration entrypoint는 별도 모듈에서 읽을 수 있다.

## 6. Phase B. `server.ts` 정리

Status:

- completed

### 6.1 목적

단일 `handleRequest` giant if-chain을 route registration 구조로 바꾼다.

### 6.2 현재 대상

- `handleRequest`
- POST mutation 공통 패턴
- auth / save / broadcast 중복

### 6.3 목표 구조

추천 파일 구조:

- `src/server/routes.ts`
- `src/server/route-types.ts`
- `src/server/mutation-wrapper.ts`

### 6.4 세부 작업

- GET route table을 분리한다.
- POST route table을 분리한다.
- 공통 mutation wrapper를 만든다.
  - auth 확인
  - payload parse
  - execute
  - save
  - event broadcast
  - response write
- `handleRequest`는 route lookup + dispatch만 담당하게 한다.

### 6.5 완료 기준

- `handleRequest`가 현재보다 훨씬 짧아진다.
- POST mutation 패턴이 한 곳에서 재사용된다.
- endpoint path는 그대로 유지된다.

## 7. Phase C. `cli.ts` 정리

### 7.1 목적

수동 `parseArgs` 체인을 command registry 기반으로 정리한다.

### 7.2 현재 대상

- `parseArgs`
- `main`
- command-specific handler wiring

### 7.3 목표 구조

추천 파일 구조:

- `src/cli/parser.ts`
- `src/cli/command-registry.ts`
- `src/cli/handlers/*.ts`

### 7.4 세부 작업

- command definition object를 만든다.
- 각 command의:
  - path
  - option schema
  - parser
  - handler
  를 registry에 넣는다.
- `parseArgs`는 registry dispatch만 수행하게 만든다.

### 7.5 완료 기준

- 새 command를 추가할 때 if-chain을 늘리지 않아도 된다.
- 기존 명령과 옵션은 호환된다.

## 8. Phase D. `web.ts` 정리

### 8.1 목적

현재 단일 HTML string 안에 들어 있는 app shell, state, rendering, effects, fetch logic를 분리한다.

### 8.2 현재 대상

- `renderWebAppHtml`
- embedded client state
- render functions
- event handlers
- fetch helpers
- SSE 연결

### 8.3 목표 구조

추천 파일 구조:

- `src/web/shell.ts`
- `src/web/renderers.ts`
- `src/web/client-state.ts`
- `src/web/api.ts`
- `src/web/events.ts`

### 8.4 세부 작업

- HTML shell template를 분리한다.
- inline client logic를 작은 모듈로 나눈다.
- 탭 전환, thread selection, task action, SSE 반영을 별도 함수로 나눈다.

### 8.5 완료 기준

- `renderWebAppHtml`이 shell 조립 중심으로 줄어든다.
- fetch/effect/render가 분리된다.
- 현재 UI behavior는 유지된다.

## 9. Phase E. Integration Adapter 분리

### 9.1 목적

Linear / Supabase 연동을 core state module 밖으로 이동시킨다.

### 9.2 현재 대상

- `syncRuntimeToSupabase`
- `fetchLinearTeamId`
- `fetchLinearProjectId`
- `createLinearIssue`
- `updateLinearIssue`
- `linearGraphql`

### 9.3 목표 구조

추천 파일 구조:

- `src/integrations/linear.ts`
- `src/integrations/supabase.ts`
- `src/integrations/sync.ts`

### 9.4 세부 작업

- provider-specific HTTP logic를 분리한다.
- state layer는 adapter 호출만 하게 만든다.
- provider config access를 helper로 묶는다.

### 9.5 완료 기준

- provider API 호출 로직이 `state.ts` 밖에 있다.
- sync 실패/재시도 테스트 경계가 더 분명해진다.

## 10. 테스트 전략

모든 Phase에서 공통 검증:

- `npm run check`
- `npm test`
- `npm run validate:config`

Phase별 추가 권장 검증:

### Conversation orchestration

- thread follow-up
- direct agent mention
- auto-continue
- chat 기반 project create
- chat 기반 agent install

### Server

- 기존 `/v1/*` endpoint 동작 유지
- mutation 이후 event broadcast 유지

### CLI

- 기존 command path와 option parsing 유지
- 대표 command smoke test

### Web

- render HTML smoke
- tab behavior
- thread/task action wiring 유지

### Integrations

- Linear sync test
- Supabase push test

## 11. 리스크와 대응

### 리스크 1. 오케스트레이션 분리 중 행동 변화

대응:

- intent 판단과 reply composition을 먼저 pure function으로 분리한다.
- orchestration entrypoint wrapper는 마지막에 얇게 바꾼다.

### 리스크 2. route 정리 중 auth/save/broadcast 누락

대응:

- mutation wrapper 도입 전후 snapshot-like behavior를 비교한다.

### 리스크 3. CLI registry 전환 중 하위 명령 깨짐

대응:

- 자주 쓰는 command path를 fixture처럼 정리해서 smoke test한다.

### 리스크 4. Web 분리 중 hidden coupling 발생

대응:

- shell, api, event wiring을 먼저 나누고 render는 마지막에 나눈다.

## 12. 추천 커밋 단위

- Commit A1: conversation intent/reply extraction
- Commit A2: thread orchestrator extraction
- Commit B1: server route registry
- Commit B2: server mutation wrapper cleanup
- Commit C1: cli command registry
- Commit D1: web shell/api split
- Commit D2: web render/effects split
- Commit E1: linear adapter extraction
- Commit E2: supabase adapter extraction

## 13. Detailed Todo List

### Immediate Todo

- [ ] `respondToThread`를 orchestrator 모듈로 이동한다.
- [ ] `intakeRequest`의 orchestration 부분과 pure task creation 부분을 분리한다.
- [ ] `continueThread`를 orchestrator 계층으로 이동한다.
- [ ] `resolveConversationAction`를 `conversation-intents` 모듈로 이동한다.
- [ ] `compose*Reply` 함수들을 `reply-builder` 모듈로 이동한다.

### Short-Term Todo

- [ ] `server.ts` GET/POST route table을 분리한다.
- [ ] mutation wrapper를 도입한다.
- [ ] `handleRequest`를 dispatch 중심으로 줄인다.
- [ ] `cli.ts` command registry 초안을 만든다.
- [ ] `parseArgs`에서 registry dispatch를 사용하게 만든다.

### Mid-Term Todo

- [ ] `web.ts`에서 shell template를 분리한다.
- [ ] client state 로직을 별도 모듈로 이동한다.
- [ ] fetch/API wrapper를 분리한다.
- [ ] SSE 연결 로직을 별도 모듈로 이동한다.
- [ ] render 함수들을 renderer 모듈로 이동한다.

### Long-Term Todo

- [ ] Linear adapter를 분리한다.
- [ ] Supabase adapter를 분리한다.
- [ ] sync layer 테스트 경계를 정리한다.
- [ ] `state.ts`를 최종 thin compatibility layer 수준으로 줄인다.

## 14. Done 조건

이 계획이 끝났다고 보려면 아래를 만족해야 한다.

- `state.ts`는 orchestration과 integration의 구현 본체가 아니다.
- task policy와 workflow 규칙은 전용 계층에 모여 있다.
- conversation orchestration은 전용 계층에 모여 있다.
- `server.ts`, `cli.ts`, `web.ts`는 현재보다 더 얇고 읽기 쉬워진다.
- provider 연동은 adapter 뒤로 숨겨진다.
- 테스트가 계속 통과한다.
