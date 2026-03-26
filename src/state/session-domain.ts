import { randomBytes, randomUUID } from "node:crypto";

import type { JSONObject } from "../config.js";

type SessionRecordLike = {
  id: string;
  actorId: string;
  role: string;
  label: string | null;
  token: string;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
};

type RuntimeStateLike = {
  sessions: SessionRecordLike[];
  counters: {
    session: number;
  };
};

type EventInput = {
  type: string;
  entityType: "thread" | "message" | "task" | "consultation" | "review" | "approval" | "system";
  entityId: string;
  timestamp: string;
  payload: Record<string, string | number | boolean | null>;
};

type ConfiguredActor = {
  id: string;
  role: string;
};

type SessionDomainDeps<TState extends RuntimeStateLike> = {
  appendEvent: (state: TState, input: EventInput) => void;
  findConfiguredActor: (config: JSONObject, actorId: string) => ConfiguredActor;
};

export function listSessions<TSession extends SessionRecordLike, TState extends RuntimeStateLike & { sessions: TSession[] }>(
  state: TState,
  filters?: { actorId?: string; activeOnly?: boolean }
): TSession[] {
  return state.sessions
    .filter((session) => {
      if (filters?.actorId && session.actorId !== filters.actorId) {
        return false;
      }
      if (filters?.activeOnly && session.revokedAt !== null) {
        return false;
      }
      return true;
    })
    .slice()
    .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt)) as TSession[];
}

export function createSession<TSession extends SessionRecordLike, TState extends RuntimeStateLike & { sessions: TSession[] }>(
  config: JSONObject,
  state: TState,
  input: { actorId: string; label?: string },
  deps: SessionDomainDeps<TState>
): TSession {
  const actor = deps.findConfiguredActor(config, input.actorId);
  const now = new Date().toISOString();
  const session = {
    id: `session_${String(state.counters.session + 1).padStart(4, "0")}_${randomUUID().slice(0, 8)}`,
    actorId: actor.id,
    role: actor.role,
    label: input.label ?? null,
    token: randomBytes(24).toString("hex"),
    createdAt: now,
    lastSeenAt: now,
    revokedAt: null
  } as TSession;

  state.counters.session += 1;
  state.sessions.push(session);
  deps.appendEvent(state, {
    type: "session.created",
    entityType: "system",
    entityId: session.id,
    timestamp: now,
    payload: {
      actorId: session.actorId,
      role: session.role
    }
  });

  return session as TSession;
}

export function revokeSession<TSession extends SessionRecordLike, TState extends RuntimeStateLike & { sessions: TSession[] }>(
  state: TState,
  input: { sessionId: string },
  deps: Pick<SessionDomainDeps<TState>, "appendEvent">
): TSession {
  const session = state.sessions.find((item) => item.id === input.sessionId);
  if (!session) {
    throw new Error(`Unknown session id: ${input.sessionId}`);
  }

  if (session.revokedAt === null) {
    session.revokedAt = new Date().toISOString();
    session.lastSeenAt = session.revokedAt;
    deps.appendEvent(state, {
      type: "session.revoked",
      entityType: "system",
      entityId: session.id,
      timestamp: session.revokedAt,
      payload: {
        actorId: session.actorId
      }
    });
  }

  return session as TSession;
}

export function resolveSession<TSession extends SessionRecordLike, TState extends RuntimeStateLike & { sessions: TSession[] }>(
  state: TState,
  input: { token: string }
): TSession | null {
  const session = state.sessions.find((item) => item.token === input.token && item.revokedAt === null) ?? null;
  if (session) {
    session.lastSeenAt = new Date().toISOString();
  }
  return session as TSession | null;
}

export function findConfiguredActor(config: JSONObject, actorId: string): ConfiguredActor {
  const auth = asMap(config.auth);
  const localUsers = Array.isArray(auth?.local_users) ? auth.local_users : [];
  const actor = localUsers.find((entry) => asMap(entry)?.id === actorId);
  if (!actor) {
    throw new Error(`Unknown actor id: ${actorId}`);
  }

  const actorMap = asMap(actor);
  return {
    id: actorId,
    role: typeof actorMap?.role === "string" ? actorMap.role : "observer"
  };
}

function asMap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
