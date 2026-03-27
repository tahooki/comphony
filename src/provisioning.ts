import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";

import type { JSONObject } from "./config.js";

export type ProvisionableProject = {
  id: string;
  name: string;
  purpose?: string | null;
  lanes: string[];
  repoSlug?: string | null;
};

export type WorkflowKind = "dev" | "research" | "project_admin";
export type RepoBootstrapStrategy = "clone" | "worktree";

export type WorkflowGenerationResult = {
  projectId: string;
  bootstrapStrategy: RepoBootstrapStrategy;
  workflowPaths: string[];
};

export type ProvisionProjectFlowInput = {
  projectId: string;
  name: string;
  purpose?: string;
  lanes: string[];
  repoSlug?: string;
  repoPath?: string;
  defaultBranch?: string;
  bootstrapStrategy?: RepoBootstrapStrategy;
};

export type ProvisionProjectResult = WorkflowGenerationResult & {
  projectId: string;
  projectName: string;
  repoPath: string;
  bootstrapPaths: string[];
  reportJsonPath: string;
  reportMarkdownPath: string;
  workspacePath: string;
};

export type SmokeTestRequestShape = {
  title: string;
  description: string;
};

export function createProvisionedProjectFlow<TProject extends ProvisionableProject, TSmokeTest>(
  config: JSONObject,
  root: string,
  input: ProvisionProjectFlowInput,
  deps: {
    findProjectById: (projectId: string) => TProject | null;
    createProject: (input: ProvisionableProject) => TProject;
    createSmokeTest: (project: TProject) => TSmokeTest;
  }
): { project: TProject; provision: ProvisionProjectResult; smokeTest: TSmokeTest } {
  const existing = deps.findProjectById(input.projectId);
  const project = existing ?? deps.createProject({
    id: input.projectId,
    name: input.name,
    purpose: input.purpose,
    lanes: input.lanes,
    repoSlug: input.repoSlug
  });
  const provision = provisionProjectFoundation(config, root, {
    id: project.id,
    name: project.name,
    purpose: input.purpose ?? project.purpose,
    lanes: project.lanes,
    repoSlug: input.repoSlug ?? project.repoSlug,
    repoPath: input.repoPath,
    defaultBranch: input.defaultBranch,
    bootstrapStrategy: input.bootstrapStrategy
  });
  const smokeTest = deps.createSmokeTest(project);
  return { project, provision, smokeTest };
}

export function provisionProjectFoundation(
  config: JSONObject,
  root: string,
  input: ProvisionableProject & {
    defaultBranch?: string;
    repoPath?: string | null;
    workflowKinds?: WorkflowKind[];
    bootstrapStrategy?: RepoBootstrapStrategy;
  }
): ProvisionProjectResult {
  const repoRoot = resolve(root, configString(config.runtime, "repo_root", "./repos"));
  const workspaceRoot = resolve(root, configString(config.runtime, "workspace_root", "./workspaces"));
  const runtimeDataRoot = resolve(root, configString(config.runtime, "data_dir", "./runtime-data"));
  const repoSlug = input.repoSlug ?? slugifyRepoSlug(input.name);
  const repoPath = resolveProvisionRepoPath(repoRoot, repoSlug, input.repoPath ?? null);
  const workspacePath = resolve(workspaceRoot, input.id);

  mkdirSync(repoPath, { recursive: true });
  mkdirSync(workspacePath, { recursive: true });

  const bootstrapPaths = writeBootstrapFiles(repoPath, input, repoSlug);
  const workflow = generateProjectWorkflows(config, root, {
    id: input.id,
    name: input.name,
    purpose: input.purpose ?? null,
    lanes: input.lanes,
    repoSlug
  }, {
    defaultBranch: input.defaultBranch,
    workflowKinds: input.workflowKinds,
    bootstrapStrategy: input.bootstrapStrategy
  });

  const reportRoot = resolve(runtimeDataRoot, "provisioning", input.id);
  mkdirSync(reportRoot, { recursive: true });
  const reportJsonPath = resolve(reportRoot, "provision-report.json");
  const reportMarkdownPath = resolve(reportRoot, "provision-report.md");
  const report = {
    projectId: input.id,
    projectName: input.name,
    purpose: input.purpose ?? null,
    repoSlug,
    repoPath,
    workspacePath,
    workflowPaths: workflow.workflowPaths,
    bootstrapStrategy: workflow.bootstrapStrategy,
    bootstrapPaths,
    createdAt: new Date().toISOString()
  };
  writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(reportMarkdownPath, renderProvisionReport(report), "utf8");

  return {
    projectId: input.id,
    projectName: input.name,
    repoPath,
    workspacePath,
    workflowPaths: workflow.workflowPaths,
    bootstrapStrategy: workflow.bootstrapStrategy,
    bootstrapPaths,
    reportJsonPath,
    reportMarkdownPath
  };
}

export function generateProjectWorkflows(
  config: JSONObject,
  root: string,
  project: ProvisionableProject & { repoSlug?: string | null },
  options?: { defaultBranch?: string; workflowKinds?: WorkflowKind[]; bootstrapStrategy?: RepoBootstrapStrategy }
): WorkflowGenerationResult {
  const workflowRoot = resolve(root, configString(config.runtime, "workflow_root", "./workflows"));
  const repoRoot = resolve(root, configString(config.runtime, "repo_root", "./repos"));
  const workspaceRoot = resolve(root, configString(config.runtime, "workspace_root", "./workspaces"));
  const repoSlug = project.repoSlug ?? slugifyRepoSlug(project.name);
  const repoPath = resolve(repoRoot, repoSlug);
  const defaultBranch = options?.defaultBranch ?? "main";
  const workflowKinds = options?.workflowKinds ?? deriveWorkflowKinds(project.id, project.lanes);
  const bootstrapStrategy = resolveBootstrapStrategy(config, options?.bootstrapStrategy);

  mkdirSync(workflowRoot, { recursive: true });
  mkdirSync(resolve(workspaceRoot, project.id), { recursive: true });

  const workflowPaths: string[] = [];
  for (const workflowKind of workflowKinds) {
    const { fileName, body } = renderWorkflow(workspaceRoot, project, {
      repoPath,
      repoSlug,
      defaultBranch,
      bootstrapStrategy,
      workflowKind
    });
    const path = resolve(workflowRoot, fileName);
    writeFileSync(path, body, "utf8");
    workflowPaths.push(path);
  }

  return {
    projectId: project.id,
    bootstrapStrategy,
    workflowPaths
  };
}

function writeBootstrapFiles(repoPath: string, project: ProvisionableProject, repoSlug: string): string[] {
  const paths = [
    resolve(repoPath, "README.md"),
    resolve(repoPath, "docs", "BOOTSTRAP.md"),
    resolve(repoPath, "plans", "bootstrap", "INITIAL_PLAN.md")
  ];

  writeFileIfMissing(paths[0], renderRepoReadme(project, repoSlug));
  writeFileIfMissing(paths[1], renderBootstrapDoc(project));
  writeFileIfMissing(paths[2], renderInitialPlan(project));
  return paths;
}

export function createProjectSmokeTestRequest(projectName: string): SmokeTestRequestShape {
  return {
    title: `Smoke test ${projectName}`,
    description: `Verify the ${projectName} runtime foundation, repo path, workflow files, and bootstrap docs.`
  };
}

function renderWorkflow(
  workspaceRoot: string,
  project: ProvisionableProject,
  input: {
    repoPath: string;
    repoSlug: string;
    defaultBranch: string;
    bootstrapStrategy: RepoBootstrapStrategy;
    workflowKind: WorkflowKind;
  }
): { fileName: string; body: string } {
  const afterCreateHook = renderAfterCreateHook(input.repoPath, input.defaultBranch, input.bootstrapStrategy);
  switch (input.workflowKind) {
    case "project_admin":
      return {
        fileName: "WORKFLOW.project-admin.md",
        body: `---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "Project Managing"
  active_states:
    - Todo
    - In Progress
  terminal_states:
    - Done
    - Canceled
workspace:
  root: "${resolve(workspaceRoot, project.id)}"
hooks:
  after_create: |
${indentBlock(afterCreateHook, 4)}
agent:
  max_concurrent_agents: 1
  max_turns: 12
codex:
  command: codex app-server
---

You are the project administration agent for ${project.name}.

Use this workflow to provision repos, generate workflows, and record exact paths for every generated artifact.
`
      };
    case "research":
      return {
        fileName: `WORKFLOW.${input.repoSlug}.research.md`,
        body: `---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "${project.name}"
  active_states:
    - Research
    - Planning
  terminal_states:
    - Done
    - Canceled
workspace:
  root: "${resolve(workspaceRoot, project.id)}"
hooks:
  after_create: |
    mkdir -p notes output sources
agent:
  max_concurrent_agents: 1
  max_turns: 10
codex:
  command: codex app-server
---

You are the research lane agent for ${project.name}.

Use the workspace as a report folder. Produce structured notes, comparisons, and decision-ready recommendations.
`
      };
    case "dev":
    default:
      return {
        fileName: `WORKFLOW.${input.repoSlug}.dev.md`,
        body: `---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "${project.name}"
  active_states:
    - Todo
    - In Progress
    - Rework
  terminal_states:
    - Done
    - Canceled
workspace:
  root: "${resolve(workspaceRoot, project.id)}"
hooks:
  after_create: |
${indentBlock(afterCreateHook, 4)}
agent:
  max_concurrent_agents: 1
  max_turns: 16
codex:
  command: codex app-server
---

You are the engineering delivery agent for ${project.name}.

Work inside the prepared workspace clone. Record exact file changes, verification commands, and next recommended state transitions.
`
      };
  }
}

function renderRepoReadme(project: ProvisionableProject, repoSlug: string): string {
  return `# ${project.name}

Provisioned by Comphony.

## Project

- ID: \`${project.id}\`
- Repo slug: \`${repoSlug}\`
- Purpose: ${project.purpose ?? "No purpose provided."}

## Supported Lanes

${project.lanes.map((lane) => `- ${lane}`).join("\n")}

## Local Operation

- Repos root: \`repos/${repoSlug}\`
- Workspace root: \`workspaces/${project.id}\`
- Workflow files: generated under \`workflows/\`
`;
}

function renderBootstrapDoc(project: ProvisionableProject): string {
  return `# Bootstrap Notes

This project was provisioned by Comphony.

## Purpose

${project.purpose ?? "No purpose provided."}

## Initial Expectations

- Prepare runnable local workflows
- Keep repo, workspace, and workflow paths explicit
- Use Comphony to emit follow-up work and smoke tests
`;
}

function renderInitialPlan(project: ProvisionableProject): string {
  return `# Initial Plan

## Goal

${project.name}

## First Tasks

1. Confirm runtime and workflow wiring.
2. Create an initial smoke-test request.
3. Verify repo, workflow, and workspace paths are correct.

## Lanes

${project.lanes.map((lane) => `- ${lane}`).join("\n")}
`;
}

function renderProvisionReport(report: {
  projectId: string;
  projectName: string;
  purpose: string | null;
  repoSlug: string;
  repoPath: string;
  workspacePath: string;
  workflowPaths: string[];
  bootstrapStrategy: RepoBootstrapStrategy;
  bootstrapPaths: string[];
  createdAt: string;
}): string {
  return `# Provision Report

Generated at ${report.createdAt}

## Project

- ID: \`${report.projectId}\`
- Name: ${report.projectName}
- Repo slug: \`${report.repoSlug}\`
- Purpose: ${report.purpose ?? "No purpose provided."}

## Paths

- Repo: \`${report.repoPath}\`
- Workspace root: \`${report.workspacePath}\`
- Bootstrap strategy: \`${report.bootstrapStrategy}\`

## Workflows

${report.workflowPaths.map((path) => `- \`${path}\``).join("\n")}

## Bootstrap Artifacts

${report.bootstrapPaths.map((path) => `- \`${path}\``).join("\n")}
`;
}

function deriveWorkflowKinds(projectId: string, lanes: string[]): WorkflowKind[] {
  if (projectId === "project_managing") {
    return ["project_admin"];
  }
  const workflowKinds: WorkflowKind[] = [];
  if (lanes.includes("research")) {
    workflowKinds.push("research");
  }
  if (lanes.includes("build") || lanes.includes("review") || lanes.includes("planning")) {
    workflowKinds.push("dev");
  }
  return workflowKinds.length > 0 ? workflowKinds : ["dev"];
}

function resolveProvisionRepoPath(repoRoot: string, repoSlug: string, configuredRepoPath: string | null): string {
  if (!configuredRepoPath) {
    return resolve(repoRoot, repoSlug);
  }
  const absolute = resolve(configuredRepoPath);
  const relativeToRoot = relative(repoRoot, absolute);
  if (relativeToRoot.startsWith("..") || relativeToRoot === "") {
    if (relativeToRoot === "") {
      return absolute;
    }
    throw new Error(`Provisioned repo path must live under ${repoRoot}`);
  }
  return absolute;
}

function writeFileIfMissing(path: string, body: string): void {
  if (existsSync(path)) {
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, "utf8");
}

function slugifyRepoSlug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "project";
}

function configString(
  section: unknown,
  key: string,
  fallback: string
): string {
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    return fallback;
  }
  const value = (section as Record<string, unknown>)[key];
  return typeof value === "string" ? value : fallback;
}

function resolveBootstrapStrategy(config: JSONObject, explicit?: RepoBootstrapStrategy): RepoBootstrapStrategy {
  if (explicit) {
    return explicit;
  }
  const configured = configString(config.runtime, "repo_bootstrap_strategy", "clone");
  return configured === "worktree" ? "worktree" : "clone";
}

function renderAfterCreateHook(repoPath: string, defaultBranch: string, strategy: RepoBootstrapStrategy): string {
  if (strategy === "worktree") {
    return `git -C ${shellQuote(repoPath)} worktree add --force --detach . ${shellQuote(defaultBranch)}`;
  }
  return `git clone --depth 1 --branch ${shellQuote(defaultBranch)} ${shellQuote(`file://${repoPath}`)} .`;
}

function indentBlock(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return value.split("\n").map((line) => `${prefix}${line}`).join("\n");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}
