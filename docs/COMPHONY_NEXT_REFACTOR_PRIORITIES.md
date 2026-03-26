# Comphony Next Refactor Priorities

이 문서는 현재 리팩터링 진행 이후, 다음에 손대면 가장 효과가 큰 남은 리팩터링 항목을 우선순위 기준으로 정리한 수정 계획서다.

이 문서의 목적은 세 가지다.

- 다음 리팩터링 순서를 명확하게 고정한다.
- 왜 그 순서가 맞는지 근거를 남긴다.
- 바로 실행 가능한 Todo List를 제공한다.

## 현재 판단

현재 기준으로 `state.ts`와 `server.ts`의 핵심 분리는 상당히 진척되었다.

따라서 다음 단계는 "코어 도메인 분리"보다는 아래와 같은 entrypoint / adapter / compatibility 정리에 더 무게를 두는 것이 맞다.

한 줄 판단은 이렇다.

- 꼭 급한 리팩터링은 아니다.
- 하지만 다음에 손대면 가장 이득이 큰 리팩터링은 분명히 남아 있다.

추천 순서는 아래와 같다.

1. CLI command registry화
2. Web 분리
3. Provider adapter 분리
4. `state.ts` thin compatibility layer 마무리

## 1순위. `cli.ts` command registry화

Status:

- completed

대상:

- `src/cli.ts`

핵심 이유:

- `parseArgs`가 여전히 거대한 수동 분기 체인이다.
- 현재 코드베이스에서 유지보수 비용이 가장 높은 진입점이다.
- 명령 추가나 옵션 변경 시 수정 포인트가 많다.

현재 문제:

- command parsing이 선언형 registry가 아니라 if-chain 중심이다.
- parser와 handler 연결이 흩어져 있다.
- 새 명령을 추가할 때 중복 패턴이 반복된다.

목표:

- command registry를 도입한다.
- command path, option schema, parser, handler를 한 구조에 모은다.
- `parseArgs`는 dispatch 중심 함수로 줄인다.

완료 기준:

- `parseArgs`가 현재보다 훨씬 짧아진다.
- 새 command 추가 시 registry만 수정해도 되는 구조가 된다.
- 기존 command 이름과 플래그 호환성은 유지된다.

## 2순위. `web.ts` 분리

Status:

- completed

대상:

- `src/web.ts`

핵심 이유:

- `renderWebAppHtml`가 여전히 단일 거대 진입점이다.
- HTML, CSS, client state, rendering, event wiring, fetch logic가 한 파일에 섞여 있다.
- 수정 시 영향 범위를 예측하기 어렵다.

현재 문제:

- shell/template와 client behavior가 분리되어 있지 않다.
- render 함수와 effect 함수의 경계가 약하다.
- fetch/API 호출과 state 변경이 한 위치에 뒤엉켜 있다.

목표:

- shell/template를 분리한다.
- client state를 분리한다.
- renderers, API helpers, event wiring을 별도 모듈로 분리한다.

완료 기준:

- `renderWebAppHtml`는 shell 조립 중심으로 줄어든다.
- UI 구조와 동작 로직을 따로 읽을 수 있다.
- 탭, task action, SSE 동작은 유지된다.

## 3순위. Provider adapter 분리

Status:

- completed

대상:

- `src/state.ts` 안의 Linear / Supabase 연동 코드

핵심 이유:

- provider-specific HTTP / GraphQL / retry 로직이 아직 core state module에 남아 있다.
- provider 추가나 교체, 테스트 분리가 어렵다.

현재 문제:

- `Linear` / `Supabase` 관련 구현이 `state.ts`에 남아 있다.
- integration failure handling과 state mutation 경계가 약하다.
- provider 테스트와 core runtime 테스트 경계가 흐리다.

목표:

- Linear adapter 분리
- Supabase adapter 분리
- sync interface 정리

완료 기준:

- provider-specific network code가 `state.ts` 밖으로 이동한다.
- state layer는 adapter 호출만 담당한다.
- provider 테스트 경계가 분명해진다.

## 4순위. `state.ts` thin compatibility layer 마무리

Status:

- in_progress

대상:

- `src/state.ts`

핵심 이유:

- 많이 줄었지만 아직 wrapper 이상의 책임이 일부 남아 있다.
- integration/runtime 관리 성격의 함수가 아직 함께 있다.

현재 문제:

- runtime 관리 책임과 compatibility 역할이 완전히 분리되지 않았다.
- 일부 helper와 adapter 성격 코드가 여전히 남아 있다.

목표:

- `state.ts`를 export surface와 compatibility layer 중심으로 정리한다.
- 실제 구현은 domain / orchestrator / integration 모듈로 이동시킨다.

완료 기준:

- `state.ts`는 더 이상 구현 본체가 아니라 조합 레이어에 가깝다.
- domain / orchestration / integration 경계가 분명해진다.

## 추가로 남아 있는 열린 항목

아래 항목은 위 4개와 함께 계속 추적해야 한다.

- `continueThread` / `runTaskWorkTurn` 바깥으로 lane-specific rule 완전 분리
- scattered status string 정리
- direct agent mention / manager reply 호환성 확인 항목 마감
- `/v1/*` endpoint surface unchanged 항목 명시적 확인
- `state.ts` thin compatibility layer 완료

## 추천 실행 순서

가장 추천하는 실제 실행 순서는 아래와 같다.

1. `CLI`
2. `Web`
3. `Provider Adapter`
4. `state.ts` final cleanup

이 순서가 좋은 이유:

- CLI는 현재 가장 큰 수동 분기와 유지보수 비용을 갖고 있다.
- Web은 단일 대형 파일이라 다음으로 효과가 크다.
- Provider adapter는 behavior 경계를 깨끗하게 만들지만, entrypoint 정리 뒤에 하는 편이 자연스럽다.
- `state.ts` 최종 cleanup은 그 앞선 분리가 끝나야 깔끔하게 마무리된다.

## Todo List

### Immediate Todo

- [x] `src/cli.ts`의 command registry 설계 초안 작성
- [x] `src/cli.ts`의 `parseArgs`를 registry dispatch 구조로 전환
- [x] 기존 대표 command path 호환성 유지 검증

### Short-Term Todo

- [x] `src/web.ts`에서 shell/template 분리
- [x] client state 분리
- [x] render 함수 분리
- [x] fetch / API helper 분리
- [x] event wiring / SSE 처리 분리

### Mid-Term Todo

- [x] Linear adapter 분리
- [x] Supabase adapter 분리
- [x] sync abstraction 정리
- [x] provider-specific tests 경계 정리

### Final Cleanup Todo

- [ ] `continueThread` / `runTaskWorkTurn`의 lane-specific rule 잔여 로직 재점검
- [ ] scattered status string 정리
- [ ] direct agent mention / manager reply 호환성 확인
- [ ] `/v1/*` endpoint surface unchanged 명시적 확인
- [ ] `state.ts`를 thin compatibility layer 수준으로 마무리

## 검증 규칙

모든 단계에서 아래를 반복한다.

- `npm run check`
- `npm test`
- `npm run validate:config`

추가 확인 항목:

- CLI 기존 명령 호환성
- thread follow-up / continue / direct agent mention 동작
- web tab / task action / SSE 반영
- Linear sync / Supabase push 테스트 유지

## 완료 조건

이 문서 기준 리팩터링이 완료되었다고 보려면 아래를 만족해야 한다.

- `cli.ts`가 registry 기반 구조가 되었다.
- `web.ts`가 shell / state / render / effect / api로 분리되었다.
- provider-specific integration code가 `state.ts` 밖으로 이동했다.
- `state.ts`는 thin compatibility layer에 가깝다.
- 기존 테스트와 검증 흐름이 계속 통과한다.
