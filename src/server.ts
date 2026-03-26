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
  createSession,
  createThread,
  decideApproval,
  getThreadDetail,
  handoffTask,
  ingestConnectorMessage,
  intakeRequest,
  installAgentPackage,
  listAgentCatalog,
  listApprovals,
  listConsultations,
  listEvents,
  listPeopleOverview,
  listMemories,
  listProjectOverview,
  listReviews,
  listSessions,
  listSyncRecords,
  pushRuntimeToProvider,
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
  revokeSession,
  syncTaskToProvider,
  resolveConsultation,
  resolveSession,
  runTaskWorkTurn,
  saveRuntimeState,
  updateTaskStatus
} from "./state.js";
import type { EventRecord } from "./state.js";
import { renderWebAppHtml } from "./web.js";
import { createMutationWrapper } from "./server/mutation-wrapper.js";
import { createGetRoutes, createPostRoutes } from "./server/routes.js";

export function startServer(config: JSONObject, root: string): void {
  const summary = summarizeCompanyConfig(config);
  const state = loadRuntimeState(config, root);
  const eventClients = new Set<ServerResponse>();
  const host = typeof summary.host === "string" ? summary.host : "127.0.0.1";
  const port = typeof summary.port === "number" ? summary.port : 43110;
  const mutation = createMutationWrapper({
    broadcastEvents,
    eventClients,
    readJsonBody,
    requireActorForMutation: (request, minimumRole) => requireActorForMutation(request, config, state, minimumRole),
    saveState: () => saveRuntimeState(config, root, state),
    writeJson
  });
  const getRoutes = createGetRoutes({
    addMessage,
    arrayOfStringsField,
    assignAgentToProject,
    assignTask,
    autoAssignTask,
    completeTaskReview,
    connectorIngest: ingestConnectorMessage,
    continueThread,
    createProject,
    createSession,
    createThread,
    decideApproval,
    getThreadDetail,
    handoffTask,
    intakeRequest,
    installAgentPackage,
    listAgentCatalog,
    listApprovals,
    listConsultations,
    listEvents,
    listMemories,
    listMessages,
    listPeopleOverview,
    listProjectOverview,
    recommendMemories,
    recommendTasks,
    listReviews,
    listSessions,
    listSyncRecords,
    listThreads,
    mutation,
    openEventStream: (response) => openEventStream(response, eventClients),
    optionalStringField,
    promoteMessageToTask,
    pushRuntimeToProvider,
    requestApproval,
    requestConsultation,
    requestTaskReview,
    resolveConsultation,
    requireActorForMutation: (request, minimumRole) => requireActorForMutation(request, config, state, minimumRole),
    resolveRequestActor: (request) => resolveRequestActor(request, config, state),
    resolveRoutingPolicy,
    resolveSession,
    respondToThread,
    retrySync,
    revokeSession,
    runTaskWorkTurn,
    stringField,
    syncTaskToProvider,
    updateTaskStatus,
    writeHtml,
    writeJson
  });
  const postRoutes = createPostRoutes({
    addMessage,
    arrayOfStringsField,
    assignAgentToProject,
    assignTask,
    autoAssignTask,
    completeTaskReview,
    connectorIngest: ingestConnectorMessage,
    continueThread,
    createProject,
    createSession,
    createThread,
    decideApproval,
    getThreadDetail,
    handoffTask,
    intakeRequest,
    installAgentPackage,
    listAgentCatalog,
    listApprovals,
    listConsultations,
    listEvents,
    listMemories,
    listMessages,
    listPeopleOverview,
    listProjectOverview,
    recommendMemories,
    recommendTasks,
    listReviews,
    listSessions,
    listSyncRecords,
    listThreads,
    mutation,
    openEventStream: (response) => openEventStream(response, eventClients),
    optionalStringField,
    promoteMessageToTask,
    pushRuntimeToProvider,
    requestApproval,
    requestConsultation,
    requestTaskReview,
    resolveConsultation,
    requireActorForMutation: (request, minimumRole) => requireActorForMutation(request, config, state, minimumRole),
    resolveRequestActor: (request) => resolveRequestActor(request, config, state),
    resolveRoutingPolicy,
    resolveSession,
    respondToThread,
    retrySync,
    revokeSession,
    runTaskWorkTurn,
    stringField,
    syncTaskToProvider,
    updateTaskStatus,
    writeHtml,
    writeJson
  });

  const server = createServer((request, response) => {
    handleRequest(request, response, config, root, summary, state, getRoutes, postRoutes);
  });

  server.listen(port, host, () => {
    console.log(`Comphony server listening on http://${host}:${port}`);
    console.log(
      "Available endpoints: /healthz, /v1/status, /v1/auth/session, /v1/projects, /v1/projects/overview, /v1/agents, /v1/agents/catalog, /v1/people, /v1/sessions, /v1/tasks, /v1/tasks/recommend, /v1/tasks/sync, /v1/threads, /v1/messages, /v1/events, /v1/memory, /v1/consultations, /v1/reviews, /v1/approvals, /v1/sync"
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
  getRoutes: Array<{ matches: (context: any) => boolean; handle: (context: any) => void }>,
  postRoutes: Array<{ matches: (context: any) => boolean; handle: (context: any) => void }>
): void {
  const url = request.url ?? "/";
  const parsedUrl = new URL(url, "http://127.0.0.1");
  const context = { config, parsedUrl, request, response, root, state, summary, url };
  const routes = request.method === "GET" ? getRoutes : request.method === "POST" ? postRoutes : [];
  const route = routes.find((candidate) => candidate.matches(context));
  if (route) {
    route.handle(context);
    return;
  }
  writeJson(response, 404, { error: "not_found" });
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
  state: ReturnType<typeof loadRuntimeState>,
  minimumRole: "operator" | "reviewer" | "admin"
): void {
  const actor = resolveRequestActor(request, config, state);
  if (roleRank(actor.role) < roleRank(minimumRole)) {
    throw new Error(`Actor ${actor.actorId} does not have permission for this action`);
  }
}

function resolveRequestActor(
  request: IncomingMessage,
  config: JSONObject,
  state: ReturnType<typeof loadRuntimeState>
): { actorId: string; role: string; sessionId: string | null } {
  const auth = asMap(config.auth);
  if (auth?.require_auth_for_remote_clients !== true) {
    return { actorId: "local_runtime", role: "owner", sessionId: null };
  }
  const rawAuthorization = request.headers.authorization;
  const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] : rawAuthorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    const session = resolveSession(state, { token });
    if (!session) {
      throw new Error("Invalid or revoked session token");
    }
    return { actorId: session.actorId, role: session.role, sessionId: session.id };
  }
  const rawSessionToken = request.headers["x-comphony-session-token"];
  const sessionToken = Array.isArray(rawSessionToken) ? rawSessionToken[0] : rawSessionToken;
  if (typeof sessionToken === "string" && sessionToken.trim() !== "") {
    const session = resolveSession(state, { token: sessionToken });
    if (!session) {
      throw new Error("Invalid or revoked session token");
    }
    return { actorId: session.actorId, role: session.role, sessionId: session.id };
  }
  const rawActor = request.headers["x-comphony-actor-id"];
  const actorId = Array.isArray(rawActor) ? rawActor[0] : rawActor;
  if (typeof actorId !== "string" || actorId.trim() === "") {
    throw new Error("Missing x-comphony-actor-id header or session token");
  }
  const localUsers = Array.isArray(auth?.local_users) ? auth.local_users : [];
  const actor = localUsers.find((entry) => asMap(entry)?.id === actorId);
  if (!actor) {
    throw new Error(`Unknown actor id: ${actorId}`);
  }
  const role = String(asMap(actor)?.role ?? "observer");
  return { actorId, role, sessionId: null };
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
