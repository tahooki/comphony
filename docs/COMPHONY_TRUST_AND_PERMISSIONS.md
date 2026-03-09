# Comphony Trust And Permissions

This document defines the trust, permission, and approval model for `Comphony`.

Without this layer, a local-first company runtime becomes unsafe the moment it can:

- execute local commands
- access repos
- create external resources
- sync with external systems
- respond through remote clients

## 1. Goal

The goal is to let `Comphony` feel autonomous without becoming reckless.

The system should be able to:

- move quickly for low-risk actions
- ask for approval for high-risk actions
- explain who can do what
- restrict external channels and imported agents

## 2. Trust Model

The system should assume four trust zones.

### 2.1 User Zone

Trusted human operators.

Examples:

- owner
- admin
- operator
- reviewer

### 2.2 System Zone

Core `Comphony` runtime services.

Examples:

- conversation orchestrator
- routing engine
- task graph engine
- sync worker

### 2.3 Agent Zone

Installed workers acting inside the company.

Examples:

- designer
- researcher
- dev
- ops
- project admin

### 2.4 External Zone

Anything not fully controlled by the local runtime.

Examples:

- marketplace agent packages
- external chat connectors
- Linear
- GitHub
- Supabase-hosted control plane

## 3. Permission Categories

Permissions should be capability-based rather than role-name-based.

Recommended categories:

- `read_memory`
- `write_memory`
- `read_repo`
- `write_repo`
- `run_commands`
- `create_tasks`
- `assign_tasks`
- `handoff_tasks`
- `request_review`
- `close_tasks`
- `create_projects`
- `create_repos`
- `edit_sync_rules`
- `send_external_messages`
- `install_agents`
- `manage_secrets`
- `deploy`

## 4. Action Classes

All actions should be classified into one of three classes.

### 4.1 Safe Automatic

Allowed without human approval.

Examples:

- read memory
- search previous tasks
- write non-destructive status notes
- request review
- create internal handoff
- update internal task status

### 4.2 Guarded Automatic

Allowed automatically only if policy explicitly permits it.

Examples:

- write to a repo workspace
- create a branch
- run tests
- generate a document
- post to Linear
- update project-local configuration

### 4.3 Explicit Approval Required

Never run without approval from an authorized human.

Examples:

- create or delete external repos
- production deployment
- destructive filesystem operations
- secret rotation
- external network actions to untrusted destinations
- sending messages to public channels
- installing untrusted agent packages

## 5. Actor Roles

Recommended human/operator roles:

- `owner`
- `admin`
- `operator`
- `reviewer`
- `observer`

Recommended semantics:

- `owner`
  - full authority
- `admin`
  - can manage runtime, sync, agents, and projects
- `operator`
  - can drive work and approve guarded actions
- `reviewer`
  - can approve review-bound actions and close work
- `observer`
  - read-only

## 6. Agent Permission Envelope

Every agent should have a permission envelope.

Minimum structure:

```yaml
permissions:
  read_memory: allow
  write_memory: allow
  read_repo: allow
  write_repo: guarded
  run_commands: guarded
  create_tasks: allow
  assign_tasks: allow
  handoff_tasks: allow
  request_review: allow
  close_tasks: guarded
  create_projects: deny
  create_repos: deny
  deploy: deny
```

This should be attached to the agent or agent template and enforced by the runtime.

## 7. Approval Gates

The runtime should support approval gates as first-class events.

A gate should include:

- requested action
- requesting actor
- scope
- reason
- risk level
- expiry
- approving actor

Example:

```yaml
approval_request:
  action: create_repo
  requested_by: project_admin_01
  scope: project/foo
  reason: bootstrap new product
  risk_level: high
  expires_at: ...
```

## 8. Connector Trust

External channels should be less trusted than local clients.

Suggested model:

- local web UI
  - full interactive control depending on user role
- mobile web UI
  - same role model, possibly reduced by device/session policy
- Telegram/Discord/Slack
  - command subset only
  - no dangerous actions by default

These connectors should default to:

- ask status
- create request
- approve pending review
- receive notifications

They should not default to:

- install agents
- mutate sync policy
- create repos
- run destructive actions

## 9. Imported Agent Trust

Imported agents from a registry must not be trusted automatically.

Every imported agent package should carry:

- publisher identity
- version
- requested permissions
- required tools
- required secrets
- checksum or signature

The system should classify imported agents as:

- trusted
- restricted
- quarantined

## 10. Secret Access

Secrets should not be global by default.

Secret access should be:

- scoped by project
- scoped by agent permission
- logged
- revocable

Recommended secret classes:

- runtime secrets
- project secrets
- connector secrets
- external tool secrets

## 11. Auditability

Every sensitive action should create an audit record.

Minimum audit fields:

- actor
- action
- target
- policy decision
- approval status
- timestamp
- correlation id

This matters for both debugging and trust.

## 12. Default Security Position

If the system is unsure, the default should be:

- allow reads
- guard writes
- require approval for irreversible or externally visible operations

That default preserves useful autonomy without making the system brittle or unsafe.
