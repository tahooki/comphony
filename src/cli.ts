import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ConfigError, loadCompanyConfig, resolveRoutingPolicy, validateCompanyConfig } from "./config.js";
import { startServer } from "./server.js";
import type { Command } from "./cli/command-registry.js";
import { parseArgs } from "./cli/parser.js";
import {
  addMessage,
  assignTask,
  assignAgentToProject,
  autoAssignTask,
  completeTaskReview,
  continueThread,
  createProject,
  createThread,
  createSession,
  createTask,
  decideApproval,
  getThreadDetail,
  handoffTask,
  ingestConnectorMessage,
  intakeRequest,
  listAgentCatalog,
  listApprovals,
  listConsultations,
  listMemories,
  listPeopleOverview,
  listProjectOverview,
  listReviews,
  listSessions,
  listSyncRecords,
  pushRuntimeToProvider,
  recommendMemories,
  recommendTasks,
  listAgents,
  listMessages,
  listProjects,
  listTasks,
  listThreads,
  loadRuntimeState,
  listEvents,
  promoteMessageToTask,
  respondToThread,
  requestApproval,
  requestConsultation,
  requestTaskReview,
  revokeSession,
  resolveConsultation,
  retrySync,
  runTaskWorkTurn,
  saveRuntimeState,
  installAgentPackage,
  syncTaskToProvider,
  updateTaskStatus
} from "./state.js";
import { DEFAULT_COMPANY_YAML } from "./templates.js";

export function main(argv = process.argv.slice(2)): number {
  try {
    const parsed = parseArgs(argv, helpText);
    const root = process.cwd();
    const configPath = resolve(root, parsed.configPath);

    switch (parsed.command.kind) {
      case "init":
        return runInit(root, configPath, parsed.command.force);
      case "validate":
        return runValidate(root, configPath);
      case "server-start":
        return runServer(root, configPath);
      case "project-list":
        return runProjectList(root, configPath);
      case "project-overview":
        return runProjectOverview(root, configPath);
      case "project-create":
        return runProjectCreate(root, configPath, parsed.command);
      case "agent-list":
        return runAgentList(root, configPath, parsed.command.projectId);
      case "agent-catalog":
        return runAgentCatalog(root, configPath);
      case "people-list":
        return runPeopleList(root, configPath);
      case "agent-install":
        return runAgentInstall(root, configPath, parsed.command);
      case "agent-assign-project":
        return runAgentAssignProject(root, configPath, parsed.command);
      case "task-create":
        return runTaskCreate(root, configPath, parsed.command);
      case "task-list":
        return runTaskList(root, configPath, parsed.command);
      case "task-assign":
        return runTaskAssign(root, configPath, parsed.command);
      case "task-autoassign":
        return runTaskAutoAssign(root, configPath, parsed.command);
      case "task-status":
        return runTaskStatus(root, configPath, parsed.command);
      case "task-handoff":
        return runTaskHandoff(root, configPath, parsed.command);
      case "task-work":
        return runTaskWork(root, configPath, parsed.command);
      case "task-sync":
        return runTaskSync(root, configPath, parsed.command);
      case "task-recommend":
        return runTaskRecommend(root, configPath, parsed.command);
      case "consult-list":
        return runConsultationList(root, configPath, parsed.command);
      case "consult-request":
        return runConsultationRequest(root, configPath, parsed.command);
      case "consult-resolve":
        return runConsultationResolve(root, configPath, parsed.command);
      case "review-list":
        return runReviewList(root, configPath, parsed.command);
      case "review-request":
        return runReviewRequest(root, configPath, parsed.command);
      case "review-complete":
        return runReviewComplete(root, configPath, parsed.command);
      case "approval-list":
        return runApprovalList(root, configPath, parsed.command);
      case "approval-request":
        return runApprovalRequest(root, configPath, parsed.command);
      case "approval-decide":
        return runApprovalDecide(root, configPath, parsed.command);
      case "sync-list":
        return runSyncList(root, configPath, parsed.command);
      case "sync-push":
        return runSyncPush(root, configPath, parsed.command);
      case "sync-retry":
        return runSyncRetry(root, configPath, parsed.command);
      case "session-list":
        return runSessionList(root, configPath, parsed.command);
      case "session-create":
        return runSessionCreate(root, configPath, parsed.command);
      case "session-revoke":
        return runSessionRevoke(root, configPath, parsed.command);
      case "connector-ingest":
        return runConnectorIngest(root, configPath, parsed.command);
      case "thread-create":
        return runThreadCreate(root, configPath, parsed.command.title);
      case "thread-list":
        return runThreadList(root, configPath);
      case "thread-show":
        return runThreadShow(root, configPath, parsed.command.threadId);
      case "thread-continue":
        return runThreadContinue(root, configPath, parsed.command.threadId);
      case "thread-ask":
        return runThreadAsk(root, configPath, parsed.command);
      case "memory-list":
        return runMemoryList(root, configPath, parsed.command);
      case "memory-recommend":
        return runMemoryRecommend(root, configPath, parsed.command);
      case "event-list":
        return runEventList(root, configPath, parsed.command.limit);
      case "message-send":
        return runMessageSend(root, configPath, parsed.command);
      case "message-list":
        return runMessageList(root, configPath, parsed.command.threadId);
      case "message-promote":
        return runMessagePromote(root, configPath, parsed.command);
      case "intake-create":
        return runIntakeCreate(root, configPath, parsed.command);
      default:
        return 2;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}

function runInit(root: string, configPath: string, force: boolean): number {
  ["agents", "repos", "runtime-data", "workspaces", "workflows"].forEach((directory) => {
    mkdirSync(resolve(root, directory), { recursive: true });
  });

  [
    "agents/.gitkeep",
    "runtime-data/.gitkeep"
  ].forEach((relativePath) => {
    const path = resolve(root, relativePath);
    try {
      writeFileSync(path, "", { flag: "wx" });
    } catch {
      // file already exists
    }
  });

  if (!force) {
    try {
      loadCompanyConfig(configPath);
      console.log(`Kept existing config: ${configPath}`);
    } catch {
      writeFileSync(configPath, DEFAULT_COMPANY_YAML, "utf8");
      console.log(`Created config: ${configPath}`);
    }
  } else {
    writeFileSync(configPath, DEFAULT_COMPANY_YAML, "utf8");
    console.log(`Overwrote config: ${configPath}`);
  }

  console.log("Prepared local directories:");
  ["agents", "repos", "runtime-data", "workspaces", "workflows"].forEach((directory) => {
    console.log(`  - ${resolve(root, directory)}`);
  });
  console.log("Next steps:");
  console.log("  - Run `npm run validate:config`");
  console.log("  - Run `npm run server:start`");
  return 0;
}

function runValidate(root: string, configPath: string): number {
  let config;
  try {
    config = loadCompanyConfig(configPath);
  } catch (error) {
    if (error instanceof ConfigError || error instanceof Error) {
      console.error(`Config error: ${error.message}`);
      return 1;
    }
    throw error;
  }

  const result = validateCompanyConfig(config, root);
  const companyName =
    config.company && typeof config.company === "object" && !Array.isArray(config.company)
      ? (config.company as Record<string, unknown>).name
      : "-";
  console.log(
    `Validation summary: company=${String(companyName ?? "-")}, projects=${Array.isArray(config.projects) ? config.projects.length : 0}, agents=${Array.isArray(config.agents) ? config.agents.length : 0}`
  );
  result.warnings.forEach((warning) => console.log(`WARNING: ${warning}`));
  if (result.errors.length > 0) {
    result.errors.forEach((error) => console.log(`ERROR: ${error}`));
    return 1;
  }
  console.log("Config is valid.");
  return 0;
}

function runServer(root: string, configPath: string): number {
  let config;
  try {
    config = loadCompanyConfig(configPath);
  } catch (error) {
    if (error instanceof ConfigError || error instanceof Error) {
      console.error(`Config error: ${error.message}`);
      return 1;
    }
    throw error;
  }
  const result = validateCompanyConfig(config, root);
  result.warnings.forEach((warning) => console.log(`WARNING: ${warning}`));
  if (result.errors.length > 0) {
    result.errors.forEach((error) => console.log(`ERROR: ${error}`));
    return 1;
  }
  startServer(config, root);
  return 0;
}

function runProjectList(root: string, configPath: string): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listProjects(state).forEach((project) => {
    console.log(`${project.id}\t${project.name}\t${project.repoSlug ?? "-"}\tlanes=${project.lanes.join(",")}`);
  });
  return 0;
}

function runProjectOverview(root: string, configPath: string): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listProjectOverview(state).forEach((project) => {
    console.log(
      `${project.id}\tactive=${project.activeTaskCount}\tblocked=${project.blockedTaskCount}\tthreads=${project.openThreadCount}\tagents=${project.agentIds.length}\tlatest=${project.latestArtifactPath ?? "-"}`
    );
  });
  return 0;
}

function runProjectCreate(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "project-create" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const project = createProject(state, {
    id: command.projectId,
    name: command.name,
    purpose: command.purpose,
    lanes: command.lanes,
    repoSlug: command.repoSlug
  });
  saveRuntimeState(config, root, state);
  console.log(`${project.id}\t${project.name}\t${project.repoSlug ?? "-"}\t${project.source}`);
  return 0;
}

function runAgentList(root: string, configPath: string, projectId?: string): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listAgents(state, projectId).forEach((agent) => {
    console.log(`${agent.id}\t${agent.role}\t${agent.sourceKind ?? "-"}\t${agent.trustState}\tprojects=${agent.assignedProjects.join(",")}`);
  });
  return 0;
}

function runAgentCatalog(root: string, configPath: string): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listAgentCatalog(state, root).forEach((agent) => {
    console.log(
      `${agent.id}\t${agent.role}\t${agent.trustState}\t${agent.sourceKind ?? "-"}\t${agent.cachedPath ?? "-"}\tprojects=${agent.assignedProjects.join(",")}`
    );
  });
  return 0;
}

function runPeopleList(root: string, configPath: string): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listPeopleOverview(state).forEach((person) => {
    console.log(
      `${person.id}\t${person.role}\tactive=${person.activeTaskCount}\tblocked=${person.blockedTaskCount}\tprojects=${person.assignedProjects.join(",")}`
    );
  });
  return 0;
}

function runAgentInstall(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "agent-install" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const agent = installAgentPackage(state, root, {
    sourceKind: command.sourceKind,
    ref: command.ref,
    trustState: command.trustState
  });
  saveRuntimeState(config, root, state);
  console.log(`${agent.id}\t${agent.name}\t${agent.role}\t${agent.sourceKind ?? "-"}\t${agent.trustState}`);
  return 0;
}

function runAgentAssignProject(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "agent-assign-project" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const agent = assignAgentToProject(state, {
    agentId: command.agentId,
    projectId: command.projectId
  });
  saveRuntimeState(config, root, state);
  console.log(`${agent.id}\tprojects=${agent.assignedProjects.join(",")}`);
  return 0;
}

function runTaskCreate(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "task-create" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const task = createTask(state, {
    projectId: command.projectId,
    title: command.title,
    description: command.description,
    lane: command.lane
  });
  saveRuntimeState(config, root, state);
  console.log(`${task.id}\t${task.projectId}\t${task.lane}\t${task.status}\t${task.title}`);
  return 0;
}

function runTaskList(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "task-list" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listTasks(state, { projectId: command.projectId, status: command.status }).forEach((task) => {
    console.log(
      `${task.id}\t${task.projectId}\t${task.lane}\t${task.status}\t${task.assigneeId ?? "-"}\t${task.title}`
    );
  });
  return 0;
}

function runTaskAssign(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "task-assign" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const task = assignTask(config, root, state, { taskId: command.taskId, agentId: command.agentId });
  saveRuntimeState(config, root, state);
  console.log(`${task.id}\t${task.status}\t${task.assigneeId ?? "-"}\t${task.title}`);
  return 0;
}

function runTaskAutoAssign(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "task-autoassign" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = autoAssignTask(config, root, state, command.taskId);
  saveRuntimeState(config, root, state);
  console.log(
    `${result.task.id}\t${result.task.status}\t${result.agentId ?? "-"}\t${result.error ?? "-"}\t${result.task.title}`
  );
  return result.error ? 1 : 0;
}

function runTaskStatus(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "task-status" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const task = updateTaskStatus(state, { taskId: command.taskId, status: command.status });
  saveRuntimeState(config, root, state);
  console.log(`${task.id}\t${task.status}\t${task.assigneeId ?? "-"}\t${task.title}`);
  return 0;
}

function runTaskHandoff(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "task-handoff" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = handoffTask(config, root, state, { taskId: command.taskId, lane: command.lane });
  saveRuntimeState(config, root, state);
  console.log(
    `${result.task.id}\t${result.task.lane}\t${result.task.status}\t${result.agentId ?? "-"}\t${result.error ?? "-"}`
  );
  return result.error ? 1 : 0;
}

function runTaskWork(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "task-work" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = runTaskWorkTurn(config, root, state, { taskId: command.taskId });
  saveRuntimeState(config, root, state);
  console.log(
    `${result.task.id}\t${result.task.status}\t${result.task.assigneeId ?? "-"}\tthread=${result.threadId}\tmessage=${result.message.id}\tartifacts=${result.task.artifactPaths.length}`
  );
  return 0;
}

function runTaskSync(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "task-sync" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = syncTaskToProvider(config, root, state, {
    provider: command.provider,
    taskId: command.taskId
  });
  saveRuntimeState(config, root, state);
  console.log(
    `${result.task.id}\t${result.ref.provider}\t${result.ref.externalKey ?? "-"}\t${result.ref.url ?? "-"}`
  );
  return 0;
}

function runThreadCreate(root: string, configPath: string, title: string): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const thread = createThread(state, { title });
  saveRuntimeState(config, root, state);
  console.log(`${thread.id}\t${thread.title}`);
  return 0;
}

function runThreadList(root: string, configPath: string): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listThreads(state).forEach((thread) => {
    console.log(`${thread.id}\t${thread.title}\tmessages=${thread.messageIds.length}\ttasks=${thread.taskIds.length}`);
  });
  return 0;
}

function runThreadShow(root: string, configPath: string, threadId: string): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const detail = getThreadDetail(state, threadId);
  console.log(`thread\t${detail.thread.id}\t${detail.thread.title}`);
  detail.messages.forEach((message) => {
    console.log(`message\t${message.id}\t${message.role}\t${message.body}`);
  });
  detail.tasks.forEach((task) => {
    console.log(`task\t${task.id}\t${task.status}\t${task.assigneeId ?? "-"}\t${task.title}`);
  });
  return 0;
}

function runThreadContinue(root: string, configPath: string, threadId: string): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = continueThread(config, root, state, { threadId });
  saveRuntimeState(config, root, state);
  console.log(
    `${result.threadId}\ttask=${result.taskId ?? "-"}\taction=${result.action}\tmessage=${result.message?.id ?? "-"}\tnotes=${result.notes.join(" | ")}`
  );
  return 0;
}

function runThreadAsk(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "thread-ask" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = respondToThread(config, root, state, { threadId: command.threadId, body: command.body });
  saveRuntimeState(config, root, state);
  console.log(
    `${result.threadId}\tuser=${result.userMessage.id}\tresponse=${result.responseMessage.id}\t${result.responseMessage.body.replace(/\n/g, " | ")}`
  );
  return 0;
}

function runMemoryList(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "memory-list" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listMemories(state, {
    projectId: command.projectId,
    threadId: command.threadId,
    taskId: command.taskId,
    query: command.query
  }).forEach((memory) => {
    console.log(
      `${memory.id}\t${memory.scope}\t${memory.kind}\t${memory.projectId ?? "-"}\t${memory.threadId ?? "-"}\t${memory.taskId ?? "-"}\t${memory.body}`
    );
  });
  return 0;
}

function runMemoryRecommend(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "memory-recommend" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  recommendMemories(state, {
    projectId: command.projectId,
    threadId: command.threadId,
    taskId: command.taskId,
    query: command.query
  }).forEach((memory) => {
    console.log(
      `${memory.id}\tscore=${memory.score}\t${memory.scope}\t${memory.kind}\t${memory.projectId ?? "-"}\t${memory.threadId ?? "-"}\t${memory.taskId ?? "-"}\t${memory.body}`
    );
  });
  return 0;
}

function runTaskRecommend(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "task-recommend" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  recommendTasks(state, {
    projectId: command.projectId,
    threadId: command.threadId,
    taskId: command.taskId,
    query: command.query
  }).forEach((task) => {
    console.log(
      `${task.id}\tscore=${task.score}\t${task.projectId}\t${task.lane}\t${task.status}\t${task.assigneeId ?? "-"}\t${task.title}`
    );
  });
  return 0;
}

function runConsultationList(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "consult-list" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listConsultations(state, {
    taskId: command.taskId,
    threadId: command.threadId,
    status: command.status
  }).forEach((consultation) => {
    console.log(
      `${consultation.id}\t${consultation.taskId}\t${consultation.toAgentId}\t${consultation.status}\t${consultation.reason}`
    );
  });
  return 0;
}

function runConsultationRequest(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "consult-request" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = requestConsultation(config, state, {
    taskId: command.taskId,
    toAgentId: command.agentId,
    reason: command.reason,
    instructions: command.instructions
  });
  saveRuntimeState(config, root, state);
  console.log(`${result.consultation.id}\t${result.task.id}\t${result.consultation.toAgentId}\t${result.consultation.status}`);
  return 0;
}

function runConsultationResolve(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "consult-resolve" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = resolveConsultation(config, state, {
    consultationId: command.consultationId,
    response: command.response
  });
  saveRuntimeState(config, root, state);
  console.log(`${result.consultation.id}\t${result.task.id}\t${result.consultation.status}\t${result.consultation.response ?? ""}`);
  return 0;
}

function runReviewList(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "review-list" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listReviews(state, {
    taskId: command.taskId,
    threadId: command.threadId,
    status: command.status
  }).forEach((review) => {
    console.log(
      `${review.id}\t${review.taskId}\t${review.reviewerAgentId}\t${review.status}\t${review.reason}`
    );
  });
  return 0;
}

function runReviewRequest(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "review-request" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = requestTaskReview(config, state, {
    taskId: command.taskId,
    reviewerAgentId: command.reviewerId,
    reason: command.reason
  });
  saveRuntimeState(config, root, state);
  console.log(`${result.review.id}\t${result.task.id}\t${result.review.reviewerAgentId}\t${result.review.status}`);
  return 0;
}

function runReviewComplete(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "review-complete" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = completeTaskReview(config, state, {
    reviewId: command.reviewId,
    outcome: command.outcome,
    notes: command.notes
  });
  saveRuntimeState(config, root, state);
  console.log(`${result.review.id}\t${result.task.id}\t${result.review.status}\t${result.task.status}`);
  return 0;
}

function runApprovalList(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "approval-list" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listApprovals(state, {
    taskId: command.taskId,
    threadId: command.threadId,
    status: command.status
  }).forEach((approval) => {
    console.log(
      `${approval.id}\t${approval.taskId ?? "-"}\t${approval.action}\t${approval.status}\t${approval.reason}`
    );
  });
  return 0;
}

function runApprovalRequest(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "approval-request" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = requestApproval(config, state, {
    action: command.action,
    reason: command.reason,
    taskId: command.taskId,
    requestedBy: command.actorId
  });
  saveRuntimeState(config, root, state);
  console.log(`${result.approval.id}\t${result.approval.action}\t${result.approval.status}\t${result.approval.taskId ?? "-"}`);
  return 0;
}

function runApprovalDecide(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "approval-decide" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = decideApproval(config, state, {
    approvalId: command.approvalId,
    decision: command.decision,
    actorId: command.actorId,
    notes: command.notes
  });
  saveRuntimeState(config, root, state);
  console.log(`${result.approval.id}\t${result.approval.status}\t${result.task?.status ?? "-"}`);
  return 0;
}

function runSyncList(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "sync-list" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listSyncRecords(state, {
    provider: command.provider,
    projectId: command.projectId,
    status: command.status
  }).forEach((record) => {
    console.log(`${record.id}\t${record.provider}\t${record.mode}\t${record.status}\t${record.projectId ?? "-"}\t${record.taskId ?? "-"}`);
  });
  return 0;
}

function runSyncPush(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "sync-push" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const record = pushRuntimeToProvider(config, root, state, {
    provider: command.provider,
    reason: command.reason
  });
  saveRuntimeState(config, root, state);
  console.log(`${record.id}\t${record.provider}\t${record.status}\t${record.reason}`);
  return 0;
}

function runSyncRetry(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "sync-retry" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const record = retrySync(config, root, state, {
    provider: command.provider,
    projectId: command.projectId,
    taskId: command.taskId,
    reason: command.reason
  });
  saveRuntimeState(config, root, state);
  console.log(`${record.id}\t${record.provider}\t${record.status}\t${record.projectId ?? "-"}\t${record.taskId ?? "-"}`);
  return 0;
}

function runSessionList(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "session-list" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listSessions(state, {
    actorId: command.actorId,
    activeOnly: command.activeOnly
  }).forEach((session) => {
    console.log(
      `${session.id}\t${session.actorId}\t${session.role}\t${session.label ?? "-"}\tactive=${session.revokedAt === null}\t${session.lastSeenAt}`
    );
  });
  return 0;
}

function runSessionCreate(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "session-create" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const session = createSession(config, state, {
    actorId: command.actorId,
    label: command.label
  });
  saveRuntimeState(config, root, state);
  console.log(`${session.id}\t${session.actorId}\t${session.role}\t${session.token}`);
  return 0;
}

function runSessionRevoke(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "session-revoke" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const session = revokeSession(state, {
    sessionId: command.sessionId
  });
  saveRuntimeState(config, root, state);
  console.log(`${session.id}\trevoked=${session.revokedAt ?? "-"}`);
  return 0;
}

function runConnectorIngest(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "connector-ingest" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = ingestConnectorMessage(config, root, state, {
    provider: command.provider,
    body: command.body,
    senderId: command.senderId,
    senderName: command.senderName,
    threadId: command.threadId,
    title: command.title
  });
  saveRuntimeState(config, root, state);
  console.log(
    `${result.provider}\t${result.mode}\tthread=${result.threadId}\ttask=${result.taskId ?? "-"}\tmessage=${result.messageId}`
  );
  return 0;
}

function runEventList(root: string, configPath: string, limit?: number): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listEvents(state, limit ?? 20).forEach((event) => {
    console.log(`${event.id}\t${event.type}\t${event.entityType}\t${event.entityId}\t${event.timestamp}`);
  });
  return 0;
}

function runMessageSend(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "message-send" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const routing = resolveRoutingPolicy(config);
  const message = addMessage(state, {
    threadId: command.threadId,
    role: command.role,
    body: command.body
  }, routing);
  saveRuntimeState(config, root, state);
  console.log(`${message.id}\t${message.threadId}\t${message.role}\t${message.suggestedLane ?? "-"}\t${message.body}`);
  return 0;
}

function runMessageList(root: string, configPath: string, threadId?: string): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  listMessages(state, threadId).forEach((message) => {
    console.log(
      `${message.id}\t${message.threadId}\t${message.role}\t${message.routedProjectId ?? "-"}\t${message.suggestedLane ?? "-"}\t${message.body}`
    );
  });
  return 0;
}

function runMessagePromote(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "message-promote" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const routing = resolveRoutingPolicy(config);
  const task = promoteMessageToTask(state, {
    messageId: command.messageId,
    projectId: command.projectId,
    lane: command.lane,
    title: command.title
  }, routing);
  saveRuntimeState(config, root, state);
  console.log(`${task.id}\t${task.projectId}\t${task.lane}\t${task.status}\t${task.title}`);
  return 0;
}

function runIntakeCreate(
  root: string,
  configPath: string,
  command: Extract<Command, { kind: "intake-create" }>
): number {
  const config = loadOrExit(configPath);
  const state = loadRuntimeState(config, root);
  const result = intakeRequest(config, root, state, {
    title: command.title,
    body: command.body,
    projectId: command.projectId,
    lane: command.lane
  });
  saveRuntimeState(config, root, state);
  console.log(
    [
      `thread=${result.thread.id}`,
      `message=${result.message.id}`,
      `task=${result.task.id}`,
      `project=${result.task.projectId}`,
      `lane=${result.task.lane}`,
      `assignee=${result.assignedAgentId ?? "-"}`,
      `assignment_error=${result.assignmentError ?? "-"}`
    ].join("\t")
  );
  return 0;
}

function helpText(): string {
  return [
    "Usage:",
    "  comphony [--config company.yaml] init [--force]",
    "  comphony [--config company.yaml] validate",
    "  comphony [--config company.yaml] server start",
    "  comphony [--config company.yaml] project list",
    "  comphony [--config company.yaml] project overview",
    "  comphony [--config company.yaml] project create --id <project-id> --name <name> --lanes <comma-separated> [--purpose <text>] [--repo-slug <slug>]",
    "  comphony [--config company.yaml] agent list [--project <project-id>]",
    "  comphony [--config company.yaml] agent catalog",
    "  comphony [--config company.yaml] people list",
    "  comphony [--config company.yaml] agent install --source-kind local_package|registry_package --ref <path> [--trust trusted|restricted|quarantined]",
    "  comphony [--config company.yaml] agent assign-project --agent <agent-id> --project <project-id>",
    "  comphony [--config company.yaml] task create --project <project-id> --title <title> [--description <text>] [--lane <lane>]",
    "  comphony [--config company.yaml] task list [--project <project-id>] [--status <status>]",
    "  comphony [--config company.yaml] task assign --task <task-id> --agent <agent-id>",
    "  comphony [--config company.yaml] task autoassign --task <task-id>",
    "  comphony [--config company.yaml] task status --task <task-id> --status <status>",
    "  comphony [--config company.yaml] task handoff --task <task-id> --lane <lane>",
    "  comphony [--config company.yaml] task work --task <task-id>",
    "  comphony [--config company.yaml] task sync --task <task-id> --provider <provider>",
    "  comphony [--config company.yaml] task recommend [--project <project-id>] [--thread <thread-id>] [--task <task-id>] [--query <text>]",
    "  comphony [--config company.yaml] consult list [--task <task-id>] [--thread <thread-id>] [--status <status>]",
    "  comphony [--config company.yaml] consult request --task <task-id> --agent <agent-id> --reason <text> [--instructions <text>]",
    "  comphony [--config company.yaml] consult resolve --consultation <consultation-id> --response <text>",
    "  comphony [--config company.yaml] review list [--task <task-id>] [--thread <thread-id>] [--status <status>]",
    "  comphony [--config company.yaml] review request --task <task-id> --reviewer <agent-id> --reason <text>",
    "  comphony [--config company.yaml] review complete --review <review-id> --outcome approved|changes_requested [--notes <text>]",
    "  comphony [--config company.yaml] approval list [--task <task-id>] [--thread <thread-id>] [--status <status>]",
    "  comphony [--config company.yaml] approval request --action <action> --reason <text> [--task <task-id>] [--actor <actor-id>]",
    "  comphony [--config company.yaml] approval decide --approval <approval-id> --decision granted|denied [--actor <actor-id>] [--notes <text>]",
    "  comphony [--config company.yaml] sync list [--provider <provider>] [--project <project-id>] [--status <status>]",
    "  comphony [--config company.yaml] sync push --provider <provider> [--reason <text>]",
    "  comphony [--config company.yaml] sync retry --provider <provider> [--project <project-id>] [--task <task-id>] [--reason <text>]",
    "  comphony [--config company.yaml] session list [--actor <actor-id>] [--active-only]",
    "  comphony [--config company.yaml] session create --actor <actor-id> [--label <text>]",
    "  comphony [--config company.yaml] session revoke --session <session-id>",
    "  comphony [--config company.yaml] connector ingest --provider telegram|discord|slack --sender-id <id> --body <text> [--sender-name <name>] [--thread <thread-id>] [--title <text>]",
    "  comphony [--config company.yaml] thread create --title <title>",
    "  comphony [--config company.yaml] thread list",
    "  comphony [--config company.yaml] thread show --thread <thread-id>",
    "  comphony [--config company.yaml] thread continue --thread <thread-id>",
    "  comphony [--config company.yaml] thread ask --thread <thread-id> --body <text>",
    "  comphony [--config company.yaml] memory list [--project <project-id>] [--thread <thread-id>] [--task <task-id>] [--query <text>]",
    "  comphony [--config company.yaml] memory recommend [--project <project-id>] [--thread <thread-id>] [--task <task-id>] [--query <text>]",
    "  comphony [--config company.yaml] event list [--limit <n>]",
    "  comphony [--config company.yaml] message send --thread <thread-id> --body <text> [--role user|agent|system]",
    "  comphony [--config company.yaml] message list [--thread <thread-id>]",
    "  comphony [--config company.yaml] message promote --message <message-id> [--project <project-id>] [--lane <lane>] [--title <title>]",
    "  comphony [--config company.yaml] intake create --title <title> --body <text> [--project <project-id>] [--lane <lane>]"
  ].join("\n");
}

function loadOrExit(configPath: string) {
  try {
    return loadCompanyConfig(configPath);
  } catch (error) {
    if (error instanceof ConfigError || error instanceof Error) {
      throw new Error(`Config error: ${error.message}`);
    }
    throw error;
  }
}

process.exitCode = main();
