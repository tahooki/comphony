# Workflow Parts

이 문서는 Symphony workflow 파일의 각 부분이 무엇을 담당하는지 설명한다.

## 가장 중요한 세 부분

## 1. `tracker`

이 workflow가 어떤 Linear 이슈를 볼지 정한다.

예:

```yaml
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "repo-a-project-slug"
  active_states:
    - Todo
    - In Progress
  terminal_states:
    - Done
    - Canceled
    - Duplicate
```

핵심:

- `project_slug`
  - 어떤 Linear 프로젝트를 볼지
- `active_states`
  - 현재 처리 대상으로 볼 상태
- `terminal_states`
  - 끝난 것으로 간주하고 workspace를 정리할 상태

## 2. `workspace`

이슈별 작업 폴더를 어디에 만들지 정한다.

예:

```yaml
workspace:
  root: /Users/you/Documents/comphony/workspaces/repo_a
```

결과:

- `ABC-123` 이슈가 잡히면 보통 `/Users/.../repo_a/ABC-123` 같은 폴더가 만들어진다.
- 권장 위치는 `/Users/you/Documents/comphony/workspaces/<repo-slug>/<issue-id>`다.

## 3. `hooks.after_create`

새 workspace가 만들어진 직후 어떤 repo나 자료를 준비할지 정한다.

코드 작업 예:

```yaml
hooks:
  after_create: |
    git clone --depth 1 --branch main file:///Users/you/Documents/comphony/repos/repo_a .
    pnpm install --frozen-lockfile
```

리서치 작업 예:

```yaml
hooks:
  after_create: |
    mkdir -p notes output
```

즉:

- repo를 복제할 수도 있다
- 아무것도 복제하지 않을 수도 있다
- 템플릿 파일만 넣을 수도 있다

권장 표준:

- 원본 저장소 루트: `/Users/you/Documents/comphony/repos`
- 작업공간 루트: `/Users/you/Documents/comphony/workspaces`
- 실행용 workflow 루트: `/Users/you/Documents/comphony/workflows`
- `docs/workflows/`는 샘플, `workflows/`는 실사용 파일

## 역할은 어디에 설정하나

Symphony에 `role: pm` 같은 별도 필드는 없다. 역할은 prompt 본문이 정한다.

예:

- PM workflow는 "요구사항과 acceptance criteria를 정리하라"는 prompt를 가진다
- Research workflow는 "비교 조사 보고서를 작성하라"는 prompt를 가진다
- Dev workflow는 "코드를 수정하고 테스트하라"는 prompt를 가진다
- Desk workflow는 "요청을 분류하고 child issue를 만들고 최종 보고를 회수하라"는 prompt를 가진다

즉 역할 분리는 보통 다음 세 가지 조합으로 이뤄진다.

- `project_slug`
- `active_states`
- prompt 본문

## 자주 쓰는 분리 방식

### 방식 1. repo별 분리

- repo_a -> workflow A
- repo_b -> workflow B

이 방식은 가장 단순하다.

### 방식 2. 역할별 분리

- Desk workflow -> `Inbox`, `Clarifying`, `Triaged`, `Reported`
- PM workflow -> `Planning`
- Research workflow -> `Research`
- Design workflow -> `Design`
- Dev workflow -> `Todo`, `In Progress`

이 방식은 관심사 분리에 좋다.

### 방식 3. repo x 역할 조합

예:

- `repo_a.pm`
- `repo_a.research`
- `repo_a.dev`
- `repo_b.dev`

이 방식은 가장 세밀하지만 운영 복잡도가 높다.

## 무엇을 기준으로 쪼개야 하나

다음 기준으로 판단하면 된다.

- repo가 다르면 workflow를 분리하는 편이 좋다
- 상태 기반 릴레이가 필요하면 역할별 workflow를 분리한다
- bootstrap 비용이 다르면 workflow를 분리한다
- PR 정책이나 테스트 방식이 다르면 workflow를 분리한다

## 추천 기본값

처음에는 아래 둘 중 하나로 시작하는 것이 좋다.

### 옵션 A. 단순 시작

- repo별 dev workflow

### 옵션 B. 역할 릴레이 시작

- PM
- Research
- Design
- Dev

단, 같은 상태를 여러 workflow가 동시에 잡지 않도록 설계해야 한다.
