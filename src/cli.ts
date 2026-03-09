import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ConfigError, loadCompanyConfig, validateCompanyConfig } from "./config.js";
import { startServer } from "./server.js";
import { DEFAULT_COMPANY_YAML } from "./templates.js";

type Command =
  | { kind: "init"; force: boolean }
  | { kind: "validate" }
  | { kind: "server-start" };

type ParsedArgs = {
  configPath: string;
  command: Command;
};

export function main(argv = process.argv.slice(2)): number {
  try {
    const parsed = parseArgs(argv);
    const root = process.cwd();
    const configPath = resolve(root, parsed.configPath);

    switch (parsed.command.kind) {
      case "init":
        return runInit(root, configPath, parsed.command.force);
      case "validate":
        return runValidate(root, configPath);
      case "server-start":
        return runServer(root, configPath);
      default:
        return 2;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  let configPath = "company.yaml";
  let index = 0;

  while (index < argv.length && argv[index]?.startsWith("--")) {
    const current = argv[index];
    if (current === "--config") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value after --config");
      }
      configPath = value;
      index += 2;
      continue;
    }
    if (current === "--help" || current === "-h") {
      throw new Error(helpText());
    }
    break;
  }

  const command = argv[index];
  if (!command) {
    throw new Error(helpText());
  }

  if (command === "init") {
    const force = argv.includes("--force");
    return { configPath, command: { kind: "init", force } };
  }
  if (command === "validate") {
    return { configPath, command: { kind: "validate" } };
  }
  if (command === "server" && argv[index + 1] === "start") {
    return { configPath, command: { kind: "server-start" } };
  }

  throw new Error(helpText());
}

function runInit(root: string, configPath: string, force: boolean): number {
  ["agents", "repos", "runtime-data", "workspaces", "workflows"].forEach((directory) => {
    mkdirSync(resolve(root, directory), { recursive: true });
  });

  [
    "agents/.gitkeep",
    "runtime-data/.gitkeep"
  ].forEach((relativePath) => {
    const path = resolve(root, relativePath);
    try {
      writeFileSync(path, "", { flag: "wx" });
    } catch {
      // file already exists
    }
  });

  if (!force) {
    try {
      loadCompanyConfig(configPath);
      console.log(`Kept existing config: ${configPath}`);
    } catch {
      writeFileSync(configPath, DEFAULT_COMPANY_YAML, "utf8");
      console.log(`Created config: ${configPath}`);
    }
  } else {
    writeFileSync(configPath, DEFAULT_COMPANY_YAML, "utf8");
    console.log(`Overwrote config: ${configPath}`);
  }

  console.log("Prepared local directories:");
  ["agents", "repos", "runtime-data", "workspaces", "workflows"].forEach((directory) => {
    console.log(`  - ${resolve(root, directory)}`);
  });
  console.log("Next steps:");
  console.log("  - Run `npm run validate:config`");
  console.log("  - Run `npm run server:start`");
  return 0;
}

function runValidate(root: string, configPath: string): number {
  let config;
  try {
    config = loadCompanyConfig(configPath);
  } catch (error) {
    if (error instanceof ConfigError || error instanceof Error) {
      console.error(`Config error: ${error.message}`);
      return 1;
    }
    throw error;
  }

  const result = validateCompanyConfig(config, root);
  const companyName =
    config.company && typeof config.company === "object" && !Array.isArray(config.company)
      ? (config.company as Record<string, unknown>).name
      : "-";
  console.log(
    `Validation summary: company=${String(companyName ?? "-")}, projects=${Array.isArray(config.projects) ? config.projects.length : 0}, agents=${Array.isArray(config.agents) ? config.agents.length : 0}`
  );
  result.warnings.forEach((warning) => console.log(`WARNING: ${warning}`));
  if (result.errors.length > 0) {
    result.errors.forEach((error) => console.log(`ERROR: ${error}`));
    return 1;
  }
  console.log("Config is valid.");
  return 0;
}

function runServer(root: string, configPath: string): number {
  let config;
  try {
    config = loadCompanyConfig(configPath);
  } catch (error) {
    if (error instanceof ConfigError || error instanceof Error) {
      console.error(`Config error: ${error.message}`);
      return 1;
    }
    throw error;
  }
  const result = validateCompanyConfig(config, root);
  result.warnings.forEach((warning) => console.log(`WARNING: ${warning}`));
  if (result.errors.length > 0) {
    result.errors.forEach((error) => console.log(`ERROR: ${error}`));
    return 1;
  }
  startServer(config);
  return 0;
}

function helpText(): string {
  return [
    "Usage:",
    "  comphony [--config company.yaml] init [--force]",
    "  comphony [--config company.yaml] validate",
    "  comphony [--config company.yaml] server start"
  ].join("\n");
}

process.exitCode = main();
