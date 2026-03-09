# Comphony Identity And Memory Policy

This document defines how `Comphony` should handle identity, sessions, and memory boundaries.

## 1. Purpose

The product is built around:

- user conversations
- agent collaboration
- company memory

Without an identity and memory policy, the system becomes confusing and unsafe.

## 2. Identity Types

The product should recognize at least these identity classes.

### Human identities

Examples:

- owner
- admin
- operator
- reviewer
- observer

### System identities

Examples:

- orchestrator
- sync worker
- runtime service

### Agent identities

Examples:

- designer_01
- researcher_02
- dev_03

## 3. Session Types

Recommended session classes:

- local desktop session
- remote web session
- mobile web session
- connector session
- service-to-service session

These should not all have the same trust level.

## 4. Memory Scopes

Recommended memory scopes:

- `company`
- `project`
- `agent`
- `task`
- `private_user`

This is important because not all memory should be equally visible.

## 5. Memory Visibility Rules

Recommended default rules:

- company memory
  - visible to most internal actors
- project memory
  - visible to assigned agents and authorized users
- agent memory
  - visible to the agent and authorized operators
- task memory
  - visible to participants and reviewers
- private user memory
  - visible only to the relevant human unless explicitly shared

## 6. User Identity Rule

The user should be able to:

- ask what happened
- inspect prior decisions
- understand who did the work

But the system should still preserve internal/private boundaries when needed.

## 7. Memory Retention

The product should define retention classes.

Suggested categories:

- ephemeral
- normal
- pinned
- compliance-critical

Examples:

- ephemeral
  - temporary planning note
- normal
  - ordinary task report
- pinned
  - important decision or reusable pattern
- compliance-critical
  - sensitive operational audit event

## 8. Memory Sources

Memory may be created from:

- user messages
- agent summaries
- task results
- review outcomes
- imported artifacts
- sync imports

Not all raw data should be preserved equally.

The system should support summarization and pinning.

## 9. Privacy And Safety

The memory layer should support:

- redaction
- scoped access
- deletion requests where appropriate
- secret exclusion

The system should not blindly store:

- secrets
- unnecessary raw command output
- sensitive tokens

## 10. Identity In Audit Trails

Every important action should record:

- which human, system, or agent did it
- through which session type
- under which permission context

This makes memory and audit coherent.

## 11. Product Rule

The product should feel like it remembers the company, not like it leaks everything to everyone.

That means:

- memory must be useful
- identity must be clear
- access boundaries must remain understandable
