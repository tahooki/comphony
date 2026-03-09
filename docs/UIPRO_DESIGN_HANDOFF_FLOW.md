# UIPro Design Handoff Flow

이 문서는 `UIPro` 기반 디자인 계획서를 만들고, 그 산출물을 토대로 개발과 퍼블리싱을 진행하는 `Comphony` 표준 흐름을 정리한다.

## 목적

이 흐름의 목표는 단순하다.

- 디자인 아이디어를 바로 코드로 점프하지 않는다
- 먼저 `UIPro`로 디자인 계획서를 만든다
- 그 계획서를 기준으로 프론트 구현과 퍼블리싱을 진행한다
- 리뷰 시에는 결과가 계획서와 얼마나 일치하는지 확인한다

## 기본 역할 분리

- `Design Planner`
  - `UIPro`로 디자인 시스템과 계획서 작성
- `Frontend Publisher`
  - 계획서를 읽고 실제 UI 구현
- `Reviewer`
  - 계획서 대비 구현 차이 검토

## 표준 산출물

디자인 단계가 끝나면 최소 아래 파일이 남아야 한다.

- `design-system/MASTER.md`
- `design-system/pages/<page>.md`
- `plans/design/design-plan.md`
- `plans/design/dev-handoff.md`

의미:

- `design-system/MASTER.md`
  - 전역 디자인 시스템 규칙
- `design-system/pages/<page>.md`
  - 특정 화면 override
- `plans/design/design-plan.md`
  - 이번 작업의 목적, 구조, 상태, 핵심 UX 결정
- `plans/design/dev-handoff.md`
  - 개발자가 바로 구현할 수 있는 체크리스트

## 권장 단계

### 1. Research

입력:

- 문제 정의
- 제품 유형
- 주요 사용자
- 화면 범위

작업:

- 레퍼런스 조사
- UX 패턴 조사
- `UIPro` 키워드 정리

### 2. Design

입력:

- 조사 결과
- repo 컨텍스트
- 현재 제품 방향

작업:

- `UIPro`로 디자인 시스템 초안 생성
- 페이지별 override 생성
- `design-plan.md` 작성
- `dev-handoff.md` 작성

이 단계에서 중요한 점:

- 문장만 예쁘게 쓰고 끝내면 안 된다
- 개발자가 바로 구현 가능한 수준의 상태와 규칙이 있어야 한다

### 3. Build / Publishing

입력:

- `design-system/MASTER.md`
- `design-system/pages/<page>.md`
- `plans/design/design-plan.md`
- `plans/design/dev-handoff.md`

작업:

- 구현 전에 handoff를 재요약
- 디자인 시스템 규칙을 코드에 반영
- 구현 후 visual QA
- 차이가 있으면 deviation note 작성

## `design-plan.md`에 꼭 들어갈 항목

- screen goal
- user intent
- layout structure
- section order
- component list
- interaction states
- empty/loading/error states
- copy tone
- accessibility constraints

## `dev-handoff.md`에 꼭 들어갈 항목

- implementation scope
- required components
- spacing and layout rules
- color and typography rules
- responsive behavior
- interaction rules
- QA checklist
- explicit anti-patterns

## 개발자가 이걸 어떻게 써야 하나

개발자는 구현 전에 반드시 아래 순서로 읽는다.

1. `design-system/MASTER.md`
2. 해당 페이지 override
3. `plans/design/design-plan.md`
4. `plans/design/dev-handoff.md`

그리고 구현 시작 전에 최소 이 내용을 다시 적어야 한다.

- 이번 화면의 핵심 구조
- 지켜야 하는 디자인 규칙
- 주의할 anti-pattern

즉 handoff는 참고 문서가 아니라 구현 계약서처럼 써야 한다.

## 추천 issue 흐름

- `Research`
  - 레퍼런스/UX 조사
- `Design`
  - `UIPro` 기반 계획서와 handoff 생성
- `Todo`
  - 구현 시작
- `Human Review`
  - 계획서 대비 구현 검토

## 한 줄 원칙

`UIPro`는 아이디어 스케치 도구가 아니라, 개발 가능한 디자인 계획서를 만드는 단계에 써야 한다.
