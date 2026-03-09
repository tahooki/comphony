import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { JSONObject } from "./config.js";
import { resolveRoutingPolicy, summarizeCompanyConfig } from "./config.js";
import {
  addMessage,
  assignTask,
  autoAssignTask,
  createThread,
  getThreadDetail,
  handoffTask,
  intakeRequest,
  listEvents,
  listMemories,
  listMessages,
  listThreads,
  loadRuntimeState,
  promoteMessageToTask,
  respondToThread,
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
    console.log("Available endpoints: /healthz, /v1/status, /v1/projects, /v1/agents, /v1/tasks, /v1/threads, /v1/messages, /v1/events");
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
  if (request.method === "GET" && url === "/v1/agents") {
    writeJson(response, 200, { agents: state.agents });
    return;
  }
  if (request.method === "GET" && url === "/v1/tasks") {
    writeJson(response, 200, { tasks: state.tasks });
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
  if (request.method === "POST" && url === "/v1/messages") {
    void handlePostJson(request, response, async (payload) => {
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
