import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

import { generateTaskArtifacts } from "./agent-runtime.js";
import type { JSONObject, RoutingPolicy } from "./config.js";
import { resolveRoutingPolicy } from "./config.js";
import {
  addMessage as addThreadDomainMessage,
  createThread as createThreadRecord,
  getThreadDetail as getThreadDomainDetail,
  listMessages as listThreadMessages,
  listThreads as listThreadRecords
} from "./state/thread-domain.js";
import {
  addMemory as addMemoryRecord,
  listMemories as listMemoryRecords,
  recommendMemories as recommendMemoryRecords,
  recommendTasks as recommendTaskRecords
} from "./state/memory-domain.js";
import {
  createSession as createSessionRecord,
  findConfiguredActor as findConfiguredSessionActor,
  listSessions as listSessionRecords,
  resolveSession as resolveSessionRecord,
  revokeSession as revokeSessionRecord
} from "./state/session-domain.js";
import {
  autoReviewTarget as findAutoReviewTarget,
  createExecutionTasksFromLanes as createLaneExecutionTasks,
  dependenciesSatisfied as areDependenciesSatisfied,
  deriveRequestedLanes as inferRequestedLanes,
  findNextReadyChildTask as findNextReadyThreadChildTask,
  getOrderedThreadTasks as getOrderedTasksForThread,
  isTaskBlocked as isWorkflowTaskBlocked,
  isTaskComplete as isWorkflowTaskComplete,
  nextStatusForWorkTurn as getNextStatusForWorkTurn,
  refreshTaskGraphState as refreshWorkflowTaskGraphState,
  requiresDesignHandoff as needsDesignHandoff,
  selectAgentForTask as chooseAgentForTask,
  workTurnMessage as composeWorkTurnMessage
} from "./state/task-workflow-helpers.js";
import {
  assignTask as assignTaskRecord,
  autoAssignTask as autoAssignTaskRecord,
  createTask as createTaskRecord,
  updateTaskStatus as updateTaskStatusRecord,
  validateDesignHandoffArtifacts as validateDesignHandoffArtifactsRecord
} from "./state/task-lifecycle.js";

type RuntimeProject = {
  id: string;
  name: string;
  purpose: string | null;
  lanes: string[];
  repoSlug: string | null;
  source: "config" | "runtime";
};

type RuntimeAgent = {
  id: string;
  name: string;
  role: string;
  assignedProjects: string[];
  sourceKind: string | null;
  sourceRef: string | null;
  trustState: "trusted" | "restricted" | "quarantined";
};

export type TaskRecord = {
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
  externalRefs: ExternalRefRecord[];
  blockingReason: string | null;
  needsApproval: boolean;
  humanTakeover: boolean;
  completionSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExternalRefRecord = {
  provider: string;
  externalId: string | null;
  externalKey: string | null;
  url: string | null;
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
  consultations: ConsultationRecord[];
  reviews: ReviewRecord[];
  approvals: ApprovalRecord[];
};

export type MessageRecord = {
  id: string;
  threadId: string;
  role: "user" | "agent" | "system";
  body: string;
  routedProjectId: string | null;
  suggestedLane: string | null;
  targetAgentId: string | null;
  createdAt: string;
};

export type EventRecord = {
  id: string;
  type: string;
  entityType: "thread" | "message" | "task" | "consultation" | "review" | "approval" | "system";
  entityId: string;
  timestamp: string;
  payload: Record<string, string | number | boolean | null>;
};

export type ConsultationRecord = {
  id: string;
  taskId: string;
  threadId: string;
  fromAgentId: string | null;
  toAgentId: string;
  reason: string;
  instructions: string;
  status: "requested" | "answered" | "closed";
  response: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewRecord = {
  id: string;
  taskId: string;
  threadId: string;
  requesterAgentId: string | null;
  reviewerAgentId: string;
  reason: string;
  status: "requested" | "approved" | "changes_requested" | "closed";
  outcome: "approved" | "changes_requested" | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalRecord = {
  id: string;
  taskId: string | null;
  threadId: string | null;
  action: string;
  reason: string;
  status: "requested" | "granted" | "denied";
  requestedBy: string | null;
  decidedBy: string | null;
  notes: string | null;
  resumeStatus: string | null;
  createdAt: string;
  updatedAt: string;
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

export type RecommendedMemory = MemoryRecord & {
  score: number;
};

export type RecommendedTask = TaskRecord & {
  score: number;
};

export type IntakeResult = {
  thread: ThreadRecord;
  message: MessageRecord;
  task: TaskRecord;
  rootTaskId: string | null;
  createdTaskIds: string[];
  assignedAgentId: string | null;
  assignmentError: string | null;
};

export type PeopleOverview = {
  id: string;
  name: string;
  role: string;
  assignedProjects: string[];
  activeTaskCount: number;
  blockedTaskCount: number;
  currentTaskIds: string[];
  currentTaskTitles: string[];
  consultationCount: number;
  reviewCount: number;
  sourceKind: string | null;
  sourceRef: string | null;
  availability: "available" | "busy" | "blocked";
  trustState: RuntimeAgent["trustState"];
};

export type ProjectOverview = {
  id: string;
  name: string;
  purpose: string | null;
  repoSlug: string | null;
  lanes: string[];
  agentIds: string[];
  activeTaskCount: number;
  blockedTaskCount: number;
  openThreadCount: number;
  latestArtifactPath: string | null;
  currentTaskTitles: string[];
  latestThreadTitle: string | null;
  health: "healthy" | "active" | "blocked";
};

export type ContinueThreadResult = {
  threadId: string;
  taskId: string | null;
  action:
    | "assigned"
    | "worked"
    | "review_requested"
    | "review_completed"
    | "waiting"
    | "blocked"
    | "next_task_activated"
    | "nothing_to_do";
  message: MessageRecord | null;
  task: TaskRecord | null;
  notes: string[];
};

export type SessionRecord = {
  id: string;
  actorId: string;
  role: string;
  label: string | null;
  token: string;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
};

export type AgentCatalogEntry = {
  id: string;
  name: string;
  role: string;
  sourceKind: string | null;
  sourceRef: string | null;
  trustState: RuntimeAgent["trustState"];
  assignedProjects: string[];
  installed: boolean;
  cachedPath: string | null;
};

export type ConnectorIngestResult = {
  provider: string;
  mode: "intake" | "follow_up";
  threadId: string;
  taskId: string | null;
  messageId: string;
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
  consultations: ConsultationRecord[];
  reviews: ReviewRecord[];
  approvals: ApprovalRecord[];
  syncRecords: SyncRecord[];
  sessions: SessionRecord[];
  counters: {
    task: number;
    thread: number;
    message: number;
    event: number;
    memory: number;
    consultation: number;
    review: number;
    approval: number;
    sync: number;
    session: number;
  };
};

export type SyncRecord = {
  id: string;
  provider: string;
  mode: string;
  projectId: string | null;
  taskId: string | null;
  status: "queued" | "failed" | "retried";
  reason: string;
  createdAt: string;
  updatedAt: string;
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
  consultations: [],
  reviews: [],
  approvals: [],
  syncRecords: [],
  sessions: [],
  counters: {
    task: 0,
    thread: 0,
    message: 0,
    event: 0,
    memory: 0,
    consultation: 0,
    review: 0,
    approval: 0,
    sync: 0,
    session: 0
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

export function listPeopleOverview(state: RuntimeState): PeopleOverview[] {
  return state.agents.map((agent) => {
    const currentTasks = state.tasks.filter((task) => task.assigneeId === agent.id && !isTaskComplete(task));
    const consultationCount = state.consultations.filter((item) => item.toAgentId === agent.id && item.status === "requested").length;
    const reviewCount = state.reviews.filter((item) => item.reviewerAgentId === agent.id && item.status === "requested").length;
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      assignedProjects: agent.assignedProjects,
      activeTaskCount: currentTasks.length,
      blockedTaskCount: currentTasks.filter((task) => isTaskBlocked(task)).length,
      currentTaskIds: currentTasks.map((task) => task.id),
      currentTaskTitles: currentTasks.map((task) => task.title),
      consultationCount,
      reviewCount,
      sourceKind: agent.sourceKind,
      sourceRef: agent.sourceRef,
      availability: currentTasks.some((task) => isTaskBlocked(task))
        ? "blocked"
        : currentTasks.length > 0 || consultationCount > 0 || reviewCount > 0
          ? "busy"
          : "available",
      trustState: agent.trustState
    };
  });
}

export function listProjectOverview(state: RuntimeState): ProjectOverview[] {
  return state.projects.map((project) => {
    const projectTasks = state.tasks.filter((task) => task.projectId === project.id);
    const projectThreads = state.threads.filter((thread) => thread.taskIds.some((taskId) => projectTasks.some((task) => task.id === taskId)));
    const latestArtifactPath = projectTasks
      .flatMap((task) => task.artifactPaths.map((path) => ({ path, updatedAt: task.updatedAt })))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.path ?? null;
    return {
      id: project.id,
      name: project.name,
      purpose: project.purpose,
      repoSlug: project.repoSlug,
      lanes: project.lanes,
      agentIds: state.agents.filter((agent) => agent.assignedProjects.includes(project.id)).map((agent) => agent.id),
      activeTaskCount: projectTasks.filter((task) => !isTaskComplete(task)).length,
      blockedTaskCount: projectTasks.filter((task) => isTaskBlocked(task)).length,
      openThreadCount: projectThreads.length,
      latestArtifactPath,
      currentTaskTitles: projectTasks
        .filter((task) => !isTaskComplete(task))
        .slice()
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 4)
        .map((task) => task.title),
      latestThreadTitle: projectThreads.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.title ?? null,
      health: projectTasks.some((task) => isTaskBlocked(task))
        ? "blocked"
        : projectTasks.some((task) => !isTaskComplete(task))
          ? "active"
          : "healthy"
    };
  });
}

export function listAgentCatalog(state: RuntimeState, root: string): AgentCatalogEntry[] {
  const cachedRoot = resolve(root, "runtime-data", "registry", "agents");
  const cachedIds = existsSync(cachedRoot)
    ? readdirSync(cachedRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];
  return state.agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    sourceKind: agent.sourceKind,
    sourceRef: agent.sourceRef,
    trustState: agent.trustState,
    assignedProjects: agent.assignedProjects,
    installed: true,
    cachedPath: cachedIds.includes(agent.id) ? resolve(cachedRoot, agent.id) : null
  }));
}

export function listSessions(state: RuntimeState, filters?: { actorId?: string; activeOnly?: boolean }): SessionRecord[] {
  return listSessionRecords(state, filters);
}

export function createSession(
  config: JSONObject,
  state: RuntimeState,
  input: { actorId: string; label?: string }
): SessionRecord {
  return createSessionRecord(config, state, input, {
    appendEvent,
    findConfiguredActor
  });
}

export function revokeSession(state: RuntimeState, input: { sessionId: string }): SessionRecord {
  return revokeSessionRecord(state, input, {
    appendEvent
  });
}

export function resolveSession(state: RuntimeState, input: { token: string }): SessionRecord | null {
  return resolveSessionRecord(state, input);
}

export function createProject(
  state: RuntimeState,
  input: { id: string; name: string; purpose?: string; lanes: string[]; repoSlug?: string | null }
): RuntimeProject {
  if (state.projects.some((project) => project.id === input.id)) {
    throw new Error(`Duplicate project id: ${input.id}`);
  }
  const project: RuntimeProject = {
    id: input.id,
    name: input.name,
    purpose: input.purpose ?? null,
    lanes: input.lanes,
    repoSlug: input.repoSlug ?? null,
    source: "runtime"
  };
  state.projects.push(project);
  appendEvent(state, {
    type: "project.created",
    entityType: "system",
    entityId: project.id,
    timestamp: new Date().toISOString(),
    payload: {
      projectId: project.id,
      name: project.name,
      repoSlug: project.repoSlug
    }
  });
  return project;
}

export function installAgentPackage(
  state: RuntimeState,
  root: string,
  input: { sourceKind: "local_package" | "registry_package"; ref: string; trustState?: "trusted" | "restricted" | "quarantined" }
): RuntimeAgent {
  const source = loadAgentPackageSource(root, input);
  const parsed = YAML.parse(source.manifestText) as Record<string, unknown>;
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid agent manifest for ${input.ref}`);
  }
  const id = typeof parsed.id === "string" ? parsed.id : "";
  const name = typeof parsed.name === "string" ? parsed.name : "";
  const role = typeof parsed.role === "string" ? parsed.role : "";
  if (!id || !name || !role) {
    throw new Error(`agent.yaml for ${input.ref} must define id, name, and role`);
  }
  if (state.agents.some((agent) => agent.id === id)) {
    throw new Error(`Duplicate agent id: ${id}`);
  }
  if (input.sourceKind === "registry_package") {
    const installRoot = resolve(root, "runtime-data", "registry", "agents", id);
    mkdirSync(resolve(installRoot, "prompts"), { recursive: true });
    writeFileSync(resolve(installRoot, "agent.yaml"), source.manifestText, "utf8");
    if (source.promptText) {
      writeFileSync(resolve(installRoot, "prompts", "system.md"), source.promptText, "utf8");
    }
  }
  const assignedProjects = Array.isArray(parsed.assigned_projects)
    ? parsed.assigned_projects.filter((value): value is string => typeof value === "string")
    : [];
  const agent: RuntimeAgent = {
    id,
    name,
    role,
    assignedProjects,
    sourceKind: input.sourceKind,
    sourceRef: source.sourceRef,
    trustState: input.trustState ?? (input.sourceKind === "local_package" ? "trusted" : "restricted")
  };
  state.agents.push(agent);
  appendEvent(state, {
    type: "agent.installed",
    entityType: "system",
    entityId: agent.id,
    timestamp: new Date().toISOString(),
    payload: {
      agentId: agent.id,
      role: agent.role,
      sourceKind: agent.sourceKind,
      trustState: agent.trustState
    }
  });
  return agent;
}

export function assignAgentToProject(
  state: RuntimeState,
  input: { agentId: string; projectId: string }
): RuntimeAgent {
  const agent = findAgent(state, input.agentId);
  const project = state.projects.find((item) => item.id === input.projectId);
  if (!project) {
    throw new Error(`Unknown project id: ${input.projectId}`);
  }
  if (!agent.assignedProjects.includes(input.projectId)) {
    agent.assignedProjects.push(input.projectId);
  }
  appendEvent(state, {
    type: "agent.assigned_to_project",
    entityType: "system",
    entityId: agent.id,
    timestamp: new Date().toISOString(),
    payload: {
      agentId: agent.id,
      projectId: input.projectId
    }
  });
  return agent;
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
  return listThreadRecords(state);
}

export function getThreadDetail(state: RuntimeState, threadId: string): ThreadDetail {
  return getThreadDomainDetail(state, threadId);
}

export function listMessages(state: RuntimeState, threadId?: string): MessageRecord[] {
  return listThreadMessages(state, threadId);
}

export function listEvents(state: RuntimeState, limit = 50): EventRecord[] {
  return state.events.slice(-limit).reverse();
}

export function listMemories(
  state: RuntimeState,
  filters?: { projectId?: string; threadId?: string; taskId?: string; query?: string; limit?: number }
): MemoryRecord[] {
  return listMemoryRecords(state, filters);
}

export function listConsultations(
  state: RuntimeState,
  filters?: { taskId?: string; threadId?: string; status?: string }
): ConsultationRecord[] {
  return state.consultations.filter((consultation) => {
    if (filters?.taskId && consultation.taskId !== filters.taskId) {
      return false;
    }
    if (filters?.threadId && consultation.threadId !== filters.threadId) {
      return false;
    }
    if (filters?.status && consultation.status !== filters.status) {
      return false;
    }
    return true;
  }).slice().reverse();
}

export function listReviews(
  state: RuntimeState,
  filters?: { taskId?: string; threadId?: string; status?: string }
): ReviewRecord[] {
  return state.reviews.filter((review) => {
    if (filters?.taskId && review.taskId !== filters.taskId) {
      return false;
    }
    if (filters?.threadId && review.threadId !== filters.threadId) {
      return false;
    }
    if (filters?.status && review.status !== filters.status) {
      return false;
    }
    return true;
  }).slice().reverse();
}

export function listApprovals(
  state: RuntimeState,
  filters?: { taskId?: string; threadId?: string; status?: string }
): ApprovalRecord[] {
  return state.approvals.filter((approval) => {
    if (filters?.taskId && approval.taskId !== filters.taskId) {
      return false;
    }
    if (filters?.threadId && approval.threadId !== filters.threadId) {
      return false;
    }
    if (filters?.status && approval.status !== filters.status) {
      return false;
    }
    return true;
  }).slice().reverse();
}

export function listSyncRecords(
  state: RuntimeState,
  filters?: { provider?: string; projectId?: string; status?: string }
): SyncRecord[] {
  return state.syncRecords.filter((record) => {
    if (filters?.provider && record.provider !== filters.provider) {
      return false;
    }
    if (filters?.projectId && record.projectId !== filters.projectId) {
      return false;
    }
    if (filters?.status && record.status !== filters.status) {
      return false;
    }
    return true;
  }).slice().reverse();
}

export function retrySync(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: { provider: string; projectId?: string; taskId?: string; reason?: string }
): SyncRecord {
  const sync = asMap(config.sync);
  const providers = asMap(sync?.providers);
  const providerConfig = providers ? asMap(providers[input.provider]) : null;
  if (!providerConfig || providerConfig.enabled !== true) {
    throw new Error(`Sync provider ${input.provider} is not enabled`);
  }
  const now = new Date().toISOString();
  const record: SyncRecord = {
    id: nextSyncId(state),
    provider: input.provider,
    mode: typeof sync?.default_mode === "string" ? sync.default_mode : "mirror_out",
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    status: "retried",
    reason: input.reason ?? "Manual retry requested",
    createdAt: now,
    updatedAt: now
  };
  state.syncRecords.push(record);
  if (input.taskId && input.provider === "linear") {
    try {
      syncTaskToProvider(config, root, state, {
        provider: input.provider,
        taskId: input.taskId
      });
      record.reason = input.reason ?? "Manual retry succeeded";
    } catch (error) {
      record.status = "failed";
      record.reason = error instanceof Error ? error.message : String(error);
    }
    record.updatedAt = new Date().toISOString();
  }
  appendEvent(state, {
    type: "sync.retried",
    entityType: "system",
    entityId: record.id,
    timestamp: now,
    payload: {
      provider: record.provider,
      projectId: record.projectId,
      taskId: record.taskId
    }
  });
  return record;
}

export function pushRuntimeToProvider(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: { provider: string; reason?: string }
): SyncRecord {
  if (input.provider !== "supabase") {
    throw new Error(`Unsupported runtime sync provider: ${input.provider}`);
  }
  const providerConfig = getSyncProviderConfig(config, "supabase");
  syncRuntimeToSupabase(config, providerConfig, state);
  const now = new Date().toISOString();
  const record: SyncRecord = {
    id: nextSyncId(state),
    provider: input.provider,
    mode: "control_plane_push",
    projectId: null,
    taskId: null,
    status: "retried",
    reason: input.reason ?? "Runtime snapshot pushed",
    createdAt: now,
    updatedAt: now
  };
  state.syncRecords.push(record);
  appendEvent(state, {
    type: "sync.runtime_pushed",
    entityType: "system",
    entityId: record.id,
    timestamp: now,
    payload: {
      provider: record.provider
    }
  });
  return record;
}

export function syncTaskToProvider(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: { provider: string; taskId: string }
): { task: TaskRecord; ref: ExternalRefRecord } {
  const task = findTask(state, input.taskId);
  if (input.provider !== "linear") {
    throw new Error(`Unsupported sync provider: ${input.provider}`);
  }
  ensureExternalSyncApproval(config, state, task, "external_sync");
  const linearConfig = getSyncProviderConfig(config, "linear");
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error("LINEAR_API_KEY is not set");
  }
  const teamKey = typeof linearConfig.team_key === "string" ? linearConfig.team_key : null;
  if (!teamKey) {
    throw new Error("Linear sync requires sync.providers.linear.team_key");
  }
  const teamId = fetchLinearTeamId(apiKey, teamKey);
  const projectSyncName = getProjectSyncName(config, task.projectId);
  const projectId = projectSyncName ? fetchLinearProjectId(apiKey, projectSyncName) : null;
  const existing = task.externalRefs.find((ref) => ref.provider === "linear") ?? null;
  const synced = existing?.externalId
    ? updateLinearIssue(apiKey, existing.externalId, composeLinearIssuePayload(task))
    : createLinearIssue(apiKey, {
      teamId,
      projectId,
      ...composeLinearIssuePayload(task)
    });
  const ref: ExternalRefRecord = {
    provider: "linear",
    externalId: synced.id,
    externalKey: synced.identifier,
    url: synced.url
  };
  upsertTaskExternalRef(task, ref);
  appendEvent(state, {
    type: existing?.externalId ? "external_issue_updated" : "external_issue_created",
    entityType: "task",
    entityId: task.id,
    timestamp: new Date().toISOString(),
    payload: {
      provider: "linear",
      externalId: ref.externalId,
      externalKey: ref.externalKey,
      url: ref.url
    }
  });
  return { task, ref };
}

export function ingestConnectorMessage(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: {
    provider: "telegram" | "discord" | "slack";
    body: string;
    senderId: string;
    senderName?: string;
    threadId?: string;
    title?: string;
  }
): ConnectorIngestResult {
  ensureConnectorEnabled(config, input.provider);
  const label = input.senderName?.trim() || input.senderId;
  if (input.threadId) {
    const response = respondToThread(config, root, state, {
      threadId: input.threadId,
      body: input.body
    });
    appendEvent(state, {
      type: "connector.message_ingested",
      entityType: "system",
      entityId: response.responseMessage.id,
      timestamp: response.responseMessage.createdAt,
      payload: {
        provider: input.provider,
        senderId: input.senderId,
        threadId: input.threadId
      }
    });
    return {
      provider: input.provider,
      mode: "follow_up",
      threadId: input.threadId,
      taskId: getThreadDetail(state, input.threadId).tasks[0]?.id ?? null,
      messageId: response.userMessage.id
    };
  }

  const intake = intakeRequest(config, root, state, {
    title: input.title ?? `${capitalizeLane(input.provider)} request from ${label}`,
    body: input.body
  });
  appendEvent(state, {
    type: "connector.message_ingested",
    entityType: "system",
    entityId: intake.message.id,
    timestamp: intake.message.createdAt,
    payload: {
      provider: input.provider,
      senderId: input.senderId,
      threadId: intake.thread.id
    }
  });
  return {
    provider: input.provider,
    mode: "intake",
    threadId: intake.thread.id,
    taskId: intake.task.id,
    messageId: intake.message.id
  };
}

export function recommendMemories(
  state: RuntimeState,
  input: { projectId?: string; threadId?: string; taskId?: string; query?: string; limit?: number }
): RecommendedMemory[] {
  return recommendMemoryRecords(state, input);
}

export function recommendTasks(
  state: RuntimeState,
  input: { projectId?: string; threadId?: string; taskId?: string; query?: string; limit?: number }
): RecommendedTask[] {
  return recommendTaskRecords(state, input, {
    getThreadDetail
  });
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
  return addMemoryRecord(state, input, {
    appendEvent,
    nextMemoryId
  });
}

export function respondToThread(
  config: JSONObject,
  root: string,
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
  const targetedAgentId = userMessage.targetAgentId;
  const targetedAgent = targetedAgentId ? state.agents.find((agent) => agent.id === targetedAgentId) ?? null : null;
  const directAction = !targetedAgent ? resolveConversationAction(config, state, detail, input.body) : null;
  const responseMessage = addMessage(state, {
    threadId: thread.id,
    role: targetedAgent ? "agent" : "system",
    body: targetedAgent
      ? composeAgentDirectedReply(state, targetedAgent, detail, input.body)
      : directAction?.kind === "continue_loop"
        ? composeContinueLoopReply(continueThreadUntilPause(config, root, state, { threadId: thread.id }))
        : directAction?.kind === "create_project"
          ? composeProjectCreationReply(createProject(state, directAction.project))
          : directAction?.kind === "install_agent"
            ? composeAgentInstallReply(
                installAndMaybeAssignAgent(state, root, {
                  sourceKind: directAction.sourceKind,
                  ref: directAction.ref,
                  trustState: directAction.trustState,
                  projectId: directAction.assignProjectId
                })
              )
            : directAction?.kind === "people_summary"
              ? composePeopleSummaryReply(listPeopleOverview(state))
      : composeManagerThreadReply(
        detail,
        input.body,
        recommendMemories(state, {
          projectId: detail.tasks[0]?.projectId ?? undefined,
          threadId: thread.id,
          taskId: detail.tasks[0]?.id ?? undefined,
          query: input.body,
          limit: 3
        }),
        recommendTasks(state, {
          projectId: detail.tasks[0]?.projectId ?? undefined,
          threadId: thread.id,
          taskId: detail.tasks[0]?.id ?? undefined,
          query: input.body,
          limit: 3
        })
      ),
    routedProjectId: detail.tasks[0]?.projectId ?? userMessage.routedProjectId,
    suggestedLane: detail.tasks[0]?.lane ?? userMessage.suggestedLane,
    targetAgentId: targetedAgent?.id ?? null
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
  return createThreadRecord(state, input, {
    appendEvent,
    nextThreadId
  });
}

export function addMessage(
  state: RuntimeState,
  input: {
    threadId: string;
    role: "user" | "agent" | "system";
    body: string;
    routedProjectId?: string | null;
    suggestedLane?: string | null;
    targetAgentId?: string | null;
  },
  routing?: RoutingPolicy
): MessageRecord {
  return addThreadDomainMessage(state, input, {
    appendEvent,
    defaultRoutingPolicy,
    inferLaneFromMessage,
    inferProjectFromMessage,
    nextMessageId,
    resolveMentionedAgentId
  }, routing);
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
  refreshTaskGraphState(state, task.id);
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
  const projectId = input.projectId ?? message.routedProjectId ?? inferProjectFromMessage(state, input.body, routing);
  if (!projectId) {
    throw new Error("Could not determine project for intake request");
  }
  const requestedLanes = deriveRequestedLanes(state, projectId, input.body, input.lane ?? message.suggestedLane ?? undefined, routing);
  const rootTask = createTask(state, {
    projectId,
    title: input.title,
    description: input.body,
    lane: "planning"
  });
  rootTask.status = "in_progress";
  rootTask.completionSummary = "Comphony accepted the request and is coordinating child tasks.";
  if (!thread.taskIds.includes(rootTask.id)) {
    thread.taskIds.push(rootTask.id);
  }
  const plannedTasks = createExecutionTasksFromLanes(state, {
    projectId,
    body: input.body,
    parentTaskId: rootTask.id,
    threadId: thread.id,
    requestedLanes
  });
  const task = plannedTasks[0] ?? promoteMessageToTask(state, {
    messageId: message.id,
    projectId,
    lane: requestedLanes[0],
    title: input.title
  }, routing);
  for (const plannedTask of plannedTasks) {
    if (!thread.taskIds.includes(plannedTask.id)) {
      thread.taskIds.push(plannedTask.id);
    }
  }
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
      rootTaskId: rootTask.id,
      createdTaskIds: [rootTask.id, ...plannedTasks.map((item) => item.id)],
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
      rootTaskId: rootTask.id,
      createdTaskIds: [rootTask.id, ...plannedTasks.map((item) => item.id)],
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
      rootTaskId: rootTask.id,
      createdTaskIds: [rootTask.id, ...plannedTasks.map((item) => item.id)],
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
  input: {
    projectId: string;
    title: string;
    description: string;
    lane: string;
    parentTaskId?: string | null;
    dependsOnTaskIds?: string[];
  }
): TaskRecord {
  return createTaskRecord(state, input, {
    appendEvent,
    nextTaskId,
    refreshTaskGraphState
  });
}

export function assignTask(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: { taskId: string; agentId: string }
): TaskRecord {
  return assignTaskRecord(config, root, state, input, {
    appendEvent,
    requiresDesignHandoff
  });
}

export function autoAssignTask(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  taskId: string
): { task: TaskRecord; agentId: string | null; error: string | null } {
  return autoAssignTaskRecord(config, root, state, taskId, {
    appendEvent,
    requiresDesignHandoff,
    selectAgentForTask
  });
}

export function updateTaskStatus(state: RuntimeState, input: { taskId: string; status: string }): TaskRecord {
  return updateTaskStatusRecord(state, input, {
    appendEvent
  });
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
  refreshTaskGraphState(state, task.id);
  return {
    task,
    threadId: thread.id,
    message,
    agentId: assigned.agentId,
    error: assigned.error
  };
}

export function requestConsultation(
  config: JSONObject,
  state: RuntimeState,
  input: { taskId: string; toAgentId: string; reason: string; instructions?: string }
): { consultation: ConsultationRecord; task: TaskRecord; threadId: string; message: MessageRecord } {
  const task = findTask(state, input.taskId);
  const thread = findThreadByTask(state, task.id);
  const agent = findAgent(state, input.toAgentId);
  if (!agent.assignedProjects.includes(task.projectId)) {
    throw new Error(`Agent ${agent.id} is not assigned to project ${task.projectId}`);
  }

  const now = new Date().toISOString();
  const consultation: ConsultationRecord = {
    id: nextConsultationId(state),
    taskId: task.id,
    threadId: thread.id,
    fromAgentId: task.assigneeId,
    toAgentId: agent.id,
    reason: input.reason,
    instructions: input.instructions ?? "",
    status: "requested",
    response: null,
    createdAt: now,
    updatedAt: now
  };
  state.consultations.push(consultation);
  task.status = "consulting";
  task.blockingReason = input.reason;
  task.updatedAt = now;
  thread.updatedAt = now;

  const message = addMessage(state, {
    threadId: thread.id,
    role: "system",
    body: `Comphony requested consultation from ${agent.id} for ${task.title}. Reason: ${input.reason}`,
    routedProjectId: task.projectId,
    suggestedLane: task.lane
  }, resolveRoutingPolicy(config));

  appendEvent(state, {
    type: "task.consultation_requested",
    entityType: "consultation",
    entityId: consultation.id,
    timestamp: now,
    payload: {
      taskId: task.id,
      threadId: thread.id,
      fromAgentId: consultation.fromAgentId,
      toAgentId: consultation.toAgentId
    }
  });
  addMemory(state, {
    scope: "task",
    projectId: task.projectId,
    threadId: thread.id,
    taskId: task.id,
    agentId: agent.id,
    kind: "consultation_requested",
    body: `${agent.id} was consulted for ${task.title}: ${input.reason}`,
    tags: ["consultation", task.lane]
  });
  refreshTaskGraphState(state, task.id);

  return { consultation, task, threadId: thread.id, message };
}

export function resolveConsultation(
  config: JSONObject,
  state: RuntimeState,
  input: { consultationId: string; response: string }
): { consultation: ConsultationRecord; task: TaskRecord; threadId: string; message: MessageRecord } {
  const consultation = state.consultations.find((item) => item.id === input.consultationId);
  if (!consultation) {
    throw new Error(`Unknown consultation id: ${input.consultationId}`);
  }
  const task = findTask(state, consultation.taskId);
  const thread = findThreadByTask(state, task.id);
  const now = new Date().toISOString();
  consultation.status = "answered";
  consultation.response = input.response;
  consultation.updatedAt = now;
  task.status = "in_progress";
  task.blockingReason = null;
  task.updatedAt = now;
  thread.updatedAt = now;

  const message = addMessage(state, {
    threadId: thread.id,
    role: "agent",
    body: `Consultation ${consultation.id} answered by ${consultation.toAgentId}: ${input.response}`,
    routedProjectId: task.projectId,
    suggestedLane: task.lane
  }, resolveRoutingPolicy(config));

  appendEvent(state, {
    type: "task.consultation_resolved",
    entityType: "consultation",
    entityId: consultation.id,
    timestamp: now,
    payload: {
      taskId: task.id,
      threadId: thread.id,
      toAgentId: consultation.toAgentId
    }
  });
  addMemory(state, {
    scope: "task",
    projectId: task.projectId,
    threadId: thread.id,
    taskId: task.id,
    agentId: consultation.toAgentId,
    kind: "consultation_response",
    body: input.response,
    tags: ["consultation", "response", task.lane]
  });
  refreshTaskGraphState(state, task.id);

  return { consultation, task, threadId: thread.id, message };
}

export function requestTaskReview(
  config: JSONObject,
  state: RuntimeState,
  input: { taskId: string; reviewerAgentId: string; reason: string }
): { review: ReviewRecord; task: TaskRecord; threadId: string; message: MessageRecord } {
  const task = findTask(state, input.taskId);
  const thread = findThreadByTask(state, task.id);
  const reviewer = findAgent(state, input.reviewerAgentId);
  if (!reviewer.assignedProjects.includes(task.projectId)) {
    throw new Error(`Agent ${reviewer.id} is not assigned to project ${task.projectId}`);
  }

  const now = new Date().toISOString();
  const review: ReviewRecord = {
    id: nextReviewId(state),
    taskId: task.id,
    threadId: thread.id,
    requesterAgentId: task.assigneeId,
    reviewerAgentId: reviewer.id,
    reason: input.reason,
    status: "requested",
    outcome: null,
    notes: null,
    createdAt: now,
    updatedAt: now
  };
  state.reviews.push(review);
  task.status = "review_requested";
  task.updatedAt = now;
  thread.updatedAt = now;

  const message = addMessage(state, {
    threadId: thread.id,
    role: "system",
    body: `Comphony requested review from ${reviewer.id} for ${task.title}. Reason: ${input.reason}`,
    routedProjectId: task.projectId,
    suggestedLane: "review"
  }, resolveRoutingPolicy(config));

  appendEvent(state, {
    type: "task.review_requested",
    entityType: "review",
    entityId: review.id,
    timestamp: now,
    payload: {
      taskId: task.id,
      threadId: thread.id,
      reviewerAgentId: reviewer.id
    }
  });
  addMemory(state, {
    scope: "task",
    projectId: task.projectId,
    threadId: thread.id,
    taskId: task.id,
    agentId: reviewer.id,
    kind: "review_requested",
    body: `${reviewer.id} was asked to review ${task.title}: ${input.reason}`,
    tags: ["review", task.lane]
  });
  refreshTaskGraphState(state, task.id);

  return { review, task, threadId: thread.id, message };
}

export function completeTaskReview(
  config: JSONObject,
  state: RuntimeState,
  input: { reviewId: string; outcome: "approved" | "changes_requested"; notes?: string }
): { review: ReviewRecord; task: TaskRecord; threadId: string; message: MessageRecord } {
  const review = state.reviews.find((item) => item.id === input.reviewId);
  if (!review) {
    throw new Error(`Unknown review id: ${input.reviewId}`);
  }
  const task = findTask(state, review.taskId);
  const thread = findThreadByTask(state, task.id);
  const now = new Date().toISOString();
  review.outcome = input.outcome;
  review.notes = input.notes ?? null;
  review.status = input.outcome;
  review.updatedAt = now;
  task.status = input.outcome === "approved" ? "reported" : "in_progress";
  task.completionSummary = input.outcome === "approved"
    ? input.notes ?? `Review approved for ${task.title}.`
    : input.notes ?? `Changes requested for ${task.title}.`;
  task.updatedAt = now;
  thread.updatedAt = now;

  const message = addMessage(state, {
    threadId: thread.id,
    role: "system",
    body: input.outcome === "approved"
      ? `Review ${review.id} approved ${task.title}.${input.notes ? ` Notes: ${input.notes}` : ""}`
      : `Review ${review.id} requested changes for ${task.title}.${input.notes ? ` Notes: ${input.notes}` : ""}`,
    routedProjectId: task.projectId,
    suggestedLane: task.lane
  }, resolveRoutingPolicy(config));

  appendEvent(state, {
    type: "task.review_completed",
    entityType: "review",
    entityId: review.id,
    timestamp: now,
    payload: {
      taskId: task.id,
      threadId: thread.id,
      outcome: input.outcome
    }
  });
  addMemory(state, {
    scope: "task",
    projectId: task.projectId,
    threadId: thread.id,
    taskId: task.id,
    agentId: review.reviewerAgentId,
    kind: "review_outcome",
    body: input.notes ?? input.outcome,
    tags: ["review", input.outcome, task.lane]
  });

  refreshTaskGraphState(state, task.id);
  return { review, task, threadId: thread.id, message };
}

export function requestApproval(
  config: JSONObject,
  state: RuntimeState,
  input: { action: string; reason: string; taskId?: string; requestedBy?: string | null }
): { approval: ApprovalRecord; task: TaskRecord | null; threadId: string | null; message: MessageRecord | null } {
  const task = input.taskId ? findTask(state, input.taskId) : null;
  const thread = task ? findThreadByTask(state, task.id) : null;
  const now = new Date().toISOString();
  const approval: ApprovalRecord = {
    id: nextApprovalId(state),
    taskId: task?.id ?? null,
    threadId: thread?.id ?? null,
    action: input.action,
    reason: input.reason,
    status: "requested",
    requestedBy: input.requestedBy ?? task?.assigneeId ?? null,
    decidedBy: null,
    notes: null,
    resumeStatus: task?.status ?? null,
    createdAt: now,
    updatedAt: now
  };
  state.approvals.push(approval);

  let message: MessageRecord | null = null;
  if (task && thread) {
    task.needsApproval = true;
    task.status = "waiting";
    task.blockingReason = input.reason;
    task.updatedAt = now;
    thread.updatedAt = now;
    message = addMessage(state, {
      threadId: thread.id,
      role: "system",
      body: `Comphony requested approval for ${input.action} on ${task.title}. Reason: ${input.reason}`,
      routedProjectId: task.projectId,
      suggestedLane: task.lane
    }, resolveRoutingPolicy(config));
  }

  appendEvent(state, {
    type: "approval.requested",
    entityType: "approval",
    entityId: approval.id,
    timestamp: now,
    payload: {
      taskId: approval.taskId,
      threadId: approval.threadId,
      action: approval.action
    }
  });
  if (task) {
    refreshTaskGraphState(state, task.id);
  }

  return { approval, task, threadId: thread?.id ?? null, message };
}

export function decideApproval(
  config: JSONObject,
  state: RuntimeState,
  input: { approvalId: string; decision: "granted" | "denied"; actorId?: string | null; notes?: string }
): { approval: ApprovalRecord; task: TaskRecord | null; threadId: string | null; message: MessageRecord | null } {
  const approval = state.approvals.find((item) => item.id === input.approvalId);
  if (!approval) {
    throw new Error(`Unknown approval id: ${input.approvalId}`);
  }
  const task = approval.taskId ? findTask(state, approval.taskId) : null;
  const thread = approval.threadId ? state.threads.find((item) => item.id === approval.threadId) ?? null : null;
  const now = new Date().toISOString();

  approval.status = input.decision;
  approval.decidedBy = input.actorId ?? null;
  approval.notes = input.notes ?? null;
  approval.updatedAt = now;

  let message: MessageRecord | null = null;
  if (task) {
    task.needsApproval = false;
    task.updatedAt = now;
    if (input.decision === "granted") {
      task.blockingReason = null;
      task.status = approval.resumeStatus ?? "triaged";
    } else {
      task.status = "blocked";
      task.blockingReason = input.notes ?? approval.reason;
    }
    refreshTaskGraphState(state, task.id);
  }
  if (thread) {
    thread.updatedAt = now;
    message = addMessage(state, {
      threadId: thread.id,
      role: "system",
      body: input.decision === "granted"
        ? `Approval ${approval.id} was granted for ${approval.action}.${input.notes ? ` Notes: ${input.notes}` : ""}`
        : `Approval ${approval.id} was denied for ${approval.action}.${input.notes ? ` Notes: ${input.notes}` : ""}`,
      routedProjectId: task?.projectId ?? null,
      suggestedLane: task?.lane ?? null
    }, resolveRoutingPolicy(config));
  }

  appendEvent(state, {
    type: input.decision === "granted" ? "approval.granted" : "approval.denied",
    entityType: "approval",
    entityId: approval.id,
    timestamp: now,
    payload: {
      taskId: approval.taskId,
      threadId: approval.threadId,
      action: approval.action
    }
  });

  return { approval, task, threadId: thread?.id ?? null, message };
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
  if (task.needsApproval || task.status === "waiting") {
    throw new Error(`Task ${task.id} is waiting for approval before more work can run`);
  }
  if (["blocked", "consulting", "review_requested", "reported", "failed", "canceled"].includes(task.status)) {
    throw new Error(`Task ${task.id} cannot run a work turn while in ${task.status}`);
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
  task.completionSummary = artifacts.summary;
  refreshTaskGraphState(state, task.id);

  return { task, threadId: thread.id, message };
}

export function continueThread(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: { threadId: string }
): ContinueThreadResult {
  const thread = state.threads.find((item) => item.id === input.threadId);
  if (!thread) {
    throw new Error(`Unknown thread id: ${input.threadId}`);
  }

  const readyTasks = getOrderedThreadTasks(state, thread.id);
  const activeTask = readyTasks.find((task) => !isTaskComplete(task) && task.parentTaskId !== null) ?? readyTasks.find((task) => !isTaskComplete(task));
  if (!activeTask) {
    const message = addMessage(state, {
      threadId: thread.id,
      role: "system",
      body: "Comphony has no remaining work on this thread. All linked tasks are complete."
    }, resolveRoutingPolicy(config));
    return {
      threadId: thread.id,
      taskId: null,
      action: "nothing_to_do",
      message,
      task: null,
      notes: ["all tasks complete"]
    };
  }

  if (!dependenciesSatisfied(state, activeTask)) {
    const message = addMessage(state, {
      threadId: thread.id,
      role: "system",
      body: `Comphony cannot advance ${activeTask.title} yet because dependencies are still incomplete.`
    }, resolveRoutingPolicy(config));
    return {
      threadId: thread.id,
      taskId: activeTask.id,
      action: "blocked",
      message,
      task: activeTask,
      notes: ["dependencies incomplete"]
    };
  }

  if (activeTask.needsApproval || activeTask.status === "waiting") {
    const message = addMessage(state, {
      threadId: thread.id,
      role: "system",
      body: `Comphony is waiting for approval before continuing ${activeTask.title}.`
    }, resolveRoutingPolicy(config));
    return {
      threadId: thread.id,
      taskId: activeTask.id,
      action: "waiting",
      message,
      task: activeTask,
      notes: ["approval required"]
    };
  }

  if (activeTask.status === "consulting") {
    const message = addMessage(state, {
      threadId: thread.id,
      role: "system",
      body: `Comphony is waiting on specialist input before continuing ${activeTask.title}.`
    }, resolveRoutingPolicy(config));
    return {
      threadId: thread.id,
      taskId: activeTask.id,
      action: "waiting",
      message,
      task: activeTask,
      notes: ["consultation pending"]
    };
  }

  if (activeTask.status === "review_requested") {
    const review = state.reviews.find((item) => item.taskId === activeTask.id && item.status === "requested");
    if (review) {
      const result = completeTaskReview(config, state, {
        reviewId: review.id,
        outcome: "approved",
        notes: "Auto-approved by Comphony reviewer loop."
      });
      refreshTaskGraphState(state, activeTask.id);
      const nextReady = findNextReadyChildTask(state, thread.id);
      if (nextReady && !nextReady.assigneeId) {
        autoAssignTask(config, root, state, nextReady.id);
      }
      return {
        threadId: thread.id,
        taskId: activeTask.id,
        action: "review_completed",
        message: result.message,
        task: result.task,
        notes: ["review completed automatically"]
      };
    }
  }

  if (!activeTask.assigneeId) {
    const assigned = autoAssignTask(config, root, state, activeTask.id);
    refreshTaskGraphState(state, activeTask.id);
    const message = addMessage(state, {
      threadId: thread.id,
      role: "system",
      body: assigned.agentId
        ? `Comphony assigned ${activeTask.title} to ${assigned.agentId}.`
        : `Comphony could not find an eligible agent for ${activeTask.title}.`,
      routedProjectId: activeTask.projectId,
      suggestedLane: activeTask.lane
    }, resolveRoutingPolicy(config));
    return {
      threadId: thread.id,
      taskId: activeTask.id,
      action: "assigned",
      message,
      task: assigned.task,
      notes: assigned.error ? [assigned.error] : ["task assigned"]
    };
  }

  const work = runTaskWorkTurn(config, root, state, { taskId: activeTask.id });
  const reviewTarget = autoReviewTarget(state, work.task);
  if (work.task.status === "review" && work.task.lane !== "review" && reviewTarget) {
    requestTaskReview(config, state, {
      taskId: work.task.id,
      reviewerAgentId: reviewTarget.id,
      reason: `Auto-review requested after ${work.task.lane} work turn.`
    });
    refreshTaskGraphState(state, work.task.id);
    return {
      threadId: thread.id,
      taskId: work.task.id,
      action: "review_requested",
      message: work.message,
      task: work.task,
      notes: [`review requested from ${reviewTarget.id}`]
    };
  }

  refreshTaskGraphState(state, work.task.id);
  const nextReady = findNextReadyChildTask(state, thread.id);
  if (isTaskComplete(work.task) && nextReady && !nextReady.assigneeId) {
    autoAssignTask(config, root, state, nextReady.id);
  }
  return {
    threadId: thread.id,
    taskId: work.task.id,
    action: "worked",
    message: work.message,
    task: work.task,
    notes: ["work turn executed"]
  };
}

export function validateDesignHandoffArtifacts(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  projectId: string
): string[] {
  return validateDesignHandoffArtifactsRecord(config, root, state, projectId);
}

function createExecutionTasksFromLanes(
  state: RuntimeState,
  input: { projectId: string; body: string; parentTaskId: string; threadId: string; requestedLanes: string[] }
): TaskRecord[] {
  return createLaneExecutionTasks(state, input, {
    createTask,
    deriveTaskTitle
  });
}

function deriveRequestedLanes(
  state: RuntimeState,
  projectId: string,
  body: string,
  preferredLane: string | undefined,
  routing: RoutingPolicy
): string[] {
  return inferRequestedLanes(state, projectId, body, preferredLane, routing, {
    inferLaneFromMessage
  });
}

function getOrderedThreadTasks(state: RuntimeState, threadId: string): TaskRecord[] {
  return getOrderedTasksForThread(state, threadId, {
    getThreadDetail
  });
}

function findNextReadyChildTask(state: RuntimeState, threadId: string): TaskRecord | null {
  return findNextReadyThreadChildTask(state, threadId, {
    getThreadDetail
  });
}

function dependenciesSatisfied(state: RuntimeState, task: TaskRecord): boolean {
  return areDependenciesSatisfied(state, task);
}

function refreshTaskGraphState(state: RuntimeState, taskId: string): void {
  refreshWorkflowTaskGraphState(state, taskId);
}

function isTaskComplete(task: TaskRecord): boolean {
  return isWorkflowTaskComplete(task);
}

function isTaskBlocked(task: TaskRecord): boolean {
  return isWorkflowTaskBlocked(task);
}

function autoReviewTarget(state: RuntimeState, task: TaskRecord): RuntimeAgent | null {
  return findAutoReviewTarget(state, task) as RuntimeAgent | null;
}

function resolveMentionedAgentId(state: RuntimeState, body: string): string | null {
  const matches = body.match(/@([a-z0-9_-]+)/ig);
  if (!matches) {
    return null;
  }
  for (const match of matches) {
    const normalized = match.slice(1).toLowerCase();
    const agent = state.agents.find((item) => {
      const compactName = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      return item.id.toLowerCase() === normalized || compactName === normalized;
    });
    if (agent) {
      return agent.id;
    }
  }
  return null;
}

function resolveConversationAction(
  config: JSONObject,
  state: RuntimeState,
  detail: ThreadDetail,
  body: string
):
  | { kind: "continue_loop" }
  | { kind: "create_project"; project: { id: string; name: string; purpose?: string; lanes: string[]; repoSlug?: string | null } }
  | { kind: "install_agent"; sourceKind: "local_package" | "registry_package"; ref: string; trustState?: "trusted" | "restricted" | "quarantined"; assignProjectId?: string }
  | { kind: "people_summary" }
  | null {
  const lowered = body.toLowerCase();
  if (/(who('| i)?s working|who is busy|who is free|team status|people status)/u.test(lowered)) {
    return { kind: "people_summary" };
  }
  if (/(continue|keep going|move forward|proceed|finish this|run the company|drive this)/u.test(lowered)) {
    return { kind: "continue_loop" };
  }

  const projectMatch = body.match(/(?:create|open|start|bootstrap)\s+(?:a\s+)?project(?:\s+called)?\s+["']?([^"'\n]+?)["']?(?:[.!?]|$)/iu);
  if (projectMatch) {
    const rawName = projectMatch[1]?.trim();
    if (rawName) {
      const normalizedId = slugifyProjectId(rawName);
      const repoSlug = slugifyRepoSlug(rawName);
      return {
        kind: "create_project",
        project: {
          id: normalizedId,
          name: rawName,
          purpose: `Created from thread ${detail.thread.id}`,
          lanes: ["planning", "research", "design", "build", "review"],
          repoSlug
        }
      };
    }
  }

  const sourceMatch = body.match(/https?:\/\/\S+|(?:\.\/|\/)[^\s]+/u);
  if (sourceMatch && /(hire|install|add).*(agent|designer|developer|researcher|publisher|worker)|\b(agent|designer|developer|researcher|publisher)\b.*\b(hire|install|add)\b/iu.test(body)) {
    const currentProjectId = detail.tasks[0]?.projectId;
    return {
      kind: "install_agent",
      sourceKind: sourceMatch[0].startsWith("http") ? "registry_package" : "local_package",
      ref: sourceMatch[0],
      trustState: sourceMatch[0].startsWith("http") ? "restricted" : "trusted",
      assignProjectId: currentProjectId ?? undefined
    };
  }

  void config;
  return null;
}

function continueThreadUntilPause(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: { threadId: string; maxSteps?: number }
): ContinueThreadResult[] {
  const results: ContinueThreadResult[] = [];
  const maxSteps = input.maxSteps ?? 8;
  for (let index = 0; index < maxSteps; index += 1) {
    const result = continueThread(config, root, state, { threadId: input.threadId });
    results.push(result);
    if (["waiting", "blocked", "nothing_to_do"].includes(result.action)) {
      break;
    }
  }
  return results;
}

function composeContinueLoopReply(results: ContinueThreadResult[]): string {
  if (results.length === 0) {
    return "Comphony did not take any additional action on this thread.";
  }
  const lines = ["Comphony continued the thread automatically."];
  for (const result of results) {
    lines.push(
      `- ${result.action}: ${result.task?.title ?? "thread"}${result.task ? ` (${result.task.status})` : ""}`
    );
  }
  const final = results[results.length - 1];
  if (final?.notes?.length) {
    lines.push(`Latest note: ${final.notes.join(", ")}`);
  }
  return lines.join("\n");
}

function composeProjectCreationReply(project: RuntimeProject): string {
  return [
    `Comphony opened a new project: ${project.name}.`,
    `Project id: ${project.id}.`,
    `Lanes: ${project.lanes.join(", ")}.`,
    `Repo slug: ${project.repoSlug ?? "-"}.`
  ].join(" ");
}

function installAndMaybeAssignAgent(
  state: RuntimeState,
  root: string,
  input: { sourceKind: "local_package" | "registry_package"; ref: string; trustState?: "trusted" | "restricted" | "quarantined"; projectId?: string }
): { agent: RuntimeAgent; assignedProjectId: string | null } {
  const agent = installAgentPackage(state, root, {
    sourceKind: input.sourceKind,
    ref: input.ref,
    trustState: input.trustState
  });
  if (input.projectId) {
    assignAgentToProject(state, { agentId: agent.id, projectId: input.projectId });
    return { agent, assignedProjectId: input.projectId };
  }
  return { agent, assignedProjectId: null };
}

function composeAgentInstallReply(result: { agent: RuntimeAgent; assignedProjectId: string | null }): string {
  return [
    `Comphony installed ${result.agent.name} (${result.agent.id}) as a ${result.agent.role} agent.`,
    `Source: ${result.agent.sourceKind ?? "-"} ${result.agent.sourceRef ?? ""}`.trim(),
    result.assignedProjectId ? `Assigned to project ${result.assignedProjectId}.` : "No project assignment was applied yet."
  ].join(" ");
}

function composePeopleSummaryReply(people: PeopleOverview[]): string {
  if (people.length === 0) {
    return "Comphony has no registered agents yet.";
  }
  const ordered = people.slice().sort((left, right) => {
    const score = (person: PeopleOverview) => person.activeTaskCount + person.consultationCount + person.reviewCount;
    return score(right) - score(left);
  });
  return [
    "Current team snapshot:",
    ...ordered.map((person) => `- ${person.name} (${person.role}) · ${person.availability} · tasks=${person.activeTaskCount} · consultations=${person.consultationCount} · reviews=${person.reviewCount}`)
  ].join("\n");
}

function composeAgentDirectedReply(
  state: RuntimeState,
  agent: RuntimeAgent,
  detail: ThreadDetail,
  body: string
): string {
  const ownedTasks = detail.tasks.filter((task) => task.assigneeId === agent.id || task.projectId && agent.assignedProjects.includes(task.projectId));
  const currentTask = ownedTasks.find((task) => !isTaskComplete(task)) ?? ownedTasks[0];
  if (!currentTask) {
    return `${agent.name} does not have a linked task on this thread yet. Comphony can assign follow-up work if needed.`;
  }
  return [
    `${agent.name} here.`,
    `I am handling ${currentTask.title} on the ${currentTask.lane} lane.`,
    `Current status: ${currentTask.status}.`,
    currentTask.blockingReason ? `Blocker: ${currentTask.blockingReason}.` : "No active blocker right now.",
    currentTask.completionSummary ? `Latest outcome: ${currentTask.completionSummary}` : `Latest request: ${body}`
  ].join(" ");
}

function composeManagerThreadReply(
  detail: ThreadDetail,
  latestUserBody: string,
  memories: Array<MemoryRecord | RecommendedMemory>,
  recommendedTasks: RecommendedTask[]
): string {
  const currentTasks = detail.tasks.filter((task) => task.parentTaskId !== null);
  const openConsultations = detail.consultations.filter((consultation) => consultation.status === "requested");
  const openReviews = detail.reviews.filter((review) => review.status === "requested");
  const openApprovals = detail.approvals.filter((approval) => approval.status === "requested");
  const currentTask = currentTasks.find((task) => !isTaskComplete(task)) ?? currentTasks[0];
  if (!currentTask) {
    return `Comphony logged your follow-up: "${latestUserBody}". This thread has no active child tasks right now.`;
  }

  const whyAssigned = currentTask.assigneeId
    ? `Assigned to ${currentTask.assigneeId} because the current lane is ${currentTask.lane}.`
    : `No assignee yet because Comphony has not selected the next worker.`;
  const nextStep = currentTask.status === "review_requested"
    ? "Next step: finish the pending review."
    : currentTask.status === "waiting"
      ? "Next step: wait for approval before resuming."
      : currentTask.status === "consulting"
        ? "Next step: wait for specialist input."
        : "Next step: continue execution on the active lane.";

  return [
    `Comphony logged your follow-up: "${latestUserBody}".`,
    `Current focus: ${currentTask.title}.`,
    `Lane=${currentTask.lane}, status=${currentTask.status}, assignee=${currentTask.assigneeId ?? "-"}.`,
    whyAssigned,
    nextStep,
    `Open coordination: consultations=${openConsultations.length}, reviews=${openReviews.length}, approvals=${openApprovals.length}.`,
    ...(memories.length > 0
      ? ["Related memory:", ...memories.map((memory) => `- ${memory.kind}: ${memory.body}`)]
      : []),
    ...(recommendedTasks.length > 0
      ? ["Similar tasks:", ...recommendedTasks.map((task) => `- ${task.id}: ${task.title} (${task.lane}, ${task.status})`)]
      : [])
  ].join("\n");
}

function slugifyProjectId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `project_${randomUUID().slice(0, 8)}`;
}

function slugifyRepoSlug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `project-${randomUUID().slice(0, 8)}`;
}

function capitalizeLane(lane: string): string {
  return lane.length > 0 ? `${lane[0].toUpperCase()}${lane.slice(1)}` : lane;
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
      memories: state.memories ?? [],
      consultations: state.consultations ?? [],
      reviews: state.reviews ?? [],
      approvals: state.approvals ?? [],
      syncRecords: state.syncRecords ?? [],
      sessions: state.sessions ?? []
    }),
    tasks: (state.tasks ?? []).map((task) => ({
      ...task,
      parentTaskId: typeof task.parentTaskId === "string" ? task.parentTaskId : null,
      childTaskIds: Array.isArray(task.childTaskIds)
        ? task.childTaskIds.filter((item: unknown): item is string => typeof item === "string")
        : [],
      dependsOnTaskIds: Array.isArray(task.dependsOnTaskIds)
        ? task.dependsOnTaskIds.filter((item: unknown): item is string => typeof item === "string")
        : [],
      artifactPaths: Array.isArray(task.artifactPaths)
        ? task.artifactPaths.filter((item: unknown): item is string => typeof item === "string")
        : [],
      externalRefs: Array.isArray(task.externalRefs)
        ? task.externalRefs.map((ref) => ({
          provider: typeof ref?.provider === "string" ? ref.provider : "unknown",
          externalId: typeof ref?.externalId === "string" ? ref.externalId : null,
          externalKey: typeof ref?.externalKey === "string" ? ref.externalKey : null,
          url: typeof ref?.url === "string" ? ref.url : null
        }))
        : [],
      blockingReason: typeof task.blockingReason === "string" ? task.blockingReason : null,
      needsApproval: Boolean(task.needsApproval),
      humanTakeover: Boolean(task.humanTakeover),
      completionSummary: typeof task.completionSummary === "string" ? task.completionSummary : null
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
    consultations: (state.consultations ?? []).map((consultation) => ({
      ...consultation,
      response: typeof consultation.response === "string" ? consultation.response : null
    })),
    reviews: (state.reviews ?? []).map((review) => ({
      ...review,
      notes: typeof review.notes === "string" ? review.notes : null,
      outcome: review.outcome === "approved" || review.outcome === "changes_requested" ? review.outcome : null
    })),
    approvals: (state.approvals ?? []).map((approval) => ({
      ...approval,
      taskId: typeof approval.taskId === "string" ? approval.taskId : null,
      threadId: typeof approval.threadId === "string" ? approval.threadId : null,
      notes: typeof approval.notes === "string" ? approval.notes : null,
      resumeStatus: typeof approval.resumeStatus === "string" ? approval.resumeStatus : null
    })),
    syncRecords: (state.syncRecords ?? []).map((record) => ({
      ...record,
      projectId: typeof record.projectId === "string" ? record.projectId : null,
      taskId: typeof record.taskId === "string" ? record.taskId : null
    })),
    sessions: (state.sessions ?? []).map((session) => ({
      ...session,
      label: typeof session.label === "string" ? session.label : null,
      revokedAt: typeof session.revokedAt === "string" ? session.revokedAt : null
    })),
    projects: [],
    agents: []
  };

  const configProjects = (Array.isArray(config.projects) ? config.projects : []).flatMap((project) => {
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
        repoSlug: typeof repo?.slug === "string" ? repo.slug : null,
        source: "config" as const
      }
    ];
  });
  const runtimeProjects = (state.projects ?? []).filter((project) => !configProjects.some((item) => item.id === project.id));
  nextState.projects = [...configProjects, ...runtimeProjects];

  const configAgents = (Array.isArray(config.agents) ? config.agents : []).flatMap((agent) => {
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
        assignedProjects,
        sourceKind: typeof asMap(agentMap.source)?.kind === "string" ? String(asMap(agentMap.source)?.kind) : null,
        sourceRef: typeof asMap(agentMap.source)?.ref === "string" ? String(asMap(agentMap.source)?.ref) : null,
        trustState: "trusted" as const
      }
    ];
  });
  const runtimeAgents = (state.agents ?? []).filter((agent) => !configAgents.some((item) => item.id === agent.id));
  nextState.agents = [...configAgents, ...runtimeAgents];

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

function nextConsultationId(state: RuntimeState): string {
  state.counters.consultation += 1;
  return `consult_${String(state.counters.consultation).padStart(4, "0")}`;
}

function nextReviewId(state: RuntimeState): string {
  state.counters.review += 1;
  return `review_${String(state.counters.review).padStart(4, "0")}`;
}

function nextApprovalId(state: RuntimeState): string {
  state.counters.approval += 1;
  return `approval_${String(state.counters.approval).padStart(4, "0")}`;
}

function nextSyncId(state: RuntimeState): string {
  state.counters.sync += 1;
  return `sync_${String(state.counters.sync).padStart(4, "0")}`;
}

function normalizeCounters(state: Partial<RuntimeState>): RuntimeState["counters"] {
  return {
    task: safeCounterValue(state.counters?.task, state.tasks?.length ?? 0),
    thread: safeCounterValue(state.counters?.thread, state.threads?.length ?? 0),
    message: safeCounterValue(state.counters?.message, state.messages?.length ?? 0),
    event: safeCounterValue(state.counters?.event, state.events?.length ?? 0),
    memory: safeCounterValue(state.counters?.memory, state.memories?.length ?? 0),
    consultation: safeCounterValue(state.counters?.consultation, state.consultations?.length ?? 0),
    review: safeCounterValue(state.counters?.review, state.reviews?.length ?? 0),
    approval: safeCounterValue(state.counters?.approval, state.approvals?.length ?? 0),
    sync: safeCounterValue(state.counters?.sync, state.syncRecords?.length ?? 0),
    session: safeCounterValue(state.counters?.session, state.sessions?.length ?? 0)
  };
}

function safeCounterValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function requiresDesignHandoff(role: string, lane: string): boolean {
  return needsDesignHandoff(role, lane);
}

function selectAgentForTask(state: RuntimeState, task: TaskRecord, routing: RoutingPolicy): RuntimeAgent | null {
  return chooseAgentForTask(state, task, routing) as RuntimeAgent | null;
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

function nextStatusForWorkTurn(lane: string, status: string): string {
  return getNextStatusForWorkTurn(lane, status);
}

function workTurnMessage(
  agentName: string,
  role: string,
  task: TaskRecord,
  nextStatus: string,
  artifacts: { artifactPaths: string[]; summary: string }
): string {
  return composeWorkTurnMessage(agentName, role, task, nextStatus, artifacts);
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

function normalizeMessages(messages: MessageRecord[]): MessageRecord[] {
  return messages.map((message, index) => {
    const validId = /^msg_\d{4,}$/.test(message.id);
    return {
      ...message,
      id: validId ? message.id : `msg_${String(index + 1).padStart(4, "0")}`,
      targetAgentId: typeof message.targetAgentId === "string" ? message.targetAgentId : null
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

function loadAgentPackageSource(
  root: string,
  input: { sourceKind: "local_package" | "registry_package"; ref: string }
): { manifestText: string; promptText: string | null; sourceRef: string } {
  if (input.sourceKind === "local_package") {
    const basePath = resolve(root, input.ref);
    return {
      manifestText: readFileSync(resolve(basePath, "agent.yaml"), "utf8"),
      promptText: safeReadText(resolve(basePath, "prompts", "system.md")),
      sourceRef: input.ref
    };
  }

  if (isHttpUrl(input.ref)) {
    const manifestUrl = input.ref.endsWith(".yaml") ? input.ref : `${input.ref.replace(/\/$/, "")}/agent.yaml`;
    const manifestText = fetchTextSync(manifestUrl);
    const parsed = YAML.parse(manifestText) as Record<string, unknown>;
    const entrypoints = asMap(parsed?.entrypoints);
    const promptPath = typeof entrypoints?.prompt === "string" ? entrypoints.prompt : "prompts/system.md";
    let promptText: string | null = null;
    try {
      promptText = fetchTextSync(joinUrl(dirnameUrl(manifestUrl), promptPath));
    } catch {
      promptText = null;
    }
    return {
      manifestText,
      promptText,
      sourceRef: manifestUrl
    };
  }

  const basePath = resolve(root, input.ref);
  return {
    manifestText: readFileSync(resolve(basePath, "agent.yaml"), "utf8"),
    promptText: safeReadText(resolve(basePath, "prompts", "system.md")),
    sourceRef: input.ref
  };
}

function ensureExternalSyncApproval(
  config: JSONObject,
  state: RuntimeState,
  task: TaskRecord,
  action: string
): void {
  const policies = asMap(config.policies);
  if (policies?.external_sync_requires_auth !== true) {
    return;
  }
  const latestApproval = [...state.approvals]
    .reverse()
    .find((approval) => approval.taskId === task.id && approval.action === action);
  if (!latestApproval || latestApproval.status !== "granted") {
    throw new Error(`External sync requires granted approval for task ${task.id}`);
  }
}

function findConfiguredActor(config: JSONObject, actorId: string): { id: string; role: string } {
  return findConfiguredSessionActor(config, actorId);
}

function ensureConnectorEnabled(config: JSONObject, provider: "telegram" | "discord" | "slack"): void {
  const connectors = asMap(config.connectors);
  const providerConfig = asMap(connectors?.[provider]);
  if (providerConfig?.enabled !== true) {
    throw new Error(`Connector ${provider} is not enabled`);
  }
}

function getSyncProviderConfig(config: JSONObject, provider: string): Record<string, unknown> {
  const sync = asMap(config.sync);
  const providers = asMap(sync?.providers);
  const providerConfig = providers ? asMap(providers[provider]) : null;
  if (!providerConfig || providerConfig.enabled !== true) {
    throw new Error(`Sync provider ${provider} is not enabled`);
  }
  return providerConfig;
}

function syncRuntimeToSupabase(
  config: JSONObject,
  providerConfig: Record<string, unknown>,
  state: RuntimeState
): void {
  const projectRef = typeof providerConfig.project_ref === "string" ? providerConfig.project_ref : "local-dev";
  const supabaseUrl = process.env.SUPABASE_URL ?? (projectRef !== "local-dev" ? `https://${projectRef}.supabase.co` : undefined);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  const company = asMap(config.company);
  const companySlug = typeof company?.slug === "string" ? company.slug : "comphony";
  const snapshotBody = {
    company_slug: companySlug,
    project_ref: projectRef,
    generated_at: new Date().toISOString(),
    snapshot: {
      projects: state.projects,
      agents: state.agents,
      tasks: state.tasks,
      threads: state.threads,
      messages: state.messages.slice(-200),
      approvals: state.approvals,
      reviews: state.reviews,
      consultations: state.consultations,
      sync_records: state.syncRecords,
      sessions: state.sessions.map((session) => ({
        id: session.id,
        actor_id: session.actorId,
        role: session.role,
        label: session.label,
        created_at: session.createdAt,
        last_seen_at: session.lastSeenAt,
        revoked_at: session.revokedAt
      }))
    }
  };
  fetchTextSync(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/comphony_runtime_snapshots`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(snapshotBody)
  });
  const recentEvents = listEvents(state, 50).map((event) => ({
    company_slug: companySlug,
    project_ref: projectRef,
    event_id: event.id,
    event_type: event.type,
    entity_type: event.entityType,
    entity_id: event.entityId,
    occurred_at: event.timestamp,
    payload: event.payload
  }));
  if (recentEvents.length > 0) {
    fetchTextSync(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/comphony_events`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(recentEvents)
    });
  }
}

function getProjectSyncName(config: JSONObject, projectId: string): string | null {
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const projectConfig = projects.find((item) => asMap(item)?.id === projectId);
  const trackerSync = asMap(asMap(projectConfig)?.tracker_sync);
  if (typeof trackerSync?.project_name === "string") {
    return trackerSync.project_name;
  }
  return null;
}

function composeLinearIssuePayload(task: TaskRecord): { title: string; description: string } {
  const lines = [
    task.description.trim() || task.title,
    "",
    `Comphony task: ${task.id}`,
    `Lane: ${task.lane}`,
    `Status: ${task.status}`,
    `Assignee: ${task.assigneeId ?? "-"}`,
    task.parentTaskId ? `Parent task: ${task.parentTaskId}` : "",
    task.dependsOnTaskIds.length > 0 ? `Depends on: ${task.dependsOnTaskIds.join(", ")}` : "",
    task.completionSummary ? `Summary: ${task.completionSummary}` : ""
  ].filter(Boolean);
  return {
    title: task.title,
    description: lines.join("\n")
  };
}

function upsertTaskExternalRef(task: TaskRecord, ref: ExternalRefRecord): void {
  const existingIndex = task.externalRefs.findIndex((item) => item.provider === ref.provider);
  if (existingIndex === -1) {
    task.externalRefs.push(ref);
    return;
  }
  task.externalRefs[existingIndex] = ref;
}

function fetchLinearTeamId(apiKey: string, teamKey: string): string {
  const data = linearGraphql(apiKey, `
    query ComphonyTeamByKey($teamKey: String!) {
      teams(filter: { key: { eq: $teamKey } }) {
        nodes {
          id
          key
        }
      }
    }
  `, { teamKey });
  const team = data?.teams?.nodes?.[0];
  if (!team?.id) {
    throw new Error(`Linear team with key ${teamKey} was not found`);
  }
  return String(team.id);
}

function fetchLinearProjectId(apiKey: string, projectName: string): string | null {
  const data = linearGraphql(apiKey, `
    query ComphonyProjectByName($projectName: String!) {
      projects(filter: { name: { eq: $projectName } }) {
        nodes {
          id
          name
        }
      }
    }
  `, { projectName });
  const project = data?.projects?.nodes?.[0];
  return project?.id ? String(project.id) : null;
}

function createLinearIssue(
  apiKey: string,
  input: { teamId: string; projectId: string | null; title: string; description: string }
): { id: string; identifier: string | null; url: string | null } {
  const data = linearGraphql(apiKey, `
    mutation ComphonyIssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `, {
    input: {
      teamId: input.teamId,
      projectId: input.projectId,
      title: input.title,
      description: input.description
    }
  });
  const issue = data?.issueCreate?.issue;
  if (!issue?.id) {
    throw new Error("Linear issueCreate did not return an issue id");
  }
  return {
    id: String(issue.id),
    identifier: issue.identifier ? String(issue.identifier) : null,
    url: issue.url ? String(issue.url) : null
  };
}

function updateLinearIssue(
  apiKey: string,
  issueId: string,
  input: { title: string; description: string }
): { id: string; identifier: string | null; url: string | null } {
  const data = linearGraphql(apiKey, `
    mutation ComphonyIssueUpdate($issueId: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $issueId, input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `, {
    issueId,
    input: {
      title: input.title,
      description: input.description
    }
  });
  const issue = data?.issueUpdate?.issue;
  if (!issue?.id) {
    throw new Error("Linear issueUpdate did not return an issue id");
  }
  return {
    id: String(issue.id),
    identifier: issue.identifier ? String(issue.identifier) : null,
    url: issue.url ? String(issue.url) : null
  };
}

function linearGraphql(apiKey: string, query: string, variables: Record<string, unknown>): any {
  const endpoint = process.env.LINEAR_API_URL ?? "https://api.linear.app/graphql";
  const responseText = fetchTextSync(endpoint, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });
  const parsed = JSON.parse(responseText) as { data?: unknown; errors?: Array<{ message?: string }> };
  if (parsed.errors && parsed.errors.length > 0) {
    const message = parsed.errors.map((error) => error.message || "Unknown Linear error").join("; ");
    throw new Error(message);
  }
  return parsed.data;
}

function fetchTextSync(
  url: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
): string {
  const script = `
    const [url, optionsJson] = process.argv.slice(1);
    const options = optionsJson ? JSON.parse(optionsJson) : {};
    fetch(url, options).then(async (response) => {
      const text = await response.text();
      if (!response.ok) {
        console.error(text || response.statusText);
        process.exit(1);
      }
      process.stdout.write(text);
    }).catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `;
  return execFileSync(process.execPath, ["-e", script, url, JSON.stringify(options ?? {})], { encoding: "utf8" });
}

function asMap(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function safeReadText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function dirnameUrl(url: string): string {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  parts.pop();
  parsed.pathname = `/${parts.join("/")}`;
  return parsed.toString().replace(/\/$/, "");
}

function joinUrl(base: string, relative: string): string {
  const cleanBase = base.replace(/\/$/, "");
  const cleanRelative = relative.replace(/^\.\//, "").replace(/^\//, "");
  return `${cleanBase}/${cleanRelative}`;
}

function findTask(state: RuntimeState, taskId: string): TaskRecord {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) {
    throw new Error(`Unknown task id: ${taskId}`);
  }
  return task;
}

function findAgent(state: RuntimeState, agentId: string): RuntimeAgent {
  const agent = state.agents.find((item) => item.id === agentId);
  if (!agent) {
    throw new Error(`Unknown agent id: ${agentId}`);
  }
  return agent;
}

function findThreadByTask(state: RuntimeState, taskId: string): ThreadRecord {
  const thread = state.threads.find((item) => item.taskIds.includes(taskId));
  if (!thread) {
    throw new Error(`Task ${taskId} is not linked to a thread`);
  }
  return thread;
}
