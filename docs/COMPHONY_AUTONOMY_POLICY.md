# Comphony Autonomy Policy

This document defines what `Comphony` and its agents may do automatically, what should be suggested first, and what requires human approval.

## 1. Why This Exists

If the product becomes too passive, it feels useless.
If it becomes too autonomous, it becomes unsafe and unpredictable.

The system needs a clear autonomy policy so that:

- users know what to expect
- agents know when to proceed
- the runtime knows when to pause for approval

## 2. Autonomy Levels

Recommended levels:

### Level 0: Ask First

No meaningful action without user confirmation.

Useful for:

- first-time setup
- cautious mode
- high-risk environments

### Level 1: Suggest And Wait

The system can prepare plans and recommendations, but waits before acting.

Useful for:

- project bootstrap
- new lane creation
- agent installation

### Level 2: Safe Auto

The system acts automatically on low-risk internal operations.

Useful for:

- task creation
- status updates
- handoffs
- review requests
- memory writes

### Level 3: Guarded Auto

The system may perform medium-risk actions if policy allows and guardrails pass.

Useful for:

- repo workspace writes
- test runs
- issue sync to Linear
- local artifact generation

### Level 4: Explicit Human Approval

The system may prepare the action, but execution requires approval.

Examples:

- create repo
- deploy
- destructive file operation
- install untrusted agent package
- send public external messages

## 3. Default Recommendations

Recommended defaults:

- chat answers: auto
- status inspection: auto
- internal task creation: auto
- handoff and consultation: auto
- review request: auto
- local code changes: guarded
- external tracker mutation: guarded
- repo creation: approval required
- deployment: approval required

## 4. Agent Autonomy Profiles

Different agents should have different autonomy profiles.

Examples:

### Research agent

- high read autonomy
- medium memory write autonomy
- low external mutation autonomy

### Design agent

- high document generation autonomy
- medium artifact generation autonomy
- low external resource mutation autonomy

### Dev agent

- medium repo write autonomy
- high test execution autonomy
- guarded branch/PR autonomy

### Ops agent

- broad operational insight
- narrow mutation rights by default
- approval gate for risky changes

### Project admin agent

- can prepare provisioning
- cannot finalize external creation without approval by default

## 5. User Overrides

The user should be able to choose a company mode.

Suggested modes:

- `safe`
- `balanced`
- `fast`

Example semantics:

- `safe`
  - more approvals
- `balanced`
  - safe internal automation, guarded external actions
- `fast`
  - broad autonomy except destructive or high-risk actions

## 6. Escalation Rules

The system should escalate to the user when:

- permissions are insufficient
- required resources are missing
- cost or risk crosses a threshold
- conflicting recommendations exist
- task routing confidence is low

## 7. Explainability Requirement

Whenever the system takes an autonomous action, it should be able to explain:

- what it did
- why it did it
- under which policy level
- what the next action is

This is important for trust.

## 8. Product Rule

The product should feel:

- confidently autonomous for low-risk work
- clearly permissioned for risky work

That balance is the point.
