# Local Layout

이 문서는 `comphony`를 로컬에서 어떻게 배치하면 좋은지 설명한다.

핵심 결론은 단순하다.

- 원본 저장소 모음은 `repos`
- 이슈별 작업 폴더는 `workspaces`
- 실제 실행할 workflow 파일은 `workflows`
- `projects`는 파일 시스템 이름이 아니라 `Linear 프로젝트` 이름으로만 쓴다

## 1. 왜 `repos`가 좋은가

세 가지 후보 중에서는 `repos`가 가장 명확하다.

- `repos`
  - GitHub/GitLab의 repository 개념과 바로 연결된다
  - "원본 저장소들이 모여 있는 루트"라는 뜻이 분명하다
- `gits`
  - 보통 이렇게 이름 붙이지 않는다
  - 폴더 이름으로도 어색하다
- `projects`
  - Linear 프로젝트, 제품 프로젝트, 작업 프로젝트와 쉽게 헷갈린다

즉 `projects`는 업무 관리 개념으로 남겨두고, 파일 시스템 이름은 `repos`로 고정하는 편이 좋다.

## 2. 추천 표준 구조

가장 추천하는 기본 구조는 아래다.

```text
comphony/
  AGENTS.md
  MISSION.md
  MISSION.template.md
  README.md
  docs/
  repos/
    product-core/
    project-admin/
    design-system/
  workspaces/
    product-core/
    project-admin/
  workflows/
    WORKFLOW.product-core.dev.md
    WORKFLOW.product-core.research.md
    WORKFLOW.project-admin.md
```

각 폴더의 의미는 다음과 같다.

- `docs/`
  - 운영 설명 문서
  - 샘플과 원칙
- `repos/`
  - 원본 저장소들의 모음
  - canonical clone 또는 canonical checkout 위치
- `workspaces/`
  - 이슈별 실제 작업 폴더
  - Symphony가 workspace를 만들 때 사용하는 위치
- `workflows/`
  - 실제로 Symphony 실행에 넘기는 workflow 파일

중요한 점:

- `docs/workflows/`는 샘플 템플릿 위치
- 루트 `workflows/`는 실제 실행용 workflow 위치

## 3. 이름 규칙

### repo 폴더

- `repos/product-core`
- `repos/project-admin`
- `repos/marketing-site`

보통 GitHub repo slug와 맞추는 편이 좋다.

### workspace 폴더

추천:

- `workspaces/product-core/CORE-12`
- `workspaces/product-core/CORE-19`
- `workspaces/project-admin/OPS-4`

즉 `workspaces/<repo-slug>/<issue-id>` 구조가 가장 읽기 쉽다.

### workflow 파일

추천:

- `WORKFLOW.product-core.dev.md`
- `WORKFLOW.product-core.research.md`
- `WORKFLOW.product-core.design.md`
- `WORKFLOW.project-admin.md`

역할이 명확해질수록 파일 이름도 명확해진다.

## 4. workflow는 왜 `workflows/`에 두는가

이유는 분리 때문이다.

- `docs/workflows/`
  - 설명용 샘플
  - 템플릿
- `workflows/`
  - 실제 실행 대상
  - 로컬 경로와 실제 project slug가 반영된 파일

이렇게 나누면 공개 문서와 실사용 설정이 섞이지 않는다.

## 5. 실제 경로 예시

예를 들어 제품 하나를 운영한다면:

- 원본 repo: `/Users/you/Documents/comphony/repos/product-core`
- workspace root: `/Users/you/Documents/comphony/workspaces/product-core`
- 실제 workflow 파일: `/Users/you/Documents/comphony/workflows/WORKFLOW.product-core.dev.md`

이 workflow의 `after_create`는 보통 이렇게 된다.

```yaml
hooks:
  after_create: |
    git clone --depth 1 file:///Users/you/Documents/comphony/repos/product-core .
```

## 6. 언제 이 규칙을 깨도 되는가

깨도 되는 경우는 있다.

- 여러 디스크를 써서 `repos`와 `workspaces`를 물리적으로 분리해야 할 때
- monorepo가 너무 커서 canonical checkout을 다른 볼륨에 둬야 할 때
- 조직 정책상 저장 위치가 따로 정해져 있을 때

하지만 특별한 이유가 없다면 처음에는 `comphony/repos`, `comphony/workspaces`, `comphony/workflows`를 유지하는 것이 제일 단순하다.

## 7. 추천 기본값

처음 시작할 때는 아래를 기본값으로 쓰면 된다.

- repo root: `/Users/you/Documents/comphony/repos`
- workspace root: `/Users/you/Documents/comphony/workspaces`
- workflow root: `/Users/you/Documents/comphony/workflows`

그리고 `projects`라는 이름은 Linear 안에서만 쓴다.
