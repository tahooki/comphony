import { randomUUID } from "node:crypto";

export type ConversationAction =
  | { kind: "continue_loop" }
  | {
      kind: "create_project";
      project: { id: string; name: string; purpose?: string; lanes: string[]; repoSlug?: string | null };
    }
  | {
      kind: "install_agent";
      sourceKind: "local_package" | "registry_package";
      ref: string;
      trustState?: "trusted" | "restricted" | "quarantined";
      assignProjectId?: string;
    }
  | { kind: "people_summary" };

export function resolveConversationAction(
  body: string,
  input: { threadId: string; currentProjectId?: string | null }
): ConversationAction | null {
  const lowered = body.toLowerCase();
  if (/(who('| i)?s working|who is busy|who is free|team status|people status)/u.test(lowered)) {
    return { kind: "people_summary" };
  }
  if (/(continue|keep going|move forward|proceed|finish this|run the company|drive this)/u.test(lowered)) {
    return { kind: "continue_loop" };
  }

  const projectMatch = body.match(/(?:create|open|start|bootstrap)\s+(?:a\s+)?project(?:\s+called)?\s+["']?([^"'\n]+?)["']?(?:[.!?]|$)/iu);
  if (projectMatch) {
    const rawName = projectMatch[1]?.trim();
    if (rawName) {
      return {
        kind: "create_project",
        project: {
          id: slugifyProjectId(rawName),
          name: rawName,
          purpose: `Created from thread ${input.threadId}`,
          lanes: ["planning", "research", "design", "build", "review"],
          repoSlug: slugifyRepoSlug(rawName)
        }
      };
    }
  }

  const sourceMatch = body.match(/https?:\/\/\S+|(?:\.\/|\/)[^\s]+/u);
  if (
    sourceMatch &&
    /(hire|install|add).*(agent|designer|developer|researcher|publisher|worker)|\b(agent|designer|developer|researcher|publisher)\b.*\b(hire|install|add)\b/iu.test(body)
  ) {
    return {
      kind: "install_agent",
      sourceKind: sourceMatch[0].startsWith("http") ? "registry_package" : "local_package",
      ref: sourceMatch[0],
      trustState: sourceMatch[0].startsWith("http") ? "restricted" : "trusted",
      assignProjectId: input.currentProjectId ?? undefined
    };
  }

  return null;
}

function slugifyProjectId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `project_${randomUUID().slice(0, 8)}`;
}

function slugifyRepoSlug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `project-${randomUUID().slice(0, 8)}`;
}
