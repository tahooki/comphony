import type { RoutingPolicy } from "../config.js";

type RuntimeAgentLike = {
  id: string;
  role: string;
  assignedProjects: string[];
};

type TaskRecordLike = {
  id: string;
  projectId: string;
  lane: string;
  status: string;
  assigneeId: string | null;
  parentTaskId: string | null;
  childTaskIds: string[];
  artifactPaths?: string[];
  blockingReason: string | null;
  needsApproval: boolean;
  completionSummary: string | null;
  updatedAt: string;
};

type RuntimeStateLike = {
  agents: RuntimeAgentLike[];
  tasks: TaskRecordLike[];
};

export const TASK_STATUS = {
  new: "new",
  triaged: "triaged",
  assigned: "assigned",
  inProgress: "in_progress",
  review: "review",
  reviewRequested: "review_requested",
  waiting: "waiting",
  consulting: "consulting",
  blocked: "blocked",
  reported: "reported",
  done: "done",
  failed: "failed",
  canceled: "canceled"
} as const;

const TASK_COMPLETE_STATUSES: ReadonlySet<string> = new Set([TASK_STATUS.reported, TASK_STATUS.done]);
const TASK_BLOCKED_STATUSES: ReadonlySet<string> = new Set([TASK_STATUS.blocked, TASK_STATUS.waiting, TASK_STATUS.consulting]);
const REVIEW_REQUESTED_STATUS = TASK_STATUS.reviewRequested;
const WAITING_STATUSES: ReadonlySet<string> = new Set([TASK_STATUS.consulting, TASK_STATUS.waiting]);
const BUILD_RELATED_LANES: ReadonlySet<string> = new Set(["build", "review", "todo", TASK_STATUS.inProgress]);
const BUILD_RELATED_ROLES: ReadonlySet<string> = new Set(["build", "publishing"]);
const REVIEW_TARGET_ROLES: ReadonlySet<string> = new Set(["publishing", "coordination", "build"]);

export function summarizeParentCompletion<TTask extends Pick<TaskRecordLike, "lane">>(children: TTask[]): string {
  const completedLanes = children.map((child) => child.lane).join(", ");
  return `Completed child lanes: ${completedLanes}.`;
}

function summarizeDeskChildReport<TTask extends Pick<TaskRecordLike, "projectId" | "lane" | "completionSummary" | "artifactPaths">>(children: TTask[]): string {
  const summary = summarizeParentCompletion(children);
  const childProjects = Array.from(new Set(children.map((child) => describeProjectId(child.projectId))));
  const childSummaries = children
    .map((child) => child.completionSummary?.trim())
    .filter((item): item is string => Boolean(item));
  const artifactPaths = Array.from(
    new Set(
      children.flatMap((child) => child.artifactPaths ?? [])
    )
  );
  return [
    `${joinLabels(childProjects)} reported back to Comphony Desk.`,
    childSummaries.length > 0 ? childSummaries.join(" ") : summary,
    artifactPaths.length > 0 ? `Artifacts: ${artifactPaths.join(", ")}.` : null
  ].filter((item): item is string => Boolean(item)).join(" ");
}

function shouldUseDeskReportedClosure<TTask extends Pick<TaskRecordLike, "projectId">>(
  parent: TTask,
  children: TTask[]
): boolean {
  return parent.projectId === "comphony_desk" && children.length > 0 && children.every((child) => child.projectId !== "comphony_desk");
}

export function isTaskComplete<TTask extends Pick<TaskRecordLike, "status">>(task: TTask): boolean {
  return TASK_COMPLETE_STATUSES.has(task.status);
}

export function isTaskBlocked<TTask extends Pick<TaskRecordLike, "status" | "needsApproval">>(task: TTask): boolean {
  return TASK_BLOCKED_STATUSES.has(task.status) || task.needsApproval;
}

export function isTaskWaitingForApproval<TTask extends Pick<TaskRecordLike, "status" | "needsApproval">>(task: TTask): boolean {
  return task.needsApproval || task.status === TASK_STATUS.waiting;
}

export function isTaskAwaitingConsultation<TTask extends Pick<TaskRecordLike, "status">>(task: TTask): boolean {
  return task.status === TASK_STATUS.consulting;
}

export function isTaskReviewRequested<TTask extends Pick<TaskRecordLike, "status">>(task: TTask): boolean {
  return task.status === TASK_STATUS.reviewRequested;
}

export function refreshTaskGraphState<TState extends RuntimeStateLike, TTask extends TaskRecordLike>(
  state: TState,
  taskId: string
): void {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || !task.parentTaskId) {
    return;
  }

  const parent = state.tasks.find((item) => item.id === task.parentTaskId);
  if (!parent) {
    return;
  }

  const children = parent.childTaskIds
    .map((childId) => state.tasks.find((item) => item.id === childId))
    .filter((child): child is TTask => Boolean(child));
  if (children.length === 0) {
    return;
  }

  if (children.every((child) => isTaskComplete(child))) {
    parent.status = shouldUseDeskReportedClosure(parent, children) ? TASK_STATUS.reported : TASK_STATUS.done;
    parent.completionSummary = shouldUseDeskReportedClosure(parent, children)
      ? summarizeDeskChildReport(children)
      : summarizeParentCompletion(children);
    parent.blockingReason = null;
  } else if (children.some((child) => isTaskBlocked(child))) {
    parent.status = TASK_STATUS.blocked;
    parent.blockingReason = children.find((child) => isTaskBlocked(child))?.blockingReason ?? "child task blocked";
  } else if (children.some((child) => child.status === REVIEW_REQUESTED_STATUS)) {
    parent.status = REVIEW_REQUESTED_STATUS;
  } else if (children.some((child) => WAITING_STATUSES.has(child.status))) {
    parent.status = TASK_STATUS.waiting;
  } else {
    parent.status = TASK_STATUS.inProgress;
    parent.blockingReason = null;
  }

  parent.updatedAt = new Date().toISOString();
  if (parent.parentTaskId) {
    refreshTaskGraphState(state, parent.id);
  }
}

function describeProjectId(projectId: string): string {
  return projectId
    .split(/[_-]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) {
    return labels[0] ?? "Downstream work";
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function autoReviewTarget<
  TState extends { agents: RuntimeAgentLike[] },
  TTask extends Pick<TaskRecordLike, "projectId" | "assigneeId">
>(
  state: TState,
  task: TTask
): RuntimeAgentLike | null {
  return state.agents.find((agent) => {
    if (!agent.assignedProjects.includes(task.projectId)) {
      return false;
    }
    return REVIEW_TARGET_ROLES.has(agent.role) && agent.id !== task.assigneeId;
  }) ?? null;
}

export function requiresDesignHandoff(role: string, lane: string): boolean {
  return BUILD_RELATED_ROLES.has(role) || BUILD_RELATED_LANES.has(lane);
}

export function selectAgentForTask<
  TState extends { agents: RuntimeAgentLike[] },
  TTask extends Pick<TaskRecordLike, "projectId" | "lane">
>(
  state: TState,
  task: TTask,
  routing: RoutingPolicy
): RuntimeAgentLike | null {
  const candidates = state.agents.filter((agent) => agent.assignedProjects.includes(task.projectId));
  const preferredRoles = routing.preferredRoles[task.lane] ?? preferredRolesForLane(task.lane);
  for (const role of preferredRoles) {
    const match = candidates.find((agent) => agent.role === role);
    if (match) {
      return match;
    }
  }
  return candidates[0] ?? null;
}

export function nextStatusForWorkTurn(lane: string, status: string): string {
  if (lane === "review") {
    switch (status) {
      case TASK_STATUS.new:
      case TASK_STATUS.triaged:
      case TASK_STATUS.assigned:
        return TASK_STATUS.review;
      case TASK_STATUS.review:
      case TASK_STATUS.inProgress:
        return TASK_STATUS.done;
      case TASK_STATUS.done:
        return TASK_STATUS.done;
      default:
        return TASK_STATUS.review;
    }
  }

  switch (status) {
    case TASK_STATUS.new:
    case TASK_STATUS.triaged:
    case TASK_STATUS.assigned:
      return TASK_STATUS.inProgress;
    case TASK_STATUS.inProgress:
      return TASK_STATUS.review;
    case TASK_STATUS.review:
    case TASK_STATUS.done:
      return status;
    default:
      return TASK_STATUS.inProgress;
  }
}

export function shouldAutoRequestReview<TTask extends Pick<TaskRecordLike, "status" | "lane">>(task: TTask): boolean {
  return task.status === TASK_STATUS.review && task.lane !== TASK_STATUS.review;
}

function preferredRolesForLane(lane: string): string[] {
  switch (lane) {
    case "design":
      return ["design", "coordination"];
    case "build":
      return ["build", "publishing"];
    case "review":
      return ["publishing", "build", "coordination"];
    case "research":
    case "planning":
      return ["coordination", "design"];
    default:
      return ["coordination"];
  }
}
