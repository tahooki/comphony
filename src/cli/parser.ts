import { parseCommand, type ParsedArgs } from "./command-registry.js";

export function parseArgs(argv: string[], helpText: () => string): ParsedArgs {
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

  try {
    return parseCommand(argv, index, configPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "No command matched") {
      throw new Error(helpText());
    }
    throw error;
  }
}
