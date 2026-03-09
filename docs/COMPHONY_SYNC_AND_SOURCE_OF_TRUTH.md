# Comphony Sync And Source Of Truth

This document defines how `Comphony` should relate to external systems such as `Linear`.

## 1. Core Principle

`Comphony` internal state should be the primary source of truth for:

- conversation state
- task graph state
- handoff state
- review state
- memory state
- agent registry state

External tools should be treated as:

- sync targets
- mirrored trackers
- integration surfaces

They should not redefine the product's internal model.

## 2. Why This Matters

If external trackers are treated as the primary source of truth, `Comphony` loses:

- multi-agent collaboration detail
- consultation and handoff semantics
- rich thread context
- internal memory continuity

So the rule should be:

- internal graph first
- external tracker second

## 3. Sync Modes

The system should support explicit sync modes.

### 3.1 None

No external sync.

Useful for:

- private/local-only operation
- early experimentation
- research-only work

### 3.2 Mirror Out

Internal state is primary.
Selected fields are pushed outward.

Useful for:

- Linear visibility
- team reporting
- status mirroring

### 3.3 Linked External

Internal task is linked to an external issue, but `Comphony` still owns richer semantics.

Useful for:

- teams that already rely on Linear issue links
- preserving external references without giving away internal control

### 3.4 Import Only

External issues can be imported as tasks, but ongoing orchestration stays internal.

Useful for:

- bootstrapping from an existing board
- migration scenarios

## 4. Sync Object Mapping

Recommended mapping:

- `Comphony project` -> `Linear project`
- `Comphony task` -> `Linear issue`
- `Comphony status summary` -> `Linear comments` or state updates

Not everything should map 1:1.

These objects are mostly internal:

- handoff
- consultation
- memory items
- internal agent discussion

Those may be summarized externally, but should not be flattened into the external model by default.

## 5. Conflict Resolution

Conflicts will happen.

Recommended policy:

- internal graph wins for task ownership, handoff, review, memory
- external tracker wins only for explicitly user-edited external tracking fields if sync policy says so

Suggested field classes:

### Internal-authoritative

- owner agent
- handoff chain
- review chain
- blockers
- next recommended actor
- internal notes

### Shared

- title
- summary
- priority
- public-facing status

### External-authoritative only if configured

- externally managed labels
- externally managed milestone/iteration references

## 6. Sync Events

Every sync action should be an event, not an invisible side effect.

Examples:

- external_issue_created
- external_issue_updated
- sync_conflict_detected
- sync_retry_scheduled
- external_project_linked

## 7. Minimal Linear Strategy

The best initial Linear strategy is:

- internal-first graph
- mirror out key issues and project status
- keep richer collaboration internal

This gives the user the benefit of Linear without flattening the product into Linear semantics.

## 8. Project Sync Rules

When a project is synced to Linear, define:

- whether a Linear project should be created automatically
- whether existing projects may be linked instead
- which states are mirrored
- whether new tasks create new issues automatically
- whether task closure closes external issues

Recommended default:

```yaml
tracker_sync:
  provider: linear
  mode: mirror_out
  create_project_if_missing: false
  create_issue_on_task_create: true
  close_issue_on_task_close: false
  mirror_status_summary: true
```

## 9. User Experience Rule

The user should not need to think:

- "Which system is the real one?"

The product should make this clear:

- `Comphony` is where work is coordinated
- external systems are where that work may also be reflected

## 10. Failure Handling

Sync failure should not block local execution by default.

If Linear is unavailable:

- local work continues
- sync events are queued
- the user sees that external sync is delayed

This prevents external tooling from becoming the execution bottleneck.
