import type { JSONObject } from "../config.js";
import { fetchTextSync } from "./http.js";

type LinearIssuePayload = {
  title: string;
  description: string;
};

export function getProjectSyncName(config: JSONObject, projectId: string): string | null {
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const projectConfig = projects.find((item) => asMap(item)?.id === projectId);
  const trackerSync = asMap(asMap(projectConfig)?.tracker_sync);
  if (typeof trackerSync?.project_name === "string") {
    return trackerSync.project_name;
  }
  return null;
}

export function fetchLinearTeamId(apiKey: string, teamKey: string): string {
  const data = linearGraphql(apiKey, `
    query ComphonyTeamByKey($teamKey: String!) {
      teams(filter: { key: { eq: $teamKey } }) {
        nodes {
          id
          key
        }
      }
    }
  `, { teamKey });
  const team = data?.teams?.nodes?.[0];
  if (!team?.id) {
    throw new Error(`Linear team with key ${teamKey} was not found`);
  }
  return String(team.id);
}

export function fetchLinearProjectId(apiKey: string, projectName: string): string | null {
  const data = linearGraphql(apiKey, `
    query ComphonyProjectByName($projectName: String!) {
      projects(filter: { name: { eq: $projectName } }) {
        nodes {
          id
          name
        }
      }
    }
  `, { projectName });
  const project = data?.projects?.nodes?.[0];
  return project?.id ? String(project.id) : null;
}

export function createLinearIssue(
  apiKey: string,
  input: { teamId: string; projectId: string | null; title: string; description: string }
): { id: string; identifier: string | null; url: string | null } {
  const data = linearGraphql(apiKey, `
    mutation ComphonyIssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `, {
    input: {
      teamId: input.teamId,
      projectId: input.projectId,
      title: input.title,
      description: input.description
    }
  });
  const issue = data?.issueCreate?.issue;
  if (!issue?.id) {
    throw new Error("Linear issueCreate did not return an issue id");
  }
  return {
    id: String(issue.id),
    identifier: issue.identifier ? String(issue.identifier) : null,
    url: issue.url ? String(issue.url) : null
  };
}

export function updateLinearIssue(
  apiKey: string,
  issueId: string,
  input: LinearIssuePayload
): { id: string; identifier: string | null; url: string | null } {
  const data = linearGraphql(apiKey, `
    mutation ComphonyIssueUpdate($issueId: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $issueId, input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `, {
    issueId,
    input: {
      title: input.title,
      description: input.description
    }
  });
  const issue = data?.issueUpdate?.issue;
  if (!issue?.id) {
    throw new Error("Linear issueUpdate did not return an issue id");
  }
  return {
    id: String(issue.id),
    identifier: issue.identifier ? String(issue.identifier) : null,
    url: issue.url ? String(issue.url) : null
  };
}

export function linearGraphql(apiKey: string, query: string, variables: Record<string, unknown>): any {
  const endpoint = process.env.LINEAR_API_URL ?? "https://api.linear.app/graphql";
  const responseText = fetchTextSync(endpoint, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });
  const parsed = JSON.parse(responseText) as { data?: unknown; errors?: Array<{ message?: string }> };
  if (parsed.errors && parsed.errors.length > 0) {
    const message = parsed.errors.map((error) => error.message || "Unknown Linear error").join("; ");
    throw new Error(message);
  }
  return parsed.data;
}

function asMap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
