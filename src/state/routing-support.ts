import type { RoutingPolicy } from "../config.js";

type RuntimeProjectLike = {
  id: string;
  name: string;
};

type RuntimeStateLike = {
  projects: RuntimeProjectLike[];
};

export function inferProjectFromMessage<TState extends RuntimeStateLike>(
  state: TState,
  body: string,
  routing: RoutingPolicy
): string | null {
  const lowered = body.toLowerCase();

  for (const project of state.projects) {
    const normalizedName = project.name.toLowerCase();
    const normalizedId = project.id.toLowerCase();
    if (lowered.includes(normalizedName) || lowered.includes(normalizedId)) {
      return project.id;
    }
  }

  const inferredProjectId = inferProjectByIntent(state.projects, lowered);
  if (inferredProjectId) {
    return inferredProjectId;
  }

  return routing.defaultProject ?? state.projects[0]?.id ?? null;
}

export function inferLaneFromMessage(body: string, routing: RoutingPolicy): string {
  const lowered = body.toLowerCase();
  for (const [lane, keywords] of Object.entries(routing.laneKeywords)) {
    if (matchesAny(lowered, keywords)) {
      return lane;
    }
  }
  return routing.defaultLane;
}

export function deriveTaskTitle(body: string): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "Untitled task";
  }
  if (trimmed.length <= 72) {
    return trimmed;
  }
  return `${trimmed.slice(0, 69)}...`;
}

export function defaultRoutingPolicy(): RoutingPolicy {
  return {
    defaultProject: null,
    defaultLane: "planning",
    laneKeywords: {
      research: ["research", "investigate", "analyze", "analysis", "리서치", "조사", "탐색", "분석"],
      design: ["design", "redesign", "ux", "ui", "wireframe", "layout", "dashboard", "디자인", "설계", "화면", "레이아웃", "대시보드"],
      planning: ["plan", "scope", "spec", "define", "기획", "계획", "범위", "정의", "명세", "로드맵"],
      build: ["implement", "build", "code", "develop", "publish", "fix", "patch", "hotfix", "구현", "개발", "코드", "제작", "배포", "수정", "패치"],
      review: ["review", "qa", "check", "리뷰", "검토", "확인", "테스트"]
    },
    preferredRoles: {
      planning: ["coordination", "design"],
      research: ["coordination", "design"],
      design: ["design", "coordination"],
      build: ["build", "publishing"],
      review: ["publishing", "build", "coordination"]
    }
  };
}

function matchesAny(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
}

function inferProjectByIntent(projects: RuntimeProjectLike[], lowered: string): string | null {
  const routingCandidates: Array<{ projectId: string; keywords: string[] }> = [
    {
      projectId: "project_managing",
      keywords: [
        "setup",
        "set up",
        "bootstrap",
        "provision",
        "provisioning",
        "initialize",
        "init ",
        "create repo",
        "new repo",
        "workflow",
        "linear project",
        "설정",
        "세팅",
        "셋업",
        "구성",
        "초기화",
        "프로비저닝",
        "부트스트랩",
        "워크플로우",
        "레포",
        "리포지토리",
        "저장소 생성",
        "새 저장소",
        "프로젝트 생성"
      ]
    },
    {
      projectId: "ops_maintenance",
      keywords: [
        "fix",
        "bug",
        "incident",
        "outage",
        "maintenance",
        "operational",
        "operations",
        "hotfix",
        "cleanup",
        "수정",
        "버그",
        "장애",
        "이슈",
        "점검",
        "운영",
        "유지보수",
        "핫픽스",
        "정리"
      ]
    },
    {
      projectId: "idea_lab",
      keywords: [
        "idea",
        "brainstorm",
        "research",
        "explore",
        "planning",
        "plan",
        "roadmap",
        "strategy",
        "spec",
        "prd",
        "아이디어",
        "브레인스토밍",
        "조사",
        "리서치",
        "탐색",
        "기획",
        "계획",
        "로드맵",
        "전략",
        "스펙",
        "요구사항"
      ]
    },
    {
      projectId: "product_core",
      keywords: [
        "implement",
        "build",
        "design",
        "redesign",
        "develop",
        "feature",
        "ui",
        "ux",
        "dashboard",
        "frontend",
        "구현",
        "개발",
        "디자인",
        "설계",
        "기능",
        "화면",
        "대시보드",
        "프론트엔드",
        "사용자 경험"
      ]
    }
  ];

  for (const candidate of routingCandidates) {
    if (projects.some((project) => project.id === candidate.projectId) && matchesAny(lowered, candidate.keywords)) {
      return candidate.projectId;
    }
  }

  return null;
}
