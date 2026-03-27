import type { JSONObject } from "../config.js";
import { resolveRoutingPolicy } from "../config.js";
import { TASK_STATUS } from "./task-policy.js";

type RuntimeAgentLike = {
  id: string;
  assignedProjects: string[];
};

type RuntimeProjectLike = {
  id: string;
  lanes: string[];
};

type TaskRecordLike = {
  id: string;
  title: string;
  projectId: string;
  lane: string;
  status: string;
  assigneeId: string | null;
  parentTaskId: string | null;
  childTaskIds: string[];
  blockingReason: string | null;
  needsApproval: boolean;
  completionSummary: string | null;
  updatedAt: string;
};

type ThreadRecordLike = {
  id: string;
  updatedAt: string;
};

type MessageRecordLike = {
  body: string;
  createdAt: string;
};

type ConsultationRecordLike = {
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

type HandoffRecordLike = {
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

type ReviewRecordLike = {
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

type ApprovalRecordLike = {
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

type RuntimeStateLike = {
  projects: RuntimeProjectLike[];
  agents: RuntimeAgentLike[];
  tasks: TaskRecordLike[];
  threads: ThreadRecordLike[];
  handoffs: HandoffRecordLike[];
  consultations: ConsultationRecordLike[];
  reviews: ReviewRecordLike[];
  approvals: ApprovalRecordLike[];
};

type EventInput = {
  type: string;
  entityType: "thread" | "message" | "task" | "consultation" | "review" | "approval" | "system";
  entityId: string;
  timestamp: string;
  payload: Record<string, string | number | boolean | null>;
};

type CollaborationDeps<
  TState extends RuntimeStateLike,
  TTask extends TaskRecordLike,
  TThread extends ThreadRecordLike,
  TMessage extends MessageRecordLike,
  TAgent extends RuntimeAgentLike,
  THandoff extends HandoffRecordLike,
  TConsultation extends ConsultationRecordLike,
  TReview extends ReviewRecordLike,
  TApproval extends ApprovalRecordLike
> = {
  addMessage: (
    state: TState,
    input: {
      threadId: string;
      role: "user" | "agent" | "system";
      body: string;
      routedProjectId?: string | null;
      suggestedLane?: string | null;
      targetAgentId?: string | null;
    },
    routing?: ReturnType<typeof resolveRoutingPolicy>
  ) => TMessage;
  addMemory: (
    state: TState,
    input: {
      scope: "company" | "project" | "thread" | "task" | "agent";
      projectId?: string | null;
      threadId?: string | null;
      taskId?: string | null;
      agentId?: string | null;
      kind: string;
      body: string;
      tags?: string[];
    }
  ) => unknown;
  appendEvent: (state: TState, input: EventInput) => void;
  autoAssignTask: (config: JSONObject, root: string, state: TState, taskId: string) => { task: TTask; agentId: string | null; error: string | null };
  findAgent: (state: TState, agentId: string) => TAgent;
  findTask: (state: TState, taskId: string) => TTask;
  findThreadByTask: (state: TState, taskId: string) => TThread;
  nextApprovalId: (state: TState) => string;
  nextConsultationId: (state: TState) => string;
  nextHandoffId: (state: TState) => string;
  nextReviewId: (state: TState) => string;
  refreshTaskGraphState: (state: TState, taskId: string) => void;
};

export function handoffTask<
  TState extends RuntimeStateLike,
  TTask extends TaskRecordLike,
  TThread extends ThreadRecordLike,
  TMessage extends MessageRecordLike,
  TAgent extends RuntimeAgentLike,
  THandoff extends HandoffRecordLike,
  TConsultation extends ConsultationRecordLike,
  TReview extends ReviewRecordLike,
  TApproval extends ApprovalRecordLike
>(
  config: JSONObject,
  root: string,
  state: TState,
  input: { taskId: string; lane: string; reason?: string; instructions?: string },
  deps: CollaborationDeps<TState, TTask, TThread, TMessage, TAgent, THandoff, TConsultation, TReview, TApproval>
): { handoff: THandoff; task: TTask; threadId: string; message: TMessage; agentId: string | null; error: string | null } {
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
  const resolvedThread = deps.findThreadByTask(state, task.id);

  const previousLane = task.lane;
  const previousAssigneeId = task.assigneeId;
  const now = new Date().toISOString();
  task.lane = input.lane;
  task.status = TASK_STATUS.triaged;
  task.assigneeId = null;
  task.updatedAt = now;
  resolvedThread.updatedAt = now;

  const message = deps.addMessage(state, {
    threadId: resolvedThread.id,
    role: "system",
    body: `Comphony handed off ${task.title} from ${previousLane} to ${input.lane}.`,
    routedProjectId: task.projectId,
    suggestedLane: input.lane
  });

  deps.appendEvent(state, {
    type: "task.handed_off",
    entityType: "task",
    entityId: task.id,
    timestamp: now,
    payload: {
      threadId: resolvedThread.id,
      previousLane,
      lane: input.lane,
      previousAssigneeId
    }
  });

  const assigned = deps.autoAssignTask(config, root, state, task.id);
  const handoff = {
    id: deps.nextHandoffId(state),
    taskId: task.id,
    threadId: resolvedThread.id,
    fromLane: previousLane,
    toLane: input.lane,
    fromAgentId: previousAssigneeId,
    toAgentId: assigned.agentId,
    reason: input.reason ?? null,
    instructions: input.instructions ?? null,
    status: assigned.agentId ? "completed" : "pending_assignment",
    createdAt: now,
    updatedAt: now,
    completedAt: assigned.agentId ? now : null
  } as THandoff;
  state.handoffs.push(handoff);
  message.body = assigned.agentId
    ? `Comphony handed off ${task.title} from ${previousLane} to ${input.lane} and assigned ${assigned.agentId}.`
    : `Comphony handed off ${task.title} from ${previousLane} to ${input.lane} but no eligible agent was available.`;
  deps.addMemory(state, {
    scope: "task",
    projectId: task.projectId,
    threadId: resolvedThread.id,
    taskId: task.id,
    agentId: assigned.agentId,
    kind: "handoff",
    body: message.body,
    tags: ["handoff", previousLane, input.lane]
  });
  deps.refreshTaskGraphState(state, task.id);

  return {
    handoff,
    task: task as TTask,
    threadId: resolvedThread.id,
    message,
    agentId: assigned.agentId,
    error: assigned.error
  };
}

export function requestConsultation<
  TState extends RuntimeStateLike,
  TTask extends TaskRecordLike,
  TThread extends ThreadRecordLike,
  TMessage extends MessageRecordLike,
  TAgent extends RuntimeAgentLike,
  THandoff extends HandoffRecordLike,
  TConsultation extends ConsultationRecordLike,
  TReview extends ReviewRecordLike,
  TApproval extends ApprovalRecordLike
>(
  config: JSONObject,
  state: TState,
  input: { taskId: string; toAgentId: string; reason: string; instructions?: string },
  deps: CollaborationDeps<TState, TTask, TThread, TMessage, TAgent, THandoff, TConsultation, TReview, TApproval>
): { consultation: TConsultation; task: TTask; threadId: string; message: TMessage } {
  const task = deps.findTask(state, input.taskId);
  const thread = deps.findThreadByTask(state, task.id);
  const agent = deps.findAgent(state, input.toAgentId);
  if (!agent.assignedProjects.includes(task.projectId)) {
    throw new Error(`Agent ${agent.id} is not assigned to project ${task.projectId}`);
  }

  const now = new Date().toISOString();
  const consultation = {
    id: deps.nextConsultationId(state),
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
  } as TConsultation;
  state.consultations.push(consultation);
  task.status = TASK_STATUS.consulting;
  task.blockingReason = input.reason;
  task.updatedAt = now;
  thread.updatedAt = now;

  const message = deps.addMessage(state, {
    threadId: thread.id,
    role: "system",
    body: `Comphony requested consultation from ${agent.id} for ${task.title}. Reason: ${input.reason}`,
    routedProjectId: task.projectId,
    suggestedLane: task.lane
  }, resolveRoutingPolicy(config));

  deps.appendEvent(state, {
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
  deps.addMemory(state, {
    scope: "task",
    projectId: task.projectId,
    threadId: thread.id,
    taskId: task.id,
    agentId: agent.id,
    kind: "consultation_requested",
    body: `${agent.id} was consulted for ${task.title}: ${input.reason}`,
    tags: ["consultation", task.lane]
  });
  deps.refreshTaskGraphState(state, task.id);

  return { consultation, task, threadId: thread.id, message };
}

export function resolveConsultation<
  TState extends RuntimeStateLike,
  TTask extends TaskRecordLike,
  TThread extends ThreadRecordLike,
  TMessage extends MessageRecordLike,
  TAgent extends RuntimeAgentLike,
  THandoff extends HandoffRecordLike,
  TConsultation extends ConsultationRecordLike,
  TReview extends ReviewRecordLike,
  TApproval extends ApprovalRecordLike
>(
  config: JSONObject,
  state: TState,
  input: { consultationId: string; response: string },
  deps: CollaborationDeps<TState, TTask, TThread, TMessage, TAgent, THandoff, TConsultation, TReview, TApproval>
): { consultation: TConsultation; task: TTask; threadId: string; message: TMessage } {
  const consultation = state.consultations.find((item) => item.id === input.consultationId);
  if (!consultation) {
    throw new Error(`Unknown consultation id: ${input.consultationId}`);
  }
  const task = deps.findTask(state, consultation.taskId);
  const thread = deps.findThreadByTask(state, task.id);
  const now = new Date().toISOString();
  consultation.status = "answered";
  consultation.response = input.response;
  consultation.updatedAt = now;
  task.status = TASK_STATUS.inProgress;
  task.blockingReason = null;
  task.updatedAt = now;
  thread.updatedAt = now;

  const message = deps.addMessage(state, {
    threadId: thread.id,
    role: "agent",
    body: `Consultation ${consultation.id} answered by ${consultation.toAgentId}: ${input.response}`,
    routedProjectId: task.projectId,
    suggestedLane: task.lane
  }, resolveRoutingPolicy(config));

  deps.appendEvent(state, {
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
  deps.addMemory(state, {
    scope: "task",
    projectId: task.projectId,
    threadId: thread.id,
    taskId: task.id,
    agentId: consultation.toAgentId,
    kind: "consultation_response",
    body: input.response,
    tags: ["consultation", "response", task.lane]
  });
  deps.refreshTaskGraphState(state, task.id);

  return { consultation: consultation as TConsultation, task, threadId: thread.id, message };
}

export function requestTaskReview<
  TState extends RuntimeStateLike,
  TTask extends TaskRecordLike,
  TThread extends ThreadRecordLike,
  TMessage extends MessageRecordLike,
  TAgent extends RuntimeAgentLike,
  THandoff extends HandoffRecordLike,
  TConsultation extends ConsultationRecordLike,
  TReview extends ReviewRecordLike,
  TApproval extends ApprovalRecordLike
>(
  config: JSONObject,
  state: TState,
  input: { taskId: string; reviewerAgentId: string; reason: string },
  deps: CollaborationDeps<TState, TTask, TThread, TMessage, TAgent, THandoff, TConsultation, TReview, TApproval>
): { review: TReview; task: TTask; threadId: string; message: TMessage } {
  const task = deps.findTask(state, input.taskId);
  const thread = deps.findThreadByTask(state, task.id);
  const reviewer = deps.findAgent(state, input.reviewerAgentId);
  if (!reviewer.assignedProjects.includes(task.projectId)) {
    throw new Error(`Agent ${reviewer.id} is not assigned to project ${task.projectId}`);
  }

  const now = new Date().toISOString();
  const review = {
    id: deps.nextReviewId(state),
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
  } as TReview;
  state.reviews.push(review);
  task.status = TASK_STATUS.reviewRequested;
  task.updatedAt = now;
  thread.updatedAt = now;

  const message = deps.addMessage(state, {
    threadId: thread.id,
    role: "system",
    body: `Comphony requested review from ${reviewer.id} for ${task.title}. Reason: ${input.reason}`,
    routedProjectId: task.projectId,
    suggestedLane: "review"
  }, resolveRoutingPolicy(config));

  deps.appendEvent(state, {
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
  deps.addMemory(state, {
    scope: "task",
    projectId: task.projectId,
    threadId: thread.id,
    taskId: task.id,
    agentId: reviewer.id,
    kind: "review_requested",
    body: `${reviewer.id} was asked to review ${task.title}: ${input.reason}`,
    tags: ["review", task.lane]
  });
  deps.refreshTaskGraphState(state, task.id);

  return { review, task, threadId: thread.id, message };
}

export function completeTaskReview<
  TState extends RuntimeStateLike,
  TTask extends TaskRecordLike,
  TThread extends ThreadRecordLike,
  TMessage extends MessageRecordLike,
  TAgent extends RuntimeAgentLike,
  THandoff extends HandoffRecordLike,
  TConsultation extends ConsultationRecordLike,
  TReview extends ReviewRecordLike,
  TApproval extends ApprovalRecordLike
>(
  config: JSONObject,
  state: TState,
  input: { reviewId: string; outcome: "approved" | "changes_requested"; notes?: string },
  deps: CollaborationDeps<TState, TTask, TThread, TMessage, TAgent, THandoff, TConsultation, TReview, TApproval>
): { review: TReview; task: TTask; threadId: string; message: TMessage } {
  const review = state.reviews.find((item) => item.id === input.reviewId);
  if (!review) {
    throw new Error(`Unknown review id: ${input.reviewId}`);
  }
  const task = deps.findTask(state, review.taskId);
  const thread = deps.findThreadByTask(state, task.id);
  const now = new Date().toISOString();
  review.outcome = input.outcome;
  review.notes = input.notes ?? null;
  review.status = input.outcome;
  review.updatedAt = now;
  task.status = input.outcome === "approved" ? TASK_STATUS.reported : TASK_STATUS.inProgress;
  task.completionSummary = input.outcome === "approved"
    ? input.notes ?? `Review approved for ${task.title}.`
    : input.notes ?? `Changes requested for ${task.title}.`;
  task.updatedAt = now;
  thread.updatedAt = now;

  const message = deps.addMessage(state, {
    threadId: thread.id,
    role: "system",
    body: input.outcome === "approved"
      ? `Review ${review.id} approved ${task.title}.${input.notes ? ` Notes: ${input.notes}` : ""}`
      : `Review ${review.id} requested changes for ${task.title}.${input.notes ? ` Notes: ${input.notes}` : ""}`,
    routedProjectId: task.projectId,
    suggestedLane: task.lane
  }, resolveRoutingPolicy(config));

  deps.appendEvent(state, {
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
  deps.addMemory(state, {
    scope: "task",
    projectId: task.projectId,
    threadId: thread.id,
    taskId: task.id,
    agentId: review.reviewerAgentId,
    kind: "review_outcome",
    body: input.notes ?? input.outcome,
    tags: ["review", input.outcome, task.lane]
  });
  deps.refreshTaskGraphState(state, task.id);

  return { review: review as TReview, task, threadId: thread.id, message };
}

export function requestApproval<
  TState extends RuntimeStateLike,
  TTask extends TaskRecordLike,
  TThread extends ThreadRecordLike,
  TMessage extends MessageRecordLike,
  TAgent extends RuntimeAgentLike,
  THandoff extends HandoffRecordLike,
  TConsultation extends ConsultationRecordLike,
  TReview extends ReviewRecordLike,
  TApproval extends ApprovalRecordLike
>(
  config: JSONObject,
  state: TState,
  input: { action: string; reason: string; taskId?: string; requestedBy?: string | null },
  deps: CollaborationDeps<TState, TTask, TThread, TMessage, TAgent, THandoff, TConsultation, TReview, TApproval>
): { approval: TApproval; task: TTask | null; threadId: string | null; message: TMessage | null } {
  const task = input.taskId ? deps.findTask(state, input.taskId) : null;
  const thread = task ? deps.findThreadByTask(state, task.id) : null;
  const now = new Date().toISOString();
  const approval = {
    id: deps.nextApprovalId(state),
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
  } as TApproval;
  state.approvals.push(approval);

  let message: TMessage | null = null;
  if (task && thread) {
    task.needsApproval = true;
    task.status = TASK_STATUS.waiting;
    task.blockingReason = input.reason;
    task.updatedAt = now;
    thread.updatedAt = now;
    message = deps.addMessage(state, {
      threadId: thread.id,
      role: "system",
      body: `Comphony requested approval for ${input.action} on ${task.title}. Reason: ${input.reason}`,
      routedProjectId: task.projectId,
      suggestedLane: task.lane
    }, resolveRoutingPolicy(config));
  }

  deps.appendEvent(state, {
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
    deps.refreshTaskGraphState(state, task.id);
  }

  return { approval, task, threadId: thread?.id ?? null, message };
}

export function decideApproval<
  TState extends RuntimeStateLike,
  TTask extends TaskRecordLike,
  TThread extends ThreadRecordLike,
  TMessage extends MessageRecordLike,
  TAgent extends RuntimeAgentLike,
  THandoff extends HandoffRecordLike,
  TConsultation extends ConsultationRecordLike,
  TReview extends ReviewRecordLike,
  TApproval extends ApprovalRecordLike
>(
  config: JSONObject,
  state: TState,
  input: { approvalId: string; decision: "granted" | "denied"; actorId?: string | null; notes?: string },
  deps: CollaborationDeps<TState, TTask, TThread, TMessage, TAgent, THandoff, TConsultation, TReview, TApproval>
): { approval: TApproval; task: TTask | null; threadId: string | null; message: TMessage | null } {
  const approval = state.approvals.find((item) => item.id === input.approvalId);
  if (!approval) {
    throw new Error(`Unknown approval id: ${input.approvalId}`);
  }
  const task = approval.taskId ? deps.findTask(state, approval.taskId) : null;
  const thread = approval.threadId ? state.threads.find((item) => item.id === approval.threadId) ?? null : null;
  const now = new Date().toISOString();

  approval.status = input.decision;
  approval.decidedBy = input.actorId ?? null;
  approval.notes = input.notes ?? null;
  approval.updatedAt = now;

  let message: TMessage | null = null;
  if (task) {
    task.needsApproval = false;
    task.updatedAt = now;
    if (input.decision === "granted") {
      task.blockingReason = null;
      task.status = approval.resumeStatus ?? TASK_STATUS.triaged;
    } else {
      task.status = TASK_STATUS.blocked;
      task.blockingReason = input.notes ?? approval.reason;
    }
    deps.refreshTaskGraphState(state, task.id);
  }
  if (thread) {
    thread.updatedAt = now;
    message = deps.addMessage(state, {
      threadId: thread.id,
      role: "system",
      body: input.decision === "granted"
        ? `Approval ${approval.id} was granted for ${approval.action}.${input.notes ? ` Notes: ${input.notes}` : ""}`
        : `Approval ${approval.id} was denied for ${approval.action}.${input.notes ? ` Notes: ${input.notes}` : ""}`,
      routedProjectId: task?.projectId ?? null,
      suggestedLane: task?.lane ?? null
    }, resolveRoutingPolicy(config));
  }

  deps.appendEvent(state, {
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

  return { approval: approval as TApproval, task, threadId: thread?.id ?? null, message };
}
