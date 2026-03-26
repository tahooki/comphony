# Comphony Refactoring Todo

This document turns the current complexity review into an execution-ready refactoring checklist.

## Goal

Reduce structural complexity without changing the current product behavior.

The main target is not algorithmic complexity.
The main target is over-centralized responsibility across a few large files.

## Refactoring Principles

- Keep current CLI commands and HTTP endpoints stable while refactoring internals.
- Preserve the current thread -> task -> work -> review -> approval flow.
- Prefer extracting modules before changing behavior.
- Use the existing test suite as a safety net after each step.

## Priority 0

- [ ] Split `src/state.ts` into smaller domain modules.
- [x] Extract thread and message logic into a dedicated module.
- [x] Extract task graph and task workflow logic into a dedicated module.
- [x] Extract memory and recommendation logic into a dedicated module.
- [x] Extract session and actor resolution logic into a dedicated module.
- [ ] Leave `src/state.ts` as a thin compatibility layer until all callers are migrated.

## Priority 1

- [x] Create a single task state machine or policy module for status transitions.
- [ ] Move lane-specific rules out of `continueThread` and `runTaskWorkTurn`.
- [x] Move design handoff prerequisite checks into the same policy layer.
- [ ] Replace scattered status strings with a shared status contract.
- [x] Add focused tests for allowed transitions and blocked transitions.

## Priority 2

- [x] Extract conversation orchestration from `src/state.ts`.
- [x] Move `respondToThread` into a dedicated orchestrator module.
- [x] Move `resolveConversationAction` into a dedicated command intent module.
- [x] Move auto-continue loop behavior into an orchestrator loop module.
- [ ] Keep direct agent mention behavior and manager reply behavior compatible with current tests.

## Priority 3

- [x] Refactor `src/server.ts` so route registration is declarative.
- [x] Introduce a shared mutation wrapper for auth, execute, save, broadcast, and respond.
- [x] Group routes by resource instead of keeping them in one long request handler.
- [ ] Keep the current `/v1/*` endpoint surface unchanged.

## Priority 4

- [ ] Refactor `src/cli.ts` to use a command registry instead of a long manual parser chain.
- [ ] Co-locate each command spec with its handler.
- [ ] Reduce `parseArgs` to dispatch logic only.
- [ ] Keep the current command names and flags compatible.

## Priority 5

- [ ] Split `src/web.ts` into separate concerns.
- [ ] Move static HTML shell markup out of the main client logic block.
- [ ] Move client state management into a dedicated module.
- [ ] Move rendering functions into dedicated view modules.
- [ ] Move fetch helpers and event-stream wiring into dedicated client API modules.
- [ ] Preserve the current UI tabs, task actions, and event stream behavior.

## Priority 6

- [ ] Extract Linear sync code out of `src/state.ts`.
- [ ] Extract Supabase sync code out of `src/state.ts`.
- [ ] Introduce adapter boundaries for external providers.
- [ ] Standardize provider error handling and retry behavior.
- [ ] Add mock-friendly integration tests around provider adapters.

## Verification Checklist

- [ ] Run `npm run validate:config` after each phase.
- [ ] Run `npm test` after each phase.
- [ ] Verify thread intake still creates linked tasks.
- [ ] Verify task auto-assignment still works.
- [ ] Verify work turn still generates artifacts.
- [ ] Verify review and approval flows still behave the same.
- [ ] Verify project creation and agent installation still work from chat.
- [ ] Verify Linear sync and Supabase push still pass tests.

## Hotspots To Start From

- `src/state.ts`
- `src/server.ts`
- `src/cli.ts`
- `src/web.ts`

## Definition Of Done

- `src/state.ts` is no longer the main home for every domain concern.
- Task workflow rules exist in one place.
- HTTP and CLI entrypoints are thinner and more declarative.
- Web client code is split into readable units.
- External integrations are isolated behind adapters.
- Existing tests continue to pass.
