import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import YAML from "yaml";

import type { JSONObject } from "../config.js";
import { fetchTextSync } from "../integrations/http.js";

type ExternalRefLike = {
  provider: string;
  externalId: string | null;
  externalKey: string | null;
  url: string | null;
};

type MessageRecordLike = {
  id: string;
  threadId: string;
  targetAgentId: string | null;
};

type ThreadRecordLike = {
  id: string;
  messageIds: string[];
  taskIds: string[];
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
  dependsOnTaskIds: string[];
  completionSummary: string | null;
  childTaskIds: string[];
  artifactPaths: string[];
  externalRefs: ExternalRefLike[];
  blockingReason: string | null;
  needsApproval: boolean;
  humanTakeover: boolean;
};

type RuntimeProjectLike = {
  id: string;
  name: string;
  purpose: string | null;
  lanes: string[];
  repoSlug: string | null;
  source: "config" | "runtime";
};

type RuntimeAgentLike = {
  id: string;
  name: string;
  role: string;
  assignedProjects: string[];
  sourceKind: string | null;
  sourceRef: string | null;
  trustState: "trusted" | "restricted" | "quarantined";
};

type RuntimeStateLike = {
  version: number;
  counters?: Partial<{
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
  }>;
  tasks?: TaskRecordLike[];
  threads?: ThreadRecordLike[];
  messages?: MessageRecordLike[];
  events?: unknown[];
  memories?: Array<{ tags: unknown[] }>;
  handoffs?: Array<{ toAgentId: unknown; reason: unknown; instructions: unknown; completedAt: unknown }>;
  consultations?: Array<{ response: unknown }>;
  reviews?: Array<{ notes: unknown; outcome: unknown }>;
  approvals?: Array<{ taskId: unknown; threadId: unknown; notes: unknown; resumeStatus: unknown }>;
  syncRecords?: Array<{ projectId: unknown; taskId: unknown }>;
  sessions?: Array<{
    id: string;
    actorId: string;
    role: string;
    label: string | null;
    createdAt: string;
    lastSeenAt: string;
    revokedAt: string | null;
  }>;
  projects?: RuntimeProjectLike[];
  agents?: RuntimeAgentLike[];
};

export function syncCatalogFromConfig(config: JSONObject, state: RuntimeStateLike): RuntimeStateLike {
  const normalizedMessages = normalizeMessages(state.messages ?? []);
  const normalizedThreads = normalizeThreads(state.threads ?? [], normalizedMessages);
  const nextState: RuntimeStateLike = {
    version: state.version ?? 1,
    counters: normalizeCounters({
      ...state,
      messages: normalizedMessages,
      threads: normalizedThreads,
      events: state.events ?? [],
      memories: state.memories ?? [],
      handoffs: state.handoffs ?? [],
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
    handoffs: (state.handoffs ?? []).map((handoff) => ({
      ...handoff,
      toAgentId: typeof handoff.toAgentId === "string" ? handoff.toAgentId : null,
      reason: typeof handoff.reason === "string" ? handoff.reason : null,
      instructions: typeof handoff.instructions === "string" ? handoff.instructions : null,
      completedAt: typeof handoff.completedAt === "string" ? handoff.completedAt : null
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

export function getRuntimeDataDir(config: JSONObject, root: string): string {
  const runtime = asMap(config.runtime);
  const relative = typeof runtime?.data_dir === "string" ? runtime.data_dir : "./runtime-data";
  return resolve(root, relative);
}

export function getStatePath(config: JSONObject, root: string): string {
  return resolve(getRuntimeDataDir(config, root), "state.json");
}

export function loadAgentPackageSource(
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

export function ensureExternalSyncApproval(
  config: JSONObject,
  state: { approvals: Array<{ taskId: string | null; action: string; status: string }> },
  task: { id: string },
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

export function ensureConnectorEnabled(config: JSONObject, provider: "telegram" | "discord" | "slack"): void {
  const connectors = asMap(config.connectors);
  const providerConfig = asMap(connectors?.[provider]);
  if (providerConfig?.enabled !== true) {
    throw new Error(`Connector ${provider} is not enabled`);
  }
}

export function getSyncProviderConfig(config: JSONObject, provider: string): Record<string, unknown> {
  const sync = asMap(config.sync);
  const providers = asMap(sync?.providers);
  const providerConfig = providers ? asMap(providers[provider]) : null;
  if (!providerConfig || providerConfig.enabled !== true) {
    throw new Error(`Sync provider ${provider} is not enabled`);
  }
  return providerConfig;
}

export function composeLinearIssuePayload(task: TaskRecordLike): { title: string; description: string } {
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

export function upsertTaskExternalRef(task: { externalRefs: ExternalRefLike[] }, ref: ExternalRefLike): void {
  const existingIndex = task.externalRefs.findIndex((item) => item.provider === ref.provider);
  if (existingIndex === -1) {
    task.externalRefs.push(ref);
    return;
  }
  task.externalRefs[existingIndex] = ref;
}

export function findTask<TTask extends { id: string }>(state: { tasks: TTask[] }, taskId: string): TTask {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) {
    throw new Error(`Unknown task id: ${taskId}`);
  }
  return task;
}

export function findAgent<TAgent extends { id: string }>(state: { agents: TAgent[] }, agentId: string): TAgent {
  const agent = state.agents.find((item) => item.id === agentId);
  if (!agent) {
    throw new Error(`Unknown agent id: ${agentId}`);
  }
  return agent;
}

export function findThreadByTask<TThread extends { taskIds: string[] }>(state: { threads: TThread[] }, taskId: string): TThread {
  const thread = state.threads.find((item) => item.taskIds.includes(taskId));
  if (!thread) {
    throw new Error(`Task ${taskId} is not linked to a thread`);
  }
  return thread;
}

function normalizeMessages(messages: MessageRecordLike[]): MessageRecordLike[] {
  return messages.map((message, index) => {
    const validId = /^msg_\d{4,}$/.test(message.id);
    return {
      ...message,
      id: validId ? message.id : `msg_${String(index + 1).padStart(4, "0")}`,
      targetAgentId: typeof message.targetAgentId === "string" ? message.targetAgentId : null
    };
  });
}

function normalizeThreads(threads: ThreadRecordLike[], messages: MessageRecordLike[]): ThreadRecordLike[] {
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

function normalizeCounters(state: RuntimeStateLike): NonNullable<RuntimeStateLike["counters"]> {
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

export function asMap(value: unknown): Record<string, unknown> | null {
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
