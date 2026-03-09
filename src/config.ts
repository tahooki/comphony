import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

export type Primitive = string | number | boolean | null;
export type JSONObject = { [key: string]: JSONValue };
export type JSONValue = Primitive | JSONObject | JSONValue[];

export type ValidationResult = {
  errors: string[];
  warnings: string[];
};

export class ConfigError extends Error {}

type StringMap = Record<string, unknown>;

export function loadCompanyConfig(path: string): JSONObject {
  const raw = readFileSync(path, "utf8");
  const parsed = YAML.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigError("Root config must be a mapping.");
  }
  return parsed as JSONObject;
}

export function validateCompanyConfig(config: JSONObject, root: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const company = expectMap(config, "company", errors);
  const runtime = expectMap(config, "runtime", errors);
  const projects = expectList(config, "projects", errors);
  const agents = expectList(config, "agents", errors);

  if (company) {
    requireString(company, "name", "company", errors);
    requireString(company, "slug", "company", errors);
  }

  let runtimeDataDir: string | undefined;

  if (runtime) {
    requireString(runtime, "mode", "runtime", errors);
    runtimeDataDir = requireString(runtime, "data_dir", "runtime", errors) || undefined;
    requireString(runtime, "repo_root", "runtime", errors);
    requireString(runtime, "workspace_root", "runtime", errors);
    requireString(runtime, "workflow_root", "runtime", errors);

    const localServer = expectMap(runtime, "local_server", errors, "runtime");
    if (localServer) {
      requireString(localServer, "host", "runtime.local_server", errors);
      requireInteger(localServer, "port", "runtime.local_server", errors);
    }
  }

  const projectIds = new Set<string>();
  projects.forEach((project, index) => {
    const context = `projects[${index}]`;
    if (!isMap(project)) {
      errors.push(`${context} must be a mapping.`);
      return;
    }
    const projectId = requireString(project, "id", context, errors);
    requireString(project, "name", context, errors);
    const lanes = project.lanes;
    if (!Array.isArray(lanes) || !lanes.every((lane) => typeof lane === "string")) {
      errors.push(`${context}.lanes must be a list of strings.`);
    }
    if (project.repo !== undefined && !isMap(project.repo)) {
      errors.push(`${context}.repo must be a mapping.`);
    }
    if (projectId) {
      if (projectIds.has(projectId)) {
        errors.push(`Duplicate project id: ${projectId}`);
      }
      projectIds.add(projectId);
    }
  });

  agents.forEach((agent, index) => {
    const context = `agents[${index}]`;
    if (!isMap(agent)) {
      errors.push(`${context} must be a mapping.`);
      return;
    }
    requireString(agent, "id", context, errors);
    requireString(agent, "name", context, errors);
    requireString(agent, "role", context, errors);

    const source = expectMap(agent, "source", errors, context);
    if (source) {
      const kind = requireString(source, "kind", `${context}.source`, errors);
      const ref = requireString(source, "ref", `${context}.source`, errors);
      if (kind === "local_package" && ref) {
        const manifestPath = resolve(root, ref, "agent.yaml");
        try {
          readFileSync(manifestPath, "utf8");
        } catch {
          errors.push(`${context}.source.ref points to missing agent package: ${manifestPath}`);
        }
      } else if (kind && !["local_package", "registry_package", "codex_skill"].includes(kind)) {
        warnings.push(`${context}.source.kind uses unrecognized kind: ${kind}`);
      }
    }

    const assignedProjects = agent.assigned_projects;
    if (!Array.isArray(assignedProjects) || !assignedProjects.every((value) => typeof value === "string")) {
      errors.push(`${context}.assigned_projects must be a list of strings.`);
    } else {
      assignedProjects.forEach((projectId) => {
        if (!projectIds.has(projectId)) {
          errors.push(`${context} references unknown project id: ${projectId}`);
        }
      });
    }
  });

  if (runtimeDataDir) {
    const runtimePath = resolve(root, runtimeDataDir);
    if (!existsSync(runtimePath)) {
      warnings.push(`runtime.data_dir does not exist yet: ${runtimePath}`);
    }
  }

  warnings.push("Validated with Comphony runtime 0.1.0");

  return { errors, warnings };
}

export function summarizeCompanyConfig(config: JSONObject): JSONObject {
  const company = isMap(config.company) ? config.company : {};
  const runtime = isMap(config.runtime) ? config.runtime : {};
  const localServer = isMap(runtime.local_server) ? runtime.local_server : {};

  return {
    company: typeof company.name === "string" ? company.name : null,
    slug: typeof company.slug === "string" ? company.slug : null,
    projects: Array.isArray(config.projects) ? config.projects.length : 0,
    agents: Array.isArray(config.agents) ? config.agents.length : 0,
    host: typeof localServer.host === "string" ? localServer.host : "127.0.0.1",
    port: typeof localServer.port === "number" ? localServer.port : 43110
  };
}

function expectMap(payload: StringMap, key: string, errors: string[], parent?: string): StringMap | null {
  const value = payload[key];
  const label = parent ? `${parent}.${key}` : key;
  if (value === undefined) {
    errors.push(`${label} is required.`);
    return null;
  }
  if (!isMap(value)) {
    errors.push(`${label} must be a mapping.`);
    return null;
  }
  return value;
}

function expectList(payload: StringMap, key: string, errors: string[]): unknown[] {
  const value = payload[key];
  if (value === undefined) {
    errors.push(`${key} is required.`);
    return [];
  }
  if (!Array.isArray(value)) {
    errors.push(`${key} must be a list.`);
    return [];
  }
  return value;
}

function requireString(payload: StringMap, key: string, parent: string, errors: string[]): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${parent}.${key} must be a non-empty string.`);
    return "";
  }
  return value;
}

function requireInteger(payload: StringMap, key: string, parent: string, errors: string[]): number {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    errors.push(`${parent}.${key} must be an integer.`);
    return 0;
  }
  return value;
}

function isMap(value: unknown): value is StringMap {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
