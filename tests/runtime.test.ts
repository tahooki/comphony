import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { loadCompanyConfig, validateCompanyConfig } from "../src/config.js";
import { resetLoadedEnvironmentForTests } from "../src/env.js";
import {
  addMessage,
  assignTask,
  assignAgentToProject,
  autoAssignTask,
  completeTaskReview,
  continueThread,
  createProject,
  createSession,
  createThread,
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
  listEvents,
  listMessages,
  listProjects,
  listTasks,
  loadRuntimeState,
  promoteMessageToTask,
  respondToThread,
  requestApproval,
  requestConsultation,
  requestTaskReview,
  retrySync,
  resolveConsultation,
  resolveSession,
  revokeSession,
  runTaskWorkTurn,
  installAgentPackage,
  syncTaskToProvider,
  updateTaskStatus
} from "../src/state.js";
import { DEFAULT_COMPANY_YAML } from "../src/templates.js";
import { renderWebAppHtml } from "../src/web.js";

const root = resolve(import.meta.dirname, "..");

test("repository company config validates", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const result = validateCompanyConfig(config, root);
  assert.deepEqual(result.errors, []);
});

test("loading company config also loads root .env values when missing", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-env-"));
  writeFileSync(resolve(tempRoot, ".env"), "SUPABASE_URL=https://example.supabase.co\nTEST_QUOTED='hello world'\n", "utf8");
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  const previousSupabaseUrl = process.env.SUPABASE_URL;
  const previousQuoted = process.env.TEST_QUOTED;
  delete process.env.SUPABASE_URL;
  delete process.env.TEST_QUOTED;
  resetLoadedEnvironmentForTests();

  try {
    loadCompanyConfig(resolve(tempRoot, "company.yaml"));
    assert.equal(process.env.SUPABASE_URL, "https://example.supabase.co");
    assert.equal(process.env.TEST_QUOTED, "hello world");
  } finally {
    resetLoadedEnvironmentForTests();
    if (previousSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = previousSupabaseUrl;
    }
    if (previousQuoted === undefined) {
      delete process.env.TEST_QUOTED;
    } else {
      process.env.TEST_QUOTED = previousQuoted;
    }
  }
});

test("company config exposes the expected runtime metadata", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  assert.equal((config.company as { name: string }).name, "Comphony");
  assert.equal((config.runtime as { mode: string }).mode, "local_first");
  assert.equal((config.projects as unknown[]).length, 1);
  assert.equal((config.agents as unknown[]).length, 4);
});

test("runtime state syncs projects and agents from config", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  assert.equal(listProjects(state).some((project) => project.id === "product_core"), true);
  assert.equal(listAgents(state).filter((agent) => agent.id === "design_planner_01").length >= 1, true);
});

test("task assignment to build agent requires design handoff artifacts", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-task-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "agents", "desk_coordinator", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "product_dev_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "design_planner_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "frontend_publisher_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  mkdirSync(resolve(tempRoot, "repos", "product-core"), { recursive: true });
  [
    "desk_coordinator",
    "product_dev_01",
    "design_planner_01",
    "frontend_publisher_01"
  ].forEach((agentId) => {
    writeFileSync(resolve(tempRoot, "agents", agentId, "agent.yaml"), "id: test\n", "utf8");
  });

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  const task = createTask(state, {
    projectId: "product_core",
    title: "Implement dashboard plan",
    description: "",
    lane: "build"
  });

  assert.throws(() => {
    assignTask(config, tempRoot, state, { taskId: task.id, agentId: "product_dev_01" });
  }, /Design handoff incomplete/);

  mkdirSync(resolve(tempRoot, "repos", "product-core", "design-system"), { recursive: true });
  mkdirSync(resolve(tempRoot, "repos", "product-core", "plans", "design"), { recursive: true });
  writeFileSync(resolve(tempRoot, "repos", "product-core", "design-system", "MASTER.md"), "# master", "utf8");
  writeFileSync(resolve(tempRoot, "repos", "product-core", "plans", "design", "design-plan.md"), "# plan", "utf8");
  writeFileSync(resolve(tempRoot, "repos", "product-core", "plans", "design", "dev-handoff.md"), "# handoff", "utf8");

  const assigned = assignTask(config, tempRoot, state, { taskId: task.id, agentId: "product_dev_01" });
  assert.equal(assigned.status, "assigned");
  assert.equal(assigned.assigneeId, "product_dev_01");
});

test("thread messages can be promoted into routed tasks", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const thread = createThread(state, { title: "User asks for a dashboard redesign" });
  const message = addMessage(state, {
    threadId: thread.id,
    role: "user",
    body: "Please design a cleaner dashboard UI for Product - Core with better UX and layout."
  });

  assert.equal(listMessages(state, thread.id).length >= 1, true);
  assert.equal(message.routedProjectId, "product_core");
  assert.equal(message.suggestedLane, "design");

  const task = promoteMessageToTask(state, { messageId: message.id });
  assert.equal(task.projectId, "product_core");
  assert.equal(task.lane, "design");
  assert.equal(thread.taskIds.includes(task.id), true);

  const detail = getThreadDetail(state, thread.id);
  assert.equal(detail.messages.length >= 1, true);
  assert.equal(detail.tasks.some((item) => item.id === task.id), true);
});

test("intake creates a thread, message, task, and auto-assigns design work", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const result = intakeRequest(config, root, state, {
    title: "Refresh Product - Core dashboard",
    body: "Please redesign the Product - Core dashboard UI and improve the UX."
  });

  assert.equal(result.task.projectId, "product_core");
  assert.equal(result.task.lane, "design");
  assert.equal(result.task.parentTaskId !== null, true);
  assert.equal(result.rootTaskId !== null, true);
  assert.equal(result.createdTaskIds.length >= 2, true);
  assert.equal(result.assignedAgentId, "design_planner_01");
  assert.equal(result.assignmentError, null);
  assert.equal(listEvents(state, 10).some((event) => event.type === "intake.completed"), true);
});

test("auto-assign and status updates emit expected task state", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const task = createTask(state, {
    projectId: "product_core",
    title: "Plan UI system",
    description: "Generate a design system starter.",
    lane: "design"
  });

  const result = autoAssignTask(config, root, state, task.id);
  assert.equal(result.agentId, "design_planner_01");
  assert.equal(result.error, null);

  const updated = updateTaskStatus(state, { taskId: task.id, status: "in_progress" });
  assert.equal(updated.status, "in_progress");
  assert.equal(listEvents(state, 10).some((event) => event.type === "task.status_updated"), true);
});

test("work turn adds an agent message and advances task state", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-work-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "agents", "desk_coordinator", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "product_dev_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "design_planner_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "frontend_publisher_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  [
    "desk_coordinator",
    "product_dev_01",
    "design_planner_01",
    "frontend_publisher_01"
  ].forEach((agentId) => {
    const sourceRoot = resolve(root, "agents", agentId);
    const targetRoot = resolve(tempRoot, "agents", agentId);
    writeFileSync(resolve(targetRoot, "agent.yaml"), readFileSync(resolve(sourceRoot, "agent.yaml"), "utf8"), "utf8");
    writeFileSync(resolve(targetRoot, "prompts", "system.md"), readFileSync(resolve(sourceRoot, "prompts", "system.md"), "utf8"), "utf8");
  });

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  const thread = createThread(state, { title: "Need a design work turn" });
  const message = addMessage(state, {
    threadId: thread.id,
    role: "user",
    body: "Please design a cleaner dashboard flow for Product - Core."
  });
  const task = promoteMessageToTask(state, { messageId: message.id });
  assignTask(config, tempRoot, state, { taskId: task.id, agentId: "design_planner_01" });

  const result = runTaskWorkTurn(config, tempRoot, state, { taskId: task.id });
  assert.equal(result.task.status, "in_progress");
  assert.equal(result.message.role, "agent");
  assert.equal(result.threadId, thread.id);
  assert.equal(result.task.artifactPaths.length, 3);
  assert.equal(readFileSync(resolve(tempRoot, "repos", "product-core", "design-system", "MASTER.md"), "utf8").includes("MASTER Design System"), true);
  assert.equal(getThreadDetail(state, thread.id).messages.some((item) => item.id === result.message.id), true);
  assert.equal(result.message.body.includes("Artifacts:"), true);
  assert.equal(listEvents(state, 10).some((event) => event.type === "task.artifacts_generated"), true);
  assert.equal(listEvents(state, 10).some((event) => event.type === "task.work_turn_completed"), true);
});

test("handoff moves a design task into build and auto-assigns the build agent", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-handoff-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "agents", "desk_coordinator", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "product_dev_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "design_planner_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "frontend_publisher_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  [
    "desk_coordinator",
    "product_dev_01",
    "design_planner_01",
    "frontend_publisher_01"
  ].forEach((agentId) => {
    const sourceRoot = resolve(root, "agents", agentId);
    const targetRoot = resolve(tempRoot, "agents", agentId);
    writeFileSync(resolve(targetRoot, "agent.yaml"), readFileSync(resolve(sourceRoot, "agent.yaml"), "utf8"), "utf8");
    writeFileSync(resolve(targetRoot, "prompts", "system.md"), readFileSync(resolve(sourceRoot, "prompts", "system.md"), "utf8"), "utf8");
  });

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  const thread = createThread(state, { title: "Need a full design to build handoff" });
  const message = addMessage(state, {
    threadId: thread.id,
    role: "user",
    body: "Please redesign the Product - Core dashboard UI and then implement it."
  });
  const task = promoteMessageToTask(state, { messageId: message.id, lane: "design" });
  assignTask(config, tempRoot, state, { taskId: task.id, agentId: "design_planner_01" });
  runTaskWorkTurn(config, tempRoot, state, { taskId: task.id });

  const handoff = handoffTask(config, tempRoot, state, { taskId: task.id, lane: "build" });
  assert.equal(handoff.task.lane, "build");
  assert.equal(handoff.agentId, "product_dev_01");
  assert.equal(handoff.error, null);
  assert.equal(handoff.message.role, "system");
  assert.equal(getThreadDetail(state, thread.id).messages.some((item) => item.body.includes("handed off")), true);
  assert.equal(listEvents(state, 10).some((event) => event.type === "task.handed_off"), true);
});

test("full pipeline accumulates design, build, and review artifacts", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-pipeline-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "agents", "desk_coordinator", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "product_dev_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "design_planner_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "frontend_publisher_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  [
    "desk_coordinator",
    "product_dev_01",
    "design_planner_01",
    "frontend_publisher_01"
  ].forEach((agentId) => {
    const sourceRoot = resolve(root, "agents", agentId);
    const targetRoot = resolve(tempRoot, "agents", agentId);
    writeFileSync(resolve(targetRoot, "agent.yaml"), readFileSync(resolve(sourceRoot, "agent.yaml"), "utf8"), "utf8");
    writeFileSync(resolve(targetRoot, "prompts", "system.md"), readFileSync(resolve(sourceRoot, "prompts", "system.md"), "utf8"), "utf8");
  });

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  const thread = createThread(state, { title: "Need a full multi-lane delivery" });
  const message = addMessage(state, {
    threadId: thread.id,
    role: "user",
    body: "Please redesign the Product - Core dashboard UI, implement it, and prepare it for review."
  });
  const task = promoteMessageToTask(state, { messageId: message.id, lane: "design" });

  assignTask(config, tempRoot, state, { taskId: task.id, agentId: "design_planner_01" });
  runTaskWorkTurn(config, tempRoot, state, { taskId: task.id });

  const buildHandoff = handoffTask(config, tempRoot, state, { taskId: task.id, lane: "build" });
  assert.equal(buildHandoff.agentId, "product_dev_01");
  runTaskWorkTurn(config, tempRoot, state, { taskId: task.id });

  const reviewHandoff = handoffTask(config, tempRoot, state, { taskId: task.id, lane: "review" });
  assert.equal(reviewHandoff.agentId, "frontend_publisher_01");
  const reviewTurn = runTaskWorkTurn(config, tempRoot, state, { taskId: task.id });
  assert.equal(reviewTurn.task.status, "review");

  const finalTurn = runTaskWorkTurn(config, tempRoot, state, { taskId: task.id });
  assert.equal(finalTurn.task.status, "done");
  assert.equal(finalTurn.task.artifactPaths.length >= 7, true);
  assert.equal(readFileSync(resolve(tempRoot, "repos", "product-core", "design-system", "MASTER.md"), "utf8").includes("MASTER Design System"), true);
  assert.equal(readFileSync(resolve(tempRoot, "workspaces", "product_core", task.id, "implementation-note.md"), "utf8").includes("Implementation Note"), true);
  assert.equal(readFileSync(resolve(tempRoot, "workspaces", "product_core", task.id, "visual-qa-report.md"), "utf8").includes("Visual QA Report"), true);
  assert.equal(getThreadDetail(state, thread.id).messages.some((item) => item.body.includes("assigned frontend_publisher_01")), true);
});

test("thread ask adds a user follow-up and a Comphony status reply", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  createTask(state, {
    projectId: "product_core",
    title: "Dashboard analytics refresh",
    description: "Improve analytics cards and dashboard UX",
    lane: "design"
  });
  const intake = intakeRequest(config, root, state, {
    title: "Need a status answer",
    body: "Please redesign the Product - Core dashboard UI and improve the UX."
  });

  const reply = respondToThread(config, state, {
    threadId: intake.thread.id,
    body: "What is the current status?"
  });

  assert.equal(reply.userMessage.role, "user");
  assert.equal(reply.responseMessage.role, "system");
  assert.equal(reply.responseMessage.body.includes("Current focus:"), true);
  assert.equal(reply.responseMessage.body.includes("Next step:"), true);
  assert.equal(reply.responseMessage.body.includes(intake.task.title), true);
  assert.equal(reply.responseMessage.body.includes("Related memory:"), true);
  assert.equal(reply.responseMessage.body.includes("Similar tasks:"), true);
  assert.equal(listMemories(state, { threadId: intake.thread.id }).length >= 2, true);
  assert.equal(listEvents(state, 10).some((event) => event.type === "thread.responded"), true);
});

test("thread ask can address a specific agent directly", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const intake = intakeRequest(config, root, state, {
    title: "Need direct agent answer",
    body: "Please redesign the Product - Core dashboard UI."
  });

  const reply = respondToThread(config, state, {
    threadId: intake.thread.id,
    body: "@design_planner_01 what are you doing now?"
  });

  assert.equal(reply.responseMessage.role, "agent");
  assert.equal(reply.responseMessage.targetAgentId, "design_planner_01");
  assert.equal(reply.responseMessage.body.toLowerCase().includes("design"), true);
});

test("thread continue can auto-run assignment, work, and review loop", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-continue-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "agents", "desk_coordinator", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "product_dev_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "design_planner_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "frontend_publisher_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  [
    "desk_coordinator",
    "product_dev_01",
    "design_planner_01",
    "frontend_publisher_01"
  ].forEach((agentId) => {
    const sourceRoot = resolve(root, "agents", agentId);
    const targetRoot = resolve(tempRoot, "agents", agentId);
    writeFileSync(resolve(targetRoot, "agent.yaml"), readFileSync(resolve(sourceRoot, "agent.yaml"), "utf8"), "utf8");
    writeFileSync(resolve(targetRoot, "prompts", "system.md"), readFileSync(resolve(sourceRoot, "prompts", "system.md"), "utf8"), "utf8");
  });

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  const intake = intakeRequest(config, tempRoot, state, {
    title: "Need autonomous delivery",
    body: "Please redesign the Product - Core dashboard UI and prepare it for review."
  });

  const first = continueThread(config, tempRoot, state, { threadId: intake.thread.id });
  const second = continueThread(config, tempRoot, state, { threadId: intake.thread.id });

  assert.equal(["worked", "review_requested", "review_completed"].includes(first.action), true);
  assert.equal(["worked", "review_requested", "review_completed"].includes(second.action), true);
  assert.equal(getThreadDetail(state, intake.thread.id).tasks.length >= 2, true);
});

test("memory recommendation ranks thread-related memories first", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const intake = intakeRequest(config, root, state, {
    title: "Need related memory",
    body: "Please redesign the Product - Core dashboard UI and improve the UX."
  });
  respondToThread(config, state, {
    threadId: intake.thread.id,
    body: "What is the current status?"
  });

  const recommendations = recommendMemories(state, {
    projectId: "product_core",
    threadId: intake.thread.id,
    taskId: intake.task.id,
    query: "current status dashboard ui",
    limit: 5
  });
  assert.equal(recommendations.length > 0, true);
  assert.equal(recommendations[0].threadId, intake.thread.id);
  assert.equal(recommendations[0].score > 0, true);
});

test("task recommendation finds similar tasks in the same project", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const primary = createTask(state, {
    projectId: "product_core",
    title: "Redesign dashboard navigation",
    description: "Improve dashboard navigation and UI structure",
    lane: "design"
  });
  createTask(state, {
    projectId: "product_core",
    title: "Dashboard UX refresh",
    description: "Refresh the Product - Core dashboard UI and UX layout",
    lane: "design"
  });
  createTask(state, {
    projectId: "product_core",
    title: "Prepare release notes",
    description: "Document release details for the current sprint",
    lane: "planning"
  });

  const recommendations = recommendTasks(state, {
    projectId: "product_core",
    taskId: primary.id,
    query: "dashboard ui ux",
    limit: 5
  });

  assert.equal(recommendations.length > 0, true);
  assert.equal(recommendations[0].title.includes("Dashboard"), true);
  assert.equal(recommendations.some((task) => task.id === primary.id), false);
});

test("consultation request and resolve move the task through consulting back to in_progress", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const thread = createThread(state, { title: "Consultation thread" });
  const task = createTask(state, {
    projectId: "product_core",
    title: "Need design consultation",
    description: "Ask another agent for help",
    lane: "design"
  });
  thread.taskIds.push(task.id);
  assignTask(config, root, state, { taskId: task.id, agentId: "design_planner_01" });

  const requested = requestConsultation(config, state, {
    taskId: task.id,
    toAgentId: "desk_coordinator",
    reason: "Need scope clarification"
  });
  assert.equal(requested.task.status, "consulting");
  assert.equal(listConsultations(state, { taskId: task.id }).length, 1);

  const resolved = resolveConsultation(config, state, {
    consultationId: requested.consultation.id,
    response: "Clarified scope and constraints."
  });
  assert.equal(resolved.task.status, "in_progress");
  assert.equal(resolved.consultation.response, "Clarified scope and constraints.");
});

test("review request and completion update the task state", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-review-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "agents", "desk_coordinator", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "product_dev_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "design_planner_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "frontend_publisher_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  [
    "desk_coordinator",
    "product_dev_01",
    "design_planner_01",
    "frontend_publisher_01"
  ].forEach((agentId) => {
    const sourceRoot = resolve(root, "agents", agentId);
    const targetRoot = resolve(tempRoot, "agents", agentId);
    writeFileSync(resolve(targetRoot, "agent.yaml"), readFileSync(resolve(sourceRoot, "agent.yaml"), "utf8"), "utf8");
    writeFileSync(resolve(targetRoot, "prompts", "system.md"), readFileSync(resolve(sourceRoot, "prompts", "system.md"), "utf8"), "utf8");
  });

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  const thread = createThread(state, { title: "Review thread" });
  const task = createTask(state, {
    projectId: "product_core",
    title: "Ready for review",
    description: "Review this build output",
    lane: "build"
  });
  thread.taskIds.push(task.id);
  mkdirSync(resolve(tempRoot, "repos", "product-core", "design-system"), { recursive: true });
  mkdirSync(resolve(tempRoot, "repos", "product-core", "plans", "design"), { recursive: true });
  writeFileSync(resolve(tempRoot, "repos", "product-core", "design-system", "MASTER.md"), "# master", "utf8");
  writeFileSync(resolve(tempRoot, "repos", "product-core", "plans", "design", "design-plan.md"), "# plan", "utf8");
  writeFileSync(resolve(tempRoot, "repos", "product-core", "plans", "design", "dev-handoff.md"), "# handoff", "utf8");
  assignTask(config, tempRoot, state, { taskId: task.id, agentId: "product_dev_01" });

  const requested = requestTaskReview(config, state, {
    taskId: task.id,
    reviewerAgentId: "frontend_publisher_01",
    reason: "Please inspect before reporting back."
  });
  assert.equal(requested.task.status, "review_requested");
  assert.equal(listReviews(state, { taskId: task.id }).length, 1);

  const completed = completeTaskReview(config, state, {
    reviewId: requested.review.id,
    outcome: "approved",
    notes: "Looks good."
  });
  assert.equal(completed.task.status, "reported");
  assert.equal(completed.review.status, "approved");
});

test("approval request and decision move the task through waiting", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const thread = createThread(state, { title: "Approval thread" });
  const task = createTask(state, {
    projectId: "product_core",
    title: "Need approval before sync",
    description: "Ask for approval before external action",
    lane: "build"
  });
  thread.taskIds.push(task.id);
  task.status = "in_progress";

  const requested = requestApproval(config, state, {
    taskId: task.id,
    action: "external_sync",
    reason: "Tracker mutation requires approval"
  });
  assert.equal(requested.task?.status, "waiting");
  assert.equal(listApprovals(state, { taskId: task.id }).length, 1);

  const decided = decideApproval(config, state, {
    approvalId: requested.approval.id,
    decision: "granted",
    actorId: "owner_01"
  });
  assert.equal(decided.task?.status, "in_progress");
  assert.equal(decided.approval.status, "granted");
});

test("runtime can create a dynamic project and retain it in state", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const project = createProject(state, {
    id: "research_lab",
    name: "Research Lab",
    purpose: "Dynamic runtime project",
    lanes: ["planning", "research"],
    repoSlug: "research-lab"
  });
  assert.equal(project.source, "runtime");
  assert.equal(listProjects(state).some((item) => item.id === "research_lab"), true);
});

test("runtime can install an agent package and assign it to a project", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-agent-install-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  mkdirSync(resolve(tempRoot, "package-source", "prompts"), { recursive: true });
  writeFileSync(resolve(tempRoot, "package-source", "agent.yaml"), [
    "id: research_runner_01",
    "name: Research Runner",
    "role: research",
    "assigned_projects: []"
  ].join("\n"), "utf8");
  writeFileSync(resolve(tempRoot, "package-source", "prompts", "system.md"), "Research prompt", "utf8");

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  const agent = installAgentPackage(state, tempRoot, {
    sourceKind: "local_package",
    ref: "./package-source"
  });
  assignAgentToProject(state, {
    agentId: agent.id,
    projectId: "product_core"
  });

  assert.equal(agent.trustState, "trusted");
  assert.equal(listAgents(state, "product_core").some((item) => item.id === agent.id), true);
});

test("session lifecycle creates resolves and revokes tokens", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const session = createSession(config, state, {
    actorId: "owner_01",
    label: "web"
  });

  assert.equal(listSessions(state, { activeOnly: true }).some((item) => item.id === session.id), true);
  assert.equal(resolveSession(state, { token: session.token })?.actorId, "owner_01");

  const revoked = revokeSession(state, { sessionId: session.id });
  assert.equal(revoked.revokedAt !== null, true);
  assert.equal(resolveSession(state, { token: session.token }), null);
});

test("agent catalog exposes installed cached registry agents", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-agent-catalog-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data", "registry", "agents", "cached_agent_01"), { recursive: true });
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  state.agents.push({
    id: "cached_agent_01",
    name: "Cached Agent",
    role: "research",
    assignedProjects: ["product_core"],
    sourceKind: "registry_package",
    sourceRef: "https://registry.example.com/cached-agent-01",
    trustState: "restricted"
  });

  const catalog = listAgentCatalog(state, tempRoot);
  const entry = catalog.find((item) => item.id === "cached_agent_01");
  assert.equal(Boolean(entry), true);
  assert.equal(entry?.cachedPath?.includes("cached_agent_01"), true);
});

test("registry package install can fetch a remote manifest and cache it locally", async () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-registry-agent-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  mkdirSync(resolve(tempRoot, "registry", "agent", "prompts"), { recursive: true });
  writeFileSync(resolve(tempRoot, "registry", "agent", "agent.yaml"), [
    "id: remote_designer_01",
    "name: Remote Designer",
    "role: design",
    "assigned_projects: [product_core]",
    "entrypoints:",
    "  prompt: prompts/system.md"
  ].join("\n"), "utf8");
  writeFileSync(resolve(tempRoot, "registry", "agent", "prompts", "system.md"), "Remote designer prompt", "utf8");

  const portServer = createServer();
  await new Promise<void>((resolvePromise) => portServer.listen(0, "127.0.0.1", () => resolvePromise()));
  const address = portServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to reserve a TCP port");
  }
  const port = address.port;
  await new Promise<void>((resolvePromise, rejectPromise) => portServer.close((error) => error ? rejectPromise(error) : resolvePromise()));

  const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", resolve(tempRoot, "registry")], {
    stdio: ["ignore", "ignore", "inherit"]
  });
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));

  try {
    const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
    const state = loadRuntimeState(config, tempRoot);
    const agent = installAgentPackage(state, tempRoot, {
      sourceKind: "registry_package",
      ref: `http://127.0.0.1:${port}/agent`
    });

    assert.equal(agent.id, "remote_designer_01");
    assert.equal(agent.trustState, "restricted");
    assert.equal(
      readFileSync(resolve(tempRoot, "runtime-data", "registry", "agents", "remote_designer_01", "agent.yaml"), "utf8").includes("remote_designer_01"),
      true
    );
  } finally {
    server.kill("SIGTERM");
  }
});

test("people and project overview reflect current runtime state", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const task = createTask(state, {
    projectId: "product_core",
    title: "Overview task",
    description: "Used to populate overview counts",
    lane: "design"
  });
  assignTask(config, root, state, { taskId: task.id, agentId: "design_planner_01" });

  const people = listPeopleOverview(state);
  const projects = listProjectOverview(state);
  assert.equal(people.some((person) => person.id === "design_planner_01" && person.activeTaskCount >= 1), true);
  assert.equal(projects.some((project) => project.id === "product_core" && project.activeTaskCount >= 1), true);
});

test("connector ingestion can create intake and follow-up messages", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const mutable = structuredClone(config) as typeof config;
  ((mutable.connectors as { telegram: { enabled: boolean } }).telegram).enabled = true;
  const state = loadRuntimeState(mutable, root);

  const first = ingestConnectorMessage(mutable, root, state, {
    provider: "telegram",
    body: "Please redesign the Product - Core dashboard UI.",
    senderId: "tg_001",
    senderName: "Alice"
  });
  assert.equal(first.mode, "intake");
  assert.equal(first.taskId !== null, true);

  const second = ingestConnectorMessage(mutable, root, state, {
    provider: "telegram",
    body: "What is the current status?",
    senderId: "tg_001",
    senderName: "Alice",
    threadId: first.threadId
  });
  assert.equal(second.mode, "follow_up");
  assert.equal(getThreadDetail(state, first.threadId).messages.length >= 3, true);
});

test("sync retry records a sync event when provider is enabled", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const mutable = structuredClone(config) as typeof config;
  (mutable.sync as { providers: { linear: { enabled: boolean } } }).providers.linear.enabled = true;
  const state = loadRuntimeState(mutable, root);

  const record = retrySync(mutable, root, state, {
    provider: "linear",
    projectId: "product_core",
    reason: "Retry mirror sync"
  });

  assert.equal(record.status, "retried");
  assert.equal(listSyncRecords(state, { provider: "linear" }).length >= 1, true);
});

test("supabase runtime push mirrors snapshot and events", async () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-supabase-sync-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const mutable = structuredClone(config) as typeof config;
  (mutable.sync as { providers: { supabase: { enabled: boolean; project_ref: string } } }).providers.supabase.enabled = true;
  const state = loadRuntimeState(mutable, tempRoot);
  intakeRequest(mutable, tempRoot, state, {
    title: "Supabase push task",
    body: "Please redesign the Product - Core dashboard UI."
  });

  const seenBodiesPath = resolve(tempRoot, "supabase-seen.log");
  writeFileSync(seenBodiesPath, "", "utf8");
  const portServer = createServer();
  await new Promise<void>((resolvePromise) => portServer.listen(0, "127.0.0.1", () => resolvePromise()));
  const address = portServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Supabase mock did not expose a TCP port");
  }
  const port = address.port;
  await new Promise<void>((resolvePromise, rejectPromise) => portServer.close((error) => error ? rejectPromise(error) : resolvePromise()));

  const serverScript = `
    const { createServer } = require("node:http");
    const { appendFileSync } = require("node:fs");
    const port = Number(process.argv[1]);
    const seenBodiesPath = process.argv[2];
    const server = createServer((request, response) => {
      const chunks = [];
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("end", () => {
        appendFileSync(seenBodiesPath, request.url + "\\t" + Buffer.concat(chunks).toString("utf8") + "\\n");
        response.writeHead(201, { "Content-Type": "application/json" });
        response.end("[]");
      });
    });
    server.listen(port, "127.0.0.1");
  `;
  const server = spawn(process.execPath, ["-e", serverScript, String(port), seenBodiesPath], {
    stdio: ["ignore", "ignore", "inherit"]
  });
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));

  const previousSupabaseUrl = process.env.SUPABASE_URL;
  const previousSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  try {
    const record = pushRuntimeToProvider(mutable, tempRoot, state, {
      provider: "supabase"
    });
    const seen = readFileSync(seenBodiesPath, "utf8");
    assert.equal(record.provider, "supabase");
    assert.equal(seen.includes("/rest/v1/comphony_runtime_snapshots"), true);
    assert.equal(seen.includes("/rest/v1/comphony_events"), true);
  } finally {
    server.kill("SIGTERM");
    if (previousSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = previousSupabaseUrl;
    }
    if (previousSupabaseKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousSupabaseKey;
    }
  }
});

test("task sync can create or update a Linear issue through the configured provider", async () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-linear-sync-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const mutable = structuredClone(config) as typeof config;
  (mutable.sync as { providers: { linear: { enabled: boolean; team_key: string } } }).providers.linear.enabled = true;
  const state = loadRuntimeState(mutable, tempRoot);
  const thread = createThread(state, { title: "Linear sync thread" });
  const task = createTask(state, {
    projectId: "product_core",
    title: "Sync me to Linear",
    description: "Mirror this task outward",
    lane: "design"
  });
  thread.taskIds.push(task.id);
  const approval = requestApproval(mutable, state, {
    taskId: task.id,
    action: "external_sync",
    reason: "Allow Linear mirror for this task"
  });
  decideApproval(mutable, state, {
    approvalId: approval.approval.id,
    decision: "granted",
    actorId: "owner_01"
  });

  const seenBodies: string[] = [];
  const seenBodiesPath = resolve(tempRoot, "seen-bodies.log");
  writeFileSync(seenBodiesPath, "", "utf8");
  const portServer = createServer();
  await new Promise<void>((resolvePromise) => portServer.listen(0, "127.0.0.1", () => resolvePromise()));
  const address = portServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not expose a TCP port");
  }
  const port = address.port;
  await new Promise<void>((resolvePromise, rejectPromise) => portServer.close((error) => error ? rejectPromise(error) : resolvePromise()));

  const serverScript = `
    const { createServer } = require("node:http");
    const { appendFileSync } = require("node:fs");
    const port = Number(process.argv[1]);
    const seenBodiesPath = process.argv[2];
    const responseFor = (payload) => {
      if (payload.query.includes("teams")) {
        return { data: { teams: { nodes: [{ id: "team_1", key: "TAH" }] } } };
      }
      if (payload.query.includes("projects")) {
        return { data: { projects: { nodes: [{ id: "project_1", name: "Product - Core" }] } } };
      }
      if (payload.query.includes("issueCreate")) {
        return { data: { issueCreate: { success: true, issue: { id: "issue_1", identifier: "TAH-999", url: "https://linear.app/tahooki/issue/TAH-999" } } } };
      }
      if (payload.query.includes("issueUpdate")) {
        return { data: { issueUpdate: { success: true, issue: { id: "issue_1", identifier: "TAH-999", url: "https://linear.app/tahooki/issue/TAH-999" } } } };
      }
      return { errors: [{ message: "Unknown query" }] };
    };
    const server = createServer((request, response) => {
      response.setHeader("Connection", "close");
      const chunks = [];
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        appendFileSync(seenBodiesPath, raw + "\\n");
        const payload = JSON.parse(raw);
        const body = responseFor(payload);
        response.writeHead(body.errors ? 400 : 200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(body));
      });
    });
    server.listen(port, "127.0.0.1");
  `;
  const server = spawn(process.execPath, ["-e", serverScript, String(port), seenBodiesPath], {
    stdio: ["ignore", "ignore", "inherit"]
  });
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));

  const previousApiUrl = process.env.LINEAR_API_URL;
  const previousApiKey = process.env.LINEAR_API_KEY;
  process.env.LINEAR_API_URL = `http://127.0.0.1:${port}/graphql`;
  process.env.LINEAR_API_KEY = "test-linear-key";

  try {
    const first = syncTaskToProvider(mutable, tempRoot, state, {
      provider: "linear",
      taskId: task.id
    });
    assert.equal(first.ref.externalKey, "TAH-999");
    assert.equal(task.externalRefs.some((ref) => ref.provider === "linear"), true);

    task.completionSummary = "Updated summary";
    const second = syncTaskToProvider(mutable, tempRoot, state, {
      provider: "linear",
      taskId: task.id
    });
    seenBodies.push(...readFileSync(seenBodiesPath, "utf8").trim().split("\n").filter(Boolean));
    assert.equal(second.ref.externalId, "issue_1");
    assert.equal(seenBodies.some((body) => body.includes("issueCreate")), true);
    assert.equal(seenBodies.some((body) => body.includes("issueUpdate")), true);
  } finally {
    server.kill("SIGTERM");
    if (previousApiUrl === undefined) {
      delete process.env.LINEAR_API_URL;
    } else {
      process.env.LINEAR_API_URL = previousApiUrl;
    }
    if (previousApiKey === undefined) {
      delete process.env.LINEAR_API_KEY;
    } else {
      process.env.LINEAR_API_KEY = previousApiKey;
    }
  }
});

test("task sync is blocked until external sync approval is granted", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-linear-sync-approval-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const mutable = structuredClone(config) as typeof config;
  (mutable.sync as { providers: { linear: { enabled: boolean; team_key: string } } }).providers.linear.enabled = true;
  const state = loadRuntimeState(mutable, tempRoot);
  const task = createTask(state, {
    projectId: "product_core",
    title: "Approval gated sync",
    description: "Should require approval before external sync.",
    lane: "design"
  });

  const previousApiKey = process.env.LINEAR_API_KEY;
  process.env.LINEAR_API_KEY = "test-linear-key";
  try {
    assert.throws(() => {
      syncTaskToProvider(mutable, tempRoot, state, {
        provider: "linear",
        taskId: task.id
      });
    }, /External sync requires granted approval/);
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.LINEAR_API_KEY;
    } else {
      process.env.LINEAR_API_KEY = previousApiKey;
    }
  }
});

test("web app html includes chat, people, projects, and advanced controls", () => {
  const html = renderWebAppHtml();
  assert.equal(html.includes("/v1/intake"), true);
  assert.equal(html.includes("/v1/events/stream"), true);
  assert.equal(html.includes("/v1/threads/continue"), true);
  assert.equal(html.includes("/v1/tasks/sync"), true);
  assert.equal(html.includes("/v1/people"), true);
  assert.equal(html.includes("/v1/projects/overview"), true);
  assert.equal(html.includes("/v1/tasks/recommend"), true);
  assert.equal(html.includes("/v1/approvals/request"), true);
  assert.equal(html.includes("/v1/threads/respond"), true);
  assert.equal(html.includes("/v1/memory"), true);
  assert.equal(html.includes("/v1/memory/recommend"), true);
  assert.equal(html.includes("Advanced Mode"), true);
  assert.equal(html.includes("Sync Linear"), true);
  assert.equal(html.includes("People"), true);
  assert.equal(html.includes("Projects"), true);
});
