import type { JSONObject } from "../config.js";
import { generateTaskArtifacts } from "../agent-runtime.js";
import { workTurnMessage } from "./task-workflow-helpers.js";
import {
  isTaskReviewRequested,
  isTaskWaitingForApproval,
  nextStatusForWorkTurn,
  TASK_STATUS
} from "./task-policy.js";

type RuntimeAgentLike = {
  id: string;
  name: string;
  role: string;
};

type TaskRecordLike = {
  id: string;
  title: string;
  projectId: string;
  lane: string;
  status: string;
  assigneeId: string | null;
  artifactPaths: string[];
  needsApproval: boolean;
  completionSummary: string | null;
  updatedAt: string;
};

type ThreadRecordLike = {
  id: string;
  updatedAt: string;
};

type MessageRecordLike = {
  createdAt: string;
};

type RuntimeStateLike = {
  agents: RuntimeAgentLike[];
  tasks: TaskRecordLike[];
  threads: ThreadRecordLike[];
};

type EventInput = {
  type: string;
  entityType: "thread" | "message" | "task" | "consultation" | "review" | "approval" | "system";
  entityId: string;
  timestamp: string;
  payload: Record<string, string | number | boolean | null>;
};

type ExecutionDeps<TState extends RuntimeStateLike, TTask extends TaskRecordLike, TThread extends ThreadRecordLike, TMessage extends MessageRecordLike> = {
  addMessage: (
    state: TState,
    input: {
      threadId: string;
      role: "user" | "agent" | "system";
      body: string;
      routedProjectId?: string | null;
      suggestedLane?: string | null;
      targetAgentId?: string | null;
    }
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
  findThreadByTask: (state: TState, taskId: string) => TThread;
  refreshTaskGraphState: (state: TState, taskId: string) => void;
};

export function runTaskWorkTurn<
  TState extends RuntimeStateLike,
  TTask extends TaskRecordLike,
  TThread extends ThreadRecordLike,
  TMessage extends MessageRecordLike
>(
  config: JSONObject,
  root: string,
  state: TState,
  input: { taskId: string },
  deps: ExecutionDeps<TState, TTask, TThread, TMessage>
): { task: TTask; threadId: string; message: TMessage } {
  const task = state.tasks.find((item) => item.id === input.taskId);
  if (!task) {
    throw new Error(`Unknown task id: ${input.taskId}`);
  }
  if (isTaskWaitingForApproval(task)) {
    throw new Error(`Task ${task.id} is waiting for approval before more work can run`);
  }
  const nonRunnableStatuses: string[] = [
    TASK_STATUS.blocked,
    TASK_STATUS.consulting,
    TASK_STATUS.reported,
    TASK_STATUS.failed,
    TASK_STATUS.canceled
  ];
  if (nonRunnableStatuses.includes(task.status) || isTaskReviewRequested(task)) {
    throw new Error(`Task ${task.id} cannot run a work turn while in ${task.status}`);
  }
  if (!task.assigneeId) {
    throw new Error(`Task ${task.id} has no assignee`);
  }
  const agent = state.agents.find((item) => item.id === task.assigneeId);
  if (!agent) {
    throw new Error(`Unknown agent id: ${task.assigneeId}`);
  }
  const resolvedThread = deps.findThreadByTask(state, task.id);

  const artifacts = generateTaskArtifacts({
    config,
    root,
    state: state as any,
    task: task as any,
    agentId: agent.id
  });
  const previousStatus = task.status;
  const nextStatus = nextStatusForWorkTurn(task.lane, previousStatus);
  const now = new Date().toISOString();
  const message = deps.addMessage(state, {
    threadId: resolvedThread.id,
    role: "agent",
    body: workTurnMessage(agent.name, agent.role, task, nextStatus, artifacts),
    routedProjectId: task.projectId,
    suggestedLane: task.lane
  });

  task.artifactPaths = Array.from(new Set([...task.artifactPaths, ...artifacts.artifactPaths]));
  task.status = nextStatus;
  task.updatedAt = now;
  resolvedThread.updatedAt = now;
  deps.appendEvent(state, {
    type: "task.artifacts_generated",
    entityType: "task",
    entityId: task.id,
    timestamp: now,
    payload: {
      threadId: resolvedThread.id,
      artifactCount: artifacts.artifactPaths.length,
      assigneeId: agent.id
    }
  });
  deps.appendEvent(state, {
    type: "task.work_turn_completed",
    entityType: "task",
    entityId: task.id,
    timestamp: now,
    payload: {
      threadId: resolvedThread.id,
      assigneeId: agent.id,
      previousStatus,
      status: nextStatus
    }
  });
  deps.addMemory(state, {
    scope: "task",
    projectId: task.projectId,
    threadId: resolvedThread.id,
    taskId: task.id,
    agentId: agent.id,
    kind: "work_turn",
    body: artifacts.summary,
    tags: [task.lane, task.status, agent.role]
  });
  task.completionSummary = artifacts.summary;
  deps.refreshTaskGraphState(state, task.id);

  return { task: task as TTask, threadId: resolvedThread.id, message };
}
