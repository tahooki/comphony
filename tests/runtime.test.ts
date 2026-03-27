import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { loadCompanyConfig, validateCompanyConfig } from "../src/config.js";
import { resetLoadedEnvironmentForTests } from "../src/env.js";
import { generateProjectWorkflows, provisionProjectFoundation } from "../src/provisioning.js";
import { GET_ROUTE_SURFACE, POST_ROUTE_SURFACE } from "../src/server/routes.js";
import { TASK_STATUS } from "../src/state/task-policy.js";
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
  listHandoffs,
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
  saveRuntimeState,
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
  assert.equal((config.projects as unknown[]).length, 5);
  assert.equal((config.agents as unknown[]).length, 5);
});

test("runtime state syncs projects and agents from config", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  assert.equal(listProjects(state).some((project) => project.id === "comphony_desk"), true);
  assert.equal(listProjects(state).some((project) => project.id === "idea_lab"), true);
  assert.equal(listProjects(state).some((project) => project.id === "product_core"), true);
  assert.equal(listProjects(state).some((project) => project.id === "project_managing"), true);
  assert.equal(listProjects(state).some((project) => project.id === "ops_maintenance"), true);
  assert.equal(listAgents(state).filter((agent) => agent.id === "design_planner_01").length >= 1, true);
  assert.equal(listAgents(state).filter((agent) => agent.id === "project_admin_01").length >= 1, true);
  assert.equal(listAgents(state, "comphony_desk").some((agent) => agent.id === "desk_coordinator"), true);
  assert.equal(listAgents(state, "idea_lab").some((agent) => agent.id === "desk_coordinator"), true);
  assert.equal(listAgents(state, "ops_maintenance").some((agent) => agent.id === "desk_coordinator"), true);
  assert.equal(listAgents(state, "ops_maintenance").some((agent) => agent.id === "product_dev_01"), true);
  assert.equal(listAgents(state, "ops_maintenance").some((agent) => agent.id === "frontend_publisher_01"), true);
});

test("project provisioning foundation creates repo bootstrap docs, workflows, and reports", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-provision-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  mkdirSync(resolve(tempRoot, "repos"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workspaces"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workflows"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "project_admin_01", "prompts"), { recursive: true });
  writeFileSync(resolve(tempRoot, "agents", "project_admin_01", "agent.yaml"), readFileSync(resolve(root, "agents", "project_admin_01", "agent.yaml"), "utf8"), "utf8");
  writeFileSync(resolve(tempRoot, "agents", "project_admin_01", "prompts", "system.md"), readFileSync(resolve(root, "agents", "project_admin_01", "prompts", "system.md"), "utf8"), "utf8");

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const result = provisionProjectFoundation(config, tempRoot, {
    id: "customer_portal",
    name: "Customer Portal",
    purpose: "Provision a new customer-facing product",
    lanes: ["planning", "research", "build", "review"],
    repoSlug: "customer-portal"
  });

  assert.equal(result.bootstrapStrategy, "clone");
  assert.equal(existsSync(resolve(tempRoot, "repos", "customer-portal", "README.md")), true);
  assert.equal(existsSync(resolve(tempRoot, "repos", "customer-portal", "docs", "BOOTSTRAP.md")), true);
  assert.equal(existsSync(resolve(tempRoot, "repos", "customer-portal", "plans", "bootstrap", "INITIAL_PLAN.md")), true);
  assert.equal(result.workflowPaths.some((path) => path.endsWith("WORKFLOW.customer-portal.dev.md")), true);
  assert.equal(result.workflowPaths.some((path) => path.endsWith("WORKFLOW.customer-portal.research.md")), true);
  assert.equal(existsSync(result.reportJsonPath), true);
  assert.equal(existsSync(result.reportMarkdownPath), true);
  assert.equal(readFileSync(result.workflowPaths.find((path) => path.endsWith(".dev.md")) ?? "", "utf8").includes("git clone --depth 1 --branch 'main'"), true);
});

test("workflow generation supports project managing workflow output", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-project-admin-workflow-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  mkdirSync(resolve(tempRoot, "repos", "project-admin"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workspaces"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workflows"), { recursive: true });

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const result = generateProjectWorkflows(config, tempRoot, {
    id: "project_managing",
    name: "Project Managing",
    purpose: "Provision repos and workflows",
    lanes: ["planning", "build", "review"],
    repoSlug: "project-admin"
  });

  assert.equal(result.workflowPaths.length, 1);
  assert.equal(result.bootstrapStrategy, "clone");
  assert.equal(result.workflowPaths[0]?.endsWith("WORKFLOW.project-admin.md"), true);
  assert.equal(readFileSync(result.workflowPaths[0], "utf8").includes("project administration agent"), true);
});

test("workflow generation renders worktree bootstrap hooks when requested", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-worktree-workflow-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML.replace("repo_bootstrap_strategy: clone", "repo_bootstrap_strategy: worktree"), "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  mkdirSync(resolve(tempRoot, "repos", "product-core"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workspaces"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workflows"), { recursive: true });

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const result = generateProjectWorkflows(config, tempRoot, {
    id: "product_core",
    name: "Product - Core",
    purpose: "Main product execution",
    lanes: ["planning", "build", "review"],
    repoSlug: "product-core"
  });

  assert.equal(result.bootstrapStrategy, "worktree");
  const workflow = readFileSync(result.workflowPaths.find((path) => path.endsWith(".dev.md")) ?? "", "utf8");
  assert.equal(workflow.includes("git -C"), true);
  assert.equal(workflow.includes("worktree add --force --detach . 'main'"), true);
  assert.equal(workflow.includes("git clone --depth 1"), false);
});

test("project provision CLI forwards explicit bootstrap strategy to generated workflows", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-provision-worktree-cli-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  mkdirSync(resolve(tempRoot, "repos"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workspaces"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workflows"), { recursive: true });
  ["desk_coordinator", "product_dev_01", "design_planner_01", "frontend_publisher_01", "project_admin_01"].forEach((agentId) => {
    mkdirSync(resolve(tempRoot, "agents", agentId, "prompts"), { recursive: true });
    writeFileSync(resolve(tempRoot, "agents", agentId, "agent.yaml"), readFileSync(resolve(root, "agents", agentId, "agent.yaml"), "utf8"), "utf8");
    writeFileSync(resolve(tempRoot, "agents", agentId, "prompts", "system.md"), readFileSync(resolve(root, "agents", agentId, "prompts", "system.md"), "utf8"), "utf8");
  });

  const result = spawnSync(resolve(root, "node_modules", ".bin", "tsx"), [
    resolve(root, "src", "cli.ts"),
    "project",
    "provision",
    "--id",
    "ops_maintenance",
    "--name",
    "Ops / Maintenance",
    "--lanes",
    "planning,build,review",
    "--repo-slug",
    "ops-maintenance",
    "--bootstrap-strategy",
    "worktree"
  ], {
    cwd: tempRoot,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const workflow = readFileSync(resolve(tempRoot, "workflows", "WORKFLOW.ops-maintenance.dev.md"), "utf8");
  assert.equal(workflow.includes("worktree add --force --detach . 'main'"), true);
  assert.equal(workflow.includes("git clone --depth 1"), false);
});

test("project provision CLI creates local artifacts and a smoke-test request", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-provision-cli-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  mkdirSync(resolve(tempRoot, "repos"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workspaces"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workflows"), { recursive: true });
  ["desk_coordinator", "product_dev_01", "design_planner_01", "frontend_publisher_01", "project_admin_01"].forEach((agentId) => {
    mkdirSync(resolve(tempRoot, "agents", agentId, "prompts"), { recursive: true });
    writeFileSync(resolve(tempRoot, "agents", agentId, "agent.yaml"), readFileSync(resolve(root, "agents", agentId, "agent.yaml"), "utf8"), "utf8");
    writeFileSync(resolve(tempRoot, "agents", agentId, "prompts", "system.md"), readFileSync(resolve(root, "agents", agentId, "prompts", "system.md"), "utf8"), "utf8");
  });

  const result = spawnSync(resolve(root, "node_modules", ".bin", "tsx"), [
    resolve(root, "src", "cli.ts"),
    "project",
    "provision",
    "--id",
    "customer_portal",
    "--name",
    "Customer Portal",
    "--lanes",
    "planning,research,build,review",
    "--repo-slug",
    "customer-portal"
  ], {
    cwd: tempRoot,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.includes("project=customer_portal"), true);
  assert.equal(result.stdout.includes("smoke_task="), true);
  assert.equal(existsSync(resolve(tempRoot, "repos", "customer-portal", "README.md")), true);
  assert.equal(existsSync(resolve(tempRoot, "workflows", "WORKFLOW.customer-portal.dev.md")), true);

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  assert.equal(listProjects(state).some((project) => project.id === "customer_portal"), true);
  assert.equal(listTasks(state, { projectId: "customer_portal" }).some((task) => task.title.includes("Smoke test Customer Portal")), true);
});

test("smoke-test CLI validates local project paths and emits a smoke-test request", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-smoke-test-cli-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  mkdirSync(resolve(tempRoot, "repos", "project-core"), { recursive: true });
  mkdirSync(resolve(tempRoot, "repos", "product-core"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workspaces"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workflows"), { recursive: true });
  writeFileSync(resolve(tempRoot, "workflows", "WORKFLOW.product-core.dev.md"), "tracker:\nworkspace:\nhooks:\ncodex:\n", "utf8");
  ["desk_coordinator", "product_dev_01", "design_planner_01", "frontend_publisher_01", "project_admin_01"].forEach((agentId) => {
    mkdirSync(resolve(tempRoot, "agents", agentId, "prompts"), { recursive: true });
    writeFileSync(resolve(tempRoot, "agents", agentId, "agent.yaml"), readFileSync(resolve(root, "agents", agentId, "agent.yaml"), "utf8"), "utf8");
    writeFileSync(resolve(tempRoot, "agents", agentId, "prompts", "system.md"), readFileSync(resolve(root, "agents", agentId, "prompts", "system.md"), "utf8"), "utf8");
  });

  const result = spawnSync(resolve(root, "node_modules", ".bin", "tsx"), [
    resolve(root, "src", "cli.ts"),
    "smoke-test",
    "--project",
    "product_core"
  ], {
    cwd: tempRoot,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.includes("project=product_core"), true);
  assert.equal(result.stdout.includes("smoke_task="), true);

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  assert.equal(listTasks(state, { projectId: "product_core" }).some((task) => task.title.includes("Smoke test Product - Core")), true);
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
  assert.equal(assigned.status, TASK_STATUS.assigned);
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

test("generic intake defaults to Comphony Desk as the front door project", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const result = intakeRequest(config, root, state, {
    title: "Need help",
    body: "I need help figuring out what to do next."
  });

  assert.equal(result.message.routedProjectId, "comphony_desk");
  assert.equal(result.task.projectId, "comphony_desk");
  assert.equal(result.task.lane, "planning");
});

test("intake routes setup, idea, product, and ops requests to downstream projects", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);

  const setup = intakeRequest(config, root, state, {
    title: "Bootstrap a new workspace",
    body: "Please set up a new repo and bootstrap the workflow for this project."
  });
  assert.equal(setup.message.routedProjectId, "project_managing");
  assert.equal(setup.task.projectId, "project_managing");

  const idea = intakeRequest(config, root, state, {
    title: "Research the direction",
    body: "Research the idea, compare options, and plan the roadmap."
  });
  assert.equal(idea.message.routedProjectId, "idea_lab");
  assert.equal(idea.task.projectId, "idea_lab");

  const product = intakeRequest(config, root, state, {
    title: "Build the dashboard",
    body: "Design and implement the new dashboard UI flow."
  });
  assert.equal(product.message.routedProjectId, "product_core");
  assert.equal(product.task.projectId, "product_core");

  const ops = intakeRequest(config, root, state, {
    title: "Fix production issue",
    body: "Fix the production bug and handle the maintenance cleanup."
  });
  assert.equal(ops.message.routedProjectId, "ops_maintenance");
  assert.equal(ops.task.projectId, "ops_maintenance");
});

test("intake routes representative Korean requests to the expected downstream projects and lanes", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);

  const idea = intakeRequest(config, root, state, {
    title: "아이디어 조사",
    body: "이 아이디어를 조사하고 옵션을 비교해서 로드맵을 기획해줘."
  });
  assert.equal(idea.message.routedProjectId, "idea_lab");
  assert.equal(idea.task.projectId, "idea_lab");
  assert.equal(idea.message.suggestedLane, "research");
  assert.equal(idea.task.lane, "research");

  const setup = intakeRequest(config, root, state, {
    title: "초기 셋업",
    body: "새 저장소를 설정하고 워크플로우를 부트스트랩해줘."
  });
  assert.equal(setup.message.routedProjectId, "project_managing");
  assert.equal(setup.task.projectId, "project_managing");

  const product = intakeRequest(config, root, state, {
    title: "제품 구현",
    body: "새 대시보드 화면을 디자인하고 구현해줘."
  });
  assert.equal(product.message.routedProjectId, "product_core");
  assert.equal(product.task.projectId, "product_core");
  assert.equal(product.message.suggestedLane, "design");
  assert.equal(product.task.lane, "design");

  const ops = intakeRequest(config, root, state, {
    title: "운영 이슈 처리",
    body: "운영 장애를 확인하고 버그를 수정해줘."
  });
  assert.equal(ops.message.routedProjectId, "ops_maintenance");
  assert.equal(ops.task.projectId, "ops_maintenance");
  assert.equal(ops.message.suggestedLane, "build");
  assert.equal(ops.task.lane, "build");
});

test("setup intake keeps a Desk parent while execution work runs in Project Managing", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const intake = intakeRequest(config, root, state, {
    title: "Bootstrap a new workspace",
    body: "Please set up a new repo and bootstrap the workflow for this project."
  });

  const detail = getThreadDetail(state, intake.thread.id);
  const parent = detail.tasks.find((task) => task.id === intake.rootTaskId);

  assert.equal(parent?.projectId, "comphony_desk");
  assert.equal(intake.task.projectId, "project_managing");
  assert.equal(intake.task.parentTaskId, intake.rootTaskId);
});

test("explicit project mentions still override inferred downstream routing", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const result = intakeRequest(config, root, state, {
    title: "Product-specific planning",
    body: "Please plan the next milestone for Product - Core."
  });

  assert.equal(result.message.routedProjectId, "product_core");
  assert.equal(result.task.projectId, "product_core");
  assert.equal(result.rootTaskId !== result.task.id, true);
  const detail = getThreadDetail(state, result.thread.id);
  const parent = detail.tasks.find((task) => task.id === result.rootTaskId);
  assert.equal(parent?.projectId, "comphony_desk");
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

  const updated = updateTaskStatus(state, { taskId: task.id, status: TASK_STATUS.inProgress });
  assert.equal(updated.status, TASK_STATUS.inProgress);
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
  assert.equal(result.task.status, TASK_STATUS.inProgress);
  assert.equal(result.message.role, "agent");
  assert.equal(result.threadId, thread.id);
  assert.equal(result.task.artifactPaths.length, 3);
  assert.equal(readFileSync(resolve(tempRoot, "repos", "product-core", "design-system", "MASTER.md"), "utf8").includes("MASTER Design System"), true);
  assert.equal(getThreadDetail(state, thread.id).messages.some((item) => item.id === result.message.id), true);
  assert.equal(result.message.body.includes("Artifacts:"), true);
  assert.equal(listEvents(state, 10).some((event) => event.type === "task.artifacts_generated"), true);
  assert.equal(listEvents(state, 10).some((event) => event.type === "task.work_turn_completed"), true);
});

test("ops intake auto-assigns an executable worker and completes a basic work turn", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-ops-work-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "agents", "desk_coordinator", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "product_dev_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "frontend_publisher_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  [
    "desk_coordinator",
    "product_dev_01",
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
    title: "Fix production issue",
    body: "Fix the production bug and handle the maintenance cleanup."
  });

  assert.equal(intake.message.routedProjectId, "ops_maintenance");
  assert.equal(intake.task.projectId, "ops_maintenance");
  assert.equal(intake.task.lane, "build");
  assert.equal(intake.assignedAgentId, "product_dev_01");
  assert.equal(intake.assignmentError, null);
  assert.equal(intake.task.status, TASK_STATUS.assigned);

  const work = runTaskWorkTurn(config, tempRoot, state, { taskId: intake.task.id });
  assert.equal(work.task.status, TASK_STATUS.inProgress);
  assert.equal(work.message.role, "agent");
  assert.equal(work.message.body.includes("Product Core Developer"), true);
  assert.equal(readFileSync(resolve(tempRoot, "workspaces", "ops_maintenance", intake.task.id, "implementation-note.md"), "utf8").includes("Implementation Note"), true);
  assert.equal(getThreadDetail(state, intake.thread.id).messages.some((item) => item.id === work.message.id), true);
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
  assert.equal(handoff.handoff.fromLane, "design");
  assert.equal(handoff.handoff.toLane, "build");
  assert.equal(handoff.handoff.fromAgentId, "design_planner_01");
  assert.equal(handoff.handoff.toAgentId, "product_dev_01");
  assert.equal(handoff.handoff.status, "completed");
  assert.equal(getThreadDetail(state, thread.id).messages.some((item) => item.body.includes("handed off")), true);
  assert.equal(listEvents(state, 10).some((event) => event.type === "task.handed_off"), true);
});

test("ownership handoff persists as a separate thread record distinct from consultation", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-handoff-record-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "agents", "desk_coordinator", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "product_dev_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "design_planner_01", "prompts"), { recursive: true });
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  ["desk_coordinator", "product_dev_01", "design_planner_01"].forEach((agentId) => {
    const sourceRoot = resolve(root, "agents", agentId);
    const targetRoot = resolve(tempRoot, "agents", agentId);
    writeFileSync(resolve(targetRoot, "agent.yaml"), readFileSync(resolve(sourceRoot, "agent.yaml"), "utf8"), "utf8");
    writeFileSync(resolve(targetRoot, "prompts", "system.md"), readFileSync(resolve(sourceRoot, "prompts", "system.md"), "utf8"), "utf8");
  });
  mkdirSync(resolve(tempRoot, "repos", "product-core", "design-system"), { recursive: true });
  mkdirSync(resolve(tempRoot, "repos", "product-core", "plans", "design"), { recursive: true });
  writeFileSync(resolve(tempRoot, "repos", "product-core", "design-system", "MASTER.md"), "# master", "utf8");
  writeFileSync(resolve(tempRoot, "repos", "product-core", "plans", "design", "design-plan.md"), "# plan", "utf8");
  writeFileSync(resolve(tempRoot, "repos", "product-core", "plans", "design", "dev-handoff.md"), "# handoff", "utf8");

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  const thread = createThread(state, { title: "Separate ownership handoff from consultation" });
  const task = createTask(state, {
    projectId: "product_core",
    title: "Ship dashboard redesign",
    description: "Move ownership and ask for help separately",
    lane: "design"
  });
  thread.taskIds.push(task.id);
  assignTask(config, tempRoot, state, { taskId: task.id, agentId: "design_planner_01" });

  const ownershipHandoff = handoffTask(config, tempRoot, state, {
    taskId: task.id,
    lane: "build",
    reason: "Design is ready for implementation",
    instructions: "Use the approved design handoff artifacts."
  });
  const consultation = requestConsultation(config, state, {
    taskId: task.id,
    toAgentId: "desk_coordinator",
    reason: "Need intake clarification"
  });

  const threadDetail = getThreadDetail(state, thread.id);
  assert.equal(listHandoffs(state, { taskId: task.id }).length, 1);
  assert.equal(listConsultations(state, { taskId: task.id }).length, 1);
  assert.equal(threadDetail.handoffs.length, 1);
  assert.equal(threadDetail.consultations.length, 1);
  assert.equal(threadDetail.handoffs[0]?.id, ownershipHandoff.handoff.id);
  assert.equal(threadDetail.consultations[0]?.id, consultation.consultation.id);
  assert.equal(threadDetail.handoffs[0]?.fromLane, "design");
  assert.equal(threadDetail.handoffs[0]?.toLane, "build");
  assert.equal(threadDetail.handoffs[0]?.fromAgentId, "design_planner_01");
  assert.equal(threadDetail.handoffs[0]?.toAgentId, "product_dev_01");
  assert.equal(threadDetail.handoffs[0]?.reason, "Design is ready for implementation");
  assert.equal(threadDetail.handoffs[0]?.instructions, "Use the approved design handoff artifacts.");
  assert.equal(threadDetail.handoffs[0]?.status, "completed");
  assert.equal(threadDetail.consultations[0]?.toAgentId, "desk_coordinator");
  assert.equal(threadDetail.consultations[0]?.reason, "Need intake clarification");
});

test("handoff records persist across runtime reload and remain separate from consultations", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-handoff-persist-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  const thread = createThread(state, { title: "Persist ownership handoff records" });
  const task = createTask(state, {
    projectId: "product_core",
    title: "Move planning work into design",
    description: "Persist handoff and consultation separately",
    lane: "planning"
  });
  thread.taskIds.push(task.id);
  assignTask(config, tempRoot, state, { taskId: task.id, agentId: "desk_coordinator" });

  const handoff = handoffTask(config, tempRoot, state, {
    taskId: task.id,
    lane: "design",
    reason: "Planning is complete",
    instructions: "Continue with design execution"
  });
  const consultation = requestConsultation(config, state, {
    taskId: task.id,
    toAgentId: "product_dev_01",
    reason: "Need implementation constraints"
  });

  saveRuntimeState(config, tempRoot, state);
  const reloaded = loadRuntimeState(config, tempRoot);
  const persistedHandoffs = listHandoffs(reloaded, { taskId: task.id });
  const persistedConsultations = listConsultations(reloaded, { taskId: task.id });
  const persistedThreadDetail = getThreadDetail(reloaded, thread.id);

  assert.equal(persistedHandoffs.length, 1);
  assert.equal(persistedConsultations.length, 1);
  assert.equal(persistedThreadDetail.handoffs.length, 1);
  assert.equal(persistedThreadDetail.consultations.length, 1);
  assert.equal(persistedHandoffs[0]?.id, handoff.handoff.id);
  assert.equal(persistedHandoffs[0]?.fromLane, "planning");
  assert.equal(persistedHandoffs[0]?.toLane, "design");
  assert.equal(persistedHandoffs[0]?.fromAgentId, "desk_coordinator");
  assert.equal(persistedHandoffs[0]?.toAgentId, "design_planner_01");
  assert.equal(persistedHandoffs[0]?.reason, "Planning is complete");
  assert.equal(persistedHandoffs[0]?.instructions, "Continue with design execution");
  assert.equal(persistedHandoffs[0]?.status, "completed");
  assert.equal(persistedConsultations[0]?.id, consultation.consultation.id);
  assert.equal(persistedConsultations[0]?.fromAgentId, "design_planner_01");
  assert.equal(persistedConsultations[0]?.toAgentId, "product_dev_01");
  assert.equal(persistedConsultations[0]?.reason, "Need implementation constraints");
});

test("intake leaves a routed task in triaged when no eligible agent is available", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  for (const agent of state.agents) {
    agent.assignedProjects = agent.assignedProjects.filter((projectId) => projectId !== "product_core");
  }

  const intake = intakeRequest(config, root, state, {
    title: "Triage the dashboard refresh",
    body: "Plan the Product - Core dashboard refresh",
    projectId: "product_core",
    lane: "planning"
  });

  assert.equal(intake.assignedAgentId, null);
  assert.equal(intake.assignmentError, "No eligible agent found for this task.");
  assert.equal(intake.task.status, TASK_STATUS.triaged);
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
  assert.equal(reviewTurn.task.status, TASK_STATUS.review);

  const finalTurn = runTaskWorkTurn(config, tempRoot, state, { taskId: task.id });
  assert.equal(finalTurn.task.status, TASK_STATUS.done);
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

  const reply = respondToThread(config, root, state, {
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

  const reply = respondToThread(config, root, state, {
    threadId: intake.thread.id,
    body: "@design_planner_01 what are you doing now?"
  });

  assert.equal(reply.responseMessage.role, "agent");
  assert.equal(reply.responseMessage.targetAgentId, "design_planner_01");
  assert.equal(reply.responseMessage.body.toLowerCase().includes("design"), true);
  assert.equal(reply.responseMessage.body.includes("Product Design Planner here."), true);
  assert.equal(reply.responseMessage.body.includes("Current status:"), true);
});

test("manager reply compatibility keeps current focus and next step framing", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const intake = intakeRequest(config, root, state, {
    title: "Need manager-style status summary",
    body: "Please redesign the Product - Core dashboard UI and improve the UX."
  });

  const reply = respondToThread(config, root, state, {
    threadId: intake.thread.id,
    body: "give me the manager summary"
  });

  assert.equal(reply.responseMessage.role, "system");
  assert.equal(reply.responseMessage.body.includes("Current focus:"), true);
  assert.equal(reply.responseMessage.body.includes("Next step:"), true);
  assert.equal(reply.responseMessage.body.includes("Open coordination:"), true);
});

test("thread ask can continue work autonomously through Comphony", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-chat-continue-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  ["desk_coordinator", "product_dev_01", "design_planner_01", "frontend_publisher_01"].forEach((agentId) => {
    mkdirSync(resolve(tempRoot, "agents", agentId, "prompts"), { recursive: true });
    const sourceRoot = resolve(root, "agents", agentId);
    const targetRoot = resolve(tempRoot, "agents", agentId);
    writeFileSync(resolve(targetRoot, "agent.yaml"), readFileSync(resolve(sourceRoot, "agent.yaml"), "utf8"), "utf8");
    writeFileSync(resolve(targetRoot, "prompts", "system.md"), readFileSync(resolve(sourceRoot, "prompts", "system.md"), "utf8"), "utf8");
  });
  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  const intake = intakeRequest(config, tempRoot, state, {
    title: "Autonomous dashboard refresh",
    body: "Please redesign the Product - Core dashboard UI, implement it, and review it."
  });

  const reply = respondToThread(config, tempRoot, state, {
    threadId: intake.thread.id,
    body: "keep going until you need me"
  });

  assert.equal(reply.responseMessage.body.includes("Comphony continued the thread automatically."), true);
  assert.equal(getThreadDetail(state, intake.thread.id).tasks.length >= 3, true);
});

test("thread ask can create a project from chat", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-chat-project-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  mkdirSync(resolve(tempRoot, "repos"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workspaces"), { recursive: true });
  mkdirSync(resolve(tempRoot, "workflows"), { recursive: true });
  ["desk_coordinator", "product_dev_01", "design_planner_01", "frontend_publisher_01", "project_admin_01"].forEach((agentId) => {
    mkdirSync(resolve(tempRoot, "agents", agentId, "prompts"), { recursive: true });
    const sourceRoot = resolve(root, "agents", agentId);
    const targetRoot = resolve(tempRoot, "agents", agentId);
    writeFileSync(resolve(targetRoot, "agent.yaml"), readFileSync(resolve(sourceRoot, "agent.yaml"), "utf8"), "utf8");
    writeFileSync(resolve(targetRoot, "prompts", "system.md"), readFileSync(resolve(sourceRoot, "prompts", "system.md"), "utf8"), "utf8");
  });

  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  const intake = intakeRequest(config, tempRoot, state, {
    title: "Set up next product",
    body: "We should open a new initiative."
  });

  const reply = respondToThread(config, tempRoot, state, {
    threadId: intake.thread.id,
    body: "create project called Customer Portal"
  });

  assert.equal(reply.responseMessage.body.includes("Comphony opened project Customer Portal"), true);
  assert.equal(reply.responseMessage.body.includes("Smoke test task:"), true);
  assert.equal(listProjects(state).some((project) => project.id === "customer_portal"), true);
  assert.equal(existsSync(resolve(tempRoot, "repos", "customer-portal", "README.md")), true);
  assert.equal(existsSync(resolve(tempRoot, "repos", "customer-portal", "docs", "BOOTSTRAP.md")), true);
  assert.equal(existsSync(resolve(tempRoot, "workflows", "WORKFLOW.customer-portal.dev.md")), true);
  assert.equal(existsSync(resolve(tempRoot, "workflows", "WORKFLOW.customer-portal.research.md")), true);
  assert.equal(
    listTasks(state, { projectId: "customer_portal" }).some((task) => task.title.includes("Smoke test Customer Portal")),
    true
  );
  const smokeThread = state.threads.find((thread) => thread.title === "Smoke test Customer Portal") ?? null;
  assert.notEqual(smokeThread, null);
});

test("thread ask can hire an agent from chat", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "comphony-chat-hire-"));
  writeFileSync(resolve(tempRoot, "company.yaml"), DEFAULT_COMPANY_YAML, "utf8");
  mkdirSync(resolve(tempRoot, "runtime-data"), { recursive: true });
  mkdirSync(resolve(tempRoot, "agents", "research_helper_01", "prompts"), { recursive: true });
  writeFileSync(resolve(tempRoot, "agents", "research_helper_01", "agent.yaml"), [
    "id: research_helper_01",
    "name: Research Helper",
    "role: research",
    "assigned_projects: []"
  ].join("\n"), "utf8");
  writeFileSync(resolve(tempRoot, "agents", "research_helper_01", "prompts", "system.md"), "You are a research helper.", "utf8");
  ["desk_coordinator", "product_dev_01", "design_planner_01", "frontend_publisher_01"].forEach((agentId) => {
    mkdirSync(resolve(tempRoot, "agents", agentId, "prompts"), { recursive: true });
    const sourceRoot = resolve(root, "agents", agentId);
    const targetRoot = resolve(tempRoot, "agents", agentId);
    writeFileSync(resolve(targetRoot, "agent.yaml"), readFileSync(resolve(sourceRoot, "agent.yaml"), "utf8"), "utf8");
    writeFileSync(resolve(targetRoot, "prompts", "system.md"), readFileSync(resolve(sourceRoot, "prompts", "system.md"), "utf8"), "utf8");
  });
  const config = loadCompanyConfig(resolve(tempRoot, "company.yaml"));
  const state = loadRuntimeState(config, tempRoot);
  const intake = intakeRequest(config, tempRoot, state, {
    title: "Need more research support",
    body: "Please research dashboard patterns for Product - Core."
  });

  const reply = respondToThread(config, tempRoot, state, {
    threadId: intake.thread.id,
    body: "hire agent ./agents/research_helper_01"
  });

  assert.equal(reply.responseMessage.body.includes("Research Helper"), true);
  assert.equal(listAgents(state).some((agent) => agent.id === "research_helper_01"), true);
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

test("reported Project Managing child refreshes the Desk parent and continueThread closes it to done", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const intake = intakeRequest(config, root, state, {
    title: "Bootstrap a new workspace",
    body: "Please set up a new repo and bootstrap the workflow for this project."
  });
  const detail = getThreadDetail(state, intake.thread.id);
  const parent = detail.tasks.find((task) => task.id === intake.rootTaskId);

  assert.equal(parent?.projectId, "comphony_desk");

  intake.task.completionSummary = "Provision report captured repo, workflow, and bootstrap outputs.";
  intake.task.artifactPaths.push("/tmp/provision-report.md");
  updateTaskStatus(state, { taskId: intake.task.id, status: TASK_STATUS.reported });

  assert.equal(parent?.status, TASK_STATUS.reported);
  assert.match(parent?.completionSummary ?? "", /Project Managing reported back to Comphony Desk/);
  assert.match(parent?.completionSummary ?? "", /\/tmp\/provision-report.md/);

  const closed = continueThread(config, root, state, { threadId: intake.thread.id });

  assert.equal(closed.action, "reported_closed");
  assert.equal(parent?.status, TASK_STATUS.done);
  assert.match(closed.message?.body ?? "", /Desk final report for Bootstrap a new workspace:/);
});

test("Desk-routed downstream child completion reports back through the shared parent contract", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const intake = intakeRequest(config, root, state, {
    title: "Product-specific planning",
    body: "Please plan the next milestone for Product - Core."
  });
  const detail = getThreadDetail(state, intake.thread.id);
  const parent = detail.tasks.find((task) => task.id === intake.rootTaskId);

  assert.equal(parent?.projectId, "comphony_desk");
  assert.equal(intake.task.projectId, "product_core");

  intake.task.completionSummary = "Milestone scope and rollout plan are ready.";
  intake.task.artifactPaths.push("/tmp/product-plan.md");
  updateTaskStatus(state, { taskId: intake.task.id, status: TASK_STATUS.done });

  assert.equal(parent?.status, TASK_STATUS.reported);
  assert.match(parent?.completionSummary ?? "", /Product Core reported back to Comphony Desk/);
  assert.match(parent?.completionSummary ?? "", /Milestone scope and rollout plan are ready\./);
  assert.match(parent?.completionSummary ?? "", /\/tmp\/product-plan.md/);

  const closed = continueThread(config, root, state, { threadId: intake.thread.id });

  assert.equal(closed.action, "reported_closed");
  assert.equal(parent?.status, TASK_STATUS.done);
  assert.match(closed.message?.body ?? "", /Desk final report for Product-specific planning:/);
});

test("memory recommendation ranks thread-related memories first", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const intake = intakeRequest(config, root, state, {
    title: "Need related memory",
    body: "Please redesign the Product - Core dashboard UI and improve the UX."
  });
  respondToThread(config, root, state, {
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
  assert.equal(requested.task.status, TASK_STATUS.consulting);
  assert.equal(listConsultations(state, { taskId: task.id }).length, 1);

  const resolved = resolveConsultation(config, state, {
    consultationId: requested.consultation.id,
    response: "Clarified scope and constraints."
  });
  assert.equal(resolved.task.status, TASK_STATUS.inProgress);
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
  assert.equal(requested.task.status, TASK_STATUS.reviewRequested);
  assert.equal(listReviews(state, { taskId: task.id }).length, 1);

  const completed = completeTaskReview(config, state, {
    reviewId: requested.review.id,
    outcome: "approved",
    notes: "Looks good."
  });
  assert.equal(completed.task.status, TASK_STATUS.reported);
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
  task.status = TASK_STATUS.inProgress;

  const requested = requestApproval(config, state, {
    taskId: task.id,
    action: "external_sync",
    reason: "Tracker mutation requires approval"
  });
  assert.equal(requested.task?.status, TASK_STATUS.waiting);
  assert.equal(listApprovals(state, { taskId: task.id }).length, 1);

  const decided = decideApproval(config, state, {
    approvalId: requested.approval.id,
    decision: "granted",
    actorId: "owner_01"
  });
  assert.equal(decided.task?.status, TASK_STATUS.inProgress);
  assert.equal(decided.approval.status, "granted");
});

test("approval grant without a saved resume status falls back to triaged", () => {
  const config = loadCompanyConfig(resolve(root, "company.yaml"));
  const state = loadRuntimeState(config, root);
  const thread = createThread(state, { title: "Approval resume fallback" });
  const task = createTask(state, {
    projectId: "product_core",
    title: "Resume after approval",
    description: "Task should re-enter routed pre-execution state",
    lane: "build"
  });
  thread.taskIds.push(task.id);
  task.status = TASK_STATUS.triaged;

  const requested = requestApproval(config, state, {
    taskId: task.id,
    action: "external_sync",
    reason: "Needs explicit approval"
  });
  requested.approval.resumeStatus = null;

  const decided = decideApproval(config, state, {
    approvalId: requested.approval.id,
    decision: "granted",
    actorId: "owner_01"
  });

  assert.equal(decided.task?.status, TASK_STATUS.triaged);
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
  assert.equal(html.includes("Hire Agent"), true);
  assert.equal(html.includes("Create Project"), true);
  assert.equal(html.includes("Agent Catalog"), true);
});

test("/v1 route surface remains unchanged", () => {
  assert.deepEqual(GET_ROUTE_SURFACE, [
    "/",
    "/app",
    "/healthz",
    "/v1/status",
    "/v1/auth/session",
    "/v1/projects",
    "/v1/projects/overview",
    "/v1/sync",
    "/v1/agents",
    "/v1/agents/catalog",
    "/v1/people",
    "/v1/sessions",
    "/v1/tasks",
    "/v1/tasks/recommend",
    "/v1/events/stream",
    "/v1/events",
    "/v1/memory",
    "/v1/memory/recommend",
    "/v1/consultations",
    "/v1/reviews",
    "/v1/approvals",
    "/v1/threads",
    "/v1/threads/:id",
    "/v1/messages"
  ]);

  assert.deepEqual(POST_ROUTE_SURFACE, [
    "/v1/intake",
    "/v1/threads",
    "/v1/threads/respond",
    "/v1/threads/continue",
    "/v1/messages",
    "/v1/messages/promote",
    "/v1/tasks/assign",
    "/v1/tasks/status",
    "/v1/tasks/work",
    "/v1/tasks/handoff",
    "/v1/tasks/sync",
    "/v1/tasks/consult",
    "/v1/consultations/resolve",
    "/v1/tasks/review",
    "/v1/reviews/complete",
    "/v1/approvals/request",
    "/v1/approvals/decide",
    "/v1/projects",
    "/v1/agents/install",
    "/v1/agents/assign-project",
    "/v1/sync/retry",
    "/v1/sync/push",
    "/v1/auth/login",
    "/v1/auth/logout",
    "/v1/connectors/:provider/messages"
  ]);
});
