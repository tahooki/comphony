import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { JSONObject } from "../config.js";
import { resolveRoutingPolicy, type RoutingPolicy } from "../config.js";
import { TASK_STATUS } from "./task-policy.js";

type RuntimeProjectLike = {
  id: string;
  lanes: string[];
  repoSlug: string | null;
};

type RuntimeAgentLike = {
  id: string;
  role: string;
  assignedProjects: string[];
};

type ExternalRefLike = {
  provider: string;
  externalId: string | null;
  externalKey: string | null;
  url: string | null;
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
  artifactPaths: string[];
  externalRefs: ExternalRefLike[];
  blockingReason: string | null;
  needsApproval: boolean;
  humanTakeover: boolean;
  completionSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

type RuntimeStateLike = {
  projects: RuntimeProjectLike[];
  agents: RuntimeAgentLike[];
  tasks: TaskRecordLike[];
};

type EventInput = {
  type: string;
  entityType: "thread" | "message" | "task" | "consultation" | "review" | "approval" | "system";
  entityId: string;
  timestamp: string;
  payload: Record<string, string | number | boolean | null>;
};

type LifecycleDeps<TState extends RuntimeStateLike, TTask extends TaskRecordLike, TAgent extends RuntimeAgentLike> = {
  appendEvent: (state: TState, input: EventInput) => void;
  nextTaskId: (state: TState) => string;
  refreshTaskGraphState: (state: TState, taskId: string) => void;
  requiresDesignHandoff: (role: string, lane: string) => boolean;
  selectAgentForTask: (state: TState, task: TTask, routing: RoutingPolicy) => TAgent | null;
};

export function createTask<TState extends RuntimeStateLike, TTask extends TaskRecordLike>(
  state: TState,
  input: {
    projectId: string;
    title: string;
    description: string;
    lane: string;
    parentTaskId?: string | null;
    dependsOnTaskIds?: string[];
  },
  deps: Pick<LifecycleDeps<TState, TTask, RuntimeAgentLike>, "appendEvent" | "nextTaskId" | "refreshTaskGraphState">
): TTask {
  const project = state.projects.find((item) => item.id === input.projectId);
  if (!project) {
    throw new Error(`Unknown project id: ${input.projectId}`);
  }
  if (!project.lanes.includes(input.lane)) {
    throw new Error(`Lane ${input.lane} is not defined for project ${input.projectId}`);
  }

  const now = new Date().toISOString();
  const task = {
    id: deps.nextTaskId(state),
    title: input.title,
    description: input.description,
    projectId: input.projectId,
    lane: input.lane,
    status: TASK_STATUS.new,
    assigneeId: null,
    parentTaskId: input.parentTaskId ?? null,
    childTaskIds: [],
    dependsOnTaskIds: input.dependsOnTaskIds ?? [],
    artifactPaths: [],
    externalRefs: [],
    blockingReason: null,
    needsApproval: false,
    humanTakeover: false,
    completionSummary: null,
    createdAt: now,
    updatedAt: now
  } as unknown as TTask;

  state.tasks.push(task);
  if (task.parentTaskId) {
    const parent = state.tasks.find((item) => item.id === task.parentTaskId);
    if (!parent) {
      throw new Error(`Parent task ${task.parentTaskId} does not exist`);
    }
    if (!parent.childTaskIds.includes(task.id)) {
      parent.childTaskIds.push(task.id);
      parent.updatedAt = now;
    }
  }

  deps.appendEvent(state, {
    type: "task.created",
    entityType: "task",
    entityId: task.id,
    timestamp: now,
    payload: {
      projectId: task.projectId,
      lane: task.lane,
      title: task.title,
      parentTaskId: task.parentTaskId
    }
  });
  deps.refreshTaskGraphState(state, task.id);
  return task;
}

export function assignTask<TState extends RuntimeStateLike, TTask extends TaskRecordLike, TAgent extends RuntimeAgentLike>(
  config: JSONObject,
  root: string,
  state: TState,
  input: { taskId: string; agentId: string },
  deps: Pick<LifecycleDeps<TState, TTask, TAgent>, "appendEvent" | "requiresDesignHandoff">
): TTask {
  const task = state.tasks.find((item) => item.id === input.taskId);
  if (!task) {
    throw new Error(`Unknown task id: ${input.taskId}`);
  }
  const agent = state.agents.find((item) => item.id === input.agentId);
  if (!agent) {
    throw new Error(`Unknown agent id: ${input.agentId}`);
  }
  if (!agent.assignedProjects.includes(task.projectId)) {
    throw new Error(`Agent ${agent.id} is not assigned to project ${task.projectId}`);
  }

  const project = state.projects.find((item) => item.id === task.projectId);
  if (!project) {
    throw new Error(`Unknown project id: ${task.projectId}`);
  }

  if (project.lanes.includes("design") && deps.requiresDesignHandoff(agent.role, task.lane)) {
    const missing = validateDesignHandoffArtifacts(config, root, state, task.projectId);
    if (missing.length > 0) {
      throw new Error(`Design handoff incomplete for project ${task.projectId}. Missing: ${missing.join(", ")}`);
    }
  }

  task.assigneeId = agent.id;
  task.status = TASK_STATUS.assigned;
  task.updatedAt = new Date().toISOString();
  deps.appendEvent(state, {
    type: "task.assigned",
    entityType: "task",
    entityId: task.id,
    timestamp: task.updatedAt,
    payload: {
      assigneeId: agent.id,
      projectId: task.projectId,
      lane: task.lane
    }
  });
  return task as TTask;
}

export function autoAssignTask<TState extends RuntimeStateLike, TTask extends TaskRecordLike, TAgent extends RuntimeAgentLike>(
  config: JSONObject,
  root: string,
  state: TState,
  taskId: string,
  deps: Pick<LifecycleDeps<TState, TTask, TAgent>, "appendEvent" | "requiresDesignHandoff" | "selectAgentForTask">
): { task: TTask; agentId: string | null; error: string | null } {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) {
    throw new Error(`Unknown task id: ${taskId}`);
  }
  const routing = resolveRoutingPolicy(config);
  const preferredAgent = deps.selectAgentForTask(state, task as TTask, routing);
  if (!preferredAgent) {
    return { task: task as TTask, agentId: null, error: "No eligible agent found for this task." };
  }
  try {
    const assigned = assignTask(config, root, state, { taskId, agentId: preferredAgent.id }, deps);
    return { task: assigned, agentId: preferredAgent.id, error: null };
  } catch (error) {
    return { task: task as TTask, agentId: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export function updateTaskStatus<TState extends RuntimeStateLike, TTask extends TaskRecordLike>(
  state: TState,
  input: { taskId: string; status: string },
  deps: Pick<LifecycleDeps<TState, TTask, RuntimeAgentLike>, "appendEvent" | "refreshTaskGraphState">
): TTask {
  const task = state.tasks.find((item) => item.id === input.taskId);
  if (!task) {
    throw new Error(`Unknown task id: ${input.taskId}`);
  }
  task.status = input.status;
  task.updatedAt = new Date().toISOString();
  deps.appendEvent(state, {
    type: "task.status_updated",
    entityType: "task",
    entityId: task.id,
    timestamp: task.updatedAt,
    payload: {
      status: task.status,
      projectId: task.projectId,
      lane: task.lane
    }
  });
  deps.refreshTaskGraphState(state, task.id);
  return task as TTask;
}

export function validateDesignHandoffArtifacts<TState extends RuntimeStateLike>(
  config: JSONObject,
  root: string,
  state: TState,
  projectId: string
): string[] {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) {
    throw new Error(`Unknown project id: ${projectId}`);
  }
  if (!project.lanes.includes("design")) {
    return [];
  }
  if (!project.repoSlug) {
    return ["repo slug missing"];
  }

  const runtime = asMap(config.runtime);
  const repoRoot = typeof runtime?.repo_root === "string" ? runtime.repo_root : "./repos";
  const basePath = resolve(root, repoRoot, project.repoSlug);
  const requiredPaths = [
    "design-system/MASTER.md",
    "plans/design/design-plan.md",
    "plans/design/dev-handoff.md"
  ];

  return requiredPaths.filter((relativePath) => {
    try {
      readFileSync(resolve(basePath, relativePath), "utf8");
      return false;
    } catch {
      return true;
    }
  });
}

function asMap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
