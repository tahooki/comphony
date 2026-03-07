# Comphony

Comphony는 `Symphony`로 회사 구조를 구축하고, 그 운영 방식을 `Linear`와 workflow 문서로 정리하는 저장소다.

이 저장소의 목적은 세 가지다.

- 아이디어, 프로젝트 관리, 제품 실행을 어떤 Linear 프로젝트 구조로 나눌지 정리한다.
- PM, Research, Design, Dev 같은 역할을 어떤 workflow 조합으로 운영할지 정리한다.
- 새 제품이나 새 팀을 만들 때 재사용할 수 있는 운영 문서와 workflow 샘플을 제공한다.

## 이 저장소가 다루는 것

- `Idea Lab -> Project Managing -> Product - <이름>` 형태의 회사형 운영 구조
- Symphony workflow 설계 원칙
- Linear 프로젝트와 상태 설계
- 역할별 relay 운영 방식
- 코드 작업, 리서치 작업, project-admin 작업 예시

## 디렉터리 구조

- [docs](docs)
  - Symphony 운영 가이드
  - 회사 구조 문서
  - issue lifecycle 설명
  - workflow 샘플 모음
- [repos](repos)
  - 원본 저장소 모음
  - canonical clone 또는 canonical checkout 위치
- [workspaces](workspaces)
  - 이슈별 실제 작업 폴더
- [workflows](workflows)
  - 실제 실행용 workflow 파일 위치
  - `docs/workflows`는 샘플 템플릿

로컬 전용 파일은 Git에 올라가지 않도록 설계했다.

- `MISSION.md`
- `repos/*`
- `workspaces/*`
- `workflows/*`

즉 실제 개인 설정과 실행 산출물은 루트 [.gitignore](/Users/tahooki/Documents/comphony/.gitignore)로 무시되고, 문서와 샘플만 추적된다.

## 빠른 시작

`comphony`를 클론한 뒤 Codex로 실제 셋업까지 진행하려면 아래 순서로 시작하면 된다.

1. [AGENTS.md](AGENTS.md)를 읽는다.
2. [MISSION.template.md](MISSION.template.md)를 바탕으로 `MISSION.md`를 만든다.
3. [Local Layout](docs/LOCAL_LAYOUT.md) 기준으로 `repos`, `workspaces`, `workflows` 구조를 이해한다.
4. [Start With Codex](docs/START_WITH_CODEX.md)를 읽고 Codex에게 셋업을 맡긴다.

## 핵심 문서

- [Start With Codex](docs/START_WITH_CODEX.md)
- [Local Layout](docs/LOCAL_LAYOUT.md)
- [Symphony Basics](docs/SYMPHONY_BASICS.md)
- [Comphony Company Model](docs/COMPHONY_COMPANY_MODEL.md)
- [Scenario Matrix](docs/SCENARIO_MATRIX.md)
- [Issue Lifecycle](docs/ISSUE_LIFECYCLE.md)
- [Workflow Parts](docs/WORKFLOW_PARTS.md)

## 한 줄 설명

`Comphony`는 Symphony로 구축하는 회사 운영 구조와 프로젝트 실행 체계를 정리한 레포다.
