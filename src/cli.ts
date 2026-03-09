import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ConfigError, loadCompanyConfig, resolveRoutingPolicy, validateCompanyConfig } from "./config.js";
import { startServer } from "./server.js";
import {
  addMessage,
  assignTask,
  assignAgentToProject,
  autoAssignTask,
  completeTaskReview,
  continueThread,
  createProject,
  createThread,
  createTask,
  decideApproval,
  getThreadDetail,
  handoffTask,
  intakeRequest,
  listApprovals,
  listConsultations,
  listMemories,
  listPeopleOverview,
  listProjectOverview,
  listReviews,
  listSyncRecords,
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
  resolveConsultation,
  retrySync,
  runTaskWorkTurn,
  saveRuntimeState,
  installAgentPackage,
  syncTaskToProvider,
  updateTaskStatus
} from "./state.js";
import { DEFAULT_COMPANY_YAML } from "./templates.js";

type Command =
  | { kind: "init"; force: boolean }
  | { kind: "validate" }
  | { kind: "server-start" }
  | { kind: "project-list" }
  | { kind: "project-overview" }
  | { kind: "project-create"; projectId: string; name: string; purpose?: string; lanes: string[]; repoSlug?: string }
  | { kind: "agent-list"; projectId?: string }
  | { kind: "people-list" }
  | { kind: "agent-install"; sourceKind: "local_package" | "registry_package"; ref: string; trustState?: "trusted" | "restricted" | "quarantined" }
  | { kind: "agent-assign-project"; agentId: string; projectId: string }
  | { kind: "task-create"; projectId: string; title: string; description: string; lane: string }
  | { kind: "task-list"; projectId?: string; status?: string }
  | { kind: "task-assign"; taskId: string; agentId: string }
  | { kind: "task-autoassign"; taskId: string }
  | { kind: "task-status"; taskId: string; status: string }
  | { kind: "task-handoff"; taskId: string; lane: string }
  | { kind: "task-work"; taskId: string }
  | { kind: "task-sync"; taskId: string; provider: string }
  | { kind: "task-recommend"; projectId?: string; threadId?: string; taskId?: string; query?: string }
  | { kind: "consult-list"; taskId?: string; threadId?: string; status?: string }
  | { kind: "consult-request"; taskId: string; agentId: string; reason: string; instructions?: string }
  | { kind: "consult-resolve"; consultationId: string; response: string }
  | { kind: "review-list"; taskId?: string; threadId?: string; status?: string }
  | { kind: "review-request"; taskId: string; reviewerId: string; reason: string }
  | { kind: "review-complete"; reviewId: string; outcome: "approved" | "changes_requested"; notes?: string }
  | { kind: "approval-list"; taskId?: string; threadId?: string; status?: string }
  | { kind: "approval-request"; action: string; reason: string; taskId?: string; actorId?: string }
  | { kind: "approval-decide"; approvalId: string; decision: "granted" | "denied"; actorId?: string; notes?: string }
  | { kind: "sync-list"; provider?: string; projectId?: string; status?: string }
  | { kind: "sync-retry"; provider: string; projectId?: string; taskId?: string; reason?: string }
  | { kind: "thread-create"; title: string }
  | { kind: "thread-list" }
  | { kind: "thread-show"; threadId: string }
  | { kind: "thread-continue"; threadId: string }
  | { kind: "thread-ask"; threadId: string; body: string }
  | { kind: "memory-list"; projectId?: string; threadId?: string; taskId?: string; query?: string }
  | { kind: "memory-recommend"; projectId?: string; threadId?: string; taskId?: string; query?: string }
  | { kind: "event-list"; limit?: number }
  | { kind: "message-send"; threadId: string; role: "user" | "agent" | "system"; body: string }
  | { kind: "message-list"; threadId?: string }
  | { kind: "message-promote"; messageId: string; projectId?: string; lane?: string; title?: string }
  | { kind: "intake-create"; title: string; body: string; projectId?: string; lane?: string };

type ParsedArgs = {
  configPath: string;
  command: Command;
};

export function main(argv = process.argv.slice(2)): number {
  try {
    const parsed = parseArgs(argv);
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
      case "sync-retry":
        return runSyncRetry(root, configPath, parsed.command);
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

function parseArgs(argv: string[]): ParsedArgs {
  let configPath = "company.yaml";
  let index = 0;

  while (index < argv.length && argv[index]?.startsWith("--")) {
    const current = argv[index];
    if (current === "--config") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value after --config");
      }
      configPath = value;
      index += 2;
      continue;
    }
    if (current === "--help" || current === "-h") {
      throw new Error(helpText());
    }
    break;
  }

  const command = argv[index];
  if (!command) {
    throw new Error(helpText());
  }

  if (command === "init") {
    const force = argv.includes("--force");
    return { configPath, command: { kind: "init", force } };
  }
  if (command === "validate") {
    return { configPath, command: { kind: "validate" } };
  }
  if (command === "server" && argv[index + 1] === "start") {
    return { configPath, command: { kind: "server-start" } };
  }
  if (command === "project" && argv[index + 1] === "list") {
    return { configPath, command: { kind: "project-list" } };
  }
  if (command === "project" && argv[index + 1] === "overview") {
    return { configPath, command: { kind: "project-overview" } };
  }
  if (command === "project" && argv[index + 1] === "create") {
    const args = argv.slice(index + 2);
    const rawLanes = requireOptionValue(args, "--lanes");
    return {
      configPath,
      command: {
        kind: "project-create",
        projectId: requireOptionValue(args, "--id"),
        name: requireOptionValue(args, "--name"),
        purpose: getOptionValue(args, "--purpose"),
        lanes: rawLanes.split(",").map((lane) => lane.trim()).filter(Boolean),
        repoSlug: getOptionValue(args, "--repo-slug")
      }
    };
  }
  if (command === "agent" && argv[index + 1] === "list") {
    return {
      configPath,
      command: {
        kind: "agent-list",
        projectId: getOptionValue(argv.slice(index + 2), "--project")
      }
    };
  }
  if (command === "people" && argv[index + 1] === "list") {
    return { configPath, command: { kind: "people-list" } };
  }
  if (command === "agent" && argv[index + 1] === "install") {
    const args = argv.slice(index + 2);
    const sourceKind = requireOptionValue(args, "--source-kind");
    if (!["local_package", "registry_package"].includes(sourceKind)) {
      throw new Error("agent install --source-kind must be local_package or registry_package");
    }
    return {
      configPath,
      command: {
        kind: "agent-install",
        sourceKind: sourceKind as "local_package" | "registry_package",
        ref: requireOptionValue(args, "--ref"),
        trustState: getOptionValue(args, "--trust") as "trusted" | "restricted" | "quarantined" | undefined
      }
    };
  }
  if (command === "agent" && argv[index + 1] === "assign-project") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "agent-assign-project",
        agentId: requireOptionValue(args, "--agent"),
        projectId: requireOptionValue(args, "--project")
      }
    };
  }
  if (command === "task" && argv[index + 1] === "create") {
    const args = argv.slice(index + 2);
    const projectId = requireOptionValue(args, "--project");
    const title = requireOptionValue(args, "--title");
    const description = getOptionValue(args, "--description") ?? "";
    const lane = getOptionValue(args, "--lane") ?? "build";
    return {
      configPath,
      command: { kind: "task-create", projectId, title, description, lane }
    };
  }
  if (command === "task" && argv[index + 1] === "list") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "task-list",
        projectId: getOptionValue(args, "--project"),
        status: getOptionValue(args, "--status")
      }
    };
  }
  if (command === "task" && argv[index + 1] === "assign") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "task-assign",
        taskId: requireOptionValue(args, "--task"),
        agentId: requireOptionValue(args, "--agent")
      }
    };
  }
  if (command === "task" && argv[index + 1] === "autoassign") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "task-autoassign",
        taskId: requireOptionValue(args, "--task")
      }
    };
  }
  if (command === "task" && argv[index + 1] === "status") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "task-status",
        taskId: requireOptionValue(args, "--task"),
        status: requireOptionValue(args, "--status")
      }
    };
  }
  if (command === "task" && argv[index + 1] === "handoff") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "task-handoff",
        taskId: requireOptionValue(args, "--task"),
        lane: requireOptionValue(args, "--lane")
      }
    };
  }
  if (command === "task" && argv[index + 1] === "work") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "task-work",
        taskId: requireOptionValue(args, "--task")
      }
    };
  }
  if (command === "task" && argv[index + 1] === "sync") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "task-sync",
        taskId: requireOptionValue(args, "--task"),
        provider: requireOptionValue(args, "--provider")
      }
    };
  }
  if (command === "task" && argv[index + 1] === "recommend") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "task-recommend",
        projectId: getOptionValue(args, "--project"),
        threadId: getOptionValue(args, "--thread"),
        taskId: getOptionValue(args, "--task"),
        query: getOptionValue(args, "--query")
      }
    };
  }
  if (command === "consult" && argv[index + 1] === "list") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "consult-list",
        taskId: getOptionValue(args, "--task"),
        threadId: getOptionValue(args, "--thread"),
        status: getOptionValue(args, "--status")
      }
    };
  }
  if (command === "consult" && argv[index + 1] === "request") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "consult-request",
        taskId: requireOptionValue(args, "--task"),
        agentId: requireOptionValue(args, "--agent"),
        reason: requireOptionValue(args, "--reason"),
        instructions: getOptionValue(args, "--instructions")
      }
    };
  }
  if (command === "consult" && argv[index + 1] === "resolve") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "consult-resolve",
        consultationId: requireOptionValue(args, "--consultation"),
        response: requireOptionValue(args, "--response")
      }
    };
  }
  if (command === "review" && argv[index + 1] === "list") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "review-list",
        taskId: getOptionValue(args, "--task"),
        threadId: getOptionValue(args, "--thread"),
        status: getOptionValue(args, "--status")
      }
    };
  }
  if (command === "review" && argv[index + 1] === "request") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "review-request",
        taskId: requireOptionValue(args, "--task"),
        reviewerId: requireOptionValue(args, "--reviewer"),
        reason: requireOptionValue(args, "--reason")
      }
    };
  }
  if (command === "review" && argv[index + 1] === "complete") {
    const args = argv.slice(index + 2);
    const outcome = requireOptionValue(args, "--outcome");
    if (!["approved", "changes_requested"].includes(outcome)) {
      throw new Error("review complete --outcome must be approved or changes_requested");
    }
    return {
      configPath,
      command: {
        kind: "review-complete",
        reviewId: requireOptionValue(args, "--review"),
        outcome: outcome as "approved" | "changes_requested",
        notes: getOptionValue(args, "--notes")
      }
    };
  }
  if (command === "approval" && argv[index + 1] === "list") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "approval-list",
        taskId: getOptionValue(args, "--task"),
        threadId: getOptionValue(args, "--thread"),
        status: getOptionValue(args, "--status")
      }
    };
  }
  if (command === "approval" && argv[index + 1] === "request") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "approval-request",
        action: requireOptionValue(args, "--action"),
        reason: requireOptionValue(args, "--reason"),
        taskId: getOptionValue(args, "--task"),
        actorId: getOptionValue(args, "--actor")
      }
    };
  }
  if (command === "approval" && argv[index + 1] === "decide") {
    const args = argv.slice(index + 2);
    const decision = requireOptionValue(args, "--decision");
    if (!["granted", "denied"].includes(decision)) {
      throw new Error("approval decide --decision must be granted or denied");
    }
    return {
      configPath,
      command: {
        kind: "approval-decide",
        approvalId: requireOptionValue(args, "--approval"),
        decision: decision as "granted" | "denied",
        actorId: getOptionValue(args, "--actor"),
        notes: getOptionValue(args, "--notes")
      }
    };
  }
  if (command === "sync" && argv[index + 1] === "list") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "sync-list",
        provider: getOptionValue(args, "--provider"),
        projectId: getOptionValue(args, "--project"),
        status: getOptionValue(args, "--status")
      }
    };
  }
  if (command === "sync" && argv[index + 1] === "retry") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "sync-retry",
        provider: requireOptionValue(args, "--provider"),
        projectId: getOptionValue(args, "--project"),
        taskId: getOptionValue(args, "--task"),
        reason: getOptionValue(args, "--reason")
      }
    };
  }
  if (command === "thread" && argv[index + 1] === "create") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "thread-create",
        title: requireOptionValue(args, "--title")
      }
    };
  }
  if (command === "thread" && argv[index + 1] === "list") {
    return { configPath, command: { kind: "thread-list" } };
  }
  if (command === "thread" && argv[index + 1] === "show") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "thread-show",
        threadId: requireOptionValue(args, "--thread")
      }
    };
  }
  if (command === "thread" && argv[index + 1] === "continue") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "thread-continue",
        threadId: requireOptionValue(args, "--thread")
      }
    };
  }
  if (command === "thread" && argv[index + 1] === "ask") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "thread-ask",
        threadId: requireOptionValue(args, "--thread"),
        body: requireOptionValue(args, "--body")
      }
    };
  }
  if (command === "memory" && argv[index + 1] === "list") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "memory-list",
        projectId: getOptionValue(args, "--project"),
        threadId: getOptionValue(args, "--thread"),
        taskId: getOptionValue(args, "--task"),
        query: getOptionValue(args, "--query")
      }
    };
  }
  if (command === "memory" && argv[index + 1] === "recommend") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "memory-recommend",
        projectId: getOptionValue(args, "--project"),
        threadId: getOptionValue(args, "--thread"),
        taskId: getOptionValue(args, "--task"),
        query: getOptionValue(args, "--query")
      }
    };
  }
  if (command === "event" && argv[index + 1] === "list") {
    const args = argv.slice(index + 2);
    const rawLimit = getOptionValue(args, "--limit");
    return {
      configPath,
      command: {
        kind: "event-list",
        limit: rawLimit ? Number(rawLimit) : undefined
      }
    };
  }
  if (command === "message" && argv[index + 1] === "send") {
    const args = argv.slice(index + 2);
    const roleValue = getOptionValue(args, "--role") ?? "user";
    if (!["user", "agent", "system"].includes(roleValue)) {
      throw new Error("message send --role must be one of: user, agent, system");
    }
    return {
      configPath,
      command: {
        kind: "message-send",
        threadId: requireOptionValue(args, "--thread"),
        role: roleValue as "user" | "agent" | "system",
        body: requireOptionValue(args, "--body")
      }
    };
  }
  if (command === "message" && argv[index + 1] === "list") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "message-list",
        threadId: getOptionValue(args, "--thread")
      }
    };
  }
  if (command === "message" && argv[index + 1] === "promote") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "message-promote",
        messageId: requireOptionValue(args, "--message"),
        projectId: getOptionValue(args, "--project"),
        lane: getOptionValue(args, "--lane"),
        title: getOptionValue(args, "--title")
      }
    };
  }
  if (command === "intake" && argv[index + 1] === "create") {
    const args = argv.slice(index + 2);
    return {
      configPath,
      command: {
        kind: "intake-create",
        title: requireOptionValue(args, "--title"),
        body: requireOptionValue(args, "--body"),
        projectId: getOptionValue(args, "--project"),
        lane: getOptionValue(args, "--lane")
      }
    };
  }

  throw new Error(helpText());
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
  const result = respondToThread(config, state, { threadId: command.threadId, body: command.body });
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
    "  comphony [--config company.yaml] sync retry --provider <provider> [--project <project-id>] [--task <task-id>] [--reason <text>]",
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

function getOptionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function requireOptionValue(args: string[], name: string): string {
  const value = getOptionValue(args, name);
  if (!value) {
    throw new Error(`Missing value after ${name}`);
  }
  return value;
}

process.exitCode = main();
