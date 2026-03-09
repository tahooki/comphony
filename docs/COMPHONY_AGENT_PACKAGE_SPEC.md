# Comphony Agent Package Spec

This document defines the recommended package spec for installable `Comphony` agents.

The goal is to make "hire an agent by link" real and safe.

## 1. Purpose

An agent package should be more than a prompt.

It should define:

- who the agent is
- what the agent can do
- what tools it needs
- what permissions it requests
- what outputs it produces
- what compatibility it expects

## 2. Packaging Goals

The package format should support:

- local installation
- project assignment
- versioning
- compatibility checking
- trust review
- future marketplace publishing

## 3. Minimum Package Structure

Recommended package structure:

```text
agent-package/
  agent.yaml
  prompts/
  skills/
  examples/
  docs/
```

## 4. Required Manifest

The package must contain an `agent.yaml`.

Suggested minimum fields:

```yaml
id: senior-designer
name: Senior Designer
role: design
version: 1.0.0
publisher: acme-studio
description: Design systems, UX direction, UI handoff notes
capabilities:
  - design_system
  - ux_review
  - copy_direction
tools:
  - ui-ux-pro-max
  - screenshot
permissions:
  read_memory: allow
  write_memory: allow
  read_repo: allow
  write_repo: guarded
  run_commands: guarded
supported_lanes:
  - design
  - review
required_runtime:
  comphony_min_version: 0.1.0
output_contracts:
  - design_handoff
  - design_review
entrypoints:
  prompt: prompts/system.md
```

## 5. Recommended Optional Fields

Useful optional fields:

- `required_secrets`
- `recommended_reviewers`
- `handoff_targets`
- `memory_scope`
- `install_notes`
- `source_url`
- `checksum`
- `signature`

## 6. Output Contracts

Every agent package should declare its output contracts.

Examples:

- `research_report`
- `design_handoff`
- `implementation_note`
- `ops_summary`
- `pm_scope_doc`

This makes routing and review more reliable.

## 7. Compatibility

The runtime should validate:

- Comphony version compatibility
- required tool availability
- required connector availability
- permission requests

If compatibility fails, install should stop or quarantine the agent.

## 8. Trust States

An installed agent package should have one of these states:

- `trusted`
- `restricted`
- `quarantined`

Default recommendation:

- local first-party packages -> `trusted`
- imported external packages -> `restricted`
- failed validation -> `quarantined`

## 9. Installation Targets

Recommended install targets:

- tracked first-party packages -> `./agents/<agent-id>/`
- imported registry packages -> `./runtime-data/registry/agents/<agent-id>/`
- Codex skills used by the package -> `./.codex/skills/<skill-name>/`

Important rule:

an agent package is not the same thing as a Codex skill.

- an agent package defines role, permissions, compatibility, and output contracts
- a Codex skill is one possible tool dependency used by the agent

## 10. Installation Flow

Recommended install flow:

1. resolve metadata URL or package source
2. fetch manifest
3. validate structure
4. validate permissions
5. validate runtime compatibility
6. ask for approval if needed
7. install
8. register agent in registry

## 11. Product Rule

The runtime should never treat imported agents as "just text."

They are executable organizational units and must be handled with packaging, compatibility, and trust review.
