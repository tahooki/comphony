import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import YAML from "yaml";

import type { JSONObject } from "./config.js";
import type { RuntimeState, TaskRecord } from "./state.js";

type AgentManifest = {
  id: string;
  name: string;
  role: string;
  description?: string;
  entrypoints?: {
    prompt?: string;
  };
};

type AgentRuntimeInput = {
  config: JSONObject;
  root: string;
  state: RuntimeState;
  task: TaskRecord;
  agentId: string;
};

export type AgentRuntimeResult = {
  artifactPaths: string[];
  summary: string;
};

export function generateTaskArtifacts(input: AgentRuntimeInput): AgentRuntimeResult {
  const agent = loadAgentManifest(input.config, input.root, input.agentId);
  const project = input.state.projects.find((item) => item.id === input.task.projectId);
  if (!project) {
    throw new Error(`Unknown project id: ${input.task.projectId}`);
  }

  const repoBase = resolveProjectRepoRoot(input.config, input.root, project.repoSlug ?? project.id);
  const workspaceBase = resolveProjectWorkspaceRoot(input.config, input.root, project.id, input.task.id);
  const promptText = loadAgentPrompt(input.config, input.root, input.agentId, agent);

  switch (agent.role) {
    case "design":
      return writeDesignArtifacts(repoBase, input.task, agent, promptText);
    case "build":
      return writeBuildArtifacts(workspaceBase, input.task, agent, promptText);
    case "publishing":
      return writePublishingArtifacts(workspaceBase, input.task, agent, promptText);
    case "coordination":
    default:
      return writeCoordinationArtifacts(workspaceBase, input.task, agent, promptText);
  }
}

function loadAgentManifest(config: JSONObject, root: string, agentId: string): AgentManifest {
  const agents = Array.isArray(config.agents) ? config.agents : [];
  const configAgent = agents.find((item) => isMap(item) && item.id === agentId);
  if (!isMap(configAgent)) {
    throw new Error(`Unknown agent configuration for ${agentId}`);
  }
  const source = isMap(configAgent.source) ? configAgent.source : null;
  const ref = typeof source?.ref === "string" ? source.ref : null;
  if (!ref) {
    throw new Error(`Agent ${agentId} is missing source.ref`);
  }

  const manifestPath = resolve(root, ref, "agent.yaml");
  const parsed = YAML.parse(readFileSync(manifestPath, "utf8")) as unknown;
  if (!isMap(parsed)) {
    throw new Error(`Invalid agent manifest: ${manifestPath}`);
  }
  return {
    id: typeof parsed.id === "string" ? parsed.id : agentId,
    name: typeof parsed.name === "string" ? parsed.name : agentId,
    role: typeof parsed.role === "string" ? parsed.role : "coordination",
    description: typeof parsed.description === "string" ? parsed.description : undefined,
    entrypoints: isMap(parsed.entrypoints)
      ? { prompt: typeof parsed.entrypoints.prompt === "string" ? parsed.entrypoints.prompt : undefined }
      : undefined
  };
}

function loadAgentPrompt(config: JSONObject, root: string, agentId: string, agent: AgentManifest): string {
  const agents = Array.isArray(config.agents) ? config.agents : [];
  const configAgent = agents.find((item) => isMap(item) && item.id === agentId);
  if (!isMap(configAgent)) {
    return "";
  }
  const source = isMap(configAgent.source) ? configAgent.source : null;
  const ref = typeof source?.ref === "string" ? source.ref : null;
  const promptRef = agent.entrypoints?.prompt;
  if (!ref || !promptRef) {
    return "";
  }
  try {
    return readFileSync(resolve(root, ref, promptRef), "utf8");
  } catch {
    return "";
  }
}

function writeDesignArtifacts(repoBase: string, task: TaskRecord, agent: AgentManifest, promptText: string): AgentRuntimeResult {
  const masterPath = resolve(repoBase, "design-system", "MASTER.md");
  const planPath = resolve(repoBase, "plans", "design", "design-plan.md");
  const handoffPath = resolve(repoBase, "plans", "design", "dev-handoff.md");

  writeText(masterPath, designSystemBody(task, agent, promptText));
  writeText(planPath, designPlanBody(task, agent, promptText));
  writeText(handoffPath, designHandoffBody(task, agent));

  return {
    artifactPaths: [masterPath, planPath, handoffPath],
    summary: `${agent.name} created the design system, design plan, and developer handoff for ${task.title}.`
  };
}

function writeBuildArtifacts(workspaceBase: string, task: TaskRecord, agent: AgentManifest, promptText: string): AgentRuntimeResult {
  const implementationPath = resolve(workspaceBase, "implementation-note.md");
  const changeLogPath = resolve(workspaceBase, "change-summary.md");

  writeText(implementationPath, implementationBody(task, agent, promptText));
  writeText(changeLogPath, changeSummaryBody(task, agent));

  return {
    artifactPaths: [implementationPath, changeLogPath],
    summary: `${agent.name} produced implementation notes and a change summary for ${task.title}.`
  };
}

function writePublishingArtifacts(workspaceBase: string, task: TaskRecord, agent: AgentManifest, promptText: string): AgentRuntimeResult {
  const visualQaPath = resolve(workspaceBase, "visual-qa-report.md");
  const releaseNotePath = resolve(workspaceBase, "publishing-note.md");

  writeText(visualQaPath, visualQaBody(task, agent, promptText));
  writeText(releaseNotePath, publishingNoteBody(task, agent));

  return {
    artifactPaths: [visualQaPath, releaseNotePath],
    summary: `${agent.name} created visual QA and publishing notes for ${task.title}.`
  };
}

function writeCoordinationArtifacts(workspaceBase: string, task: TaskRecord, agent: AgentManifest, promptText: string): AgentRuntimeResult {
  const summaryPath = resolve(workspaceBase, "coordination-summary.md");
  writeText(summaryPath, coordinationSummaryBody(task, agent, promptText));
  return {
    artifactPaths: [summaryPath],
    summary: `${agent.name} created a coordination summary for ${task.title}.`
  };
}

function designSystemBody(task: TaskRecord, agent: AgentManifest, promptText: string): string {
  return `# MASTER Design System

Generated by ${agent.name} for task \`${task.id}\`.

## Product Direction

- Focus area: ${task.title}
- Lane: ${task.lane}
- Project: ${task.projectId}

## Visual System

- Primary surface: warm neutral panels with strong data contrast
- Accent usage: dark green for ownership, blue for active states, amber for warnings
- Card rhythm: 16-18px radii, layered panels, visible grouping by work stage
- Typography: editorial serif for company voice, practical sans for controls

## Component Rules

- Summary cards must always show one action-oriented metric and one supporting context line
- Thread views should separate user asks, agent replies, and task state changes clearly
- Action buttons should keep one clear primary action and several secondary next-step actions

## Source Prompt

\`\`\`md
${promptText.trim() || "No prompt text available."}
\`\`\`
`;
}

function designPlanBody(task: TaskRecord, agent: AgentManifest, promptText: string): string {
  return `# Design Plan

Generated by ${agent.name} for task \`${task.id}\`.

## Goal

${task.title}

## Working Brief

${task.description || "No additional task description provided."}

## Planned UX

1. Clarify the current operator goal in the first screenful.
2. Make thread selection and task actions readable without context switching.
3. Show the most recent system movement through events and status transitions.

## Proposed Deliverables

- Refined thread-detail layout
- Action strip for task assignment and status changes
- Stronger event and work-state storytelling

## Prompt Context

\`\`\`md
${promptText.trim() || "No prompt text available."}
\`\`\`
`;
}

function designHandoffBody(task: TaskRecord, agent: AgentManifest): string {
  return `# Developer Handoff

Prepared by ${agent.name} for task \`${task.id}\`.

## Required UI Work

- Preserve the three-column operating layout on desktop.
- Keep thread detail and task controls in the center panel.
- Surface artifacts and agent notes near the related task.

## Interaction Rules

- A selected thread must show messages and tasks together.
- Task actions must support assign, run turn, and status transitions.
- Event changes should feel live through the stream, not page reloads.

## Acceptance

- Intake request creates a thread and linked task.
- Assigned task can run a work turn.
- Agent output is visible in the thread after the work turn.
`;
}

function implementationBody(task: TaskRecord, agent: AgentManifest, promptText: string): string {
  return `# Implementation Note

Author: ${agent.name}
Task: ${task.id}

## Scope

${task.title}

## Build Intent

- Apply the existing design handoff files before changing UI structure.
- Keep implementation scoped to the requested lane and task.
- Preserve live event updates and thread-task linkage.

## Prompt Context

\`\`\`md
${promptText.trim() || "No prompt text available."}
\`\`\`
`;
}

function changeSummaryBody(task: TaskRecord, agent: AgentManifest): string {
  return `# Change Summary

Prepared by ${agent.name} for ${task.id}.

- Reviewed the assigned work package
- Prepared implementation notes for the requested change
- Left a summary artifact in the task workspace for review
`;
}

function visualQaBody(task: TaskRecord, agent: AgentManifest, promptText: string): string {
  return `# Visual QA Report

Prepared by ${agent.name} for ${task.id}.

## Visual Checks

- Layout hierarchy is readable
- Primary and secondary actions are distinguishable
- Event stream and thread detail remain legible together

## Reference Prompt

\`\`\`md
${promptText.trim() || "No prompt text available."}
\`\`\`
`;
}

function publishingNoteBody(task: TaskRecord, agent: AgentManifest): string {
  return `# Publishing Note

Prepared by ${agent.name} for ${task.id}.

- Publishing lane completed a QA-oriented pass.
- Review-ready notes were generated in this workspace.
`;
}

function coordinationSummaryBody(task: TaskRecord, agent: AgentManifest, promptText: string): string {
  return `# Coordination Summary

Prepared by ${agent.name} for ${task.id}.

## Task

${task.title}

## Coordination Intent

- Clarify owner
- Confirm next lane
- Summarize outstanding questions

## Prompt Context

\`\`\`md
${promptText.trim() || "No prompt text available."}
\`\`\`
`;
}

function resolveProjectRepoRoot(config: JSONObject, root: string, repoSlug: string): string {
  const runtime = isMap(config.runtime) ? config.runtime : null;
  const repoRoot = typeof runtime?.repo_root === "string" ? runtime.repo_root : "./repos";
  return resolve(root, repoRoot, repoSlug);
}

function resolveProjectWorkspaceRoot(config: JSONObject, root: string, projectId: string, taskId: string): string {
  const runtime = isMap(config.runtime) ? config.runtime : null;
  const workspaceRoot = typeof runtime?.workspace_root === "string" ? runtime.workspace_root : "./workspaces";
  return resolve(root, workspaceRoot, projectId, taskId);
}

function writeText(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, "utf8");
}

function isMap(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
