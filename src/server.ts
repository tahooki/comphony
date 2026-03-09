import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { JSONObject } from "./config.js";
import { summarizeCompanyConfig } from "./config.js";

export function startServer(config: JSONObject): void {
  const summary = summarizeCompanyConfig(config);
  const host = typeof summary.host === "string" ? summary.host : "127.0.0.1";
  const port = typeof summary.port === "number" ? summary.port : 43110;

  const server = createServer((request, response) => {
    handleRequest(request, response, config, summary);
  });

  server.listen(port, host, () => {
    console.log(`Comphony server listening on http://${host}:${port}`);
    console.log("Available endpoints: /healthz, /v1/status, /v1/projects, /v1/agents");
  });
}

function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: JSONObject,
  summary: JSONObject
): void {
  const url = request.url ?? "/";
  if (request.method !== "GET") {
    writeJson(response, 405, { error: "method_not_allowed" });
    return;
  }
  if (url === "/healthz") {
    writeJson(response, 200, { status: "ok", service: "comphony" });
    return;
  }
  if (url === "/v1/status") {
    writeJson(response, 200, summary);
    return;
  }
  if (url === "/v1/projects") {
    writeJson(response, 200, { projects: Array.isArray(config.projects) ? config.projects : [] });
    return;
  }
  if (url === "/v1/agents") {
    writeJson(response, 200, { agents: Array.isArray(config.agents) ? config.agents : [] });
    return;
  }
  writeJson(response, 404, { error: "not_found" });
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}
