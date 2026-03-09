# Comphony Product Alignment Plan

## Purpose

This plan defines how to move the current Comphony runtime from a strong local MVP into a product that matches the intended purpose:

- the user talks to `Comphony`
- `Comphony` decides how work should move
- agents collaborate internally
- the user stays focused on outcomes, not internal mechanics

This document is not a delivery schedule.
It is an operating-level implementation plan for improving product fit.

## Current Assessment

The current system already proves several important ideas:

- local-first company runtime
- one chat entry point
- tasks, memory, events, consultations, reviews, and approvals
- dynamic projects and agents
- design-to-build handoff artifacts

However, the product still behaves too much like an operator console.

The main gaps are:

- the user still drives internal steps manually
- direct conversation with a specific agent is missing
- task decomposition is too flat
- people and projects are not yet first-class operating surfaces
- Comphony reports status, but it does not yet feel like a manager orchestrating the company

## Product Goal

The target experience is:

> A user gives Comphony an outcome, Comphony builds a plan, delegates work, coordinates agents, and reports back without requiring the user to operate the workflow manually.

## Design Principles

Every implementation choice in this plan should reinforce these principles:

1. Conversation-first
2. One front door
3. Dynamic delegation
4. Visible internal collaboration
5. Explainable decisions
6. Persistent company memory
7. Local-first control
8. Advanced controls should exist, but not dominate the default experience

## Primary Workstreams

## 1. Default Autonomous Orchestration

### Problem

The current UI exposes too many explicit task controls such as assign, work, handoff, review, and approval.
That is useful for debugging, but it weakens the core promise of "tell Comphony what you want."

### Goal

Make the default path autonomous.
The user should normally create an intake request and let Comphony advance the task graph on its own.

### Changes

- Add a planner step after intake
- Let Comphony decide whether the request needs planning, research, design, build, review, or approval
- Automatically advance tasks when the next step is clear
- Move manual task buttons into an explicit advanced mode
- Add a single high-level user action such as `Continue`, `Pause`, `Escalate`, or `Take Over`

### Acceptance Criteria

- A normal user can complete a request without pressing low-level workflow buttons
- Comphony can move a task from intake to at least one downstream lane automatically
- The default web UI reads like a conversation tool, not an admin panel

## 2. Direct Agent Conversation

### Problem

The documents promise that the user can talk directly to a worker, but the runtime still routes mostly by project and lane.

### Goal

Support agent-directed conversation as a first-class interaction mode.

### Changes

- Add mention parsing such as `@Mina` or `@Researcher`
- Allow a thread to target:
  - Comphony
  - a specific agent
  - a project
  - a task
- Add agent inboxes and direct replies
- Allow an agent to answer in-character, while Comphony still remains the top-level company identity

### Acceptance Criteria

- A user can address a named agent directly from chat
- The system can route follow-up questions to the current task owner automatically
- Agent-directed messages are visible in thread history and event history

## 3. Task Graph And Decomposition

### Problem

The runtime has handoffs and reviews, but task creation is still mostly one message to one task.
That is not enough to model real company-like work.

### Goal

Turn the task system into a real graph.

### Changes

- Add `parentTaskId`, `childTaskIds`, and `dependsOnTaskIds`
- Add planner-generated subtask creation
- Allow a task to split into:
  - planning
  - research
  - design
  - build
  - publishing
  - review
- Allow multiple agent-owned subtasks under one user request
- Add roll-up status from children to parent

### Acceptance Criteria

- One user request can generate multiple linked tasks
- A parent request can show blocked, in progress, and completed child work
- Comphony can explain which subtasks exist and why

## 4. People Surface

### Problem

Agents exist in the runtime, but the product still lacks a real view of the company's workers.

### Goal

Make agents visible as employees, not just IDs attached to tasks.

### Changes

- Add a People view
- Show:
  - name
  - role
  - skills
  - current workload
  - assigned projects
  - last completed work
  - blocked tasks
- Add agent profile pages
- Add direct actions:
  - ask
  - assign
  - request review
  - reassign

### Acceptance Criteria

- A user can answer "who is doing what?" from the People surface
- A user can inspect one agent's recent history and current queue
- A user can initiate work by selecting an agent, not only a project

## 5. Projects Surface

### Problem

Projects exist, but they are not yet presented as operating environments with lanes, artifacts, and staffing.

### Goal

Make projects feel like working environments inside the company.

### Changes

- Add a Projects view
- Show:
  - project summary
  - active tasks
  - assigned agents
  - lane coverage
  - recent artifacts
  - sync targets
- Add project creation and configuration from the UI
- Add project health indicators

### Acceptance Criteria

- A user can understand the state of a project without reading raw task objects
- A user can see whether the project has enough staffing for its active lanes
- A user can create and inspect projects without using CLI only

## 6. Manager-Grade Reporting

### Problem

Comphony currently reports status, but not with enough managerial explanation.

### Goal

Make Comphony explain decisions, not just list state.

### Changes

- Add structured narrative summaries:
  - what happened
  - why it happened
  - what is blocked
  - what happens next
- Add "why this agent?" and "why this lane?" explanations
- Add parent request summaries across subtasks
- Add end-of-run reports

### Acceptance Criteria

- The user can ask `Why was this assigned here?`
- The user can ask `What happened since my last message?`
- The user can ask `What should happen next?`

## 7. Memory As Working Context

### Problem

Memory exists, but it still behaves more like recent logs and recommendations than shared company knowledge.

### Goal

Make memory part of work planning and decision quality.

### Changes

- Add decision memories
- Add reusable playbook memories
- Add project memory pinning
- Add agent memory scopes
- Add citations in Comphony replies when prior memory influenced the response

### Acceptance Criteria

- Comphony can answer with prior relevant decisions, not only recent events
- Agents can inherit project memory when assigned new work
- The user can inspect what prior memory influenced a recommendation

## 8. Advanced Mode As A Secondary Layer

### Problem

The current runtime exposes low-level controls too early.

### Goal

Keep debugging power without making it the main product face.

### Changes

- Add a default simple mode
- Add a separate advanced operations mode
- Move raw task controls, mutation buttons, and internal state manipulation into advanced mode
- Preserve manual operations for local operators and testing

### Acceptance Criteria

- First-time users see a clear conversation-first interface
- Power users can still access low-level controls when needed
- The product no longer reads like a workflow debugger by default

## Implementation Order

The recommended build order is:

1. Default autonomous orchestration
2. Direct agent conversation
3. Task graph and decomposition
4. People and Projects surfaces
5. Manager-grade reporting
6. Memory deepening
7. Advanced mode separation

This order is intentional.
The first three items change the product identity the most.
The rest make the company model visible and easier to trust.

## What Not To Do

The product should avoid these traps while evolving:

- turning the main UI into a bigger kanban board
- exposing more internal workflow buttons as the primary UX
- forcing the user to choose projects, lanes, and assignees too early
- making Comphony feel like a wrapper around isolated tools
- building connector-heavy features before the core company interaction feels right

## Definition Of Better

This plan is successful when the product shifts from:

- "I can manually operate an AI workflow runtime"

to:

- "I can talk to Comphony and watch a company organize itself around my request"

That is the standard for future development decisions.
