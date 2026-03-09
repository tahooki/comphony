import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { generateTaskArtifacts } from "./agent-runtime.js";
import type { JSONObject, RoutingPolicy } from "./config.js";
import { resolveRoutingPolicy } from "./config.js";

type RuntimeProject = {
  id: string;
  name: string;
  purpose: string | null;
  lanes: string[];
  repoSlug: string | null;
};

type RuntimeAgent = {
  id: string;
  name: string;
  role: string;
  assignedProjects: string[];
};

export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  projectId: string;
  lane: string;
  status: string;
  assigneeId: string | null;
  artifactPaths: string[];
  createdAt: string;
  updatedAt: string;
};

type ThreadRecord = {
  id: string;
  title: string;
  taskIds: string[];
  messageIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ThreadDetail = {
  thread: ThreadRecord;
  messages: MessageRecord[];
  tasks: TaskRecord[];
};

export type MessageRecord = {
  id: string;
  threadId: string;
  role: "user" | "agent" | "system";
  body: string;
  routedProjectId: string | null;
  suggestedLane: string | null;
  createdAt: string;
};

export type EventRecord = {
  id: string;
  type: string;
  entityType: "thread" | "message" | "task" | "system";
  entityId: string;
  timestamp: string;
  payload: Record<string, string | number | boolean | null>;
};

export type MemoryRecord = {
  id: string;
  scope: "company" | "project" | "thread" | "task" | "agent";
  projectId: string | null;
  threadId: string | null;
  taskId: string | null;
  agentId: string | null;
  kind: string;
  body: string;
  tags: string[];
  createdAt: string;
};

export type IntakeResult = {
  thread: ThreadRecord;
  message: MessageRecord;
  task: TaskRecord;
  assignedAgentId: string | null;
  assignmentError: string | null;
};

export type RuntimeState = {
  version: number;
  projects: RuntimeProject[];
  agents: RuntimeAgent[];
  tasks: TaskRecord[];
  threads: ThreadRecord[];
  messages: MessageRecord[];
  events: EventRecord[];
  memories: MemoryRecord[];
  counters: {
    task: number;
    thread: number;
    message: number;
    event: number;
    memory: number;
  };
};

const DEFAULT_STATE: RuntimeState = {
  version: 1,
  projects: [],
  agents: [],
  tasks: [],
  threads: [],
  messages: [],
  events: [],
  memories: [],
  counters: {
    task: 0,
    thread: 0,
    message: 0,
    event: 0,
    memory: 0
  }
};

export function loadRuntimeState(config: JSONObject, root: string): RuntimeState {
  const statePath = getStatePath(config, root);
  const dataDir = getRuntimeDataDir(config, root);
  mkdirSync(dataDir, { recursive: true });

  let state = DEFAULT_STATE;
  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8")) as RuntimeState;
    state = parsed;
  } catch {
    state = structuredClone(DEFAULT_STATE);
  }

  const synced = syncCatalogFromConfig(config, state);
  saveRuntimeState(config, root, synced);
  return synced;
}

export function saveRuntimeState(config: JSONObject, root: string, state: RuntimeState): void {
  const statePath = getStatePath(config, root);
  const dataDir = getRuntimeDataDir(config, root);
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
}

export function listProjects(state: RuntimeState): RuntimeProject[] {
  return state.projects;
}

export function listAgents(state: RuntimeState, projectId?: string): RuntimeAgent[] {
  if (!projectId) {
    return state.agents;
  }
  return state.agents.filter((agent) => agent.assignedProjects.includes(projectId));
}

export function listTasks(state: RuntimeState, filters?: { projectId?: string; status?: string }): TaskRecord[] {
  return state.tasks.filter((task) => {
    if (filters?.projectId && task.projectId !== filters.projectId) {
      return false;
    }
    if (filters?.status && task.status !== filters.status) {
      return false;
    }
    return true;
  });
}

export function listThreads(state: RuntimeState): ThreadRecord[] {
  return state.threads;
}

export function getThreadDetail(state: RuntimeState, threadId: string): ThreadDetail {
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread) {
    throw new Error(`Unknown thread id: ${threadId}`);
  }
  return {
    thread,
    messages: state.messages.filter((message) => message.threadId === threadId),
    tasks: state.tasks.filter((task) => thread.taskIds.includes(task.id))
  };
}

export function listMessages(state: RuntimeState, threadId?: string): MessageRecord[] {
  if (!threadId) {
    return state.messages;
  }
  return state.messages.filter((message) => message.threadId === threadId);
}

export function listEvents(state: RuntimeState, limit = 50): EventRecord[] {
  return state.events.slice(-limit).reverse();
}

export function listMemories(
  state: RuntimeState,
  filters?: { projectId?: string; threadId?: string; taskId?: string; query?: string; limit?: number }
): MemoryRecord[] {
  let items = state.memories.filter((memory) => {
    if (filters?.projectId && memory.projectId !== filters.projectId) {
      return false;
    }
    if (filters?.threadId && memory.threadId !== filters.threadId) {
      return false;
    }
    if (filters?.taskId && memory.taskId !== filters.taskId) {
      return false;
    }
    if (filters?.query) {
      const lowered = filters.query.toLowerCase();
      const haystack = `${memory.body} ${memory.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(lowered)) {
        return false;
      }
    }
    return true;
  });
  items = items.slice().reverse();
  return items.slice(0, filters?.limit ?? 20);
}

export function addMemory(
  state: RuntimeState,
  input: {
    scope: MemoryRecord["scope"];
    projectId?: string | null;
    threadId?: string | null;
    taskId?: string | null;
    agentId?: string | null;
    kind: string;
    body: string;
    tags?: string[];
  }
): MemoryRecord {
  const memory: MemoryRecord = {
    id: nextMemoryId(state),
    scope: input.scope,
    projectId: input.projectId ?? null,
    threadId: input.threadId ?? null,
    taskId: input.taskId ?? null,
    agentId: input.agentId ?? null,
    kind: input.kind,
    body: input.body,
    tags: input.tags ?? [],
    createdAt: new Date().toISOString()
  };
  state.memories.push(memory);
  appendEvent(state, {
    type: "memory.recorded",
    entityType: "system",
    entityId: memory.id,
    timestamp: memory.createdAt,
    payload: {
      scope: memory.scope,
      projectId: memory.projectId,
      threadId: memory.threadId,
      taskId: memory.taskId,
      agentId: memory.agentId,
      kind: memory.kind
    }
  });
  return memory;
}

export function respondToThread(
  config: JSONObject,
  state: RuntimeState,
  input: { threadId: string; body: string }
): { threadId: string; userMessage: MessageRecord; responseMessage: MessageRecord } {
  const thread = state.threads.find((item) => item.id === input.threadId);
  if (!thread) {
    throw new Error(`Unknown thread id: ${input.threadId}`);
  }
  const routing = resolveRoutingPolicy(config);
  const userMessage = addMessage(state, {
    threadId: thread.id,
    role: "user",
    body: input.body
  }, routing);
  const detail = getThreadDetail(state, thread.id);
  addMemory(state, {
    scope: "thread",
    projectId: detail.tasks[0]?.projectId ?? null,
    threadId: thread.id,
    kind: "follow_up",
    body: `User follow-up: ${input.body}`,
    tags: ["follow-up", "thread"]
  });
  const responseMessage = addMessage(state, {
    threadId: thread.id,
    role: "system",
    body: composeThreadReply(detail, input.body, listMemories(state, { threadId: thread.id, limit: 3 })),
    routedProjectId: detail.tasks[0]?.projectId ?? userMessage.routedProjectId,
    suggestedLane: detail.tasks[0]?.lane ?? userMessage.suggestedLane
  }, routing);
  appendEvent(state, {
    type: "thread.responded",
    entityType: "thread",
    entityId: thread.id,
    timestamp: responseMessage.createdAt,
    payload: {
      userMessageId: userMessage.id,
      responseMessageId: responseMessage.id
    }
  });
  return { threadId: thread.id, userMessage, responseMessage };
}

export function createThread(state: RuntimeState, input: { title: string }): ThreadRecord {
  const now = new Date().toISOString();
  const thread: ThreadRecord = {
    id: nextThreadId(state),
    title: input.title,
    taskIds: [],
    messageIds: [],
    createdAt: now,
    updatedAt: now
  };
  state.threads.push(thread);
  appendEvent(state, {
    type: "thread.created",
    entityType: "thread",
    entityId: thread.id,
    timestamp: now,
    payload: { title: thread.title }
  });
  return thread;
}

export function addMessage(
  state: RuntimeState,
  input: { threadId: string; role: "user" | "agent" | "system"; body: string; routedProjectId?: string | null; suggestedLane?: string | null },
  routing?: RoutingPolicy
): MessageRecord {
  const thread = state.threads.find((item) => item.id === input.threadId);
  if (!thread) {
    throw new Error(`Unknown thread id: ${input.threadId}`);
  }
  const policy = routing ?? defaultRoutingPolicy();
  const message: MessageRecord = {
    id: nextMessageId(state),
    threadId: input.threadId,
    role: input.role,
    body: input.body,
    routedProjectId: input.routedProjectId ?? inferProjectFromMessage(state, input.body, policy),
    suggestedLane: input.suggestedLane ?? inferLaneFromMessage(input.body, policy),
    createdAt: new Date().toISOString()
  };
  state.messages.push(message);
  thread.messageIds.push(message.id);
  thread.updatedAt = message.createdAt;
  appendEvent(state, {
    type: "message.created",
    entityType: "message",
    entityId: message.id,
    timestamp: message.createdAt,
    payload: {
      threadId: message.threadId,
      role: message.role,
      routedProjectId: message.routedProjectId,
      suggestedLane: message.suggestedLane
    }
  });
  return message;
}

export function promoteMessageToTask(
  state: RuntimeState,
  input: { messageId: string; projectId?: string; lane?: string; title?: string },
  routing?: RoutingPolicy
): TaskRecord {
  const message = state.messages.find((item) => item.id === input.messageId);
  if (!message) {
    throw new Error(`Unknown message id: ${input.messageId}`);
  }
  const thread = state.threads.find((item) => item.id === message.threadId);
  if (!thread) {
    throw new Error(`Thread missing for message ${message.id}`);
  }
  const policy = routing ?? defaultRoutingPolicy();
  const projectId = input.projectId ?? message.routedProjectId ?? inferProjectFromMessage(state, message.body, policy);
  if (!projectId) {
    throw new Error(`Could not determine project for message ${message.id}`);
  }
  const lane = input.lane ?? message.suggestedLane ?? inferLaneFromMessage(message.body, policy);
  const title = input.title ?? deriveTaskTitle(message.body);
  const task = createTask(state, {
    projectId,
    title,
    description: message.body,
    lane
  });
  thread.taskIds.push(task.id);
  thread.updatedAt = task.updatedAt;
  appendEvent(state, {
    type: "message.promoted",
    entityType: "task",
    entityId: task.id,
    timestamp: task.updatedAt,
    payload: {
      threadId: thread.id,
      messageId: message.id,
      projectId,
      lane
    }
  });
  return task;
}

export function intakeRequest(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: { title: string; body: string; projectId?: string; lane?: string }
): IntakeResult {
  const routing = resolveRoutingPolicy(config);
  const thread = createThread(state, { title: input.title });
  const message = addMessage(state, {
    threadId: thread.id,
    role: "user",
    body: input.body,
    routedProjectId: input.projectId ?? null,
    suggestedLane: input.lane ?? null
  }, routing);
  const task = promoteMessageToTask(state, {
    messageId: message.id,
    projectId: input.projectId,
    lane: input.lane,
    title: input.title
  }, routing);
  addMemory(state, {
    scope: "thread",
    projectId: task.projectId,
    threadId: thread.id,
    taskId: task.id,
    kind: "intake",
    body: `Intake created for ${task.title} in lane ${task.lane}.`,
    tags: ["intake", task.lane]
  });
  const preferredAgent = selectAgentForTask(state, task, routing);
  if (!preferredAgent) {
    const result = {
      thread,
      message,
      task,
      assignedAgentId: null,
      assignmentError: "No eligible agent found for this task."
    };
    appendEvent(state, {
      type: "intake.completed",
      entityType: "thread",
      entityId: thread.id,
      timestamp: task.updatedAt,
      payload: {
        taskId: task.id,
        assignedAgentId: null,
        assignmentError: result.assignmentError
      }
    });
    return result;
  }
  try {
    assignTask(config, root, state, { taskId: task.id, agentId: preferredAgent.id });
    const result = {
      thread,
      message,
      task,
      assignedAgentId: preferredAgent.id,
      assignmentError: null
    };
    appendEvent(state, {
      type: "intake.completed",
      entityType: "thread",
      entityId: thread.id,
      timestamp: task.updatedAt,
      payload: {
        taskId: task.id,
        assignedAgentId: preferredAgent.id,
        assignmentError: null
      }
    });
    return result;
  } catch (error) {
    const result = {
      thread,
      message,
      task,
      assignedAgentId: null,
      assignmentError: error instanceof Error ? error.message : String(error)
    };
    appendEvent(state, {
      type: "intake.completed",
      entityType: "thread",
      entityId: thread.id,
      timestamp: task.updatedAt,
      payload: {
        taskId: task.id,
        assignedAgentId: null,
        assignmentError: result.assignmentError
      }
    });
    return result;
  }
}

export function createTask(
  state: RuntimeState,
  input: { projectId: string; title: string; description: string; lane: string }
): TaskRecord {
  const project = state.projects.find((item) => item.id === input.projectId);
  if (!project) {
    throw new Error(`Unknown project id: ${input.projectId}`);
  }
  if (!project.lanes.includes(input.lane)) {
    throw new Error(`Lane ${input.lane} is not defined for project ${input.projectId}`);
  }
  const now = new Date().toISOString();
  const id = nextTaskId(state);
  const task: TaskRecord = {
    id,
    title: input.title,
    description: input.description,
    projectId: input.projectId,
    lane: input.lane,
    status: "new",
    assigneeId: null,
    artifactPaths: [],
    createdAt: now,
    updatedAt: now
  };
  state.tasks.push(task);
  appendEvent(state, {
    type: "task.created",
    entityType: "task",
    entityId: task.id,
    timestamp: now,
    payload: {
      projectId: task.projectId,
      lane: task.lane,
      title: task.title
    }
  });
  return task;
}

export function assignTask(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: { taskId: string; agentId: string }
): TaskRecord {
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

  if (requiresDesignHandoff(agent.role, task.lane)) {
    const missing = validateDesignHandoffArtifacts(config, root, state, task.projectId);
    if (missing.length > 0) {
      throw new Error(
        `Design handoff incomplete for project ${task.projectId}. Missing: ${missing.join(", ")}`
      );
    }
  }

  task.assigneeId = agent.id;
  task.status = "assigned";
  task.updatedAt = new Date().toISOString();
  appendEvent(state, {
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
  return task;
}

export function autoAssignTask(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  taskId: string
): { task: TaskRecord; agentId: string | null; error: string | null } {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) {
    throw new Error(`Unknown task id: ${taskId}`);
  }
  const routing = resolveRoutingPolicy(config);
  const preferredAgent = selectAgentForTask(state, task, routing);
  if (!preferredAgent) {
    return { task, agentId: null, error: "No eligible agent found for this task." };
  }
  try {
    const assigned = assignTask(config, root, state, { taskId, agentId: preferredAgent.id });
    return { task: assigned, agentId: preferredAgent.id, error: null };
  } catch (error) {
    return { task, agentId: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export function updateTaskStatus(state: RuntimeState, input: { taskId: string; status: string }): TaskRecord {
  const task = state.tasks.find((item) => item.id === input.taskId);
  if (!task) {
    throw new Error(`Unknown task id: ${input.taskId}`);
  }
  task.status = input.status;
  task.updatedAt = new Date().toISOString();
  appendEvent(state, {
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
  return task;
}

export function handoffTask(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: { taskId: string; lane: string }
): { task: TaskRecord; threadId: string; message: MessageRecord; agentId: string | null; error: string | null } {
  const task = state.tasks.find((item) => item.id === input.taskId);
  if (!task) {
    throw new Error(`Unknown task id: ${input.taskId}`);
  }
  const project = state.projects.find((item) => item.id === task.projectId);
  if (!project) {
    throw new Error(`Unknown project id: ${task.projectId}`);
  }
  if (!project.lanes.includes(input.lane)) {
    throw new Error(`Lane ${input.lane} is not defined for project ${task.projectId}`);
  }
  const thread = state.threads.find((item) => item.taskIds.includes(task.id));
  if (!thread) {
    throw new Error(`Task ${task.id} is not linked to a thread`);
  }

  const previousLane = task.lane;
  const previousAssigneeId = task.assigneeId;
  const now = new Date().toISOString();
  task.lane = input.lane;
  task.status = "new";
  task.assigneeId = null;
  task.updatedAt = now;
  thread.updatedAt = now;

  const message = addMessage(state, {
    threadId: thread.id,
    role: "system",
    body: `Comphony handed off ${task.title} from ${previousLane} to ${input.lane}.`,
    routedProjectId: task.projectId,
    suggestedLane: input.lane
  });

  appendEvent(state, {
    type: "task.handed_off",
    entityType: "task",
    entityId: task.id,
    timestamp: now,
    payload: {
      threadId: thread.id,
      previousLane,
      lane: input.lane,
      previousAssigneeId
    }
  });

  const assigned = autoAssignTask(config, root, state, task.id);
  message.body = assigned.agentId
    ? `Comphony handed off ${task.title} from ${previousLane} to ${input.lane} and assigned ${assigned.agentId}.`
    : `Comphony handed off ${task.title} from ${previousLane} to ${input.lane} but no eligible agent was available.`;
  addMemory(state, {
    scope: "task",
    projectId: task.projectId,
    threadId: thread.id,
    taskId: task.id,
    agentId: assigned.agentId,
    kind: "handoff",
    body: message.body,
    tags: ["handoff", previousLane, input.lane]
  });
  return {
    task,
    threadId: thread.id,
    message,
    agentId: assigned.agentId,
    error: assigned.error
  };
}

export function runTaskWorkTurn(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: { taskId: string }
): { task: TaskRecord; threadId: string; message: MessageRecord } {
  const task = state.tasks.find((item) => item.id === input.taskId);
  if (!task) {
    throw new Error(`Unknown task id: ${input.taskId}`);
  }
  if (!task.assigneeId) {
    throw new Error(`Task ${task.id} has no assignee`);
  }
  const agent = state.agents.find((item) => item.id === task.assigneeId);
  if (!agent) {
    throw new Error(`Unknown agent id: ${task.assigneeId}`);
  }
  const thread = state.threads.find((item) => item.taskIds.includes(task.id));
  if (!thread) {
    throw new Error(`Task ${task.id} is not linked to a thread`);
  }

  const artifacts = generateTaskArtifacts({
    config,
    root,
    state,
    task,
    agentId: agent.id
  });
  const previousStatus = task.status;
  const nextStatus = nextStatusForWorkTurn(task.lane, previousStatus);
  const now = new Date().toISOString();
  const message = addMessage(state, {
    threadId: thread.id,
    role: "agent",
    body: workTurnMessage(agent.name, agent.role, task, nextStatus, artifacts),
    routedProjectId: task.projectId,
    suggestedLane: task.lane
  });

  task.artifactPaths = Array.from(new Set([...task.artifactPaths, ...artifacts.artifactPaths]));
  task.status = nextStatus;
  task.updatedAt = now;
  thread.updatedAt = now;
  appendEvent(state, {
    type: "task.artifacts_generated",
    entityType: "task",
    entityId: task.id,
    timestamp: now,
    payload: {
      threadId: thread.id,
      artifactCount: artifacts.artifactPaths.length,
      assigneeId: agent.id
    }
  });
  appendEvent(state, {
    type: "task.work_turn_completed",
    entityType: "task",
    entityId: task.id,
    timestamp: now,
    payload: {
      threadId: thread.id,
      assigneeId: agent.id,
      previousStatus,
      status: nextStatus
    }
  });
  addMemory(state, {
    scope: "task",
    projectId: task.projectId,
    threadId: thread.id,
    taskId: task.id,
    agentId: agent.id,
    kind: "work_turn",
    body: artifacts.summary,
    tags: [task.lane, task.status, agent.role]
  });

  return { task, threadId: thread.id, message };
}

export function validateDesignHandoffArtifacts(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  projectId: string
): string[] {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) {
    throw new Error(`Unknown project id: ${projectId}`);
  }
  const repoSlug = project.repoSlug;
  if (!repoSlug) {
    return ["repo slug missing"];
  }

  const runtime = asMap(config.runtime);
  const repoRoot = typeof runtime?.repo_root === "string" ? runtime.repo_root : "./repos";
  const basePath = resolve(root, repoRoot, repoSlug);

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

function syncCatalogFromConfig(config: JSONObject, state: RuntimeState): RuntimeState {
  const normalizedMessages = normalizeMessages(state.messages ?? []);
  const normalizedThreads = normalizeThreads(state.threads ?? [], normalizedMessages);
  const nextState: RuntimeState = {
    version: state.version ?? 1,
    counters: normalizeCounters({
      ...state,
      messages: normalizedMessages,
      threads: normalizedThreads,
      events: state.events ?? [],
      memories: state.memories ?? []
    }),
    tasks: (state.tasks ?? []).map((task) => ({
      ...task,
      artifactPaths: Array.isArray(task.artifactPaths)
        ? task.artifactPaths.filter((item: unknown): item is string => typeof item === "string")
        : []
    })),
    threads: normalizedThreads,
    messages: normalizedMessages,
    events: state.events ?? [],
    memories: (state.memories ?? []).map((memory) => ({
      ...memory,
      tags: Array.isArray(memory.tags)
        ? memory.tags.filter((item: unknown): item is string => typeof item === "string")
        : []
    })),
    projects: [],
    agents: []
  };

  const projects = Array.isArray(config.projects) ? config.projects : [];
  nextState.projects = projects.flatMap((project) => {
    const projectMap = asMap(project);
    if (!projectMap) {
      return [];
    }
    const repo = asMap(projectMap.repo);
    const lanes = Array.isArray(projectMap.lanes)
      ? projectMap.lanes.filter((lane): lane is string => typeof lane === "string")
      : [];
    return [
      {
        id: typeof projectMap.id === "string" ? projectMap.id : "",
        name: typeof projectMap.name === "string" ? projectMap.name : "",
        purpose: typeof projectMap.purpose === "string" ? projectMap.purpose : null,
        lanes,
        repoSlug: typeof repo?.slug === "string" ? repo.slug : null
      }
    ];
  });

  const agents = Array.isArray(config.agents) ? config.agents : [];
  nextState.agents = agents.flatMap((agent) => {
    const agentMap = asMap(agent);
    if (!agentMap) {
      return [];
    }
    const assignedProjects = Array.isArray(agentMap.assigned_projects)
      ? agentMap.assigned_projects.filter((projectId): projectId is string => typeof projectId === "string")
      : [];
    return [
      {
        id: typeof agentMap.id === "string" ? agentMap.id : "",
        name: typeof agentMap.name === "string" ? agentMap.name : "",
        role: typeof agentMap.role === "string" ? agentMap.role : "",
        assignedProjects
      }
    ];
  });

  return nextState;
}

function nextTaskId(state: RuntimeState): string {
  state.counters.task += 1;
  return `task_${String(state.counters.task).padStart(4, "0")}`;
}

function nextThreadId(state: RuntimeState): string {
  state.counters.thread += 1;
  return `thread_${String(state.counters.thread).padStart(4, "0")}`;
}

function nextMessageId(state: RuntimeState): string {
  state.counters.message += 1;
  return `msg_${String(state.counters.message).padStart(4, "0")}`;
}

function nextEventId(state: RuntimeState): string {
  state.counters.event += 1;
  return `evt_${String(state.counters.event).padStart(4, "0")}`;
}

function nextMemoryId(state: RuntimeState): string {
  state.counters.memory += 1;
  return `mem_${String(state.counters.memory).padStart(4, "0")}`;
}

function normalizeCounters(state: Partial<RuntimeState>): RuntimeState["counters"] {
  return {
    task: safeCounterValue(state.counters?.task, state.tasks?.length ?? 0),
    thread: safeCounterValue(state.counters?.thread, state.threads?.length ?? 0),
    message: safeCounterValue(state.counters?.message, state.messages?.length ?? 0),
    event: safeCounterValue(state.counters?.event, state.events?.length ?? 0),
    memory: safeCounterValue(state.counters?.memory, state.memories?.length ?? 0)
  };
}

function safeCounterValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function requiresDesignHandoff(role: string, lane: string): boolean {
  return ["build", "publishing"].includes(role) || ["build", "review", "todo", "in_progress"].includes(lane);
}

function selectAgentForTask(state: RuntimeState, task: TaskRecord, routing: RoutingPolicy): RuntimeAgent | null {
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

function inferProjectFromMessage(state: RuntimeState, body: string, routing: RoutingPolicy): string | null {
  const lowered = body.toLowerCase();
  for (const project of state.projects) {
    const normalizedName = project.name.toLowerCase();
    const normalizedId = project.id.toLowerCase();
    if (lowered.includes(normalizedName) || lowered.includes(normalizedId)) {
      return project.id;
    }
  }
  return routing.defaultProject ?? state.projects[0]?.id ?? null;
}

function inferLaneFromMessage(body: string, routing: RoutingPolicy): string {
  const lowered = body.toLowerCase();
  for (const [lane, keywords] of Object.entries(routing.laneKeywords)) {
    if (matchesAny(lowered, keywords)) {
      return lane;
    }
  }
  return routing.defaultLane;
}

function deriveTaskTitle(body: string): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "Untitled task";
  }
  if (trimmed.length <= 72) {
    return trimmed;
  }
  return `${trimmed.slice(0, 69)}...`;
}

function matchesAny(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
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

function nextStatusForWorkTurn(lane: string, status: string): string {
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

function workTurnMessage(
  agentName: string,
  role: string,
  task: TaskRecord,
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

function defaultRoutingPolicy(): RoutingPolicy {
  return {
    defaultProject: null,
    defaultLane: "planning",
    laneKeywords: {
      research: ["research", "investigate", "analyze", "analysis"],
      design: ["design", "redesign", "ux", "ui", "wireframe", "layout", "dashboard"],
      planning: ["plan", "scope", "spec", "define"],
      build: ["implement", "build", "code", "develop", "publish"],
      review: ["review", "qa", "check"]
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

function composeThreadReply(detail: ThreadDetail, latestUserBody: string, memories: MemoryRecord[]): string {
  const tasks = detail.tasks;
  if (tasks.length === 0) {
    return `Comphony logged your follow-up: "${latestUserBody}". This thread does not have a linked task yet.`;
  }

  const lines = tasks.map((task) => {
    const artifactCount = task.artifactPaths.length;
    return `- ${task.id}: lane=${task.lane}, status=${task.status}, assignee=${task.assigneeId ?? "-"}, artifacts=${artifactCount}`;
  });

  return [
    `Comphony logged your follow-up: "${latestUserBody}".`,
    "Current task state:",
    ...lines,
    ...(memories.length > 0
      ? ["Recent memory:", ...memories.map((memory) => `- ${memory.kind}: ${memory.body}`)]
      : [])
  ].join("\n");
}

function normalizeMessages(messages: MessageRecord[]): MessageRecord[] {
  return messages.map((message, index) => {
    const validId = /^msg_\d{4,}$/.test(message.id);
    if (validId) {
      return message;
    }
    return {
      ...message,
      id: `msg_${String(index + 1).padStart(4, "0")}`
    };
  });
}

function normalizeThreads(threads: ThreadRecord[], messages: MessageRecord[]): ThreadRecord[] {
  const messageIds = new Set(messages.map((message) => message.id));
  return threads.map((thread) => ({
    ...thread,
    messageIds: thread.messageIds.map((messageId, index) => {
      if (messageIds.has(messageId)) {
        return messageId;
      }
      const fallback = messages.find((message) => message.threadId === thread.id);
      return fallback?.id ?? `msg_${String(index + 1).padStart(4, "0")}`;
    })
  }));
}

function appendEvent(state: RuntimeState, input: Omit<EventRecord, "id">): EventRecord {
  const event: EventRecord = {
    id: nextEventId(state),
    ...input
  };
  state.events.push(event);
  return event;
}

function getRuntimeDataDir(config: JSONObject, root: string): string {
  const runtime = asMap(config.runtime);
  const relative = typeof runtime?.data_dir === "string" ? runtime.data_dir : "./runtime-data";
  return resolve(root, relative);
}

function getStatePath(config: JSONObject, root: string): string {
  return resolve(getRuntimeDataDir(config, root), "state.json");
}

function asMap(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
