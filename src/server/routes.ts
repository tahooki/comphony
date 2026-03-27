import type { IncomingMessage, ServerResponse } from "node:http";

import { renderWebAppHtml } from "../web.js";

type ServerContext<TState> = {
  config: Record<string, unknown>;
  parsedUrl: URL;
  request: IncomingMessage;
  response: ServerResponse;
  root: string;
  state: TState;
  summary: Record<string, unknown>;
  url: string;
};

type ServerDeps<TState> = {
  addMessage: (state: TState, input: {
    threadId: string;
    role: "user" | "agent" | "system";
    body: string;
    routedProjectId?: string | null;
    suggestedLane?: string | null;
    targetAgentId?: string | null;
  }, routing?: any) => unknown;
  arrayOfStringsField: (payload: Record<string, unknown>, key: string) => string[];
  assignAgentToProject: (state: TState, input: { agentId: string; projectId: string }) => unknown;
  assignTask: (config: any, root: string, state: TState, input: { taskId: string; agentId: string }) => unknown;
  autoAssignTask: (config: any, root: string, state: TState, taskId: string) => unknown;
  completeTaskReview: (config: any, state: TState, input: { reviewId: string; outcome: "approved" | "changes_requested"; notes?: string }) => unknown;
  connectorIngest: (config: any, root: string, state: TState, input: {
    provider: "telegram" | "discord" | "slack";
    body: string;
    senderId: string;
    senderName?: string;
    threadId?: string;
    title?: string;
  }) => unknown;
  continueThread: (config: any, root: string, state: TState, input: { threadId: string }) => unknown;
  createProject: (state: TState, input: { id: string; name: string; purpose?: string; lanes: string[]; repoSlug?: string | null }) => unknown;
  createSession: (config: any, state: TState, input: { actorId: string; label?: string }) => unknown;
  createThread: (state: TState, input: { title: string }) => unknown;
  decideApproval: (config: any, state: TState, input: { approvalId: string; decision: "granted" | "denied"; actorId?: string; notes?: string }) => unknown;
  getThreadDetail: (state: TState, threadId: string) => unknown;
  handoffTask: (config: any, root: string, state: TState, input: { taskId: string; lane: string }) => unknown;
  intakeRequest: (config: any, root: string, state: TState, input: { title: string; body: string; projectId?: string; lane?: string }) => unknown;
  installAgentPackage: (state: TState, root: string, input: { sourceKind: "local_package" | "registry_package"; ref: string; trustState?: "trusted" | "restricted" | "quarantined" }) => unknown;
  listAgentCatalog: (state: TState, root: string) => unknown;
  listApprovals: (state: TState, filters?: { taskId?: string; threadId?: string; status?: string }) => unknown;
  listConsultations: (state: TState, filters?: { taskId?: string; threadId?: string; status?: string }) => unknown;
  listEvents: (state: TState, limit?: number) => unknown;
  listMemories: (state: TState, filters?: { projectId?: string; threadId?: string; taskId?: string; query?: string; limit?: number }) => unknown;
  listMessages: (state: TState, threadId?: string) => unknown;
  listPeopleOverview: (state: TState) => unknown;
  listProjectOverview: (state: TState) => unknown;
  recommendMemories: (state: TState, filters: { projectId?: string; threadId?: string; taskId?: string; query?: string; limit?: number }) => unknown;
  recommendTasks: (state: TState, filters: { projectId?: string; threadId?: string; taskId?: string; query?: string; limit?: number }) => unknown;
  listReviews: (state: TState, filters?: { taskId?: string; threadId?: string; status?: string }) => unknown;
  listSessions: (state: TState, filters?: { actorId?: string; activeOnly?: boolean }) => unknown;
  listSyncRecords: (state: TState, filters?: { provider?: string; projectId?: string; status?: string }) => unknown;
  listThreads: (state: TState) => unknown;
  mutation: (
    context: { request: IncomingMessage; response: ServerResponse; state: TState & { events: unknown[] } },
    options: { minimumRole?: "operator" | "reviewer" | "admin"; successStatus?: number },
    handler: (payload: Record<string, unknown>) => unknown | Promise<unknown>
  ) => void;
  openEventStream: (response: ServerResponse) => void;
  optionalStringField: (payload: Record<string, unknown>, key: string) => string | undefined;
  promoteMessageToTask: (state: TState, input: { messageId: string; projectId?: string; lane?: string; title?: string }, routing?: any) => unknown;
  pushRuntimeToProvider: (config: any, root: string, state: TState, input: { provider: string; reason?: string }) => unknown;
  requestApproval: (config: any, state: TState, input: { action: string; reason: string; taskId?: string; requestedBy?: string }) => unknown;
  requestConsultation: (config: any, state: TState, input: { taskId: string; toAgentId: string; reason: string; instructions?: string }) => unknown;
  requestTaskReview: (config: any, state: TState, input: { taskId: string; reviewerAgentId: string; reason: string }) => unknown;
  resolveConsultation: (config: any, state: TState, input: { consultationId: string; response: string }) => unknown;
  requireActorForMutation: (request: IncomingMessage, minimumRole: "operator" | "reviewer" | "admin") => void;
  resolveRequestActor: (request: IncomingMessage) => { actorId: string; role: string; sessionId: string | null };
  resolveRoutingPolicy: (config: any) => unknown;
  resolveSession: (state: TState, input: { token: string }) => unknown;
  respondToThread: (config: any, root: string, state: TState, input: { threadId: string; body: string }) => unknown;
  retrySync: (config: any, root: string, state: TState, input: { provider: string; projectId?: string; taskId?: string; reason?: string }) => unknown;
  revokeSession: (state: TState, input: { sessionId: string }) => unknown;
  runTaskWorkTurn: (config: any, root: string, state: TState, input: { taskId: string }) => unknown;
  stringField: (payload: Record<string, unknown>, key: string) => string;
  syncTaskToProvider: (config: any, root: string, state: TState, input: { provider: string; taskId: string }) => unknown;
  updateTaskStatus: (state: TState, input: { taskId: string; status: string }) => unknown;
  writeHtml: (response: ServerResponse, statusCode: number, body: string) => void;
  writeJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
};

type Route<TState> = {
  matches: (context: ServerContext<TState>) => boolean;
  handle: (context: ServerContext<TState>) => void;
};

export const GET_ROUTE_SURFACE = [
  "/",
  "/app",
  "/healthz",
  "/v1/status",
  "/v1/auth/session",
  "/v1/projects",
  "/v1/projects/overview",
  "/v1/sync",
  "/v1/agents",
  "/v1/agents/catalog",
  "/v1/people",
  "/v1/sessions",
  "/v1/tasks",
  "/v1/tasks/recommend",
  "/v1/events/stream",
  "/v1/events",
  "/v1/memory",
  "/v1/memory/recommend",
  "/v1/consultations",
  "/v1/reviews",
  "/v1/approvals",
  "/v1/threads",
  "/v1/threads/:id",
  "/v1/messages"
] as const;

export const POST_ROUTE_SURFACE = [
  "/v1/intake",
  "/v1/threads",
  "/v1/threads/respond",
  "/v1/threads/continue",
  "/v1/messages",
  "/v1/messages/promote",
  "/v1/tasks/assign",
  "/v1/tasks/status",
  "/v1/tasks/work",
  "/v1/tasks/handoff",
  "/v1/tasks/sync",
  "/v1/tasks/consult",
  "/v1/consultations/resolve",
  "/v1/tasks/review",
  "/v1/reviews/complete",
  "/v1/approvals/request",
  "/v1/approvals/decide",
  "/v1/projects",
  "/v1/agents/install",
  "/v1/agents/assign-project",
  "/v1/sync/retry",
  "/v1/sync/push",
  "/v1/auth/login",
  "/v1/auth/logout",
  "/v1/connectors/:provider/messages"
] as const;

export function createGetRoutes<TState>(deps: ServerDeps<TState>): Route<TState>[] {
  return [
    {
      matches: (context) => context.parsedUrl.pathname === "/" || context.parsedUrl.pathname === "/app",
      handle: (context) => deps.writeHtml(context.response, 200, renderWebAppHtml())
    },
    {
      matches: (context) => context.url === "/healthz",
      handle: (context) => deps.writeJson(context.response, 200, { status: "ok", service: "comphony" })
    },
    {
      matches: (context) => context.url === "/v1/status",
      handle: (context) => deps.writeJson(context.response, 200, context.summary)
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/auth/session",
      handle: (context) => {
        try {
          const actor = deps.resolveRequestActor(context.request);
          deps.writeJson(context.response, 200, { session: actor });
        } catch (error) {
          deps.writeJson(context.response, 401, { error: "unauthorized", message: error instanceof Error ? error.message : String(error) });
        }
      }
    },
    {
      matches: (context) => context.url === "/v1/projects",
      handle: (context) => deps.writeJson(context.response, 200, { projects: (context.state as any).projects })
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/projects/overview",
      handle: (context) => deps.writeJson(context.response, 200, { projects: deps.listProjectOverview(context.state) })
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/sync",
      handle: (context) => deps.writeJson(context.response, 200, {
        sync: deps.listSyncRecords(context.state, {
          provider: context.parsedUrl.searchParams.get("provider") ?? undefined,
          projectId: context.parsedUrl.searchParams.get("projectId") ?? undefined,
          status: context.parsedUrl.searchParams.get("status") ?? undefined
        })
      })
    },
    {
      matches: (context) => context.url === "/v1/agents",
      handle: (context) => deps.writeJson(context.response, 200, { agents: (context.state as any).agents })
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/agents/catalog",
      handle: (context) => deps.writeJson(context.response, 200, { agents: deps.listAgentCatalog(context.state, context.root) })
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/people",
      handle: (context) => deps.writeJson(context.response, 200, { people: deps.listPeopleOverview(context.state) })
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/sessions",
      handle: (context) => {
        try {
          deps.requireActorForMutation(context.request, "admin");
          deps.writeJson(context.response, 200, {
            sessions: deps.listSessions(context.state, {
              actorId: context.parsedUrl.searchParams.get("actorId") ?? undefined,
              activeOnly: context.parsedUrl.searchParams.get("activeOnly") === "true"
            })
          });
        } catch (error) {
          deps.writeJson(context.response, 401, { error: "unauthorized", message: error instanceof Error ? error.message : String(error) });
        }
      }
    },
    {
      matches: (context) => context.url === "/v1/tasks",
      handle: (context) => deps.writeJson(context.response, 200, { tasks: (context.state as any).tasks })
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/tasks/recommend",
      handle: (context) => deps.writeJson(context.response, 200, {
        tasks: deps.recommendTasks(context.state, {
          projectId: context.parsedUrl.searchParams.get("projectId") ?? undefined,
          threadId: context.parsedUrl.searchParams.get("threadId") ?? undefined,
          taskId: context.parsedUrl.searchParams.get("taskId") ?? undefined,
          query: context.parsedUrl.searchParams.get("query") ?? undefined,
          limit: context.parsedUrl.searchParams.get("limit") ? Number(context.parsedUrl.searchParams.get("limit")) : undefined
        })
      })
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/events/stream",
      handle: (context) => deps.openEventStream(context.response)
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/events",
      handle: (context) => {
        const limitValue = context.parsedUrl.searchParams.get("limit");
        const limit = limitValue ? Number(limitValue) : 50;
        deps.writeJson(context.response, 200, { events: deps.listEvents(context.state, Number.isFinite(limit) ? limit : 50) });
      }
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/memory",
      handle: (context) => deps.writeJson(context.response, 200, {
        memories: deps.listMemories(context.state, {
          projectId: context.parsedUrl.searchParams.get("projectId") ?? undefined,
          threadId: context.parsedUrl.searchParams.get("threadId") ?? undefined,
          taskId: context.parsedUrl.searchParams.get("taskId") ?? undefined,
          query: context.parsedUrl.searchParams.get("query") ?? undefined,
          limit: context.parsedUrl.searchParams.get("limit") ? Number(context.parsedUrl.searchParams.get("limit")) : undefined
        })
      })
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/memory/recommend",
      handle: (context) => deps.writeJson(context.response, 200, {
        memories: deps.recommendMemories(context.state, {
          projectId: context.parsedUrl.searchParams.get("projectId") ?? undefined,
          threadId: context.parsedUrl.searchParams.get("threadId") ?? undefined,
          taskId: context.parsedUrl.searchParams.get("taskId") ?? undefined,
          query: context.parsedUrl.searchParams.get("query") ?? undefined,
          limit: context.parsedUrl.searchParams.get("limit") ? Number(context.parsedUrl.searchParams.get("limit")) : undefined
        })
      })
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/consultations",
      handle: (context) => deps.writeJson(context.response, 200, {
        consultations: deps.listConsultations(context.state, {
          taskId: context.parsedUrl.searchParams.get("taskId") ?? undefined,
          threadId: context.parsedUrl.searchParams.get("threadId") ?? undefined,
          status: context.parsedUrl.searchParams.get("status") ?? undefined
        })
      })
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/reviews",
      handle: (context) => deps.writeJson(context.response, 200, {
        reviews: deps.listReviews(context.state, {
          taskId: context.parsedUrl.searchParams.get("taskId") ?? undefined,
          threadId: context.parsedUrl.searchParams.get("threadId") ?? undefined,
          status: context.parsedUrl.searchParams.get("status") ?? undefined
        })
      })
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/approvals",
      handle: (context) => deps.writeJson(context.response, 200, {
        approvals: deps.listApprovals(context.state, {
          taskId: context.parsedUrl.searchParams.get("taskId") ?? undefined,
          threadId: context.parsedUrl.searchParams.get("threadId") ?? undefined,
          status: context.parsedUrl.searchParams.get("status") ?? undefined
        })
      })
    },
    {
      matches: (context) => context.url === "/v1/threads",
      handle: (context) => deps.writeJson(context.response, 200, { threads: deps.listThreads(context.state) })
    },
    {
      matches: (context) => context.parsedUrl.pathname.startsWith("/v1/threads/"),
      handle: (context) => {
        const threadId = context.parsedUrl.pathname.split("/").pop();
        if (!threadId) {
          deps.writeJson(context.response, 400, { error: "bad_request", message: "thread id is required" });
          return;
        }
        try {
          deps.writeJson(context.response, 200, deps.getThreadDetail(context.state, threadId));
        } catch (error) {
          deps.writeJson(context.response, 404, { error: "not_found", message: error instanceof Error ? error.message : String(error) });
        }
      }
    },
    {
      matches: (context) => context.parsedUrl.pathname === "/v1/messages",
      handle: (context) => deps.writeJson(context.response, 200, {
        messages: deps.listMessages(context.state, context.parsedUrl.searchParams.get("threadId") ?? undefined)
      })
    }
  ];
}

export function createPostRoutes<TState extends { events: unknown[] }>(deps: ServerDeps<TState>): Route<TState>[] {
  return [
    {
      matches: (context) => context.url === "/v1/intake",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => deps.intakeRequest(context.config, context.root, context.state, {
        title: deps.stringField(payload, "title"),
        body: deps.stringField(payload, "body"),
        projectId: deps.optionalStringField(payload, "projectId"),
        lane: deps.optionalStringField(payload, "lane")
      }))
    },
    {
      matches: (context) => context.url === "/v1/threads",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => deps.createThread(context.state, {
        title: deps.stringField(payload, "title")
      }))
    },
    {
      matches: (context) => context.url === "/v1/threads/respond",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => deps.respondToThread(context.config, context.root, context.state, {
        threadId: deps.stringField(payload, "threadId"),
        body: deps.stringField(payload, "body")
      }))
    },
    {
      matches: (context) => context.url === "/v1/threads/continue",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => deps.continueThread(context.config, context.root, context.state, {
        threadId: deps.stringField(payload, "threadId")
      }))
    },
    {
      matches: (context) => context.url === "/v1/messages",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => {
        const role = deps.optionalStringField(payload, "role") ?? "user";
        if (!["user", "agent", "system"].includes(role)) {
          throw new Error("role must be one of: user, agent, system");
        }
        return deps.addMessage(context.state, {
          threadId: deps.stringField(payload, "threadId"),
          body: deps.stringField(payload, "body"),
          role: role as "user" | "agent" | "system"
        }, deps.resolveRoutingPolicy(context.config));
      })
    },
    {
      matches: (context) => context.url === "/v1/messages/promote",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => deps.promoteMessageToTask(context.state, {
        messageId: deps.stringField(payload, "messageId"),
        projectId: deps.optionalStringField(payload, "projectId"),
        lane: deps.optionalStringField(payload, "lane"),
        title: deps.optionalStringField(payload, "title")
      }, deps.resolveRoutingPolicy(context.config)))
    },
    {
      matches: (context) => context.url === "/v1/tasks/assign",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => {
        const taskId = deps.stringField(payload, "taskId");
        const agentId = deps.optionalStringField(payload, "agentId");
        return agentId
          ? { task: deps.assignTask(context.config, context.root, context.state, { taskId, agentId }), agentId, error: null }
          : deps.autoAssignTask(context.config, context.root, context.state, taskId);
      })
    },
    {
      matches: (context) => context.url === "/v1/tasks/status",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => deps.updateTaskStatus(context.state, {
        taskId: deps.stringField(payload, "taskId"),
        status: deps.stringField(payload, "status")
      }))
    },
    {
      matches: (context) => context.url === "/v1/tasks/work",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => deps.runTaskWorkTurn(context.config, context.root, context.state, {
        taskId: deps.stringField(payload, "taskId")
      }))
    },
    {
      matches: (context) => context.url === "/v1/tasks/handoff",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => deps.handoffTask(context.config, context.root, context.state, {
        taskId: deps.stringField(payload, "taskId"),
        lane: deps.stringField(payload, "lane")
      }))
    },
    {
      matches: (context) => context.url === "/v1/tasks/sync",
      handle: (context) => deps.mutation(context, { minimumRole: "admin" }, (payload) => deps.syncTaskToProvider(context.config, context.root, context.state, {
        provider: deps.stringField(payload, "provider"),
        taskId: deps.stringField(payload, "taskId")
      }))
    },
    {
      matches: (context) => context.url === "/v1/tasks/consult",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => deps.requestConsultation(context.config, context.state, {
        taskId: deps.stringField(payload, "taskId"),
        toAgentId: deps.stringField(payload, "toAgentId"),
        reason: deps.stringField(payload, "reason"),
        instructions: deps.optionalStringField(payload, "instructions")
      }))
    },
    {
      matches: (context) => context.url === "/v1/consultations/resolve",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => deps.resolveConsultation(context.config, context.state, {
        consultationId: deps.stringField(payload, "consultationId"),
        response: deps.stringField(payload, "response")
      }))
    },
    {
      matches: (context) => context.url === "/v1/tasks/review",
      handle: (context) => deps.mutation(context, { minimumRole: "reviewer" }, (payload) => deps.requestTaskReview(context.config, context.state, {
        taskId: deps.stringField(payload, "taskId"),
        reviewerAgentId: deps.stringField(payload, "reviewerAgentId"),
        reason: deps.stringField(payload, "reason")
      }))
    },
    {
      matches: (context) => context.url === "/v1/reviews/complete",
      handle: (context) => deps.mutation(context, { minimumRole: "reviewer" }, (payload) => {
        const outcome = deps.stringField(payload, "outcome");
        if (!["approved", "changes_requested"].includes(outcome)) {
          throw new Error("outcome must be approved or changes_requested");
        }
        return deps.completeTaskReview(context.config, context.state, {
          reviewId: deps.stringField(payload, "reviewId"),
          outcome: outcome as "approved" | "changes_requested",
          notes: deps.optionalStringField(payload, "notes")
        });
      })
    },
    {
      matches: (context) => context.url === "/v1/approvals/request",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => deps.requestApproval(context.config, context.state, {
        action: deps.stringField(payload, "action"),
        reason: deps.stringField(payload, "reason"),
        taskId: deps.optionalStringField(payload, "taskId"),
        requestedBy: deps.optionalStringField(payload, "requestedBy")
      }))
    },
    {
      matches: (context) => context.url === "/v1/approvals/decide",
      handle: (context) => deps.mutation(context, { minimumRole: "admin" }, (payload) => {
        const decision = deps.stringField(payload, "decision");
        if (!["granted", "denied"].includes(decision)) {
          throw new Error("decision must be granted or denied");
        }
        return deps.decideApproval(context.config, context.state, {
          approvalId: deps.stringField(payload, "approvalId"),
          decision: decision as "granted" | "denied",
          actorId: deps.optionalStringField(payload, "actorId"),
          notes: deps.optionalStringField(payload, "notes")
        });
      })
    },
    {
      matches: (context) => context.url === "/v1/projects",
      handle: (context) => deps.mutation(context, { minimumRole: "admin" }, (payload) => ({ project: deps.createProject(context.state, {
        id: deps.stringField(payload, "id"),
        name: deps.stringField(payload, "name"),
        purpose: deps.optionalStringField(payload, "purpose"),
        lanes: deps.arrayOfStringsField(payload, "lanes"),
        repoSlug: deps.optionalStringField(payload, "repoSlug")
      }) }))
    },
    {
      matches: (context) => context.url === "/v1/agents/install",
      handle: (context) => deps.mutation(context, { minimumRole: "admin" }, (payload) => {
        const sourceKind = deps.stringField(payload, "sourceKind");
        if (!["local_package", "registry_package"].includes(sourceKind)) {
          throw new Error("sourceKind must be local_package or registry_package");
        }
        return {
          agent: deps.installAgentPackage(context.state, context.root, {
            sourceKind: sourceKind as "local_package" | "registry_package",
            ref: deps.stringField(payload, "ref"),
            trustState: deps.optionalStringField(payload, "trustState") as "trusted" | "restricted" | "quarantined" | undefined
          })
        };
      })
    },
    {
      matches: (context) => context.url === "/v1/agents/assign-project",
      handle: (context) => deps.mutation(context, { minimumRole: "admin" }, (payload) => ({
        agent: deps.assignAgentToProject(context.state, {
          agentId: deps.stringField(payload, "agentId"),
          projectId: deps.stringField(payload, "projectId")
        })
      }))
    },
    {
      matches: (context) => context.url === "/v1/sync/retry",
      handle: (context) => deps.mutation(context, { minimumRole: "admin" }, (payload) => ({
        sync: deps.retrySync(context.config, context.root, context.state, {
          provider: deps.stringField(payload, "provider"),
          projectId: deps.optionalStringField(payload, "projectId"),
          taskId: deps.optionalStringField(payload, "taskId"),
          reason: deps.optionalStringField(payload, "reason")
        })
      }))
    },
    {
      matches: (context) => context.url === "/v1/sync/push",
      handle: (context) => deps.mutation(context, { minimumRole: "admin" }, (payload) => ({
        sync: deps.pushRuntimeToProvider(context.config, context.root, context.state, {
          provider: deps.stringField(payload, "provider"),
          reason: deps.optionalStringField(payload, "reason")
        })
      }))
    },
    {
      matches: (context) => context.url === "/v1/auth/login",
      handle: (context) => deps.mutation(context, { successStatus: 201 }, (payload) => ({
        session: deps.createSession(context.config, context.state, {
          actorId: deps.stringField(payload, "actorId"),
          label: deps.optionalStringField(payload, "label")
        })
      }))
    },
    {
      matches: (context) => context.url === "/v1/auth/logout",
      handle: (context) => deps.mutation(context, { minimumRole: "operator" }, (payload) => ({
        session: deps.revokeSession(context.state, {
          sessionId: deps.stringField(payload, "sessionId")
        })
      }))
    },
    {
      matches: (context) => /^\/v1\/connectors\/(telegram|discord|slack)\/messages$/.test(context.parsedUrl.pathname),
      handle: (context) => deps.mutation(context, { successStatus: 201 }, (payload) => {
        const provider = context.parsedUrl.pathname.split("/")[3] as "telegram" | "discord" | "slack";
        return deps.connectorIngest(context.config, context.root, context.state, {
          provider,
          body: deps.stringField(payload, "body"),
          senderId: deps.stringField(payload, "senderId"),
          senderName: deps.optionalStringField(payload, "senderName"),
          threadId: deps.optionalStringField(payload, "threadId"),
          title: deps.optionalStringField(payload, "title")
        });
      })
    }
  ];
}
