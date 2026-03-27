import { TASK_STATUS } from "./task-policy.js";

type MemoryRecordLike = {
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

type RecommendedMemoryLike = MemoryRecordLike & {
  score: number;
};

type TaskRecordLike = {
  id: string;
  title: string;
  description: string;
  projectId: string;
  lane: string;
  status: string;
  updatedAt: string;
};

type RecommendedTaskLike = TaskRecordLike & {
  score: number;
};

type RuntimeStateLike = {
  memories: MemoryRecordLike[];
  tasks: TaskRecordLike[];
};

type EventInput = {
  type: string;
  entityType: "thread" | "message" | "task" | "consultation" | "review" | "approval" | "system";
  entityId: string;
  timestamp: string;
  payload: Record<string, string | number | boolean | null>;
};

type MemoryDomainDeps = {
  appendEvent: <TState extends RuntimeStateLike>(state: TState, input: EventInput) => void;
  getThreadDetail: <TState extends RuntimeStateLike>(state: TState, threadId: string) => { tasks: Array<{ id: string }> };
  nextMemoryId: <TState extends RuntimeStateLike>(state: TState) => string;
};

export function listMemories<TState extends RuntimeStateLike>(
  state: TState,
  filters?: { projectId?: string; threadId?: string; taskId?: string; query?: string; limit?: number }
): TState["memories"] {
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
  return items.slice(0, filters?.limit ?? 20) as TState["memories"];
}

export function recommendMemories<
  TMemory extends MemoryRecordLike,
  TState extends RuntimeStateLike & { memories: TMemory[] }
>(
  state: TState,
  input: { projectId?: string; threadId?: string; taskId?: string; query?: string; limit?: number }
): Array<TMemory & { score: number }> {
  const queryTokens = tokenize(`${input.query ?? ""}`);
  const ranked = state.memories
    .map((memory) => ({
      ...memory,
      score: scoreMemory(memory, input, queryTokens)
    }))
    .filter((memory) => memory.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.createdAt.localeCompare(left.createdAt);
    });

  return dedupeRecommendedMemories(ranked).slice(0, input.limit ?? 10) as Array<TMemory & { score: number }>;
}

export function recommendTasks<
  TTask extends TaskRecordLike,
  TState extends RuntimeStateLike & { tasks: TTask[] }
>(
  state: TState,
  input: { projectId?: string; threadId?: string; taskId?: string; query?: string; limit?: number },
  deps: { getThreadDetail: (state: TState, threadId: string) => { tasks: Array<{ id: string }> } }
): Array<TTask & { score: number }> {
  const queryTokens = tokenize(`${input.query ?? ""}`);
  const currentThreadTaskIds = input.threadId
    ? new Set(deps.getThreadDetail(state, input.threadId).tasks.map((task) => task.id))
    : new Set<string>();

  const ranked = state.tasks
    .filter((task) => {
      if (input.projectId && task.projectId !== input.projectId) {
        return false;
      }
      if (input.taskId && task.id === input.taskId) {
        return false;
      }
      if (currentThreadTaskIds.has(task.id)) {
        return false;
      }
      return true;
    })
    .map((task) => ({
      ...task,
      score: scoreTask(task, queryTokens, input)
    }))
    .filter((task) => task.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });

  return ranked.slice(0, input.limit ?? 10) as Array<TTask & { score: number }>;
}

export function addMemory<
  TMemory extends MemoryRecordLike,
  TState extends RuntimeStateLike & { memories: TMemory[] }
>(
  state: TState,
  input: {
    scope: TMemory["scope"];
    projectId?: string | null;
    threadId?: string | null;
    taskId?: string | null;
    agentId?: string | null;
    kind: string;
    body: string;
    tags?: string[];
  },
  deps: {
    appendEvent: (state: TState, input: EventInput) => void;
    nextMemoryId: (state: TState) => string;
  }
): TMemory {
  const memory = {
    id: deps.nextMemoryId(state),
    scope: input.scope,
    projectId: input.projectId ?? null,
    threadId: input.threadId ?? null,
    taskId: input.taskId ?? null,
    agentId: input.agentId ?? null,
    kind: input.kind,
    body: input.body,
    tags: input.tags ?? [],
    createdAt: new Date().toISOString()
  } as TMemory;

  state.memories.push(memory);
  deps.appendEvent(state, {
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

function scoreMemory(
  memory: MemoryRecordLike,
  input: { projectId?: string; threadId?: string; taskId?: string; query?: string },
  queryTokens: string[]
): number {
  let score = 0;

  if (input.projectId && memory.projectId === input.projectId) {
    score += 3;
  }
  if (input.threadId && memory.threadId === input.threadId) {
    score += 5;
  }
  if (input.taskId && memory.taskId === input.taskId) {
    score += 4;
  }

  if (queryTokens.length > 0) {
    const haystack = tokenize(`${memory.body} ${memory.tags.join(" ")}`);
    const overlaps = queryTokens.filter((token) => haystack.includes(token));
    score += overlaps.length * 2;
  }

  if (memory.kind === "follow_up") {
    score += 1;
  }

  return score;
}

function dedupeRecommendedMemories(memories: RecommendedMemoryLike[]): RecommendedMemoryLike[] {
  const seen = new Set<string>();
  const result: RecommendedMemoryLike[] = [];

  for (const memory of memories) {
    const key = `${memory.kind}:${memory.body.trim().toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(memory);
  }

  return result;
}

function scoreTask(
  task: TaskRecordLike,
  queryTokens: string[],
  input: { projectId?: string; threadId?: string; taskId?: string; query?: string }
): number {
  let score = 0;

  if (input.projectId && task.projectId === input.projectId) {
    score += 4;
  }

  const haystack = tokenize(`${task.title} ${task.description} ${task.lane} ${task.status}`);
  if (queryTokens.length > 0) {
    const overlaps = queryTokens.filter((token) => haystack.includes(token));
    score += overlaps.length * 2;
  }

  if (task.status === TASK_STATUS.done || task.status === TASK_STATUS.review) {
    score += 1;
  }

  return score;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((token) => token.length >= 3);
}
