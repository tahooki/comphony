import type { JSONObject } from "../config.js";
import { resolveRoutingPolicy } from "../config.js";
import { autoReviewTarget, isTaskAwaitingConsultation, isTaskComplete, isTaskReviewRequested, isTaskWaitingForApproval } from "../state/task-policy.js";
import { resolveConversationAction, type ConversationAction } from "./conversation-intents.js";
import {
  composeAgentDirectedReply,
  composeAgentInstallReply,
  composeContinueLoopReply,
  composeManagerThreadReply,
  composePeopleSummaryReply,
  composeProjectCreationReply
} from "./reply-builder.js";

type AgentLike = {
  id: string;
  name: string;
  role: string;
  assignedProjects: string[];
  sourceKind?: string | null;
  sourceRef?: string | null;
};

type ProjectLike = {
  id: string;
  name: string;
  purpose?: string | null;
  lanes: string[];
  repoSlug?: string | null;
};

type TaskLike = {
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
  updatedAt: string;
};

type ThreadLike = {
  id: string;
  title: string;
  taskIds: string[];
  messageIds: string[];
  updatedAt: string;
};

type MessageLike = {
  id: string;
  routedProjectId: string | null;
  suggestedLane: string | null;
  targetAgentId: string | null;
  createdAt: string;
};

type ThreadDetailLike = {
  thread: ThreadLike;
  messages: MessageLike[];
  tasks: TaskLike[];
  consultations: Array<{ status: string }>;
  reviews: Array<{ status: string; taskId: string; id: string }>;
  approvals: Array<{ status: string }>;
};

type ContinueThreadResultLike = {
  threadId: string;
  taskId: string | null;
  action: "assigned" | "worked" | "review_requested" | "review_completed" | "waiting" | "blocked" | "next_task_activated" | "nothing_to_do";
  message: MessageLike | null;
  task: TaskLike | null;
  notes: string[];
};

type IntakeResultLike = {
  thread: ThreadLike;
  message: MessageLike;
  task: TaskLike;
  rootTaskId: string | null;
  createdTaskIds: string[];
  assignedAgentId: string | null;
  assignmentError: string | null;
};

type RuntimeStateLike = {
  agents: AgentLike[];
  tasks: TaskLike[];
  threads: ThreadLike[];
  reviews: Array<{ status: string; taskId: string; id: string }>;
};

type EventInput = {
  type: string;
  entityType: "thread" | "message" | "task" | "consultation" | "review" | "approval" | "system";
  entityId: string;
  timestamp: string;
  payload: Record<string, string | number | boolean | null>;
};

type OrchestratorDeps<TState extends RuntimeStateLike, TTask extends TaskLike, TThread extends ThreadLike, TMessage extends MessageLike> = {
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
  appendEvent: (state: TState, input: EventInput) => void;
  assignAgentToProject: (state: TState, input: { agentId: string; projectId: string }) => unknown;
  assignTask: (config: JSONObject, root: string, state: TState, input: { taskId: string; agentId: string }) => TTask;
  autoAssignTask: (config: JSONObject, root: string, state: TState, taskId: string) => { task: TTask; agentId: string | null; error: string | null };
  completeTaskReview: (
    config: JSONObject,
    state: TState,
    input: { reviewId: string; outcome: "approved" | "changes_requested"; notes?: string }
  ) => { review: unknown; task: TTask; threadId: string; message: TMessage };
  createExecutionTasksFromLanes: (
    state: TState,
    input: { projectId: string; body: string; parentTaskId: string; threadId: string; requestedLanes: string[] }
  ) => TTask[];
  createProject: (
    state: TState,
    input: { id: string; name: string; purpose?: string; lanes: string[]; repoSlug?: string | null }
  ) => ProjectLike;
  createThread: (state: TState, input: { title: string }) => TThread;
  createTask: (
    state: TState,
    input: { projectId: string; title: string; description: string; lane: string; parentTaskId?: string | null; dependsOnTaskIds?: string[] }
  ) => TTask;
  deriveRequestedLanes: (state: TState, projectId: string, body: string, preferredLane: string | undefined, routing: ReturnType<typeof resolveRoutingPolicy>) => string[];
  getOrderedThreadTasks: (state: TState, threadId: string) => TTask[];
  getThreadDetail: (state: TState, threadId: string) => ThreadDetailLike;
  inferProjectFromMessage: (state: TState, body: string, routing: ReturnType<typeof resolveRoutingPolicy>) => string | null;
  installAgentPackage: (
    state: TState,
    root: string,
    input: { sourceKind: "local_package" | "registry_package"; ref: string; trustState?: "trusted" | "restricted" | "quarantined" }
  ) => AgentLike;
  listPeopleOverview: (state: TState) => Array<{ name: string; role: string; availability: string; activeTaskCount: number; consultationCount: number; reviewCount: number }>;
  promoteMessageToTask: (
    state: TState,
    input: { messageId: string; projectId?: string; lane?: string; title?: string },
    routing?: ReturnType<typeof resolveRoutingPolicy>
  ) => TTask;
  recommendMemories: (
    state: TState,
    input: { projectId?: string; threadId?: string; taskId?: string; query?: string; limit?: number }
  ) => Array<{ kind: string; body: string }>;
  recommendTasks: (
    state: TState,
    input: { projectId?: string; threadId?: string; taskId?: string; query?: string; limit?: number }
  ) => Array<{ id: string; title: string; lane: string; status: string }>;
  refreshTaskGraphState: (state: TState, taskId: string) => void;
  requestTaskReview: (config: JSONObject, state: TState, input: { taskId: string; reviewerAgentId: string; reason: string }) => unknown;
  runTaskWorkTurn: (config: JSONObject, root: string, state: TState, input: { taskId: string }) => { task: TTask; threadId: string; message: TMessage };
  selectAgentForTask: (state: TState, task: TTask, routing: ReturnType<typeof resolveRoutingPolicy>) => AgentLike | null;
};

export function respondToThread<TState extends RuntimeStateLike, TTask extends TaskLike, TThread extends ThreadLike, TMessage extends MessageLike>(
  config: JSONObject,
  root: string,
  state: TState,
  input: { threadId: string; body: string },
  deps: OrchestratorDeps<TState, TTask, TThread, TMessage>
): { threadId: string; userMessage: TMessage; responseMessage: TMessage } {
  const thread = state.threads.find((item) => item.id === input.threadId);
  if (!thread) {
    throw new Error(`Unknown thread id: ${input.threadId}`);
  }
  const routing = resolveRoutingPolicy(config);
  const userMessage = deps.addMessage(state, {
    threadId: thread.id,
    role: "user",
    body: input.body
  }, routing);
  const detail = deps.getThreadDetail(state, thread.id);
  deps.addMemory(state, {
    scope: "thread",
    projectId: detail.tasks[0]?.projectId ?? null,
    threadId: thread.id,
    kind: "follow_up",
    body: `User follow-up: ${input.body}`,
    tags: ["follow-up", "thread"]
  });
  const targetedAgent = userMessage.targetAgentId ? state.agents.find((agent) => agent.id === userMessage.targetAgentId) ?? null : null;
  const directAction = !targetedAgent
    ? resolveConversationAction(input.body, { threadId: detail.thread.id, currentProjectId: detail.tasks[0]?.projectId })
    : null;

  const responseBody = targetedAgent
    ? composeAgentDirectedReply(targetedAgent, detail, input.body)
    : directAction?.kind === "continue_loop"
      ? composeContinueLoopReply(continueThreadUntilPause(config, root, state, { threadId: thread.id }, deps))
      : directAction?.kind === "create_project"
        ? composeProjectCreationReply(deps.createProject(state, directAction.project))
        : directAction?.kind === "install_agent"
          ? composeAgentInstallReply(installAndMaybeAssignAgent(state, root, {
              sourceKind: directAction.sourceKind,
              ref: directAction.ref,
              trustState: directAction.trustState,
              projectId: directAction.assignProjectId
            }, deps))
          : directAction?.kind === "people_summary"
            ? composePeopleSummaryReply(deps.listPeopleOverview(state))
            : composeManagerThreadReply(
                detail,
                input.body,
                deps.recommendMemories(state, {
                  projectId: detail.tasks[0]?.projectId ?? undefined,
                  threadId: thread.id,
                  taskId: detail.tasks[0]?.id ?? undefined,
                  query: input.body,
                  limit: 3
                }),
                deps.recommendTasks(state, {
                  projectId: detail.tasks[0]?.projectId ?? undefined,
                  threadId: thread.id,
                  taskId: detail.tasks[0]?.id ?? undefined,
                  query: input.body,
                  limit: 3
                })
              );

  const responseMessage = deps.addMessage(state, {
    threadId: thread.id,
    role: targetedAgent ? "agent" : "system",
    body: responseBody,
    routedProjectId: detail.tasks[0]?.projectId ?? userMessage.routedProjectId,
    suggestedLane: detail.tasks[0]?.lane ?? userMessage.suggestedLane,
    targetAgentId: targetedAgent?.id ?? null
  }, routing);
  deps.appendEvent(state, {
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

export function intakeRequest<TState extends RuntimeStateLike, TTask extends TaskLike, TThread extends ThreadLike, TMessage extends MessageLike>(
  config: JSONObject,
  root: string,
  state: TState,
  input: { title: string; body: string; projectId?: string; lane?: string },
  deps: OrchestratorDeps<TState, TTask, TThread, TMessage>
): IntakeResultLike {
  const routing = resolveRoutingPolicy(config);
  const thread = deps.createThread(state, { title: input.title });
  const message = deps.addMessage(state, {
    threadId: thread.id,
    role: "user",
    body: input.body,
    routedProjectId: input.projectId ?? null,
    suggestedLane: input.lane ?? null
  }, routing);
  const projectId = input.projectId ?? message.routedProjectId ?? deps.inferProjectFromMessage(state, input.body, routing);
  if (!projectId) {
    throw new Error("Could not determine project for intake request");
  }
  const requestedLanes = deps.deriveRequestedLanes(state, projectId, input.body, input.lane ?? message.suggestedLane ?? undefined, routing);
  const rootTask = deps.createTask(state, {
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
  const plannedTasks = deps.createExecutionTasksFromLanes(state, {
    projectId,
    body: input.body,
    parentTaskId: rootTask.id,
    threadId: thread.id,
    requestedLanes
  });
  const task = plannedTasks[0] ?? deps.promoteMessageToTask(state, {
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
  deps.addMemory(state, {
    scope: "thread",
    projectId: task.projectId,
    threadId: thread.id,
    taskId: task.id,
    kind: "intake",
    body: `Intake created for ${task.title} in lane ${task.lane}.`,
    tags: ["intake", task.lane]
  });
  const preferredAgent = deps.selectAgentForTask(state, task, routing);
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
    deps.appendEvent(state, {
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
    deps.assignTask(config, root, state, { taskId: task.id, agentId: preferredAgent.id });
    const result = {
      thread,
      message,
      task,
      rootTaskId: rootTask.id,
      createdTaskIds: [rootTask.id, ...plannedTasks.map((item) => item.id)],
      assignedAgentId: preferredAgent.id,
      assignmentError: null
    };
    deps.appendEvent(state, {
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
    deps.appendEvent(state, {
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

export function continueThread<TState extends RuntimeStateLike, TTask extends TaskLike, TThread extends ThreadLike, TMessage extends MessageLike>(
  config: JSONObject,
  root: string,
  state: TState,
  input: { threadId: string },
  deps: OrchestratorDeps<TState, TTask, TThread, TMessage>
): ContinueThreadResultLike {
  const thread = state.threads.find((item) => item.id === input.threadId);
  if (!thread) {
    throw new Error(`Unknown thread id: ${input.threadId}`);
  }

  const readyTasks = deps.getOrderedThreadTasks(state, thread.id);
  const activeTask =
    readyTasks.find((task) => !isTaskComplete(task) && task.parentTaskId !== null) ??
    readyTasks.find((task) => !isTaskComplete(task));
  if (!activeTask) {
    const message = deps.addMessage(state, {
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

  const dependencyTaskIds = new Set(activeTask.dependsOnTaskIds);
  const dependenciesReady = readyTasks
    .filter((task) => dependencyTaskIds.has(task.id))
    .every((task) => isTaskComplete(task));
  if (!dependenciesReady && activeTask.dependsOnTaskIds.length > 0) {
    const message = deps.addMessage(state, {
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

  if (isTaskWaitingForApproval(activeTask)) {
    const message = deps.addMessage(state, {
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

  if (isTaskAwaitingConsultation(activeTask)) {
    const message = deps.addMessage(state, {
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

  if (isTaskReviewRequested(activeTask)) {
    const review = state.reviews.find((item) => item.taskId === activeTask.id && item.status === "requested");
    if (review) {
      const result = deps.completeTaskReview(config, state, {
        reviewId: review.id,
        outcome: "approved",
        notes: "Auto-approved by Comphony reviewer loop."
      });
      deps.refreshTaskGraphState(state, activeTask.id);
      const nextReady = deps.getOrderedThreadTasks(state, thread.id).find((task) => task.parentTaskId !== null && !isTaskComplete(task) && task.dependsOnTaskIds.every((id) => {
        const dep = state.tasks.find((candidate) => candidate.id === id);
        return dep ? isTaskComplete(dep) : false;
      })) ?? null;
      if (nextReady && !nextReady.assigneeId) {
        deps.autoAssignTask(config, root, state, nextReady.id);
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
    const assigned = deps.autoAssignTask(config, root, state, activeTask.id);
    deps.refreshTaskGraphState(state, activeTask.id);
    const message = deps.addMessage(state, {
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

  const work = deps.runTaskWorkTurn(config, root, state, { taskId: activeTask.id });
  const reviewTarget = autoReviewTarget(state, work.task);
  if (work.task.status === "review" && work.task.lane !== "review" && reviewTarget) {
    deps.requestTaskReview(config, state, {
      taskId: work.task.id,
      reviewerAgentId: reviewTarget.id,
      reason: `Auto-review requested after ${work.task.lane} work turn.`
    });
    deps.refreshTaskGraphState(state, work.task.id);
    return {
      threadId: thread.id,
      taskId: work.task.id,
      action: "review_requested",
      message: work.message,
      task: work.task,
      notes: [`review requested from ${reviewTarget.id}`]
    };
  }

  deps.refreshTaskGraphState(state, work.task.id);
  const nextReady = deps.getOrderedThreadTasks(state, thread.id).find((task) => task.parentTaskId !== null && !isTaskComplete(task) && task.dependsOnTaskIds.every((id) => {
    const dep = state.tasks.find((candidate) => candidate.id === id);
    return dep ? isTaskComplete(dep) : false;
  })) ?? null;
  if (isTaskComplete(work.task) && nextReady && !nextReady.assigneeId) {
    deps.autoAssignTask(config, root, state, nextReady.id);
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

export function continueThreadUntilPause<TState extends RuntimeStateLike, TTask extends TaskLike, TThread extends ThreadLike, TMessage extends MessageLike>(
  config: JSONObject,
  root: string,
  state: TState,
  input: { threadId: string; maxSteps?: number },
  deps: OrchestratorDeps<TState, TTask, TThread, TMessage>
): ContinueThreadResultLike[] {
  const results: ContinueThreadResultLike[] = [];
  const maxSteps = input.maxSteps ?? 8;
  for (let index = 0; index < maxSteps; index += 1) {
    const result = continueThread(config, root, state, { threadId: input.threadId }, deps);
    results.push(result);
    if (["waiting", "blocked", "nothing_to_do"].includes(result.action)) {
      break;
    }
  }
  return results;
}

function installAndMaybeAssignAgent<TState extends RuntimeStateLike, TTask extends TaskLike, TThread extends ThreadLike, TMessage extends MessageLike>(
  state: TState,
  root: string,
  input: { sourceKind: "local_package" | "registry_package"; ref: string; trustState?: "trusted" | "restricted" | "quarantined"; projectId?: string },
  deps: OrchestratorDeps<TState, TTask, TThread, TMessage>
): { agent: AgentLike; assignedProjectId: string | null } {
  const agent = deps.installAgentPackage(state, root, {
    sourceKind: input.sourceKind,
    ref: input.ref,
    trustState: input.trustState
  });
  if (input.projectId) {
    deps.assignAgentToProject(state, { agentId: agent.id, projectId: input.projectId });
    return { agent, assignedProjectId: input.projectId };
  }
  return { agent, assignedProjectId: null };
}
