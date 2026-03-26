import type { JSONObject } from "../config.js";
import { fetchTextSync } from "./http.js";

type RuntimeSnapshotState = {
  projects: unknown[];
  agents: unknown[];
  tasks: unknown[];
  threads: unknown[];
  messages: unknown[];
  approvals: unknown[];
  reviews: unknown[];
  consultations: unknown[];
  syncRecords: unknown[];
  sessions: Array<{
    id: string;
    actorId: string;
    role: string;
    label: string | null;
    createdAt: string;
    lastSeenAt: string;
    revokedAt: string | null;
  }>;
};

type EventRecordLike = {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

export function syncRuntimeToSupabase(
  config: JSONObject,
  providerConfig: Record<string, unknown>,
  state: RuntimeSnapshotState,
  recentEvents: EventRecordLike[]
): void {
  const projectRef = typeof providerConfig.project_ref === "string" ? providerConfig.project_ref : "local-dev";
  const supabaseUrl = process.env.SUPABASE_URL ?? (projectRef !== "local-dev" ? `https://${projectRef}.supabase.co` : undefined);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const company = asMap(config.company);
  const companySlug = typeof company?.slug === "string" ? company.slug : "comphony";
  const snapshotBody = {
    company_slug: companySlug,
    project_ref: projectRef,
    generated_at: new Date().toISOString(),
    snapshot: {
      projects: state.projects,
      agents: state.agents,
      tasks: state.tasks,
      threads: state.threads,
      messages: state.messages.slice(-200),
      approvals: state.approvals,
      reviews: state.reviews,
      consultations: state.consultations,
      sync_records: state.syncRecords,
      sessions: state.sessions.map((session) => ({
        id: session.id,
        actor_id: session.actorId,
        role: session.role,
        label: session.label,
        created_at: session.createdAt,
        last_seen_at: session.lastSeenAt,
        revoked_at: session.revokedAt
      }))
    }
  };

  const baseUrl = supabaseUrl.replace(/\/$/, "");
  fetchTextSync(`${baseUrl}/rest/v1/comphony_runtime_snapshots`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(snapshotBody)
  });

  if (recentEvents.length > 0) {
    const eventRows = recentEvents.map((event) => ({
      company_slug: companySlug,
      project_ref: projectRef,
      event_id: event.id,
      event_type: event.type,
      entity_type: event.entityType,
      entity_id: event.entityId,
      occurred_at: event.timestamp,
      payload: event.payload
    }));
    fetchTextSync(`${baseUrl}/rest/v1/comphony_events`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(eventRows)
    });
  }
}

function asMap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
