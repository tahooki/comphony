# Comphony Purpose And Vision

This document defines what `Comphony` is for, what kind of product it is trying to become, and what user experience should anchor future decisions.

## 1. Product Definition

`Comphony` is an agent operating system for running an AI-native company.

It is not primarily a task board.
It is not primarily a workflow template repo.
It is not primarily a Linear integration.

Those things can exist inside the product, but they are not the core.

The core is this:

- a user talks to `Comphony`
- `Comphony` figures out who should do the work
- agents collaborate, ask, hand off, review, and report
- the user stays focused on outcomes instead of managing the machinery

## 2. Primary Purpose

The purpose of `Comphony` is to let a user operate a company of AI workers through one interface.

That means the product should help the user:

- hire agents
- register projects
- delegate work
- ask questions mid-flight
- see who is doing what
- understand why something happened
- retrieve previous work and company memory
- receive completed results without manually orchestrating every step

## 3. The User Promise

The promise of the product should be:

> Tell Comphony what you want, and it will organize the right agents, route the work, and bring back the result.

This implies three things.

1. The user should not need to know the internal structure first.
2. The user should be able to interrupt, ask, and redirect at any time.
3. The system should behave like an organization, not like a pile of automations.

## 4. What Experience We Want The User To Have

The intended experience is:

- "I talk to one company, not ten tools."
- "I do not need to decide which project or worker should receive the request."
- "I can still directly talk to a specific agent if I want to."
- "I can see what is happening inside the company."
- "I can ask what happened before, who is blocked, and what the next step is."
- "I can add or replace workers without rebuilding the whole system."

The user should feel that:

- the company is coherent
- work is visible
- delegation is real
- memory accumulates
- the system is responsive to conversation, not just forms

## 5. Product Positioning

The cleanest positioning is:

`Comphony` is a local-first company operating system with a conversational control surface.

That means:

- the company runtime can live on the user's own machine or server
- the user can still access it through a web UI and later mobile/chat channels
- the system is not locked to one task board or one cloud backend

## 6. What Comphony Is Not

To keep the product focused, it should explicitly avoid becoming only one of these:

- just a Linear wrapper
- just a workflow generator
- just an agent registry
- just a chat app
- just a project management dashboard

The right model is broader:

- chat for command and conversation
- registry for agents and projects
- runtime for execution
- memory for continuity
- routing for delegation
- review and handoff for collaboration

## 7. The Central Interface

The main interface should be `Comphony` itself.

Not `Comphony Agent`.
Not `Comphony Manager`.
Not `Desk` as the brand.

The user-facing pattern should be:

- the user talks to `Comphony`
- internally, `Comphony Desk` or a routing layer coordinates the work
- agents and projects remain internal concepts unless the user wants to inspect them

This gives the product a simple mental model:

- `Comphony` is the company
- `Agents` are the workers
- `Projects` are the places they work
- `Tasks` are the units of work
- `Memory` is the company's shared knowledge

## 8. Core Product Goals

Every meaningful feature should support at least one of these goals.

### 8.1 One Front Door

The user should always have a single obvious place to start.

### 8.2 Dynamic Delegation

Work should be routed to the right agent or lane without requiring the user to manage internal topology.

### 8.3 Visible Agent Collaboration

Agents should be able to hand work off, ask each other questions, request reviews, and expose that flow to the user.

### 8.4 Persistent Memory

The system should remember what was done, why it was done, and who did it.

### 8.5 Flexible Organization Design

The user should be able to add, replace, or reassign agents and lanes without redesigning the whole company.

### 8.6 Local Control

The user should be able to run the company on their own local machine or server, not only in a managed cloud.

## 9. North Star

The north star is not "more automations."

The north star is:

> A user can run a network of AI workers through one conversation and reliably get work delegated, reviewed, remembered, and completed.

## 10. Product Thesis

If this product works, the user does not think:

- "Which workflow file should I edit?"
- "Which Linear project should I use?"
- "Which prompt should I paste?"

The user thinks:

- "I asked Comphony."
- "Comphony assigned it."
- "The design agent asked research for input."
- "The dev agent requested review."
- "Comphony brought me the result."

That is the product to build.
