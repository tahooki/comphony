# Comphony Docs

이 디렉터리는 `Comphony`의 현재 제품 방향, 운영 모델, 기존 Symphony 기반 자산을 함께 담고 있는 문서 모음이다.

가장 중요한 점은 이것이다.

- 예전 문서들은 `Symphony + Linear` 중심의 운영 구조를 설명한다.
- 현재 제품 방향은 `Comphony = 에이전트 회사를 운영하는 시스템` 쪽으로 이동했다.

즉 아래 문서들 중 일부는 `현재 canonical direction`, 일부는 `legacy-but-useful reference`다.

## 이 디렉터리의 목적

- 현재 제품 목적과 사용자 경험을 명확하게 고정하기
- 시스템 구조와 MVP 방향을 정의하기
- 기존 Symphony 기반 자산을 재사용 가능한 참고 자료로 보관하기
- 실제로 수정 가능한 샘플 workflow와 운영 가이드를 제공하기

## Canonical Docs

현재 제품 방향을 이해하려면 아래 문서부터 읽는 것이 맞다.

1. [COMPHONY_PURPOSE_AND_VISION.md](COMPHONY_PURPOSE_AND_VISION.md)
2. [COMPHONY_USER_EXPERIENCE.md](COMPHONY_USER_EXPERIENCE.md)
3. [COMPHONY_FINAL_ARCHITECTURE.md](COMPHONY_FINAL_ARCHITECTURE.md)
4. [COMPHONY_SYSTEM_ARCHITECTURE.md](COMPHONY_SYSTEM_ARCHITECTURE.md)
5. [COMPHONY_DATA_MODEL.md](COMPHONY_DATA_MODEL.md)
6. [COMPHONY_UI_INFORMATION_ARCHITECTURE.md](COMPHONY_UI_INFORMATION_ARCHITECTURE.md)
7. [COMPHONY_TRUST_AND_PERMISSIONS.md](COMPHONY_TRUST_AND_PERMISSIONS.md)
8. [COMPHONY_SYNC_AND_SOURCE_OF_TRUTH.md](COMPHONY_SYNC_AND_SOURCE_OF_TRUTH.md)
9. [COMPHONY_AUTONOMY_POLICY.md](COMPHONY_AUTONOMY_POLICY.md)
10. [COMPHONY_AGENT_PACKAGE_SPEC.md](COMPHONY_AGENT_PACKAGE_SPEC.md)
11. [COMPHONY_EXECUTION_STATE_MACHINE.md](COMPHONY_EXECUTION_STATE_MACHINE.md)
12. [COMPHONY_API_AND_EVENT_PROTOCOL.md](COMPHONY_API_AND_EVENT_PROTOCOL.md)
13. [COMPHONY_CONFIG_SPEC.md](COMPHONY_CONFIG_SPEC.md)
14. [COMPHONY_IDENTITY_AND_MEMORY_POLICY.md](COMPHONY_IDENTITY_AND_MEMORY_POLICY.md)
15. [COMPHONY_MVP_AND_DEVELOPMENT.md](COMPHONY_MVP_AND_DEVELOPMENT.md)
16. [OPERATING_LEVEL_DEVELOPMENT_PLAN.md](OPERATING_LEVEL_DEVELOPMENT_PLAN.md)
17. [20260309211824_COMPHONY_POST_MVP_DELIGHT_PLAN.md](20260309211824_COMPHONY_POST_MVP_DELIGHT_PLAN.md)

## Supporting Docs

제품 방향을 본 뒤, 아래 문서들은 보조 자료로 본다.

18. [COMPHONY_DESK_MODEL.md](COMPHONY_DESK_MODEL.md)
19. [COMPHONY_COMPANY_MODEL.md](COMPHONY_COMPANY_MODEL.md)
20. [UI_UX_PRO_MAX_GUIDE.md](UI_UX_PRO_MAX_GUIDE.md)
21. [UIPRO_DESIGN_HANDOFF_FLOW.md](UIPRO_DESIGN_HANDOFF_FLOW.md)
22. [SCENARIO_MATRIX.md](SCENARIO_MATRIX.md)
23. [ISSUE_LIFECYCLE.md](ISSUE_LIFECYCLE.md)
24. [WORKFLOW_PARTS.md](WORKFLOW_PARTS.md)

## Transitional Setup And Legacy References

아래 문서들은 여전히 유용하지만, 현재 canonical 제품 모델보다 `Symphony + Linear` 기반 실행 자산 쪽에 더 가깝다.

25. [START_WITH_CODEX.md](START_WITH_CODEX.md)
26. [LOCAL_LAYOUT.md](LOCAL_LAYOUT.md)
27. [SYMPHONY_BASICS.md](SYMPHONY_BASICS.md)
28. [LINEAR_SYMPHONY_WORKFLOW_GUIDE.md](LINEAR_SYMPHONY_WORKFLOW_GUIDE.md)

## Workflow Templates

`docs/workflows/` 아래 파일은 여전히 샘플 template로 유용하다.

## Legacy Operational Core

기존 자산의 핵심 개념은 아직 의미가 있다.

Symphony는 보통 다음 세 가지를 조합해서 운영한다.

1. `Linear 프로젝트`
   - 어떤 이슈 큐를 볼지 결정한다.
2. `Workflow 파일`
   - 어떤 repo를 어떻게 준비할지, 어떤 역할로 일할지 결정한다.
3. `Workspace`
   - 실제 작업이 일어나는 이슈별 작업 폴더다.

즉 이슈는 "무슨 일"을 설명하고, workflow는 "어디서 어떻게 일할지"를 설명한다.

## 주의할 점

- 같은 `project_slug`와 같은 `active_states`를 두 개의 Symphony가 동시에 보면 충돌 위험이 있다.
- 역할 분리는 "같은 이슈를 동시에 여러 에이전트가 본다"보다 "상태 기반 릴레이"가 더 안정적이다.
- repo 경로는 이슈가 아니라 workflow의 `hooks.after_create`가 결정한다.
- 실제 코드 수정은 원본 repo가 아니라 workspace 안에서 일어난다.
- 사람이 어디에 이슈를 만들지 헷갈리면 `Comphony Desk`를 앞단에 두는 편이 가장 운영하기 쉽다.
