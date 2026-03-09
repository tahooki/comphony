# Comphony MVP And Development Direction

This document translates the product vision into a practical development direction.

It is not a schedule.
It is a staged definition of what must exist before `Comphony` feels like a real product.

## 1. Product Shift

The old prototype direction was:

- Symphony + Linear
- one intake lane
- downstream project routing
- workflow files and shell helpers

The new product direction is:

- `Comphony` as the user-facing company
- `Comphony Chat` as the front door
- a local-first server runtime
- dynamic agent registry
- task graph with handoff/review/consultation
- optional sync to external systems

That means MVP should be chosen around the new center of gravity, not only the old workflow structure.

## 2. MVP Goal

The MVP should prove this sentence:

> A user can talk to Comphony, have work delegated to the right agent, inspect progress, and get the result back without manually managing internal routing.

If that works, the product already has its core identity.

## 3. MVP Scope

The first true MVP should include five things.

### 3.1 Comphony Chat

A web-based chat surface where the user can:

- send a request
- ask status questions
- ask a specific agent directly
- receive results and follow-up questions

### 3.2 Agent Registry

The system must support:

- registering agents
- listing agents
- attaching agents to projects
- storing basic role metadata

### 3.3 Task Graph

The system must support:

- creating a task from a chat request
- assigning a task to an agent
- delegating to another agent
- requesting review
- marking blocked/waiting/done

### 3.4 Local Runtime

The system must support:

- running on a user's local machine or personal server
- accessing local repos and workspaces
- invoking the real execution tools

### 3.5 Live Status Loop

The system must support:

- sending progress updates back to the chat UI
- showing owner, blockers, and recent events
- reporting final results in one place

## 4. MVP Features

The feature list should be intentionally narrow.

### Must Have

- `Comphony Chat`
- local `comphony server`
- agent registry
- project registry
- task assignment
- handoff
- review request
- memory note capture
- realtime updates

### Should Have

- responsive mobile-friendly web UI
- external agent import by metadata URL
- searchable memory view
- task timeline view

### Later

- Telegram
- Discord
- Slack
- advanced marketplace
- billing/cost tracking
- cross-company shared templates

## 5. Recommended Build Order

The most practical build order is:

1. define core entities
2. define local runtime contract
3. build local `comphony server`
4. build `Comphony Chat` web UI
5. add realtime sync layer
6. add agent registry UI
7. add task graph operations
8. connect execution tools
9. add memory search
10. add external connectors

## 6. Core Entities To Implement

The data model should start with these tables or equivalents:

- `agents`
- `projects`
- `tasks`
- `task_events`
- `task_assignments`
- `handoffs`
- `reviews`
- `threads`
- `messages`
- `memory_items`

This is a better product foundation than only modeling workflow files.

## 7. Agent Model

Each agent should minimally include:

- `id`
- `name`
- `role`
- `description`
- `capabilities`
- `skills`
- `tools`
- `status`
- `project_ids`
- `handoff_permissions`
- `review_permissions`

This enables actual hiring, assignment, and inspection.

## 8. Project Model

Each project should minimally include:

- `id`
- `name`
- `purpose`
- `repo_config`
- `assigned_agents`
- `default_lanes`
- `review_policy`
- `memory_scope`

## 9. Task Model

Each task should minimally include:

- `id`
- `title`
- `description`
- `source_thread_id`
- `project_id`
- `owner_agent_id`
- `status`
- `parent_task_id`
- `next_recommended_agent_id`
- `requested_reviewer_id`
- `blocking_reason`

## 10. First User Stories

The first user stories should be these.

### Story 1: Talk To Comphony

As a user,
I want to tell Comphony what I need,
so that I do not need to choose an internal workflow first.

### Story 2: Hire A Worker

As a user,
I want to register a new agent,
so that I can expand my company without manual prompt sprawl.

### Story 3: Delegate Work

As a user,
I want Comphony to assign or hand off work,
so that the right worker handles the task.

### Story 4: Ask Mid-Flight Questions

As a user,
I want to ask what is happening,
so that I can stay informed without reading raw internal state.

### Story 5: Retrieve Previous Work

As a user,
I want to ask about previous tasks and decisions,
so that the company behaves like it has memory.

## 11. What To Reuse From The Existing Prototype

The current system already provides useful assets.

Keep and reuse:

- company lane thinking
- Desk model
- local-first runtime mindset
- setup and smoke-test discipline
- role separation concepts
- repo/workspace/workflow filesystem conventions

Do not keep as the final center:

- shell-script-centric orchestration
- Linear as the only source of truth
- parent/child contracts encoded mainly in prose

## 12. What Needs To Become First-Class Product Surface

These concepts need to move from internal implementation detail to first-class product surface:

- agents
- projects
- tasks
- handoffs
- reviews
- memory
- chat

Without those, the product will remain a clever automation harness rather than a company OS.

## 13. CLI Direction

The CLI should evolve into the local operating interface for the company.

Recommended commands:

- `comphony server start`
- `comphony agent add`
- `comphony agent list`
- `comphony project add`
- `comphony project assign-agent`
- `comphony task create`
- `comphony task assign`
- `comphony task handoff`
- `comphony review request`
- `comphony memory search`
- `comphony sync`
- `comphony validate`

## 14. Web UI Direction

The initial web UI should focus on four main screens:

- `Chat`
- `Work`
- `Agents`
- `Projects`

Later add:

- `Memory`
- `Reviews`
- `Registry`

## 15. Supabase Role

Supabase should be treated as:

- auth layer
- sync layer
- realtime layer
- event storage

It should not replace the local runtime as the main execution brain.

## 16. Future Expansion

Once the MVP works, the product can expand into:

- mobile-first control
- Telegram/Discord/Slack connectors
- hosted agent registry
- team collaboration across multiple humans
- richer cost/performance insights

## 17. Definition Of MVP Success

The MVP is successful when:

- a user can talk to `Comphony` from a web UI
- a task can be created from that conversation
- the task can be assigned and handed off between agents
- progress can be inspected in real time
- the user can ask follow-up questions mid-flight
- the final result comes back into the same conversation

If those things work, the product is already meaningfully different from a static workflow manager.
