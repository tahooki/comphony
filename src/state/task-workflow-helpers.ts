import type { RoutingPolicy } from "../config.js";

type RuntimeAgentLike = {
  id: string;
  role: string;
  assignedProjects: string[];
};

type RuntimeProjectLike = {
  id: string;
  lanes: string[];
};

type TaskRecordLike = {
  id: string;
  title: string;
  description: string;
  projectId: string;
  lane: string;
  status: string;
  assigneeId: string | null;
  parentTaskId: string | null;
  childTaskIds: string[];
  dependsOnTaskIds: string[];
  blockingReason: string | null;
  needsApproval: boolean;
  completionSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

type RuntimeStateLike = {
  projects: RuntimeProjectLike[];
  agents: RuntimeAgentLike[];
  tasks: TaskRecordLike[];
};

type WorkflowDeps<TState extends RuntimeStateLike, TTask extends TaskRecordLike> = {
  createTask: (
    state: TState,
    input: {
      projectId: string;
      title: string;
      description: string;
      lane: string;
      parentTaskId?: string | null;
      dependsOnTaskIds?: string[];
    }
  ) => TTask;
  deriveTaskTitle: (body: string) => string;
  getThreadDetail: (state: TState, threadId: string) => { tasks: TTask[] };
  inferLaneFromMessage: (body: string, routing: RoutingPolicy) => string;
};

export function createExecutionTasksFromLanes<TState extends RuntimeStateLike, TTask extends TaskRecordLike>(
  state: TState,
  input: { projectId: string; body: string; parentTaskId: string; threadId: string; requestedLanes: string[] },
  deps: Pick<WorkflowDeps<TState, TTask>, "createTask" | "deriveTaskTitle">
): TTask[] {
  const tasks: TTask[] = [];
  let previousTaskId: string | null = null;
  for (const lane of input.requestedLanes) {
    const task = deps.createTask(state, {
      projectId: input.projectId,
      title: `${capitalizeLane(lane)}: ${deps.deriveTaskTitle(input.body)}`,
      description: input.body,
      lane,
      parentTaskId: input.parentTaskId,
      dependsOnTaskIds: previousTaskId ? [previousTaskId] : []
    });
    tasks.push(task);
    previousTaskId = task.id;
  }
  return tasks;
}

export function deriveRequestedLanes<TState extends RuntimeStateLike>(
  state: TState,
  projectId: string,
  body: string,
  preferredLane: string | undefined,
  routing: RoutingPolicy,
  deps: Pick<WorkflowDeps<TState, TaskRecordLike>, "inferLaneFromMessage">
): string[] {
  const project = state.projects.find((item) => item.id === projectId);
  const allowed = new Set(project?.lanes ?? []);
  const inferred = new Set<string>();
  const lowered = body.toLowerCase();
  const baseLane = preferredLane ?? deps.inferLaneFromMessage(body, routing);
  if (allowed.has(baseLane)) {
    inferred.add(baseLane);
  }
  if (/\b(plan|scope|spec|define)\b/.test(lowered) && allowed.has("planning")) {
    inferred.add("planning");
  }
  if (/\b(research|investigate|compare|reference|competitor)\b/.test(lowered) && allowed.has("research")) {
    inferred.add("research");
  }
  if (/\b(design|redesign|ux|ui|layout|dashboard|wireframe|system)\b/.test(lowered) && allowed.has("design")) {
    inferred.add("design");
  }
  if (/\b(build|implement|develop|code|publish|frontend|ship)\b/.test(lowered) && allowed.has("build")) {
    inferred.add("build");
  }
  if (/\b(review|qa|check|inspect|validate)\b/.test(lowered) && allowed.has("review")) {
    inferred.add("review");
  }

  const ordered = ["research", "design", "build", "review"].filter((lane) => inferred.has(lane));
  if (ordered.length > 0) {
    return ordered;
  }
  return [baseLane];
}

export function getOrderedThreadTasks<TState extends RuntimeStateLike, TTask extends TaskRecordLike>(
  state: TState,
  threadId: string,
  deps: Pick<WorkflowDeps<TState, TTask>, "getThreadDetail">
): TTask[] {
  const detail = deps.getThreadDetail(state, threadId);
  return detail.tasks.slice().sort((left, right) => {
    if (left.parentTaskId === null && right.parentTaskId !== null) {
      return -1;
    }
    if (left.parentTaskId !== null && right.parentTaskId === null) {
      return 1;
    }
    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function findNextReadyChildTask<TState extends RuntimeStateLike, TTask extends TaskRecordLike>(
  state: TState,
  threadId: string,
  deps: Pick<WorkflowDeps<TState, TTask>, "getThreadDetail">
): TTask | null {
  return getOrderedThreadTasks(state, threadId, deps).find((task) => task.parentTaskId !== null && !isTaskComplete(task) && dependenciesSatisfied(state, task)) ?? null;
}

export function dependenciesSatisfied<TState extends RuntimeStateLike, TTask extends TaskRecordLike>(
  state: TState,
  task: TTask
): boolean {
  return task.dependsOnTaskIds.every((taskId) => {
    const dependency = state.tasks.find((item) => item.id === taskId);
    return dependency ? isTaskComplete(dependency) : false;
  });
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
    parent.status = "done";
    parent.completionSummary = summarizeParentCompletion(children);
  } else if (children.some((child) => isTaskBlocked(child))) {
    parent.status = "blocked";
    parent.blockingReason = children.find((child) => isTaskBlocked(child))?.blockingReason ?? "child task blocked";
  } else if (children.some((child) => child.status === "review_requested")) {
    parent.status = "review_requested";
  } else if (children.some((child) => child.status === "consulting" || child.status === "waiting")) {
    parent.status = "waiting";
  } else {
    parent.status = "in_progress";
    parent.blockingReason = null;
  }

  parent.updatedAt = new Date().toISOString();
  if (parent.parentTaskId) {
    refreshTaskGraphState(state, parent.id);
  }
}

export function summarizeParentCompletion<TTask extends TaskRecordLike>(children: TTask[]): string {
  const completedLanes = children.map((child) => child.lane).join(", ");
  return `Completed child lanes: ${completedLanes}.`;
}

export function isTaskComplete<TTask extends TaskRecordLike>(task: TTask): boolean {
  return ["reported", "done"].includes(task.status);
}

export function isTaskBlocked<TTask extends TaskRecordLike>(task: TTask): boolean {
  return ["blocked", "waiting", "consulting"].includes(task.status) || task.needsApproval;
}

export function autoReviewTarget<TState extends RuntimeStateLike, TTask extends TaskRecordLike>(
  state: TState,
  task: TTask
): RuntimeAgentLike | null {
  return state.agents.find((agent) => {
    if (!agent.assignedProjects.includes(task.projectId)) {
      return false;
    }
    return ["publishing", "coordination", "build"].includes(agent.role) && agent.id !== task.assigneeId;
  }) ?? null;
}

export function requiresDesignHandoff(role: string, lane: string): boolean {
  return ["build", "publishing"].includes(role) || ["build", "review", "todo", "in_progress"].includes(lane);
}

export function selectAgentForTask<TState extends RuntimeStateLike, TTask extends TaskRecordLike>(
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
      case "new":
      case "assigned":
        return "review";
      case "review":
      case "in_progress":
        return "done";
      case "done":
        return "done";
      default:
        return "review";
    }
  }

  switch (status) {
    case "new":
    case "assigned":
      return "in_progress";
    case "in_progress":
      return "review";
    case "review":
    case "done":
      return status;
    default:
      return "in_progress";
  }
}

export function workTurnMessage<TTask extends Pick<TaskRecordLike, "title" | "lane">>(
  agentName: string,
  role: string,
  task: TTask,
  nextStatus: string,
  artifacts: { artifactPaths: string[]; summary: string }
): string {
  if (nextStatus === "in_progress") {
    return `${agentName} picked up ${task.title} as the ${role} agent and is now working on the ${task.lane} lane. ${artifacts.summary} Artifacts: ${artifacts.artifactPaths.join(", ")}`;
  }
  if (nextStatus === "review") {
    return `${agentName} completed the current work turn for ${task.title} and moved it to review. ${artifacts.summary} Artifacts: ${artifacts.artifactPaths.join(", ")}`;
  }
  return `${agentName} checked ${task.title} and kept it in ${nextStatus}. ${artifacts.summary}`;
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

function capitalizeLane(lane: string): string {
  return lane.length > 0 ? `${lane[0].toUpperCase()}${lane.slice(1)}` : lane;
}
