import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { JSONObject } from "./config.js";
import { resolveRoutingPolicy, summarizeCompanyConfig } from "./config.js";
import {
  addMessage,
  assignAgentToProject,
  assignTask,
  autoAssignTask,
  completeTaskReview,
  continueThread,
  createProject,
  createThread,
  decideApproval,
  getThreadDetail,
  handoffTask,
  intakeRequest,
  installAgentPackage,
  listApprovals,
  listConsultations,
  listEvents,
  listPeopleOverview,
  listMemories,
  listProjectOverview,
  listReviews,
  listSyncRecords,
  recommendMemories,
  recommendTasks,
  listMessages,
  listThreads,
  loadRuntimeState,
  promoteMessageToTask,
  respondToThread,
  requestApproval,
  requestConsultation,
  requestTaskReview,
  retrySync,
  syncTaskToProvider,
  resolveConsultation,
  runTaskWorkTurn,
  saveRuntimeState,
  updateTaskStatus
} from "./state.js";
import type { EventRecord } from "./state.js";
import { renderWebAppHtml } from "./web.js";

export function startServer(config: JSONObject, root: string): void {
  const summary = summarizeCompanyConfig(config);
  const state = loadRuntimeState(config, root);
  const eventClients = new Set<ServerResponse>();
  const host = typeof summary.host === "string" ? summary.host : "127.0.0.1";
  const port = typeof summary.port === "number" ? summary.port : 43110;

  const server = createServer((request, response) => {
    handleRequest(request, response, config, root, summary, state, eventClients);
  });

  server.listen(port, host, () => {
    console.log(`Comphony server listening on http://${host}:${port}`);
    console.log(
      "Available endpoints: /healthz, /v1/status, /v1/projects, /v1/projects/overview, /v1/agents, /v1/people, /v1/tasks, /v1/tasks/recommend, /v1/tasks/sync, /v1/threads, /v1/messages, /v1/events, /v1/memory, /v1/consultations, /v1/reviews, /v1/approvals, /v1/sync"
    );
  });
}

function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: JSONObject,
  root: string,
  summary: JSONObject,
  state: ReturnType<typeof loadRuntimeState>,
  eventClients: Set<ServerResponse>
): void {
  const url = request.url ?? "/";
  const parsedUrl = new URL(url, "http://127.0.0.1");
  if (request.method === "GET" && (parsedUrl.pathname === "/" || parsedUrl.pathname === "/app")) {
    writeHtml(response, 200, renderWebAppHtml());
    return;
  }
  if (request.method === "GET" && url === "/healthz") {
    writeJson(response, 200, { status: "ok", service: "comphony" });
    return;
  }
  if (request.method === "GET" && url === "/v1/status") {
    writeJson(response, 200, summary);
    return;
  }
  if (request.method === "GET" && url === "/v1/projects") {
    writeJson(response, 200, { projects: state.projects });
    return;
  }
  if (request.method === "GET" && parsedUrl.pathname === "/v1/projects/overview") {
    writeJson(response, 200, { projects: listProjectOverview(state) });
    return;
  }
  if (request.method === "GET" && parsedUrl.pathname === "/v1/sync") {
    writeJson(response, 200, {
      sync: listSyncRecords(state, {
        provider: parsedUrl.searchParams.get("provider") ?? undefined,
        projectId: parsedUrl.searchParams.get("projectId") ?? undefined,
        status: parsedUrl.searchParams.get("status") ?? undefined
      })
    });
    return;
  }
  if (request.method === "GET" && url === "/v1/agents") {
    writeJson(response, 200, { agents: state.agents });
    return;
  }
  if (request.method === "GET" && parsedUrl.pathname === "/v1/people") {
    writeJson(response, 200, { people: listPeopleOverview(state) });
    return;
  }
  if (request.method === "GET" && url === "/v1/tasks") {
    writeJson(response, 200, { tasks: state.tasks });
    return;
  }
  if (request.method === "GET" && parsedUrl.pathname === "/v1/tasks/recommend") {
    writeJson(response, 200, {
      tasks: recommendTasks(state, {
        projectId: parsedUrl.searchParams.get("projectId") ?? undefined,
        threadId: parsedUrl.searchParams.get("threadId") ?? undefined,
        taskId: parsedUrl.searchParams.get("taskId") ?? undefined,
        query: parsedUrl.searchParams.get("query") ?? undefined,
        limit: parsedUrl.searchParams.get("limit") ? Number(parsedUrl.searchParams.get("limit")) : undefined
      })
    });
    return;
  }
  if (request.method === "GET" && parsedUrl.pathname === "/v1/events/stream") {
    openEventStream(response, eventClients);
    return;
  }
  if (request.method === "GET" && parsedUrl.pathname === "/v1/events") {
    const limitValue = parsedUrl.searchParams.get("limit");
    const limit = limitValue ? Number(limitValue) : 50;
    writeJson(response, 200, { events: listEvents(state, Number.isFinite(limit) ? limit : 50) });
    return;
  }
  if (request.method === "GET" && parsedUrl.pathname === "/v1/memory") {
    writeJson(response, 200, {
      memories: listMemories(state, {
        projectId: parsedUrl.searchParams.get("projectId") ?? undefined,
        threadId: parsedUrl.searchParams.get("threadId") ?? undefined,
        taskId: parsedUrl.searchParams.get("taskId") ?? undefined,
        query: parsedUrl.searchParams.get("query") ?? undefined,
        limit: parsedUrl.searchParams.get("limit") ? Number(parsedUrl.searchParams.get("limit")) : undefined
      })
    });
    return;
  }
  if (request.method === "GET" && parsedUrl.pathname === "/v1/memory/recommend") {
    writeJson(response, 200, {
      memories: recommendMemories(state, {
        projectId: parsedUrl.searchParams.get("projectId") ?? undefined,
        threadId: parsedUrl.searchParams.get("threadId") ?? undefined,
        taskId: parsedUrl.searchParams.get("taskId") ?? undefined,
        query: parsedUrl.searchParams.get("query") ?? undefined,
        limit: parsedUrl.searchParams.get("limit") ? Number(parsedUrl.searchParams.get("limit")) : undefined
      })
    });
    return;
  }
  if (request.method === "GET" && parsedUrl.pathname === "/v1/consultations") {
    writeJson(response, 200, {
      consultations: listConsultations(state, {
        taskId: parsedUrl.searchParams.get("taskId") ?? undefined,
        threadId: parsedUrl.searchParams.get("threadId") ?? undefined,
        status: parsedUrl.searchParams.get("status") ?? undefined
      })
    });
    return;
  }
  if (request.method === "GET" && parsedUrl.pathname === "/v1/reviews") {
    writeJson(response, 200, {
      reviews: listReviews(state, {
        taskId: parsedUrl.searchParams.get("taskId") ?? undefined,
        threadId: parsedUrl.searchParams.get("threadId") ?? undefined,
        status: parsedUrl.searchParams.get("status") ?? undefined
      })
    });
    return;
  }
  if (request.method === "GET" && parsedUrl.pathname === "/v1/approvals") {
    writeJson(response, 200, {
      approvals: listApprovals(state, {
        taskId: parsedUrl.searchParams.get("taskId") ?? undefined,
        threadId: parsedUrl.searchParams.get("threadId") ?? undefined,
        status: parsedUrl.searchParams.get("status") ?? undefined
      })
    });
    return;
  }
  if (request.method === "GET" && url === "/v1/threads") {
    writeJson(response, 200, { threads: listThreads(state) });
    return;
  }
  if (request.method === "GET" && parsedUrl.pathname.startsWith("/v1/threads/")) {
    const threadId = parsedUrl.pathname.split("/").pop();
    if (!threadId) {
      writeJson(response, 400, { error: "bad_request", message: "thread id is required" });
      return;
    }
    try {
      writeJson(response, 200, getThreadDetail(state, threadId));
    } catch (error) {
      writeJson(response, 404, { error: "not_found", message: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (request.method === "GET" && parsedUrl.pathname === "/v1/messages") {
    const threadId = parsedUrl.searchParams.get("threadId") ?? undefined;
    writeJson(response, 200, { messages: listMessages(state, threadId) });
    return;
  }
  if (request.method === "POST" && url === "/v1/intake") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "operator");
      const before = state.events.length;
      const title = stringField(payload, "title");
      const body = stringField(payload, "body");
      const projectId = optionalStringField(payload, "projectId");
      const lane = optionalStringField(payload, "lane");
      const result = intakeRequest(config, root, state, { title, body, projectId, lane });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, result);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/threads") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "operator");
      const before = state.events.length;
      const title = stringField(payload, "title");
      const thread = createThread(state, { title });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, thread);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/threads/respond") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "operator");
      const before = state.events.length;
      const result = respondToThread(config, state, {
        threadId: stringField(payload, "threadId"),
        body: stringField(payload, "body")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, result);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/threads/continue") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "operator");
      const before = state.events.length;
      const result = continueThread(config, root, state, {
        threadId: stringField(payload, "threadId")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, result);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/messages") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "operator");
      const before = state.events.length;
      const threadId = stringField(payload, "threadId");
      const body = stringField(payload, "body");
      const role = optionalStringField(payload, "role") ?? "user";
      if (!["user", "agent", "system"].includes(role)) {
        throw new Error("role must be one of: user, agent, system");
      }
      const routing = resolveRoutingPolicy(config);
      const message = addMessage(state, {
        threadId,
        body,
        role: role as "user" | "agent" | "system"
      }, routing);
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, message);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/messages/promote") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "operator");
      const before = state.events.length;
      const routing = resolveRoutingPolicy(config);
      const task = promoteMessageToTask(state, {
        messageId: stringField(payload, "messageId"),
        projectId: optionalStringField(payload, "projectId"),
        lane: optionalStringField(payload, "lane"),
        title: optionalStringField(payload, "title")
      }, routing);
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, task);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/tasks/assign") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "operator");
      const before = state.events.length;
      const taskId = stringField(payload, "taskId");
      const agentId = optionalStringField(payload, "agentId");
      const result = agentId
        ? { task: assignTask(config, root, state, { taskId, agentId }), agentId, error: null }
        : autoAssignTask(config, root, state, taskId);
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, result);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/tasks/status") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "operator");
      const before = state.events.length;
      const task = updateTaskStatus(state, {
        taskId: stringField(payload, "taskId"),
        status: stringField(payload, "status")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, task);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/tasks/work") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "operator");
      const before = state.events.length;
      const result = runTaskWorkTurn(config, root, state, {
        taskId: stringField(payload, "taskId")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, result);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/tasks/handoff") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "operator");
      const before = state.events.length;
      const result = handoffTask(config, root, state, {
        taskId: stringField(payload, "taskId"),
        lane: stringField(payload, "lane")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, result);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/tasks/sync") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "admin");
      const before = state.events.length;
      const result = syncTaskToProvider(config, root, state, {
        provider: stringField(payload, "provider"),
        taskId: stringField(payload, "taskId")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, result);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/tasks/consult") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "operator");
      const before = state.events.length;
      const result = requestConsultation(config, state, {
        taskId: stringField(payload, "taskId"),
        toAgentId: stringField(payload, "toAgentId"),
        reason: stringField(payload, "reason"),
        instructions: optionalStringField(payload, "instructions")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, result);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/consultations/resolve") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "operator");
      const before = state.events.length;
      const result = resolveConsultation(config, state, {
        consultationId: stringField(payload, "consultationId"),
        response: stringField(payload, "response")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, result);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/tasks/review") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "reviewer");
      const before = state.events.length;
      const result = requestTaskReview(config, state, {
        taskId: stringField(payload, "taskId"),
        reviewerAgentId: stringField(payload, "reviewerAgentId"),
        reason: stringField(payload, "reason")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, result);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/reviews/complete") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "reviewer");
      const before = state.events.length;
      const outcome = stringField(payload, "outcome");
      if (!["approved", "changes_requested"].includes(outcome)) {
        throw new Error("outcome must be approved or changes_requested");
      }
      const result = completeTaskReview(config, state, {
        reviewId: stringField(payload, "reviewId"),
        outcome: outcome as "approved" | "changes_requested",
        notes: optionalStringField(payload, "notes")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, result);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/approvals/request") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "operator");
      const before = state.events.length;
      const result = requestApproval(config, state, {
        action: stringField(payload, "action"),
        reason: stringField(payload, "reason"),
        taskId: optionalStringField(payload, "taskId"),
        requestedBy: optionalStringField(payload, "requestedBy")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, result);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/approvals/decide") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "admin");
      const before = state.events.length;
      const decision = stringField(payload, "decision");
      if (!["granted", "denied"].includes(decision)) {
        throw new Error("decision must be granted or denied");
      }
      const result = decideApproval(config, state, {
        approvalId: stringField(payload, "approvalId"),
        decision: decision as "granted" | "denied",
        actorId: optionalStringField(payload, "actorId"),
        notes: optionalStringField(payload, "notes")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, result);
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/projects") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "admin");
      const before = state.events.length;
      const lanes = arrayOfStringsField(payload, "lanes");
      const project = createProject(state, {
        id: stringField(payload, "id"),
        name: stringField(payload, "name"),
        purpose: optionalStringField(payload, "purpose"),
        lanes,
        repoSlug: optionalStringField(payload, "repoSlug")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, { project });
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/agents/install") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "admin");
      const before = state.events.length;
      const sourceKind = stringField(payload, "sourceKind");
      if (!["local_package", "registry_package"].includes(sourceKind)) {
        throw new Error("sourceKind must be local_package or registry_package");
      }
      const agent = installAgentPackage(state, root, {
        sourceKind: sourceKind as "local_package" | "registry_package",
        ref: stringField(payload, "ref"),
        trustState: optionalStringField(payload, "trustState") as "trusted" | "restricted" | "quarantined" | undefined
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, { agent });
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/agents/assign-project") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "admin");
      const before = state.events.length;
      const agent = assignAgentToProject(state, {
        agentId: stringField(payload, "agentId"),
        projectId: stringField(payload, "projectId")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, { agent });
    });
    return;
  }
  if (request.method === "POST" && url === "/v1/sync/retry") {
    void handlePostJson(request, response, async (payload) => {
      requireActorForMutation(request, config, "admin");
      const before = state.events.length;
      const record = retrySync(config, root, state, {
        provider: stringField(payload, "provider"),
        projectId: optionalStringField(payload, "projectId"),
        taskId: optionalStringField(payload, "taskId"),
        reason: optionalStringField(payload, "reason")
      });
      saveRuntimeState(config, root, state);
      broadcastEvents(eventClients, state.events.slice(before));
      writeJson(response, 201, { sync: record });
    });
    return;
  }
  writeJson(response, 404, { error: "not_found" });
}

async function handlePostJson(
  request: IncomingMessage,
  response: ServerResponse,
  handler: (payload: Record<string, unknown>) => Promise<void>
): Promise<void> {
  try {
    const body = await readJsonBody(request);
    await handler(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeJson(response, 400, { error: "bad_request", message });
  }
}

function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const payload = raw ? (JSON.parse(raw) as unknown) : {};
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          reject(new Error("Request body must be a JSON object."));
          return;
        }
        resolveBody(payload as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function stringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function optionalStringField(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string when provided`);
  }
  return value;
}

function arrayOfStringsField(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${key} must be an array of strings`);
  }
  return value;
}

function requireActorForMutation(
  request: IncomingMessage,
  config: JSONObject,
  minimumRole: "operator" | "reviewer" | "admin"
): void {
  const auth = asMap(config.auth);
  if (auth?.require_auth_for_remote_clients !== true) {
    return;
  }
  const rawActor = request.headers["x-comphony-actor-id"];
  const actorId = Array.isArray(rawActor) ? rawActor[0] : rawActor;
  if (typeof actorId !== "string" || actorId.trim() === "") {
    throw new Error("Missing x-comphony-actor-id header");
  }
  const localUsers = Array.isArray(auth?.local_users) ? auth.local_users : [];
  const actor = localUsers.find((entry) => asMap(entry)?.id === actorId);
  if (!actor) {
    throw new Error(`Unknown actor id: ${actorId}`);
  }
  const role = String(asMap(actor)?.role ?? "observer");
  if (roleRank(role) < roleRank(minimumRole)) {
    throw new Error(`Actor ${actorId} does not have permission for this action`);
  }
}

function roleRank(role: string): number {
  switch (role) {
    case "owner":
      return 4;
    case "admin":
      return 3;
    case "operator":
      return 2;
    case "reviewer":
      return 2;
    default:
      return 0;
  }
}

function asMap(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function writeHtml(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function openEventStream(response: ServerResponse, eventClients: Set<ServerResponse>): void {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });
  response.write("retry: 3000\n\n");
  eventClients.add(response);
  response.on("close", () => {
    eventClients.delete(response);
  });
}

function broadcastEvents(eventClients: Set<ServerResponse>, events: EventRecord[]): void {
  if (events.length === 0) {
    return;
  }
  const payload = `data: ${JSON.stringify(events)}\n\n`;
  for (const client of eventClients) {
    client.write(payload);
  }
}
