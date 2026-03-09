# Comphony Post-MVP Delight Plan

## Why This Document Exists

`Comphony`의 목적은 단순히 로컬 task runtime을 만드는 것이 아니다.

목적은 이것이다.

- 사용자는 `Comphony` 하나와만 대화한다.
- `Comphony`는 내부 에이전트 조직을 움직인다.
- 사용자는 툴을 관리하는 느낌이 아니라 회사를 운영하는 느낌을 받는다.
- 결과뿐 아니라 과정, 맥락, 기억, 책임 흐름까지 신뢰할 수 있어야 한다.

현재 MVP는 이 방향의 핵심 루프를 증명했다.
하지만 아직은 `좋은 작업 콘솔`에 더 가깝고, `감동을 주는 회사형 제품`까지는 한 단계가 더 필요하다.

이 문서는 그 다음 단계를 정리한다.

## Current MVP Strength

지금 MVP가 이미 잘한 것은 분명하다.

- intake, thread, task, handoff, review, approval, memory가 동작한다.
- design -> build -> review 흐름이 실제 artifact 생성까지 이어진다.
- local-first runtime이 실제로 돌아간다.
- Supabase control plane, Linear sync, connector intake까지 기본선이 깔렸다.
- web UI에서 `Chat / Work / People / Projects / Memory`의 뼈대를 확인할 수 있다.

즉, 구조는 맞다.

문제는 `구조가 맞는 것`과 `사용자가 감동하는 것`은 다르다는 점이다.

## What Will Actually Delight The User

사용자가 감동하는 순간은 보통 기능 수가 많을 때가 아니라, 아래 경험이 자연스럽게 이어질 때다.

### 1. One Front Door Feels Real

사용자는 정말 `Comphony` 하나에게만 말해야 한다.

좋은 경험:

- "새 프로젝트 하나 열고, 필요한 직원 뽑고, 기획부터 개발까지 진행해줘."
- "지금 어디까지 됐어?"
- "민아한테 디자인 쪽만 직접 물어봐."
- "이전에 비슷한 일 어떻게 처리했지?"

감동 포인트는 사용자가 lane, state, workflow, sync provider를 몰라도 일이 굴러가는 것이다.

### 2. The Company Feels Alive

에이전트들이 단순 worker가 아니라 실제 직원처럼 보여야 한다.

좋은 경험:

- 누가 무엇을 맡고 있는지 한눈에 보인다.
- 누가 누구에게 물었는지 보인다.
- 리뷰 요청과 승인 대기가 자연스럽다.
- 막힌 일이 왜 막혔는지 설명된다.

감동 포인트는 `작업이 쌓여 있는 보드`가 아니라 `회사 조직이 살아 움직이는 감각`이다.

### 3. The System Acts Before The User Asks

좋은 제품은 사용자가 매번 다음 행동을 지정하지 않아도 된다.

좋은 경험:

- Comphony가 planning, research, design, build로 일을 자동 분해한다.
- 적절한 agent를 자동 배정한다.
- review나 approval이 필요하면 먼저 요청한다.
- 막히면 누구에게 escalation할지 스스로 정한다.

감동 포인트는 사용자가 manager처럼 느껴지되, micromanager가 되지 않는 것이다.

### 4. The System Remembers

기억은 단순 로그가 아니라 회사의 축적이어야 한다.

좋은 경험:

- "비슷한 작업 전에 했었지?"라고 물으면 관련 task, decision, artifact가 바로 나온다.
- 특정 agent의 일하는 방식과 과거 성과가 이어진다.
- project memory가 새 task 시작 품질을 올려준다.

감동 포인트는 `아는 척하는 AI`가 아니라 `실제로 축적되는 회사`다.

### 5. The User Trusts It

강한 자동화일수록 신뢰 모델이 중요하다.

좋은 경험:

- 왜 이 agent에게 맡겼는지 설명된다.
- 왜 이 결정을 했는지 설명된다.
- 외부 sync, repo change, deploy는 예측 가능하게 일어난다.
- 실수했을 때 rollback이나 human takeover가 쉽다.

감동 포인트는 강한 자율성과 강한 통제 가능성이 같이 있는 것이다.

## Product Gaps Between MVP And Delight

현재 MVP와 목표 사이의 가장 큰 차이는 아래다.

### Gap 1. Too Much Manual Control Is Still Visible

지금은 사용자가 task assign, work, handoff 같은 내부 제어를 직접 보는 순간이 많다.

다음 단계에서는:

- 기본 모드는 `대화 중심`
- 수동 제어는 `Advanced Mode`

로 더 강하게 분리해야 한다.

### Gap 2. Agent Identity Is Still Thin

지금 agent는 기능적으로는 존재하지만, 사용자가 관계를 맺는 수준의 identity는 약하다.

다음 단계에서는:

- 각 agent의 스타일, 전문성, 현재 workload, 대표 작업, 강점이 보여야 한다.
- 사용자가 `@agent`로 직접 대화하는 경험이 더 자연스러워야 한다.

### Gap 3. Task Graph Is Not Yet Expressive Enough

현재는 graph가 들어왔지만, 진짜 회사처럼 느끼게 하려면 더 구조화돼야 한다.

다음 단계에서는:

- parent task
- child task
- dependency
- consultation edge
- review edge
- approval edge

가 시각적으로 잘 보여야 한다.

### Gap 4. People And Projects Need To Become Primary Surfaces

`People`과 `Projects`는 지금보다 더 독립적인 경험이어야 한다.

다음 단계에서는:

- People은 `직원 디렉터리`
- Projects는 `사업 포트폴리오`

처럼 느껴져야 한다.

### Gap 5. Marketplace And Hiring Are Still Underpowered

사용자가 에이전트를 쉽게 고용하고 배치하는 경험은 이 제품의 큰 차별점이 될 수 있다.

다음 단계에서는:

- registry에서 agent를 탐색한다.
- capability, trust, cost, style, tools를 본다.
- 한 번에 설치한다.
- project에 배치한다.

이 흐름이 매우 쉬워야 한다.

## Next Product Stage

다음 단계의 제품 목표는 다음 한 문장으로 고정하는 것이 좋다.

`Comphony should feel less like a task console and more like a living AI company that users can direct through one conversation.`

이 목표를 기준으로, 다음 제품 단계는 아래 7개의 축으로 개발한다.

## Pillar 1. Conversation-First Experience

가장 먼저 강화해야 할 축이다.

### What To Build

- 기본 화면을 `chat first`로 재정리
- thread 안에서 후속 질문, 지시, 재지정, status inquiry를 자연어로 처리
- `continue`, `assign`, `handoff` 같은 내부 액션은 기본 UI에서 뒤로 숨기기
- Comphony 답변을 더 manager-like 하게 만들기

### What Success Looks Like

- 사용자가 버튼보다 메시지를 더 많이 쓰게 된다.
- 상태 질의, 진행 지시, 에이전트 호출이 모두 대화로 가능하다.

## Pillar 2. Rich Agent Identity And Hiring

이 제품의 차별점은 `직원` 개념이 살아 있는 데 있다.

### What To Build

- agent profile page
- skill/capability card
- work history
- trust level
- current workload
- recommended for projects
- install from registry
- assign to project

### What Success Looks Like

- 사용자가 "디자이너 한 명 더 뽑아줘"라고 말하면 실제로 registry 탐색과 배치까지 이어진다.
- 특정 에이전트를 기억하고 다시 찾게 된다.

## Pillar 3. Automatic Planning And Delegation

`Comphony`가 단순 오퍼레이터가 아니라 manager처럼 느껴지게 해야 한다.

### What To Build

- intake를 child task graph로 자동 분해
- lane별 추천 agent 자동 선택
- consultation/review/approval 자동 발행
- blocked reason 기반 escalation
- 다음 task 자동 활성화

### What Success Looks Like

- 사용자는 큰 요청만 던지고, Comphony는 내부 task graph를 스스로 조직한다.

## Pillar 4. People And Projects As Living Surfaces

`People`과 `Projects`는 상태 조회 탭이 아니라 제품의 핵심 장면이 되어야 한다.

### What To Build

- People view
  - 현재 하는 일
  - 맡은 프로젝트
  - 최근 산출물
  - 대기 중 review/consultation
- Projects view
  - active initiatives
  - assigned agents
  - health
  - blocked items
  - recent outcomes

### What Success Looks Like

- 사용자가 조직과 프로젝트 상태를 한눈에 이해한다.
- "누가 바쁜지", "어느 프로젝트가 막혔는지"가 즉시 보인다.

## Pillar 5. Memory That Improves Work

memory는 단순 로그가 아니라 생산성을 올려야 한다.

### What To Build

- task memory와 project memory를 더 명확히 구분
- 비슷한 작업 시작 시 관련 memory 자동 주입
- decision log를 task completion summary와 연결
- agent-specific memory policy
- memory pin / canonical decision marking

### What Success Looks Like

- 새 작업의 품질이 이전 작업 덕분에 높아진다.
- 사용자가 "전에 어떻게 했지?"를 자주 묻지 않아도 된다.

## Pillar 6. Trust, Explainability, And Safe Autonomy

감동은 자동화만으로 오지 않는다. 신뢰가 있어야 한다.

### What To Build

- assignment rationale
- handoff rationale
- approval rationale
- human takeover flow
- rollback-safe external actions
- risk level 표시

### What Success Looks Like

- 사용자가 시스템을 믿고 더 큰 일을 맡긴다.
- 문제가 생겨도 개입 포인트가 명확하다.

## Pillar 7. Remote Control And Daily Use

실제로 매일 쓰게 만들려면 어디서든 접근 가능해야 한다.

### What To Build

- Supabase realtime 기반 remote mirror
- 모바일 우선 thread/status UI
- remote inbox
- connector reply flow
- push notification or digest

### What Success Looks Like

- 사용자가 책상 앞이 아니어도 Comphony를 운영한다.
- Telegram, Discord, Slack이 단순 intake가 아니라 실제 대화 채널이 된다.

## Highest-Leverage Features To Build Next

다음 우선순위는 아래가 가장 좋다.

1. `Conversation-first orchestration`
   - Comphony가 기본적으로 수동 버튼 없이도 plan -> assign -> work -> review를 굴리게 만든다.
2. `Agent profile + hiring surface`
   - 에이전트를 고용하고 배치하는 경험을 제품의 중심으로 올린다.
3. `Task graph visualization`
   - child task, dependency, consultation, review 관계를 UI에서 명확히 보이게 만든다.
4. `People / Projects first-class pages`
   - 운영 경험을 "작업 목록"에서 "회사 현황"으로 끌어올린다.
5. `Memory injection and decision pinning`
   - 과거 축적이 실제 현재 작업 품질을 높이게 한다.
6. `Realtime remote control`
   - 모바일/원격 환경에서도 같은 중심 경험을 유지한다.

## What Not To Do Next

다음 단계에서 피해야 할 것도 분명하다.

- 기능 버튼만 더 늘리기
- 외부 connector만 많이 붙이기
- state/status 종류만 더 세분화하기
- 문서만 더 추가하고 사용자 경험을 안 바꾸기
- marketplace 없이 agent 설치를 계속 엔지니어링 작업처럼 남겨두기

이런 것들은 복잡도는 늘리지만 감동을 만들지 못한다.

## Desired User Reactions

다음 제품 단계가 성공하면 사용자는 이런 반응을 보이게 된다.

- "툴을 쓰는 게 아니라 회사를 운영하는 느낌이다."
- "Comphony가 알아서 사람을 붙이고 일을 굴린다."
- "누가 뭘 하고 있는지 살아 있는 조직처럼 보인다."
- "전에 했던 일을 진짜 기억하고 활용한다."
- "중간에 끼어들어 방향만 잡아줘도 된다."

## Practical Definition Of Success

다음 단계의 성공 기준은 아래처럼 잡는 것이 좋다.

- 사용자가 하나의 thread에서 요청, 질문, 재지시, agent 호출, status 확인을 끝낼 수 있다.
- Comphony가 내부 task graph를 자동 생성하고 진행시킨다.
- agent를 registry에서 고용하고 project에 배치하는 흐름이 자연스럽다.
- People, Projects, Memory가 별도 핵심 화면으로 작동한다.
- remote 환경에서도 같은 수준의 운영 감각을 유지한다.

## Final Direction

MVP 이후의 목표는 더 많은 기능을 추가하는 것이 아니다.

목표는 이것이다.

`Comphony should stop feeling like a clever local runtime and start feeling like a real AI company that the user can run with one conversation.`

그 변화가 일어나야 사용자는 기능이 아니라 경험에서 감동을 받는다.
