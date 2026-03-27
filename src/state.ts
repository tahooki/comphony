import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

import type { JSONObject, RoutingPolicy } from "./config.js";
import { resolveRoutingPolicy } from "./config.js";
import {
  createLinearIssue,
  fetchLinearProjectId,
  fetchLinearTeamId,
  getProjectSyncName,
  updateLinearIssue
} from "./integrations/linear.js";
import { syncRuntimeToSupabase as pushRuntimeSnapshotToSupabase } from "./integrations/supabase.js";
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
  createExecutionTasksFromLanes as createLaneExecutionTasks,
  dependenciesSatisfied as areDependenciesSatisfied,
  deriveRequestedLanes as inferRequestedLanes,
  findNextReadyChildTask as findNextReadyThreadChildTask,
  getOrderedThreadTasks as getOrderedTasksForThread,
  workTurnMessage as composeWorkTurnMessage
} from "./state/task-workflow-helpers.js";
import {
  defaultRoutingPolicy,
  deriveTaskTitle,
  inferLaneFromMessage,
  inferProjectFromMessage
} from "./state/routing-support.js";
import {
  asMap,
  composeLinearIssuePayload,
  ensureConnectorEnabled,
  ensureExternalSyncApproval,
  findAgent,
  findTask,
  findThreadByTask,
  getRuntimeDataDir,
  getStatePath,
  getSyncProviderConfig,
  loadAgentPackageSource,
  syncCatalogFromConfig,
  upsertTaskExternalRef
} from "./state/runtime-support.js";
import {
  autoReviewTarget as findAutoReviewTarget,
  isTaskAwaitingConsultation,
  isTaskBlocked as isWorkflowTaskBlocked,
  isTaskComplete as isWorkflowTaskComplete,
  isTaskReviewRequested,
  isTaskWaitingForApproval,
  nextStatusForWorkTurn as getNextStatusForWorkTurn,
  refreshTaskGraphState as refreshWorkflowTaskGraphState,
  requiresDesignHandoff as needsDesignHandoff,
  selectAgentForTask as chooseAgentForTask
} from "./state/task-policy.js";
import {
  assignTask as assignTaskRecord,
  autoAssignTask as autoAssignTaskRecord,
  createTask as createTaskRecord,
  updateTaskStatus as updateTaskStatusRecord,
  validateDesignHandoffArtifacts as validateDesignHandoffArtifactsRecord
} from "./state/task-lifecycle.js";
import {
  completeTaskReview as completeTaskReviewRecord,
  decideApproval as decideApprovalRecord,
  handoffTask as handoffTaskRecord,
  requestApproval as requestApprovalRecord,
  requestConsultation as requestConsultationRecord,
  requestTaskReview as requestTaskReviewRecord,
  resolveConsultation as resolveConsultationRecord
} from "./state/task-collaboration.js";
import { runTaskWorkTurn as runTaskWorkTurnRecord } from "./state/task-execution.js";
import {
  intakeRequest as intakeRequestFlow,
  respondToThread as respondToThreadFlow,
  continueThread as continueThreadFlow
} from "./orchestrator/thread-orchestrator.js";

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
  handoffs: HandoffRecord[];
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

export type HandoffRecord = {
  id: string;
  taskId: string;
  threadId: string;
  fromLane: string;
  toLane: string;
  fromAgentId: string | null;
  toAgentId: string | null;
  reason: string | null;
  instructions: string | null;
  status: "completed" | "pending_assignment";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
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
    | "reported_closed"
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
  handoffs: HandoffRecord[];
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
    handoff: number;
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
  handoffs: [],
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
    handoff: 0,
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

  const synced = syncCatalogFromConfig(config, state) as RuntimeState;
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

export function listHandoffs(
  state: RuntimeState,
  filters?: { taskId?: string; threadId?: string; status?: string }
): HandoffRecord[] {
  return state.handoffs.filter((handoff) => {
    if (filters?.taskId && handoff.taskId !== filters.taskId) {
      return false;
    }
    if (filters?.threadId && handoff.threadId !== filters.threadId) {
      return false;
    }
    if (filters?.status && handoff.status !== filters.status) {
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
  return respondToThreadFlow(config, root, state, input, {
    addMemory,
    addMessage,
    appendEvent,
    assignAgentToProject,
    assignTask,
    autoAssignTask,
    completeTaskReview,
    createExecutionTasksFromLanes,
    createProject,
    createThread,
    createTask,
    deriveRequestedLanes,
    getOrderedThreadTasks,
    getThreadDetail,
    inferProjectFromMessage,
    installAgentPackage,
    listPeopleOverview,
    promoteMessageToTask,
    recommendMemories,
    recommendTasks,
    refreshTaskGraphState,
    requestTaskReview,
    runTaskWorkTurn,
    selectAgentForTask
  }) as { threadId: string; userMessage: MessageRecord; responseMessage: MessageRecord };
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
  return intakeRequestFlow(config, root, state, input, {
    addMemory,
    addMessage,
    appendEvent,
    assignAgentToProject,
    assignTask,
    autoAssignTask,
    completeTaskReview,
    createExecutionTasksFromLanes,
    createProject,
    createThread,
    createTask,
    deriveRequestedLanes,
    getOrderedThreadTasks,
    getThreadDetail,
    inferProjectFromMessage,
    installAgentPackage,
    listPeopleOverview,
    promoteMessageToTask,
    recommendMemories,
    recommendTasks,
    refreshTaskGraphState,
    requestTaskReview,
    runTaskWorkTurn,
    selectAgentForTask
  }) as IntakeResult;
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
    appendEvent,
    refreshTaskGraphState
  });
}

export function handoffTask(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: { taskId: string; lane: string; reason?: string; instructions?: string }
): { handoff: HandoffRecord; task: TaskRecord; threadId: string; message: MessageRecord; agentId: string | null; error: string | null } {
  return handoffTaskRecord(config, root, state, input, {
    addMessage,
    addMemory,
    appendEvent,
    autoAssignTask,
    findAgent,
    findTask,
    findThreadByTask,
    nextApprovalId,
    nextConsultationId,
    nextHandoffId,
    nextReviewId,
    refreshTaskGraphState
  });
}

export function requestConsultation(
  config: JSONObject,
  state: RuntimeState,
  input: { taskId: string; toAgentId: string; reason: string; instructions?: string }
): { consultation: ConsultationRecord; task: TaskRecord; threadId: string; message: MessageRecord } {
  return requestConsultationRecord(config, state, input, {
    addMessage,
    addMemory,
    appendEvent,
    autoAssignTask,
    findAgent,
    findTask,
    findThreadByTask,
    nextApprovalId,
    nextConsultationId,
    nextHandoffId,
    nextReviewId,
    refreshTaskGraphState
  });
}

export function resolveConsultation(
  config: JSONObject,
  state: RuntimeState,
  input: { consultationId: string; response: string }
): { consultation: ConsultationRecord; task: TaskRecord; threadId: string; message: MessageRecord } {
  return resolveConsultationRecord(config, state, input, {
    addMessage,
    addMemory,
    appendEvent,
    autoAssignTask,
    findAgent,
    findTask,
    findThreadByTask,
    nextApprovalId,
    nextConsultationId,
    nextHandoffId,
    nextReviewId,
    refreshTaskGraphState
  });
}

export function requestTaskReview(
  config: JSONObject,
  state: RuntimeState,
  input: { taskId: string; reviewerAgentId: string; reason: string }
): { review: ReviewRecord; task: TaskRecord; threadId: string; message: MessageRecord } {
  return requestTaskReviewRecord(config, state, input, {
    addMessage,
    addMemory,
    appendEvent,
    autoAssignTask,
    findAgent,
    findTask,
    findThreadByTask,
    nextApprovalId,
    nextConsultationId,
    nextHandoffId,
    nextReviewId,
    refreshTaskGraphState
  });
}

export function completeTaskReview(
  config: JSONObject,
  state: RuntimeState,
  input: { reviewId: string; outcome: "approved" | "changes_requested"; notes?: string }
): { review: ReviewRecord; task: TaskRecord; threadId: string; message: MessageRecord } {
  return completeTaskReviewRecord(config, state, input, {
    addMessage,
    addMemory,
    appendEvent,
    autoAssignTask,
    findAgent,
    findTask,
    findThreadByTask,
    nextApprovalId,
    nextConsultationId,
    nextHandoffId,
    nextReviewId,
    refreshTaskGraphState
  });
}

export function requestApproval(
  config: JSONObject,
  state: RuntimeState,
  input: { action: string; reason: string; taskId?: string; requestedBy?: string | null }
): { approval: ApprovalRecord; task: TaskRecord | null; threadId: string | null; message: MessageRecord | null } {
  return requestApprovalRecord(config, state, input, {
    addMessage,
    addMemory,
    appendEvent,
    autoAssignTask,
    findAgent,
    findTask,
    findThreadByTask,
    nextApprovalId,
    nextConsultationId,
    nextHandoffId,
    nextReviewId,
    refreshTaskGraphState
  });
}

export function decideApproval(
  config: JSONObject,
  state: RuntimeState,
  input: { approvalId: string; decision: "granted" | "denied"; actorId?: string | null; notes?: string }
): { approval: ApprovalRecord; task: TaskRecord | null; threadId: string | null; message: MessageRecord | null } {
  return decideApprovalRecord(config, state, input, {
    addMessage,
    addMemory,
    appendEvent,
    autoAssignTask,
    findAgent,
    findTask,
    findThreadByTask,
    nextApprovalId,
    nextConsultationId,
    nextHandoffId,
    nextReviewId,
    refreshTaskGraphState
  });
}

export function runTaskWorkTurn(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: { taskId: string }
): { task: TaskRecord; threadId: string; message: MessageRecord } {
  return runTaskWorkTurnRecord(config, root, state, input, {
    addMessage,
    addMemory,
    appendEvent,
    findThreadByTask,
    refreshTaskGraphState
  });
}

export function continueThread(
  config: JSONObject,
  root: string,
  state: RuntimeState,
  input: { threadId: string }
): ContinueThreadResult {
  return continueThreadFlow(config, root, state, input, {
    addMemory,
    addMessage,
    appendEvent,
    assignAgentToProject,
    assignTask,
    autoAssignTask,
    completeTaskReview,
    createExecutionTasksFromLanes,
    createProject,
    createThread,
    createTask,
    deriveRequestedLanes,
    getOrderedThreadTasks,
    getThreadDetail,
    inferProjectFromMessage,
    installAgentPackage,
    listPeopleOverview,
    promoteMessageToTask,
    recommendMemories,
    recommendTasks,
    refreshTaskGraphState,
    requestTaskReview,
    runTaskWorkTurn,
    selectAgentForTask
  }) as ContinueThreadResult;
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

function nextHandoffId(state: RuntimeState): string {
  state.counters.handoff += 1;
  return `handoff_${String(state.counters.handoff).padStart(4, "0")}`;
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
    handoff: safeCounterValue(state.counters?.handoff, state.handoffs?.length ?? 0),
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

function appendEvent(state: RuntimeState, input: Omit<EventRecord, "id">): EventRecord {
  const event: EventRecord = {
    id: nextEventId(state),
    ...input
  };
  state.events.push(event);
  return event;
}

function findConfiguredActor(config: JSONObject, actorId: string): { id: string; role: string } {
  return findConfiguredSessionActor(config, actorId);
}

function syncRuntimeToSupabase(
  config: JSONObject,
  providerConfig: Record<string, unknown>,
  state: RuntimeState
): void {
  pushRuntimeSnapshotToSupabase(config, providerConfig, state, listEvents(state, 50));
}
