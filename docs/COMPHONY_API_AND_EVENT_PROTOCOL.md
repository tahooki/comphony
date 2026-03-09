# Comphony API And Event Protocol

This document defines the recommended API and event protocol shape for `Comphony`.

The goal is to make these layers interoperable:

- web UI
- mobile-friendly clients
- local `comphony server`
- sync/realtime layer
- external connectors

## 1. Purpose

`Comphony` should not become a pile of ad hoc JSON payloads.

The protocol should make it clear:

- what commands exist
- what events exist
- what responses look like
- how the UI stays in sync with the local runtime

## 2. Architectural Principle

The local runtime is the execution authority.

That means:

- clients send commands
- the local runtime validates and executes
- the runtime emits events
- clients render the resulting state

The sync layer should relay and persist events, not invent business logic.

## 3. Protocol Layers

Recommended layers:

- `command API`
  - intent sent into the system
- `query API`
  - current state read from the system
- `event stream`
  - append-only status and lifecycle feed

## 4. Core Command Types

Recommended top-level commands:

- `thread.create`
- `message.send`
- `task.create`
- `task.assign`
- `task.handoff`
- `task.consult`
- `task.request_review`
- `task.approve`
- `task.cancel`
- `task.close`
- `project.create`
- `project.link_tracker`
- `agent.install`
- `agent.assign_to_project`
- `memory.pin`
- `sync.retry`

## 5. Core Query Types

Recommended top-level queries:

- `thread.get`
- `thread.list`
- `task.get`
- `task.list`
- `agent.get`
- `agent.list`
- `project.get`
- `project.list`
- `memory.search`
- `event.list`
- `approval.list`

## 6. Core Event Types

Recommended event families:

- `message.created`
- `thread.created`
- `task.created`
- `task.updated`
- `task.assigned`
- `task.handoff_requested`
- `task.consultation_requested`
- `task.review_requested`
- `task.blocked`
- `task.unblocked`
- `task.reported`
- `task.closed`
- `project.created`
- `project.linked`
- `agent.installed`
- `agent.updated`
- `memory.created`
- `approval.requested`
- `approval.granted`
- `approval.denied`
- `sync.failed`
- `sync.retried`

## 7. Command Envelope

All commands should use a common envelope.

Recommended shape:

```json
{
  "id": "cmd_123",
  "type": "task.handoff",
  "actor_id": "user_owner_01",
  "timestamp": "2026-03-09T10:00:00Z",
  "payload": {
    "task_id": "task_01",
    "to_agent_id": "designer_01",
    "reason": "Needs UI direction"
  }
}
```

## 8. Event Envelope

All events should use a common envelope.

Recommended shape:

```json
{
  "id": "evt_456",
  "type": "task.handoff_requested",
  "timestamp": "2026-03-09T10:00:03Z",
  "correlation_id": "cmd_123",
  "actor_id": "user_owner_01",
  "entity_type": "task",
  "entity_id": "task_01",
  "payload": {
    "from_actor_id": "pm_01",
    "to_actor_id": "designer_01",
    "reason": "Needs UI direction"
  }
}
```

## 9. Query Response Shape

Queries should return state snapshots, not event fragments.

Recommended shape:

```json
{
  "data": {
    "task": {
      "id": "task_01",
      "title": "Design dashboard",
      "status": "in_progress",
      "owner_agent_id": "designer_01"
    }
  },
  "meta": {
    "source": "local_runtime",
    "synced_at": "2026-03-09T10:00:05Z"
  }
}
```

## 10. Thread Protocol

Threads should support:

- creation
- message append
- linked tasks
- participant list
- status summary

Minimum thread operations:

- create thread
- add message
- list linked tasks
- fetch recent events for this thread

## 11. Task Protocol

Tasks should support:

- creation
- status transition
- assignment
- handoff
- consultation
- review request
- closure
- artifact attachment

Important rule:

task mutation should happen through explicit commands, not hidden direct table edits.

## 12. Approval Protocol

Approvals should be first-class.

Recommended commands:

- `approval.request`
- `approval.grant`
- `approval.deny`

Recommended events:

- `approval.requested`
- `approval.granted`
- `approval.denied`

## 13. Connector Protocol

External channels should adapt into the same protocol.

Examples:

- Telegram message -> `message.send`
- Discord slash command -> `message.send` or `task.approve`

No connector should invent a private business flow.

## 14. Realtime Subscription Model

Clients should subscribe to:

- thread events
- task events
- project events
- agent events
- approval events

Recommended subscription scopes:

- by thread
- by task
- by project
- by user/session

## 15. Offline / Retry Behavior

If the local runtime is temporarily unavailable:

- commands should remain queued or rejected clearly
- the user should see the runtime status
- no silent drop should occur

If sync fails:

- events remain in the local event log
- external sync retries later

## 16. Command Acknowledgement

Every command should produce an explicit acknowledgement.

Recommended acknowledgement states:

- `accepted`
  - the runtime accepted the command for execution
- `queued`
  - the runtime persisted the command but cannot execute yet
- `rejected`
  - the command failed validation or permission checks

Recommended response shape:

```json
{
  "command_id": "cmd_123",
  "ack_status": "accepted",
  "accepted_at": "2026-03-09T10:00:00Z"
}
```

## 17. Error Envelope

Errors should follow a standard envelope.

Recommended shape:

```json
{
  "error": {
    "code": "permission_denied",
    "message": "This action requires approval.",
    "retryable": false,
    "details": {
      "required_approval_type": "repo_write"
    }
  },
  "meta": {
    "command_id": "cmd_123",
    "source": "local_runtime"
  }
}
```

Recommended error classes:

- `validation_error`
- `permission_denied`
- `not_found`
- `conflict`
- `runtime_unavailable`
- `sync_unavailable`
- `timeout`

## 18. Idempotency And Duplicate Handling

Command execution should be idempotent by `command_id`.

Recommended rules:

- the runtime should persist seen command IDs for a replay window
- a duplicate `command_id` should not re-run side effects
- duplicate submissions should return the original acknowledgement or final known result
- connectors should generate stable command IDs when retrying the same user action

This is especially important for:

- mobile retries
- external connector retries
- sync layer reconnects

## 19. Protocol Rule

The API should expose company actions and company state.

It should not leak internal script assumptions as the primary contract.
