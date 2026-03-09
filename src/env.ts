import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let loadedRoots = new Set<string>();

export function loadEnvironment(root: string): void {
  if (loadedRoots.has(root)) {
    return;
  }

  for (const candidate of [".env", ".env.local"]) {
    const filePath = resolve(root, candidate);
    if (!existsSync(filePath)) {
      continue;
    }
    const raw = readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) {
        continue;
      }
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
      if (!match) {
        continue;
      }
      const [, key, value] = match;
      if (process.env[key] !== undefined) {
        continue;
      }
      process.env[key] = normalizeEnvValue(value);
    }
  }

  loadedRoots.add(root);
}

export function resetLoadedEnvironmentForTests(): void {
  loadedRoots = new Set<string>();
}

function normalizeEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  const commentIndex = trimmed.indexOf(" #");
  return commentIndex === -1 ? trimmed : trimmed.slice(0, commentIndex).trimEnd();
}
