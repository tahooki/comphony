# Comphony AGENTS

이 저장소는 `Symphony + Linear` 운영 체계를 설계하고 실제로 세팅하기 위한 컨트롤 레포다.

## 이 저장소에서 Codex가 해야 할 일

사용자가 이 저장소에서 설정 작업을 요청하면, Codex는 문서 설명만 하는 데서 멈추지 말고 실제 세팅 완료까지 밀어야 한다.

기본 동작 순서는 아래와 같다.

1. [README.md](README.md)를 읽는다.
2. [docs/START_WITH_CODEX.md](docs/START_WITH_CODEX.md)를 읽는다.
3. 루트의 `MISSION.md`가 있으면 그것을 목표 문서로 사용한다.
4. `MISSION.md`가 없으면 [MISSION.template.md](MISSION.template.md)를 기준으로 Codex가 먼저 `MISSION.md`를 생성한다.
5. 목표가 정해지면 `Symphony 설치/검증 -> Linear 연동 -> Linear 프로젝트/상태 준비 -> workflow 생성 -> 실행 검증 -> 테스트 이슈 확인` 순서로 진행한다.
6. 목표 문서의 acceptance criteria가 충족될 때까지 계속 진행한다.

## 표준 로컬 구조

`MISSION.md`에서 별도 경로를 요구하지 않으면 아래 구조를 기본값으로 사용한다.

- `repos/`
  - 원본 저장소 모음
- `workspaces/`
  - 이슈별 작업공간
- `workflows/`
  - 실제 실행할 workflow 파일
- `docs/workflows/`
  - 참고용 샘플 템플릿

중요한 규칙:

- 파일 시스템에서는 `repos`를 사용한다.
- `projects`라는 이름은 Linear 프로젝트 이름으로만 사용한다.

## 행동 원칙

- `설정 문서`와 `실제 설정 작업`을 분리하지 말고 함께 진행한다.
- `MISSION.md`가 없으면 사용자에게 먼저 작성하라고 하지 말고 Codex가 직접 만든다.
- 사용자가 모호하게 요청하면, 먼저 가장 작은 실동작 구조를 제안하고 바로 세팅을 시작한다.
- 정말 필요한 경우가 아니면 질문을 많이 하지 않는다.
- 비밀값, 권한, 조직 정책처럼 외부 정보가 없으면 진행할 수 없는 경우에만 짧게 확인한다.
- 가능한 경우 실제로 Linear 프로젝트, workflow 파일, 실행 스크립트, 검증용 이슈까지 만들어서 끝낸다.
- 필요한 경우 `repos`, `workspaces`, `workflows` 디렉터리도 함께 만들고 문서화한다.

## 기본 완료 조건

아래가 충족되면 "작동하는 초기 셋업"으로 본다.

- Symphony가 설치되어 있거나 실행 가능하다.
- `LINEAR_API_KEY`가 안전하게 설정되어 있다.
- 적어도 하나 이상의 Linear 프로젝트가 준비되어 있다.
- 적어도 하나 이상의 workflow 파일이 실제 repo 또는 research 작업과 연결되어 있다.
- Symphony 실행 방법이 문서화되어 있다.
- 테스트용 이슈를 만들면 Symphony가 집어서 처리할 수 있다.
- 표준 로컬 경로 구조가 정해져 있고 실제 경로가 문서에 반영되어 있다.

## 추천 읽는 순서

1. [docs/START_WITH_CODEX.md](docs/START_WITH_CODEX.md)
2. [docs/LOCAL_LAYOUT.md](docs/LOCAL_LAYOUT.md)
3. [MISSION.template.md](MISSION.template.md)
4. [docs/SYMPHONY_BASICS.md](docs/SYMPHONY_BASICS.md)
5. [docs/COMPHONY_COMPANY_MODEL.md](docs/COMPHONY_COMPANY_MODEL.md)

## `MISSION.md` 생성 규칙

`MISSION.md`는 사람에게 선행 작성이 요구되는 문서가 아니다.

Codex는 아래처럼 행동해야 한다.

1. `MISSION.md`가 있으면 읽고 따른다.
2. `MISSION.md`가 없으면 `MISSION.template.md`를 바탕으로 즉시 생성한다.
3. 기본값으로 먼저 채우고, 꼭 필요한 항목만 사용자에게 확인한다.
4. 세팅이 진행되면서 실제 경로, 프로젝트 이름, workflow 이름으로 계속 갱신한다.

즉 사용자는 그냥 "셋팅해줘"라고 말할 수 있어야 하고, 목표 문서 작성 자체도 Codex의 책임이다.
