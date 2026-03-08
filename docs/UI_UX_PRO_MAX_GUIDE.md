# UI UX Pro Max Guide

이 문서는 `UI UX Pro Max` skill을 `Comphony` 안에서 디자이너와 프론트 작업자가 어떻게 활용하면 좋은지 정리한 운영 가이드다.

## 무엇인가

`UI UX Pro Max`는 Figma 파일을 읽는 구현 도구라기보다, UI/UX 의사결정을 돕는 로컬 design intelligence skill이다.

이 repo에는 이미 설치되어 있다.

- skill 위치: [/Users/tahooki/Documents/comphony/.codex/skills/ui-ux-pro-max](/Users/tahooki/Documents/comphony/.codex/skills/ui-ux-pro-max)
- 핵심 설명: [SKILL.md](/Users/tahooki/Documents/comphony/.codex/skills/ui-ux-pro-max/SKILL.md)

내부에는 색상, 타이포, 스타일, UX 가이드, 차트, landing pattern, stack guideline CSV와 검색 스크립트가 들어 있다.

## Figma 없이 할 수 있는 일

- 제품 성격에 맞는 디자인 시스템 초안 생성
- 색상/타이포/스타일 방향 추천
- 화면 구조와 landing pattern 제안
- UX guideline 검색
- 현재 코드베이스 기준 UI 개선 방향 제안
- 퍼블리싱 전에 visual direction과 implementation rule 정리

즉 `Design` 단계에서 가장 유용하고, `Research`와 `Publishing` 단계에서도 보조 두뇌처럼 쓸 수 있다.

## Comphony에서 어디에 쓰나

추천 역할 분리는 이렇다.

- `Idea Lab / Research`
  - 레퍼런스와 UX 패턴 조사
- `Product - <Name> / Design`
  - 디자인 시스템 초안 생성
  - 페이지별 UI direction 정리
  - handoff note 작성
- `Product - <Name> / Todo`
  - 프론트 구현 시작
- `Human Review`
  - `playwright-interactive`, `screenshot`로 QA
- 발표/보고 필요 시
  - `slides` skill로 deck 제작

## 기본 사용 방식

작업 디렉터리를 repo 루트로 둔 상태에서 실행한다.

### 1. 디자인 시스템 먼저 만들기

이 skill은 항상 `--design-system`으로 시작하는 게 좋다.

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "admin dashboard analytics b2b professional" --design-system -p "Comphony Admin" -f markdown
```

실제로 확인한 샘플 출력에서는 이런 식의 결과가 나왔다.

- style: `Data-Dense Dashboard`
- color strategy: blue + amber highlight
- typography: `Fira Code` + `Fira Sans`

즉 대시보드, 어드민, analytics UI 초안에는 바로 쓸 만하다.

### 2. 결과를 문서로 저장하기

지속적으로 쓸 디자인 시스템이면 `--persist`를 붙인다.

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "admin dashboard analytics b2b professional" --design-system --persist -p "Comphony Admin"
```

그러면 보통 이런 구조가 생긴다.

- `design-system/<project-slug>/MASTER.md`
- `design-system/<project-slug>/pages/`

예를 들면 `Comphony Admin` 프로젝트는 `design-system/comphony-admin/MASTER.md` 아래에 저장된다.

이 패턴은 `Design` workflow 산출물로 쓰기 좋다.

### 3. 페이지 단위로 override 만들기

특정 화면만 따로 방향을 잡고 싶으면 `--page`를 같이 쓴다.

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "dense dashboard filters charts tables" --design-system --persist -p "Comphony Admin" --page "dashboard"
```

이렇게 하면 공통 규칙은 `design-system/<project-slug>/MASTER.md`, 페이지별 차이는 `design-system/<project-slug>/pages/dashboard.md`에 남길 수 있다.

### 4. 세부 검색으로 보강하기

디자인 시스템만으로 부족하면 domain 검색을 추가한다.

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "elegant luxury serif" --domain typography
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "animation accessibility" --domain ux
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "real-time dashboard" --domain chart
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "hero social-proof pricing" --domain landing
```

이런 식으로 typography, UX, chart, landing pattern을 따로 보강한다.

### 5. 구현 stack 기준 룰 보기

퍼블리싱 직전엔 stack guideline을 같이 보는 게 좋다.

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "responsive cards forms tables" --stack html-tailwind
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "dashboard state performance" --stack react
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "forms dialogs theme" --stack nextjs
```

## 디자이너용 추천 흐름

### 흐름 1. 레퍼런스 조사

1. issue가 `Research`에 들어온다.
2. product type, tone, industry 키워드를 뽑는다.
3. `--design-system`으로 큰 방향을 만든다.
4. `--domain ux`, `--domain typography`, `--domain landing`으로 보강한다.
5. 결과를 markdown note로 정리한다.

산출물 예시:

- design direction summary
- color candidates
- typography candidates
- UX rules
- anti-patterns

### 흐름 2. 디자인 시스템 구축

1. issue가 `Design`에 들어온다.
2. `--design-system --persist`로 master rule을 만든다.
3. 필요한 페이지에 `--page` override를 만든다.
4. component naming, spacing rule, copy tone을 문서화한다.
5. `Todo`로 handoff한다.

산출물 예시:

- `design-system/MASTER.md`
- `design-system/pages/dashboard.md`
- `notes/design-handoff.md`

### 흐름 3. 퍼블리싱 지원

1. `Todo` 상태에서 프론트 구현 시작
2. 구현 전 `Design` 산출물을 읽는다.
3. 구현 후 `playwright-interactive`로 기능 QA
4. `screenshot`으로 전후 비교
5. 리뷰 전 시각 QA 요약 작성

즉 이 skill은 디자인을 “그려주는” 도구보다, 퍼블리싱 전에 기준을 세우는 도구로 보는 게 맞다.

## Codex에게 이렇게 말하면 좋다

### 디자인 시스템 초안

```text
Use $ui-ux-pro-max.
Create a design system for an admin dashboard product.
Persist the result under design-system/.
Then summarize the final direction in markdown for handoff.
```

### 기존 UI 개선안

```text
Use $ui-ux-pro-max.
Review the current frontend and propose a cleaner, more consistent UI direction.
Generate a design-system draft and list the top 5 UX improvements before implementation.
```

### 랜딩페이지 방향 제안

```text
Use $ui-ux-pro-max.
Propose a landing page direction for a B2B SaaS product.
Recommend hero structure, CTA hierarchy, color palette, and typography.
Output a concise design brief in markdown.
```

### 디자이너 + 프론트 handoff

```text
Use $ui-ux-pro-max and $playwright-interactive.
Define the design system first, then implement the page in the current repo,
and finish with visual QA notes for Human Review.
```

## 어떤 작업에 특히 잘 맞나

- 어드민 대시보드
- B2B SaaS landing page
- 채팅/워크스페이스 UI 정리
- 디자인 시스템 초안 작성
- 스타일 통일
- 퍼블리싱 전 UI rule 정리

## 한계

- 완전히 새로운 high-end visual concept 창작에는 한계가 있다.
- 실제 그래픽 편집 툴처럼 화면을 직접 그리진 않는다.
- keyword와 query 품질에 따라 추천 품질이 꽤 달라진다.
- stack guideline은 특정 query에서 결과가 없을 수 있으니 여러 키워드로 다시 검색하는 편이 좋다.

## 함께 쓰면 좋은 skill

- `playwright-interactive`
  - 구현 후 functional/visual QA
- `screenshot`
  - 기준 화면 캡처와 리뷰
- `slides`
  - 디자인 리뷰 deck, 제안서, 발표자료 제작

## 추천 운영 원칙

- `Research`에서 direction을 찾고
- `Design`에서 system을 고정하고
- `Todo`에서 구현하고
- `Human Review`에서 시각 QA를 한다

이 구조가 `Comphony`와 가장 잘 맞는다.
