import type { RoutingPolicy } from "../config.js";

type ThreadRecordLike = {
  id: string;
  title: string;
  taskIds: string[];
  messageIds: string[];
  createdAt: string;
  updatedAt: string;
};

type MessageRecordLike = {
  id: string;
  threadId: string;
  role: "user" | "agent" | "system";
  body: string;
  routedProjectId: string | null;
  suggestedLane: string | null;
  targetAgentId: string | null;
  createdAt: string;
};

type TaskRecordLike = {
  id: string;
};

type ConsultationRecordLike = {
  taskId: string;
};

type ReviewRecordLike = {
  taskId: string;
};

type ApprovalRecordLike = {
  taskId: string | null;
};

type AgentLike = {
  id: string;
};

type RuntimeStateLike = {
  threads: ThreadRecordLike[];
  messages: MessageRecordLike[];
  tasks: TaskRecordLike[];
  consultations: ConsultationRecordLike[];
  reviews: ReviewRecordLike[];
  approvals: ApprovalRecordLike[];
  agents: AgentLike[];
};

type EventInput = {
  type: string;
  entityType: "thread" | "message" | "task" | "consultation" | "review" | "approval" | "system";
  entityId: string;
  timestamp: string;
  payload: Record<string, string | number | boolean | null>;
};

type ThreadDomainDeps = {
  appendEvent: <TState extends RuntimeStateLike>(state: TState, input: EventInput) => void;
  defaultRoutingPolicy: () => RoutingPolicy;
  inferLaneFromMessage: (body: string, routing: RoutingPolicy) => string;
  inferProjectFromMessage: <TState extends RuntimeStateLike>(state: TState, body: string, routing: RoutingPolicy) => string | null;
  nextMessageId: <TState extends RuntimeStateLike>(state: TState) => string;
  resolveMentionedAgentId: <TState extends RuntimeStateLike>(state: TState, body: string) => string | null;
};

export function listThreads<TState extends RuntimeStateLike>(state: TState): TState["threads"] {
  return state.threads;
}

export function getThreadDetail<
  TTask extends TaskRecordLike,
  TConsultation extends ConsultationRecordLike,
  TReview extends ReviewRecordLike,
  TApproval extends ApprovalRecordLike,
  TState extends RuntimeStateLike & {
    tasks: TTask[];
    consultations: TConsultation[];
    reviews: TReview[];
    approvals: TApproval[];
  }
>(
  state: TState,
  threadId: string
): {
  thread: ThreadRecordLike;
  messages: MessageRecordLike[];
  tasks: TTask[];
  consultations: TConsultation[];
  reviews: TReview[];
  approvals: TApproval[];
} {
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread) {
    throw new Error(`Unknown thread id: ${threadId}`);
  }

  const taskIds = new Set(thread.taskIds);
  return {
    thread,
    messages: state.messages.filter((message) => message.threadId === threadId),
    tasks: state.tasks.filter((task) => taskIds.has(task.id)) as TTask[],
    consultations: state.consultations.filter((consultation) => taskIds.has(consultation.taskId)) as TConsultation[],
    reviews: state.reviews.filter((review) => taskIds.has(review.taskId)) as TReview[],
    approvals: state.approvals.filter((approval) => Boolean(approval.taskId && taskIds.has(approval.taskId))) as TApproval[]
  };
}

export function listMessages<TState extends RuntimeStateLike>(state: TState, threadId?: string): TState["messages"] {
  if (!threadId) {
    return state.messages;
  }

  return state.messages.filter((message) => message.threadId === threadId) as TState["messages"];
}

export function createThread<TState extends RuntimeStateLike>(
  state: TState,
  input: { title: string },
  deps: {
    appendEvent: (state: TState, input: EventInput) => void;
    nextThreadId: (state: TState) => string;
  }
): ThreadRecordLike {
  const now = new Date().toISOString();
  const thread: ThreadRecordLike = {
    id: deps.nextThreadId(state),
    title: input.title,
    taskIds: [],
    messageIds: [],
    createdAt: now,
    updatedAt: now
  };

  state.threads.push(thread);
  deps.appendEvent(state, {
    type: "thread.created",
    entityType: "thread",
    entityId: thread.id,
    timestamp: now,
    payload: { title: thread.title }
  });

  return thread;
}

export function addMessage<TState extends RuntimeStateLike>(
  state: TState,
  input: {
    threadId: string;
    role: "user" | "agent" | "system";
    body: string;
    routedProjectId?: string | null;
    suggestedLane?: string | null;
    targetAgentId?: string | null;
  },
  deps: {
    appendEvent: (state: TState, input: EventInput) => void;
    defaultRoutingPolicy: () => RoutingPolicy;
    inferLaneFromMessage: (body: string, routing: RoutingPolicy) => string;
    inferProjectFromMessage: (state: TState, body: string, routing: RoutingPolicy) => string | null;
    nextMessageId: (state: TState) => string;
    resolveMentionedAgentId: (state: TState, body: string) => string | null;
  },
  routing?: RoutingPolicy
): MessageRecordLike {
  const thread = state.threads.find((item) => item.id === input.threadId);
  if (!thread) {
    throw new Error(`Unknown thread id: ${input.threadId}`);
  }

  const policy = routing ?? deps.defaultRoutingPolicy();
  const targetedAgent = input.targetAgentId ?? deps.resolveMentionedAgentId(state, input.body);
  const message: MessageRecordLike = {
    id: deps.nextMessageId(state),
    threadId: input.threadId,
    role: input.role,
    body: input.body,
    routedProjectId: input.routedProjectId ?? deps.inferProjectFromMessage(state, input.body, policy),
    suggestedLane: input.suggestedLane ?? deps.inferLaneFromMessage(input.body, policy),
    targetAgentId: targetedAgent,
    createdAt: new Date().toISOString()
  };

  state.messages.push(message);
  thread.messageIds.push(message.id);
  thread.updatedAt = message.createdAt;
  deps.appendEvent(state, {
    type: "message.created",
    entityType: "message",
    entityId: message.id,
    timestamp: message.createdAt,
    payload: {
      threadId: message.threadId,
      role: message.role,
      routedProjectId: message.routedProjectId,
      suggestedLane: message.suggestedLane,
      targetAgentId: message.targetAgentId
    }
  });

  return message;
}
