# Comphony Doc Alignment Checklist

이 문서는 `Comphony`의 문서 기대치와 현재 구현 상태를 비교하기 위한 점검용 체크리스트다.

목적:

- 문서에 적힌 기능이 실제 런타임/코드/스크립트/UI에 반영되었는지 확인한다.
- `구현 완료`, `부분 구현`, `미구현`을 한 문서에서 빠르게 확인한다.
- 리팩터링이나 기능 추가 시, 어디가 비어 있는지 바로 보이게 한다.

사용 규칙:

- `[x]` 문서 기대치가 현재 코드/스크립트/UI 기준으로 실질적으로 충족된 항목
- `[ ]` 아직 완전히 충족되지 않은 항목
- 부분 구현은 `[ ]`로 두고 `Current:`에 현재 상태를 적는다.
- 문서상 이상형과 현재 MVP를 구분하기 위해 `Docs:`와 `Current:`를 함께 적는다.

검토 범위:

- Canonical docs
  - `docs/COMPHONY_PURPOSE_AND_VISION.md`
  - `docs/COMPHONY_USER_EXPERIENCE.md`
  - `docs/COMPHONY_FINAL_ARCHITECTURE.md`
  - `docs/COMPHONY_SYSTEM_ARCHITECTURE.md`
  - `docs/COMPHONY_DATA_MODEL.md`
  - `docs/COMPHONY_UI_INFORMATION_ARCHITECTURE.md`
  - `docs/COMPHONY_TRUST_AND_PERMISSIONS.md`
  - `docs/COMPHONY_SYNC_AND_SOURCE_OF_TRUTH.md`
  - `docs/COMPHONY_AUTONOMY_POLICY.md`
  - `docs/COMPHONY_AGENT_PACKAGE_SPEC.md`
  - `docs/COMPHONY_EXECUTION_STATE_MACHINE.md`
  - `docs/COMPHONY_API_AND_EVENT_PROTOCOL.md`
  - `docs/COMPHONY_CONFIG_SPEC.md`
  - `docs/COMPHONY_IDENTITY_AND_MEMORY_POLICY.md`
  - `docs/COMPHONY_MVP_AND_DEVELOPMENT.md`
  - `docs/OPERATING_LEVEL_DEVELOPMENT_PLAN.md`
  - `docs/20260309211824_COMPHONY_POST_MVP_DELIGHT_PLAN.md`
- Supporting docs
  - `docs/COMPHONY_DESK_MODEL.md`
  - `docs/COMPHONY_COMPANY_MODEL.md`
  - `docs/ISSUE_LIFECYCLE.md`
- Transitional setup / legacy references
  - `README.md`
  - `AGENTS.md`
  - `docs/START_WITH_CODEX.md`
  - `docs/LOCAL_LAYOUT.md`
  - `MISSION.template.md`

Last reviewed:

- 2026-03-26

Verification snapshot:

- `npm run validate:config` passed on 2026-03-26
- `npm test` passed on 2026-03-26 with `44/44` tests green

## 1. Product Identity And Promise

- [x] `Comphony`가 하나의 회사처럼 동작하는 단일 front door를 제공한다.
  Docs: 사용자는 내부 topology보다 `Comphony` 자체와 상호작용해야 한다.
  Current: 로컬 웹 UI에 `Company Inbox`와 thread 중심 진입점이 존재한다.

- [x] 자연어 요청을 받아 내부 작업으로 라우팅하는 기본 흐름이 있다.
  Docs: 사용자는 결과만 말하고, 시스템이 적절한 agent/task로 라우팅해야 한다.
  Current: intake -> thread -> routed task 생성 흐름이 구현되어 있다.

- [x] 특정 agent에게 직접 말을 거는 상호작용이 있다.
  Docs: 필요하면 사용자가 특정 에이전트와 직접 대화할 수 있어야 한다.
  Current: `@agent_id` mention을 통해 direct reply가 가능하다.

- [x] 진행 중 상태를 사람이 볼 수 있다.
  Docs: 누가 무엇을 하고 있는지 보여야 한다.
  Current: Work, People, Projects, Thread detail, Events, Memory 화면이 있다.

- [x] memory를 누적하고 다시 찾을 수 있다.
  Docs: 이전 작업과 결정이 축적되어야 한다.
  Current: memory list/recommend와 task recommend가 구현되어 있다.

- [x] local-first 실행 원칙이 코드에 반영되어 있다.
  Docs: 실행 권한은 로컬 런타임이 가져야 한다.
  Current: `company.yaml`과 `runtime-data` 기반 로컬 서버/상태 저장이 구현되어 있다.

- [ ] 사용자가 내부 프로젝트/상태/워크플로우를 몰라도 자연스럽게 일시키는 UX가 충분히 완성되었다.
  Docs: 사용자는 내부 구조를 몰라도 되어야 한다.
  Current: 기본 흐름은 있지만, lane/project/advanced controls가 아직 내부 구조를 꽤 드러낸다.

- [ ] 다국어 요청에서도 자연스럽게 lane routing이 잘 된다.
  Docs: 자연어 요청을 회사처럼 해석해야 한다.
  Current: explicit project mention 우선 정책은 유지하면서 lane/project inference에 한국어 키워드가 추가되어 대표적인 한국어-only idea/setup/product/ops 요청은 올바른 downstream project와 lane으로 라우팅된다. 다만 여전히 lightweight keyword routing 수준이라 broader multilingual/NLU coverage는 미완성이다.

## 2. User Experience And Information Architecture

- [x] Chat 화면이 존재한다.
  Docs: Chat은 기본 surface여야 한다.
  Current: thread list, message list, follow-up 입력, continue 버튼이 있다.

- [x] Work 화면이 존재한다.
  Docs: 회사 전체 active work를 한눈에 볼 수 있어야 한다.
  Current: active task list와 상태/assignee/blocker 요약이 있다.

- [x] People 화면이 존재한다.
  Docs: agent/people 상태를 볼 수 있어야 한다.
  Current: people overview와 agent catalog가 존재한다.

- [x] Projects 화면이 존재한다.
  Docs: 프로젝트 포트폴리오와 프로젝트 상태를 봐야 한다.
  Current: project overview와 portfolio view가 있다.

- [x] Memory 화면이 존재한다.
  Docs: 관련 memory와 유사 task를 다시 볼 수 있어야 한다.
  Current: memory list, recommended tasks, recent events가 있다.

- [x] Chat 화면에 thread list, conversation, task graph, coordination 영역이 있다.
  Docs: thread structure와 context rail이 존재해야 한다.
  Current: task graph summary, task cards, consultation/review/approval 영역이 존재한다.

- [x] 고급 운영 버튼이 존재한다.
  Docs: advanced flow에서는 operator가 직접 개입할 수 있어야 한다.
  Current: auto assign, run turn, handoff, sync, approval 요청 버튼이 존재한다.

- [ ] Agents / Registry가 분리된 1급 top-level surface로 충분히 정리되었다.
  Docs: Agent registry는 명시적이고 강한 surface가 되어야 한다.
  Current: People view 안에 catalog가 보이지만, 독립적 registry UX는 아직 약하다.

- [ ] 모바일 친화 UX가 실제로 검증되었다.
  Docs: mobile-friendly web가 목표에 포함된다.
  Current: 웹 UI는 있으나 모바일 최적화나 검증 흐름은 아직 문서 수준에 더 가깝다.

- [ ] 외부 채널 UX가 실제 사용자 흐름까지 구현되었다.
  Docs: Telegram/Slack/Discord 같은 외부 채널도 연결될 수 있어야 한다.
  Current: connector ingest API는 있으나 end-to-end connector UX는 기본적으로 비활성이다.

## 3. Final Architecture And System Architecture

- [x] 로컬 Comphony 서버가 존재한다.
  Docs: local server가 실행 권한을 가져야 한다.
  Current: `src/server.ts`와 HTTP API가 존재한다.

- [x] conversation orchestrator 역할이 존재한다.
  Docs: message 해석, routing, task graph 생성, reply 조립을 담당해야 한다.
  Current: `src/orchestrator/thread-orchestrator.ts`가 intake/respond/continue를 담당한다.

- [x] task graph 엔진의 기본 요소가 존재한다.
  Docs: task, child task, review, consultation, handoff를 다뤄야 한다.
  Current: parent/child/dependency/task lifecycle과 collaboration primitives가 구현되어 있다.

- [x] agent registry가 존재한다.
  Docs: agent identity, capability, source, project assignment를 저장해야 한다.
  Current: config/state에 agent 목록, trust state, source kind/ref, assigned project가 존재한다.

- [x] project registry가 존재한다.
  Docs: project config, lanes, repo binding, assigned agents를 저장해야 한다.
  Current: config/state에 project registry가 존재한다.

- [x] memory layer가 존재한다.
  Docs: decisions, summaries, artifact references를 저장해야 한다.
  Current: memory add/list/recommend가 구현되어 있다.

- [x] execution runtime이 존재한다.
  Docs: 실제 작업 수행과 artifact 생성이 필요하다.
  Current: work turn 실행과 artifact writing이 구현되어 있다.

- [x] 기본 realtime/event loop가 존재한다.
  Docs: web control surface가 실행 중 변화를 볼 수 있어야 한다.
  Current: SSE event stream과 recent event list가 있다.

- [ ] sync/realtime layer가 문서상 계층 분리 수준으로 완성되었다.
  Docs: local runtime, sync layer, control surface가 더 명확히 분리되어야 한다.
  Current: HTTP API, SSE, Supabase push는 있으나 계층 분리는 아직 MVP 수준이다.

- [ ] dynamic agent hiring이 문서 수준으로 완성되었다.
  Docs: 새 worker를 회사에 고용하고 바로 배정할 수 있어야 한다.
  Current: local/registry package install은 가능하지만 marketplace/compatibility/trust UX는 아직 제한적이다.

- [x] `Idea Lab`, `Project Managing`, `Ops` 같은 회사 구조가 기본 런타임에 1급 개념으로 올라와 있다.
  Docs: multi-project company model이 최종 구조의 일부다.
  Current: 기본 `company.yaml`과 default template에 `Idea Lab`, `Project Managing`, `Product - Core`, `Ops / Maintenance`가 함께 포함된다.

## 4. Data Model Coverage

- [x] Agent 엔터티가 존재한다.
  Current: id, name, role, source, trust, assignedProjects를 가진다.

- [ ] Agent Template가 문서 수준으로 1급 엔터티화되었다.
  Current: agent package manifest는 있으나 template registry 자체는 강하지 않다.

- [x] Project 엔터티가 존재한다.
  Current: id, name, purpose, lanes, repoSlug를 가진다.

- [x] Thread 엔터티가 존재한다.
  Current: title, taskIds, messageIds, timestamps를 가진다.

- [x] Message 엔터티가 존재한다.
  Current: role, body, routedProjectId, suggestedLane, targetAgentId를 가진다.

- [x] Task 엔터티가 존재한다.
  Current: lane, status, assignee, parent/child/dependency, artifacts, approval flags를 가진다.

- [x] Event 엔터티가 존재한다.
  Current: entityType, entityId, payload, timestamp를 가진다.

- [x] Assignment 개념이 존재한다.
  Current: `assigneeId`와 assign/autoassign 흐름이 구현되어 있다.

- [x] Handoff 개념이 존재한다.
  Current: lane handoff와 그에 따른 reassignment가 구현되어 있다.

- [x] Consultation 개념이 존재한다.
  Current: consultation request/resolve record가 존재한다.

- [x] Review 개념이 존재한다.
  Current: review request/complete record가 존재한다.

- [x] Artifact 개념이 존재한다.
  Current: task artifact path 누적이 구현되어 있다.

- [x] Memory Item 개념이 존재한다.
  Current: scope/project/thread/task/agent memory가 구현되어 있다.

- [x] Agent Install Source 개념이 존재한다.
  Current: `local_package`, `registry_package`, trust state, cached path가 존재한다.

- [ ] Artifact가 문서상 독립 엔터티 수준으로 풍부하게 모델링되었다.
  Current: 지금은 artifact path 중심이며 메타데이터 구조는 제한적이다.

## 5. Config, Local Layout, And Setup Foundation

- [x] `company.yaml` 기반 메인 설정 파일 구조가 존재한다.
  Docs: company/runtime/sync/auth/policies/projects/agents/connectors 섹션을 가져야 한다.
  Current: 기본 config가 이 구조를 따른다.

- [x] config validation이 존재한다.
  Current: `npm run validate:config`와 validation 함수가 존재한다.

- [x] `.env` 자동 로드가 존재한다.
  Current: config 로드 시 `.env`와 `.env.local`을 읽는다.

- [x] 표준 로컬 폴더 구조가 존재한다.
  Docs: `repos/`, `workspaces/`, `workflows/`, `runtime-data/`
  Current: 폴더와 `.gitignore` 규칙이 존재한다.

- [x] `MISSION.md` 생성용 템플릿과 로컬 setup 스크립트가 존재한다.
  Current: `MISSION.template.md`와 `scripts/init-local-setup.sh`가 존재한다.

- [x] preflight / validate / reset 스크립트가 존재한다.
  Current: `tests/preflight.sh`, `tests/validate-setup.sh`, `scripts/reset-local-state.sh`가 존재한다.

- [x] config/runtime project metadata로 runnable workflow를 생성할 수 있다.
  Docs: tracked template와 generated runtime workflow 분리가 필요하다.
  Current: `workflow generate`와 `project provision`으로 루트 `workflows/WORKFLOW.product-core.dev.md`, `workflows/WORKFLOW.product-core.research.md`, `workflows/WORKFLOW.project-admin.md`가 생성된 상태다.

- [x] `workflows/` 아래에 실제 runnable workflow가 기본적으로 생성된다.
  Docs: setup 완료 시 workflow 파일이 존재해야 한다.
  Current: 로컬 생성 자산으로 `workflows/WORKFLOW.product-core.dev.md`, `workflows/WORKFLOW.product-core.research.md`, `workflows/WORKFLOW.project-admin.md`가 존재한다.

- [ ] setup만으로 문서상의 acceptance criteria를 자동으로 채운다.
  Docs: Codex가 end-to-end setup을 완성해야 한다.
  Current: 스크립트는 뼈대를 만들지만, full runtime + Linear + workflow bootstrap까지 자동 완성하지는 않는다.

- [ ] `LINEAR_API_KEY`와 관련 setup이 기본 흐름에서 안전하게 완결된다.
  Docs: setup acceptance criteria에는 Linear 연동과 안전한 환경변수 구성이 포함된다.
  Current: `.env.example`와 validation script는 있으나 실제 live setup은 사용자 환경에 의존한다.

## 6. Conversation, Intake, And Thread Model

- [x] intake가 thread를 만든다.
  Current: intake 시 thread가 생성된다.

- [x] intake가 user message를 남긴다.
  Current: intake body가 thread message로 기록된다.

- [x] intake가 root coordinating task를 만든다.
  Current: planning root task가 생성된다.

- [x] intake가 execution child task를 생성할 수 있다.
  Current: inferred lane list에 따라 child task chain이 만들어진다.

- [x] follow-up message를 thread에 추가할 수 있다.
  Current: thread reply form과 `respondToThread`가 존재한다.

- [x] thread를 자동으로 계속 굴릴 수 있다.
  Current: `continueThread`와 `continueThreadUntilPause`가 존재한다.

- [x] thread가 관련 memory/task 추천을 보여준다.
  Current: thread detail에서 related memory와 similar tasks를 추천한다.

- [x] 대화에서 새 project를 만들 수 있다.
  Current: `create project called ...` intent를 처리한다.

- [x] 대화에서 agent 설치를 요청할 수 있다.
  Current: `hire/install/add agent` intent를 처리한다.

- [ ] 자연어 이해가 문서 기대 수준으로 풍부하다.
  Docs: conversation-first control surface가 보다 폭넓은 의도를 해석해야 한다.
  Current: intent/routing은 정규식/키워드 기반으로 제한적이다.

- [ ] thread가 항상 user-facing 설명 가능한 task graph를 자동으로 충분히 만든다.
  Docs: conversation-linked task graph가 강한 중심축이어야 한다.
  Current: 기본 graph는 있지만, 복잡한 요청 분해는 아직 제한적이다.

## 7. Task Graph, Lifecycle, And State Machine

- [x] task 생성이 존재한다.
- [x] task assignment / auto assignment가 존재한다.
- [x] task status update가 존재한다.
- [x] parent-child graph refresh가 존재한다.
- [x] dependency chain이 존재한다.
- [x] handoff가 존재한다.
- [x] consultation이 존재한다.
- [x] review request / completion이 존재한다.
- [x] approval request / decision이 존재한다.
- [x] blocked / waiting / consulting / review_requested / done 같은 주요 상태가 존재한다.
- [x] root task completion summary가 child 상태에 따라 갱신된다.
- [x] review 후 다음 ready task를 자동 배정하는 루프가 존재한다.

- [x] `triaged` 상태가 문서 state machine 수준으로 구현되었다.
  Docs: state machine 문서에는 `triaged`가 포함된다.
  Current: shared task status 상수에 `triaged`가 추가되었고, intake/approval resume/handoff 경로가 라우팅 후 pre-execution 상태로 이를 사용한다.

- [x] `reported` 상태가 문서에서 기대하는 parent report closure semantics까지 충분히 구현되었다.
  Docs: 보고/회수 상태가 중요하다.
  Current: Desk parent는 downstream child task들이 `done` 또는 `reported`로 닫히면 shared task graph policy를 통해 `reported`로 올라가고, 기존 thread continue loop가 최종 Desk closure를 `done`으로 마무리한다.

- [ ] recovery / timeout / retry / human takeover semantics가 문서 수준으로 구현되었다.
  Docs: recovery, timeouts, human takeover가 정의되어 있다.
  Current: 일부 필드와 retry sync는 있으나 state machine 전체는 아니다.

- [x] ownership handoff와 consultation handoff가 문서 수준으로 완전히 구분되어 있다.
  Docs: handoff semantics가 더 명확해야 한다.
  Current: ownership handoff는 별도 `handoff` runtime record로 persisted되며 lane/agent 이동과 상태를 추적하고, consultation은 기존 consultation record/read-path로 owner 유지형 협업 요청으로 남아 thread detail에서도 분리 노출된다.

## 8. Agent Registry And Package Model

- [x] agent package manifest를 읽을 수 있다.
- [x] local package install이 가능하다.
- [x] registry package install과 local cache 저장이 가능하다.
- [x] agent를 project에 배정할 수 있다.
- [x] agent catalog와 installed state를 조회할 수 있다.
- [x] trust state를 저장할 수 있다.

- [ ] package compatibility/versioning 검증이 강하게 구현되었다.
  Docs: package compatibility와 install flow가 더 명확해야 한다.
  Current: 기본 manifest parsing은 있으나 version contract enforcement는 약하다.

- [ ] output contract enforcement가 문서 수준으로 구현되었다.
  Docs: agent output contract가 중요하다.
  Current: 실제 output은 agent role별 artifact writing 중심이며 formal contract validation은 없다.

- [ ] imported agent trust UX가 문서 수준으로 완성되었다.
  Docs: trust model이 중요한 product surface여야 한다.
  Current: trust state는 저장되지만 user-facing review flow는 제한적이다.

## 9. Identity, Memory, Sessions, And Audit

- [x] local user/actor가 config에 존재한다.
- [x] session create/list/revoke/resolve가 존재한다.
- [x] memory scope가 company/project/thread/task/agent로 존재한다.
- [x] memory add/list/recommend가 존재한다.
- [x] event log/audit trail이 존재한다.
- [x] request actor / mutation role check가 기본적으로 존재한다.

- [ ] identity type이 문서 수준으로 풍부하다.
  Docs: human/system/agent identity와 세션 타입이 명확해야 한다.
  Current: 기본 local user/session은 있지만 다층 identity 모델은 아직 단순하다.

- [ ] memory visibility rule이 실제 권한 모델에 강하게 연결되어 있다.
  Docs: memory visibility와 privacy rule이 필요하다.
  Current: scope는 있으나 강한 ACL enforcement는 부족하다.

- [ ] memory retention policy가 구현되었다.
  Docs: retention/expiration/preservation rule이 필요하다.
  Current: retention policy는 문서에 비해 구현되지 않았다.

- [ ] privacy / safety rule이 실제 시스템 동작에 반영되었다.
  Docs: privacy and safety가 필요하다.
  Current: 민감정보 분리, redaction, scoped secret handling은 아직 부족하다.

## 10. Trust, Permissions, And Autonomy

- [x] 정책 필드가 config에 존재한다.
  Current: autonomy mode, external sync approval, repo creation approval, deploy approval 필드가 있다.

- [x] approval record와 approval flow가 존재한다.
  Current: request/decide approval이 구현되어 있다.

- [x] guarded external sync 전에 approval이 필요하다.
  Current: external sync approval check가 구현되어 있다.

- [x] agent별 권한 envelope를 config에 적을 수 있다.
  Current: read_repo / write_repo / run_commands 등 permission shape이 config에 존재한다.

- [ ] autonomy level이 문서의 0-4 수준으로 구현되었다.
  Docs: ask-first, suggest-and-wait, safe auto, guarded auto, explicit approval 레벨이 있어야 한다.
  Current: runtime config에는 단일 `balanced` mode 정도만 있다.

- [ ] permission envelope가 실제 tool/action 수준까지 일관되게 enforcement된다.
  Docs: action class별 security position이 필요하다.
  Current: 일부 guarded action은 있으나 전면적인 enforcement는 아니다.

- [ ] secret access / connector trust / imported agent trust가 문서 수준으로 구현되었다.
  Docs: 비밀값과 외부 trust zone이 중요하다.
  Current: 정책 문서는 있으나 secret vault / connector trust system은 미완성이다.

- [ ] explainability requirement가 system-wide rule로 완성되었다.
  Docs: 중요한 동작은 설명 가능해야 한다.
  Current: 메시지/event/memory는 남기지만 일관된 reasoning trace 수준은 아니다.

## 11. Execution Runtime And Real Work

- [x] runtime state가 로컬 파일로 저장된다.
- [x] per-task artifact가 누적된다.
- [x] design handoff artifact requirement가 존재한다.
- [x] design -> build -> review 파이프라인 테스트가 존재한다.
- [x] work turn이 thread message와 event를 남긴다.
- [x] workspace root / repo root 개념이 존재한다.

- [ ] build lane이 실제 제품 코드를 기본적으로 수정한다.
  Docs: execution runtime은 실제 구현을 수행해야 한다.
  Current: 현재 build/review/design은 주로 markdown artifact를 생성한다.

- [x] runtime이 repo bootstrap / worktree 전략을 직접 수행한다.
  Docs: repo/workspace preparation이 중요하다.
  Current: provisioning/workflow generation이 `repo_bootstrap_strategy`와 `--bootstrap-strategy`를 통해 `clone` 또는 `worktree` after_create hook를 생성한다. 기본값은 `clone`이고, 테스트로 두 전략 출력이 검증된다.

- [ ] project-admin lane이 실제 provisioning까지 수행한다.
  Docs: 새 repo / Linear project / workflow generation을 해야 한다.
  Current: local repo/workflow/bootstrap docs/provision report/smoke-test request까지는 수행하지만, Linear project/state provisioning은 아직 없다.

- [ ] design/publishing ops가 문서 수준으로 운영 자동화되었다.
  Docs: design and publishing operations가 별도 capability가 되어야 한다.
  Current: artifact 생성은 있으나 실제 publishing workflow는 제한적이다.

- [x] ops lane이 문서 수준으로 구현되었다.
  Docs: 운영/배포/유지보수 lane이 필요하다.
  Current: `ops_maintenance`가 기본 config/template에 포함되고, build/review worker가 배정되어 ops intake가 `ops_maintenance` build lane으로 라우팅된 뒤 실제 work turn까지 실행되는 테스트가 있다.

## 12. Sync, Source Of Truth, Connectors, API, And Events

- [x] task -> Linear issue sync가 존재한다.
- [x] runtime -> Supabase snapshot push가 존재한다.
- [x] sync record / list / retry가 존재한다.
- [x] HTTP API가 존재한다.
- [x] SSE event stream이 존재한다.
- [x] connector ingest endpoint가 존재한다.
- [x] auth/session endpoint가 존재한다.

- [ ] sync modes가 문서의 `none / mirror_out / linked_external / import_only` 수준으로 완전 구현되었다.
  Docs: source-of-truth와 sync mode가 명확해야 한다.
  Current: 기본 구조는 있으나 provider별 동작은 부분적이다.

- [ ] project sync rules가 문서 수준으로 구현되었다.
  Docs: Comphony project와 external project mapping이 더 풍부해야 한다.
  Current: task sync는 있으나 project provisioning sync는 약하다.

- [ ] conflict resolution / idempotency / duplicate handling이 문서 수준으로 구현되었다.
  Docs: protocol과 sync는 retry-safe 해야 한다.
  Current: 일부 retry는 있으나 envelope/idempotency 설계는 미완성이다.

- [ ] route-based API가 문서의 command/query/event protocol abstraction까지 올라갔다.
  Docs: protocol layers와 envelope가 더 명시적이어야 한다.
  Current: 현재는 REST-like route + SSE 조합에 가깝다.

- [ ] Telegram / Discord / Slack connector가 실사용 수준으로 붙어 있다.
  Docs: external channel connectors가 존재해야 한다.
  Current: connector flags와 ingest는 있으나 provider integration은 기본적으로 비활성이다.

## 13. Desk Model, Company Model, And Project Managing

- [x] `Comphony Desk`가 기본 front door project로 동작한다.
  Docs: 사용자는 Desk 또는 Comphony front door로만 요청해야 한다.
  Current: 기본 `company.yaml`과 default template에 `comphony_desk`가 추가되었고, default routing이 Desk로 향한다.

- [x] Desk가 `Idea Lab`, `Project Managing`, `Product`로 downstream routing한다.
  Docs: 전문 프로젝트로 child issue를 만들어야 한다.
  Current: explicit project mention을 유지하면서 lightweight keyword routing으로 `Idea Lab`, `Project Managing`, `Product - Core`, `Ops / Maintenance` 분기가 동작한다.

- [x] Desk parent / child return contract가 시스템 수준으로 구현되었다.
  Docs: child 완료 시 Desk parent로 자동 보고해야 한다.
  Current: Desk-routed downstream intake는 reusable Desk parent + downstream child task 구조로 생성되고, downstream child가 완료/보고되면 shared runtime policy가 Desk parent를 `reported`로 올린 뒤 existing continue loop가 최종 closure를 수행한다. 이 계약은 `Project Managing` 특례가 아니라 `Product - Core` 같은 다른 downstream Desk routing에도 동일하게 적용된다.

- [x] `Idea Lab` 프로젝트가 기본 구조에 구현되어 있다.
  Current: 기본 `company.yaml`과 default template에 `Idea Lab`이 포함된다.

- [x] `Project Managing` 프로젝트가 기본 구조에 구현되어 있다.
  Current: 기본 `company.yaml`과 default template에 `Project Managing`가 포함된다.

- [ ] `Project Managing`가 새 repo, 새 Linear 프로젝트, 새 workflow 파일을 만든다.
  Docs: supporting docs와 운영 계획 문서에서 핵심 capability다.
  Current: local repo/bootstrap docs/workflow generation과 smoke-test request는 가능하지만 Linear project/state provisioning과 Desk report-back contract는 아직 없다.

- [x] `Ops / Maintenance` 프로젝트가 기본 구조에 구현되어 있다.
  Current: 기본 `company.yaml`과 default template에 `Ops / Maintenance`가 포함된다.

- [x] 단일 제품 프로젝트 안에서 planning/research/design/build/review lane relay는 존재한다.
  Current: `product_core`와 해당 lanes, preferred roles, task graph chain이 존재한다.

## 14. Symphony / Workflow / Legacy Operational Alignment

- [x] workflow template 문서와 샘플이 존재한다.
- [x] `repos/`, `workspaces/`, `workflows/` 분리 원칙이 존재한다.
- [x] Local layout, Start With Codex, Issue Lifecycle 문서가 존재한다.

- [x] workflow generation이 runtime/CLI에 통합되었다.
  Docs: generated runtime workflows가 중요하다.
  Current: `workflow generate`와 `project provision` 결과로 `workflows/WORKFLOW.product-core.dev.md`, `workflows/WORKFLOW.product-core.research.md`, `workflows/WORKFLOW.project-admin.md`가 local `workflows/`에 생성됐다.

- [ ] Symphony 실행과 Comphony runtime이 end-to-end로 한 흐름에 통합되었다.
  Docs: legacy assets를 현재 runtime foundation에 연결해야 한다.
  Current: 문서/샘플은 많지만 runtime MVP와 완전 결합되지는 않았다.

- [ ] repo별 workflow / state relay / project-admin workflow가 실제 로컬 `workflows/` 아래에 생성된다.
  Docs: setup 완료 시 실행 자산이 있어야 한다.
  Current: `workflows/WORKFLOW.product-core.dev.md`, `workflows/WORKFLOW.product-core.research.md`, `workflows/WORKFLOW.project-admin.md`는 생성됐지만, state relay까지 이 한 항목 기준으로 충분히 닫혔다고 보기는 아직 이르다.

## 15. Validation, Operability, And Definition Of Done

- [x] preflight check가 존재한다.
- [x] validate setup script가 존재한다.
- [x] reset local state script가 존재한다.
- [x] config validation command가 존재한다.
- [x] runtime test suite가 존재한다.
- [x] web UI / intake / task graph / collaboration / sync 관련 테스트가 존재한다.

- [x] 현재 검토 기준에서 runtime test suite가 완전 green이다.
  Current: 2026-03-26 재검증 시 `npm test`가 `44/44` 통과했다.

- [ ] setup Definition of Done가 기본 repo 상태만으로 충족된다.
  Docs: runnable workflow, Linear setup, smoke test, runtime verification이 필요하다.
  Current: 현재 repo는 foundation/MVP에 가깝고 full setup completion 상태는 아니다.

- [ ] `Definition of Operable` / `Definition of Flexible`가 운영 계획 문서 수준으로 달성되었다.
  Docs: config-driven generation, routing, provisioning, validation, return contract가 필요하다.
  Current: 일부만 구현되어 있고 핵심 provisioning/workflow generation은 남아 있다.

- [x] 최소 한 개 이상의 실제 runnable workflow가 repo 또는 research 작업과 연결되어 있다.
  Docs: `START_WITH_CODEX`와 `AGENTS.md` 완료 조건에 포함된다.
  Current: `workflows/WORKFLOW.product-core.dev.md`와 `workflows/WORKFLOW.product-core.research.md`가 생성됐고, 대응 로컬 자산으로 `repos/product-core/...` bootstrap 파일과 `runtime-data/provisioning/product_core/...` report가 존재한다.

- [ ] Symphony 기반 실행 경로 또는 동등한 current runtime execution path가 end-to-end로 검증되었다.
  Docs: setup 문서는 smoke test와 실행 검증을 요구한다.
  Current: current runtime 자체는 검증되지만 Symphony + workflow execution은 문서 기대치만큼 자동화되지 않았다.

- [ ] 테스트용 issue/request를 넣었을 때 문서상 setup 완료 조건 수준으로 실제 처리된다.
  Docs: 테스트 issue 확인과 smoke test가 필요하다.
  Current: runtime intake/task loop는 동작하지만, full setup acceptance 전체를 만족하는 provisioning/sync/workflow 환경은 아직 아니다.

## 16. Immediate Highest-Gap Items

- [ ] Project Admin를 real provisioning lane으로 구현
  Current: local repo/workflow/bootstrap/smoke-test foundation은 구현됐고, 남은 핵심은 Linear project/state provisioning과 Desk return contract다.

- [ ] Linear project + required states provisioning 구현
  Current: local-only foundation은 있지만 external tracker provisioning은 아직 없다.

- [x] Desk multi-project routing 구현
  Current: Desk intake는 explicit project mention을 우선 보존하고, 그 외에는 intent/keyword 기반으로 `Idea Lab`, `Project Managing`, `Product - Core`, `Ops / Maintenance`로 라우팅한다. downstream으로 라우팅된 요청은 `comphony_desk` parent와 대상 project child task를 함께 생성한다.

- [x] conversational project creation을 provisioning path로 연결
  Current: thread conversation의 `create project` intent가 repo/workflow/bootstrap/report artifact provisioning과 smoke-test task/thread 생성까지 수행한다.

- [x] Desk / Project Managing report-back close loop 구현
  Current: setup/provisioning intake는 `comphony_desk` parent와 `project_managing` child를 같은 thread에 만들고, child가 local runtime에서 `reported`되면 Desk parent가 child-derived summary와 함께 `reported`로 올라간 뒤 `continueThread`로 `done`까지 닫힌다.

- [ ] multilingual / richer routing and decomposition 구현
  Current: explicit project mention + English/Korean keyword routing까지는 지원하지만, decomposition과 broader multilingual understanding은 아직 keyword-based 수준이다.

- [ ] build lane real code execution 연결
  Current: markdown artifact generation 중심

- [ ] protocol/sync/idempotency 정교화
  Current: route + SSE + partial sync 수준

- [ ] trust/autonomy enforcement 강화
  Current: config/policy fields는 있으나 runtime enforcement는 제한적

## 17. Post-MVP Delight And Product Polish

- [ ] 기본 모드가 내부 제어를 숨기고 truly conversation-first 하게 동작한다.
  Docs: 사용자는 low-level workflow buttons를 몰라도 되어야 한다.
  Current: Advanced controls가 이미 존재하고, 기본 UX도 아직 운영 콘솔 감각이 강하다.

- [ ] 회사가 살아 움직이는 감각을 주는 agent identity가 충분히 두껍다.
  Docs: agent는 단순 worker가 아니라 실제 직원처럼 느껴져야 한다.
  Current: agent status와 catalog는 있으나 persona/workload/history surface는 얕다.

- [ ] 시스템이 planning/research/design/build/review 분해와 escalation을 더 적극적으로 먼저 수행한다.
  Docs: 사용자가 micromanager가 되지 않아야 한다.
  Current: 일부 auto-loop는 있으나 decomposition과 escalation은 아직 제한적이다.

- [ ] task graph가 consultation/review/approval edge까지 시각적으로 풍부하게 표현된다.
  Docs: graph의 표현력이 회사형 제품 감각에 중요하다.
  Current: task list와 coordination cards는 있으나 graph visualization은 얕다.

- [ ] People과 Projects가 단순 목록을 넘어 primary living surfaces가 된다.
  Docs: 회사의 조직성과 portfolio 감각을 줘야 한다.
  Current: overview는 있으나 delight 수준의 living company feel은 아직 아니다.
