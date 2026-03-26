import { TASK_STATUS, isTaskComplete } from "../state/task-policy.js";

type AgentLike = {
  id: string;
  name: string;
  role: string;
  assignedProjects: string[];
  sourceKind?: string | null;
  sourceRef?: string | null;
};

type TaskLike = {
  id: string;
  title: string;
  lane: string;
  status: string;
  projectId: string;
  assigneeId: string | null;
  blockingReason: string | null;
  completionSummary: string | null;
  parentTaskId: string | null;
};

type ThreadDetailLike = {
  thread: { id: string; title: string };
  tasks: TaskLike[];
  consultations: Array<{ status: string }>;
  reviews: Array<{ status: string }>;
  approvals: Array<{ status: string }>;
};

type ContinueThreadResultLike = {
  action: string;
  task: TaskLike | null;
  notes: string[];
};

type MemoryLike = {
  kind: string;
  body: string;
};

type RecommendedTaskLike = {
  id: string;
  title: string;
  lane: string;
  status: string;
};

export function composeContinueLoopReply(results: ContinueThreadResultLike[]): string {
  if (results.length === 0) {
    return "Comphony did not take any additional action on this thread.";
  }
  const lines = ["Comphony continued the thread automatically."];
  for (const result of results) {
    lines.push(`- ${result.action}: ${result.task?.title ?? "thread"}${result.task ? ` (${result.task.status})` : ""}`);
  }
  const final = results[results.length - 1];
  if (final?.notes?.length) {
    lines.push(`Latest note: ${final.notes.join(", ")}`);
  }
  return lines.join("\n");
}

export function composeProjectCreationReply(project: { name: string; id: string; lanes: string[]; repoSlug?: string | null }): string {
  return [
    `Comphony opened a new project: ${project.name}.`,
    `Project id: ${project.id}.`,
    `Lanes: ${project.lanes.join(", ")}.`,
    `Repo slug: ${project.repoSlug ?? "-"}.`
  ].join(" ");
}

export function composeAgentInstallReply(result: { agent: AgentLike; assignedProjectId: string | null }): string {
  return [
    `Comphony installed ${result.agent.name} (${result.agent.id}) as a ${result.agent.role} agent.`,
    `Source: ${result.agent.sourceKind ?? "-"} ${result.agent.sourceRef ?? ""}`.trim(),
    result.assignedProjectId ? `Assigned to project ${result.assignedProjectId}.` : "No project assignment was applied yet."
  ].join(" ");
}

export function composePeopleSummaryReply(
  people: Array<{ name: string; role: string; availability: string; activeTaskCount: number; consultationCount: number; reviewCount: number }>
): string {
  if (people.length === 0) {
    return "Comphony has no registered agents yet.";
  }
  const ordered = people.slice().sort((left, right) => {
    const score = (person: typeof left) => person.activeTaskCount + person.consultationCount + person.reviewCount;
    return score(right) - score(left);
  });
  return [
    "Current team snapshot:",
    ...ordered.map(
      (person) =>
        `- ${person.name} (${person.role}) · ${person.availability} · tasks=${person.activeTaskCount} · consultations=${person.consultationCount} · reviews=${person.reviewCount}`
    )
  ].join("\n");
}

export function composeAgentDirectedReply(agent: AgentLike, detail: ThreadDetailLike, body: string): string {
  const ownedTasks = detail.tasks.filter(
    (task) => task.assigneeId === agent.id || (task.projectId && agent.assignedProjects.includes(task.projectId))
  );
  const currentTask = ownedTasks.find((task) => !isTaskComplete(task)) ?? ownedTasks[0];
  if (!currentTask) {
    return `${agent.name} does not have a linked task on this thread yet. Comphony can assign follow-up work if needed.`;
  }
  return [
    `${agent.name} here.`,
    `I am handling ${currentTask.title} on the ${currentTask.lane} lane.`,
    `Current status: ${currentTask.status}.`,
    currentTask.blockingReason ? `Blocker: ${currentTask.blockingReason}.` : "No active blocker right now.",
    currentTask.completionSummary ? `Latest outcome: ${currentTask.completionSummary}` : `Latest request: ${body}`
  ].join(" ");
}

export function composeManagerThreadReply(
  detail: ThreadDetailLike,
  latestUserBody: string,
  memories: MemoryLike[],
  recommendedTasks: RecommendedTaskLike[]
): string {
  const currentTasks = detail.tasks.filter((task) => task.parentTaskId !== null);
  const openConsultations = detail.consultations.filter((consultation) => consultation.status === "requested");
  const openReviews = detail.reviews.filter((review) => review.status === "requested");
  const openApprovals = detail.approvals.filter((approval) => approval.status === "requested");
  const currentTask = currentTasks.find((task) => !isTaskComplete(task)) ?? currentTasks[0];
  if (!currentTask) {
    return `Comphony logged your follow-up: "${latestUserBody}". This thread has no active child tasks right now.`;
  }

  const whyAssigned = currentTask.assigneeId
    ? `Assigned to ${currentTask.assigneeId} because the current lane is ${currentTask.lane}.`
    : "No assignee yet because Comphony has not selected the next worker.";
  const nextStep =
    currentTask.status === TASK_STATUS.reviewRequested
      ? "Next step: finish the pending review."
      : currentTask.status === TASK_STATUS.waiting
        ? "Next step: wait for approval before resuming."
        : currentTask.status === TASK_STATUS.consulting
          ? "Next step: wait for specialist input."
          : "Next step: continue execution on the active lane.";

  return [
    `Comphony logged your follow-up: "${latestUserBody}".`,
    `Current focus: ${currentTask.title}.`,
    `Lane=${currentTask.lane}, status=${currentTask.status}, assignee=${currentTask.assigneeId ?? "-"}.`,
    whyAssigned,
    nextStep,
    `Open coordination: consultations=${openConsultations.length}, reviews=${openReviews.length}, approvals=${openApprovals.length}.`,
    ...(memories.length > 0 ? ["Related memory:", ...memories.map((memory) => `- ${memory.kind}: ${memory.body}`)] : []),
    ...(recommendedTasks.length > 0
      ? ["Similar tasks:", ...recommendedTasks.map((task) => `- ${task.id}: ${task.title} (${task.lane}, ${task.status})`)]
      : [])
  ].join("\n");
}
