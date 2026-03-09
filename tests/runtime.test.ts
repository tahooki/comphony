import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { loadCompanyConfig, validateCompanyConfig } from "../src/config.js";
import {
  addMessage,
  assignTask,
  autoAssignTask,
  createThread,
  createTask,
  getThreadDetail,
  handoffTask,
  intakeRequest,
  listMemories,
  listAgents,
  listEvents,
  listMessages,
  listProjects,
  listTasks,
  loadRuntimeState,
  promoteMessageToTask,
  respondToThread,
  runTaskWorkTurn,
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
  assert.equal(listProjects(state).length, 1);
  assert.equal(listAgents(state).length, 4);
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
  assert.equal(reply.responseMessage.body.includes("Current task state:"), true);
  assert.equal(reply.responseMessage.body.includes(intake.task.id), true);
  assert.equal(reply.responseMessage.body.includes("Recent memory:"), true);
  assert.equal(listMemories(state, { threadId: intake.thread.id }).length >= 2, true);
  assert.equal(listEvents(state, 10).some((event) => event.type === "thread.responded"), true);
});

test("web app html includes task actions and event stream wiring", () => {
  const html = renderWebAppHtml();
  assert.equal(html.includes("/v1/intake"), true);
  assert.equal(html.includes("/v1/events/stream"), true);
  assert.equal(html.includes("/v1/tasks/assign"), true);
  assert.equal(html.includes("/v1/tasks/work"), true);
  assert.equal(html.includes("/v1/tasks/handoff"), true);
  assert.equal(html.includes("/v1/tasks/status"), true);
  assert.equal(html.includes("/v1/threads/respond"), true);
  assert.equal(html.includes("/v1/memory"), true);
  assert.equal(html.includes("/v1/threads/"), true);
});
