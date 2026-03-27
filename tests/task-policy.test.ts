import test from "node:test";
import assert from "node:assert/strict";

import {
  autoReviewTarget,
  isTaskAwaitingConsultation,
  isTaskBlocked,
  isTaskComplete,
  isTaskReviewRequested,
  isTaskWaitingForApproval,
  nextStatusForWorkTurn,
  refreshTaskGraphState,
  requiresDesignHandoff,
  selectAgentForTask,
  TASK_STATUS
} from "../src/state/task-policy.js";

test("task policy defines expected work-turn transitions", () => {
  assert.equal(nextStatusForWorkTurn("build", TASK_STATUS.new), TASK_STATUS.inProgress);
  assert.equal(nextStatusForWorkTurn("build", TASK_STATUS.triaged), TASK_STATUS.inProgress);
  assert.equal(nextStatusForWorkTurn("build", TASK_STATUS.assigned), TASK_STATUS.inProgress);
  assert.equal(nextStatusForWorkTurn("build", TASK_STATUS.inProgress), TASK_STATUS.review);
  assert.equal(nextStatusForWorkTurn("review", TASK_STATUS.triaged), TASK_STATUS.review);
  assert.equal(nextStatusForWorkTurn("review", TASK_STATUS.assigned), TASK_STATUS.review);
  assert.equal(nextStatusForWorkTurn("review", TASK_STATUS.inProgress), TASK_STATUS.done);
  assert.equal(nextStatusForWorkTurn("review", TASK_STATUS.done), TASK_STATUS.done);
});

test("task policy exposes blocked, complete, waiting, consultation, and review-requested guards", () => {
  assert.equal(isTaskComplete({ status: TASK_STATUS.reported }), true);
  assert.equal(isTaskComplete({ status: TASK_STATUS.done }), true);
  assert.equal(isTaskComplete({ status: TASK_STATUS.inProgress }), false);

  assert.equal(isTaskBlocked({ status: TASK_STATUS.blocked, needsApproval: false }), true);
  assert.equal(isTaskBlocked({ status: TASK_STATUS.waiting, needsApproval: false }), true);
  assert.equal(isTaskBlocked({ status: TASK_STATUS.consulting, needsApproval: false }), true);
  assert.equal(isTaskBlocked({ status: TASK_STATUS.inProgress, needsApproval: true }), true);
  assert.equal(isTaskBlocked({ status: TASK_STATUS.inProgress, needsApproval: false }), false);

  assert.equal(isTaskWaitingForApproval({ status: TASK_STATUS.waiting, needsApproval: false }), true);
  assert.equal(isTaskWaitingForApproval({ status: TASK_STATUS.inProgress, needsApproval: true }), true);
  assert.equal(isTaskWaitingForApproval({ status: TASK_STATUS.inProgress, needsApproval: false }), false);

  assert.equal(isTaskAwaitingConsultation({ status: TASK_STATUS.consulting }), true);
  assert.equal(isTaskAwaitingConsultation({ status: TASK_STATUS.waiting }), false);

  assert.equal(isTaskReviewRequested({ status: TASK_STATUS.reviewRequested }), true);
  assert.equal(isTaskReviewRequested({ status: TASK_STATUS.review }), false);
});

test("task policy enforces design handoff and reviewer selection rules", () => {
  assert.equal(requiresDesignHandoff("build", "planning"), true);
  assert.equal(requiresDesignHandoff("design", "build"), true);
  assert.equal(requiresDesignHandoff("design", "planning"), false);

  const state = {
    agents: [
      { id: "designer", role: "design", assignedProjects: ["product_core"] },
      { id: "builder", role: "build", assignedProjects: ["product_core"] },
      { id: "publisher", role: "publishing", assignedProjects: ["product_core"] }
    ]
  };

  const buildTask = {
    id: "task_1",
    projectId: "product_core",
    lane: "build",
    assigneeId: "builder"
  };

  const selected = selectAgentForTask(state, buildTask, {
    defaultProject: "product_core",
    defaultLane: "planning",
    laneKeywords: {},
    preferredRoles: {}
  });
  assert.equal(selected?.id, "builder");

  const reviewTarget = autoReviewTarget(state, buildTask);
  assert.equal(reviewTarget?.id, "publisher");
});

test("task policy refreshes parent-child graph status consistently", () => {
  const parent: {
    id: string;
    projectId: string;
    lane: string;
    status: string;
    assigneeId: string | null;
    parentTaskId: string | null;
    childTaskIds: string[];
    blockingReason: string | null;
    needsApproval: boolean;
    completionSummary: string | null;
    updatedAt: string;
  } = {
    id: "parent",
    projectId: "product_core",
    lane: "planning",
    status: TASK_STATUS.new,
    assigneeId: null,
    parentTaskId: null,
    childTaskIds: ["child_a", "child_b"],
    blockingReason: null,
    needsApproval: false,
    completionSummary: null,
    updatedAt: "2026-03-26T00:00:00.000Z"
  };

  const childA: typeof parent = {
    id: "child_a",
    projectId: "product_core",
    lane: "design",
    status: TASK_STATUS.done,
    assigneeId: null,
    parentTaskId: "parent",
    childTaskIds: [],
    blockingReason: null,
    needsApproval: false,
    completionSummary: null,
    updatedAt: "2026-03-26T00:00:00.000Z"
  };

  const childB: typeof parent = {
    id: "child_b",
    projectId: "product_core",
    lane: "build",
    status: TASK_STATUS.waiting,
    assigneeId: null,
    parentTaskId: "parent",
    childTaskIds: [],
    blockingReason: "approval pending",
    needsApproval: true,
    completionSummary: null,
    updatedAt: "2026-03-26T00:00:00.000Z"
  };

  const state = {
    agents: [],
    tasks: [parent, childA, childB]
  };

  refreshTaskGraphState(state, "child_b");
  assert.equal(parent.status, TASK_STATUS.blocked);
  assert.equal(parent.blockingReason, "approval pending");

  childB.status = TASK_STATUS.done;
  childB.needsApproval = false;
  childB.blockingReason = null;
  refreshTaskGraphState(state, "child_b");

  assert.equal(parent.status, TASK_STATUS.done);
  assert.equal(parent.completionSummary, "Completed child lanes: design, build.");
});

test("task policy marks Desk parent as reported when downstream children report back", () => {
  const parent = {
    id: "desk_parent",
    projectId: "comphony_desk",
    lane: "planning",
    status: TASK_STATUS.inProgress,
    assigneeId: null,
    parentTaskId: null,
    childTaskIds: ["pm_child"],
    blockingReason: null,
    needsApproval: false,
    completionSummary: null,
    artifactPaths: [],
    updatedAt: "2026-03-26T00:00:00.000Z"
  };

  const child = {
    id: "pm_child",
    projectId: "project_managing",
    lane: "planning",
    status: TASK_STATUS.reported,
    assigneeId: null,
    parentTaskId: "desk_parent",
    childTaskIds: [],
    blockingReason: null,
    needsApproval: false,
    completionSummary: "Provision report captured the repo, workflow, and bootstrap paths.",
    artifactPaths: ["/tmp/provision-report.md"],
    updatedAt: "2026-03-26T00:00:00.000Z"
  };

  const state = {
    agents: [],
    tasks: [parent, child]
  };

  refreshTaskGraphState(state, "pm_child");

  assert.equal(parent.status, TASK_STATUS.reported);
  assert.match(parent.completionSummary ?? "", /Project Managing reported back to Comphony Desk/);
  assert.match(parent.completionSummary ?? "", /Artifacts: \/tmp\/provision-report.md\./);
});

test("task policy treats completed downstream Desk children as a report boundary", () => {
  const parent = {
    id: "desk_parent",
    projectId: "comphony_desk",
    lane: "planning",
    status: TASK_STATUS.inProgress,
    assigneeId: null,
    parentTaskId: null,
    childTaskIds: ["product_child"],
    blockingReason: null,
    needsApproval: false,
    completionSummary: null,
    artifactPaths: [],
    updatedAt: "2026-03-26T00:00:00.000Z"
  };

  const child = {
    id: "product_child",
    projectId: "product_core",
    lane: "planning",
    status: TASK_STATUS.done,
    assigneeId: null,
    parentTaskId: "desk_parent",
    childTaskIds: [],
    blockingReason: null,
    needsApproval: false,
    completionSummary: "Plan complete.",
    artifactPaths: ["/tmp/product-plan.md"],
    updatedAt: "2026-03-26T00:00:00.000Z"
  };

  const state = {
    agents: [],
    tasks: [parent, child]
  };

  refreshTaskGraphState(state, "product_child");

  assert.equal(parent.status, TASK_STATUS.reported);
  assert.match(parent.completionSummary ?? "", /Product Core reported back to Comphony Desk/);
  assert.match(parent.completionSummary ?? "", /Plan complete\./);
  assert.match(parent.completionSummary ?? "", /Artifacts: \/tmp\/product-plan.md\./);
});
