export type Command =
  | { kind: "init"; force: boolean }
  | { kind: "validate" }
  | { kind: "smoke-test"; projectId?: string }
  | { kind: "server-start" }
  | { kind: "project-list" }
  | { kind: "project-overview" }
  | { kind: "project-create"; projectId: string; name: string; purpose?: string; lanes: string[]; repoSlug?: string }
  | { kind: "project-provision"; projectId: string; name: string; purpose?: string; lanes: string[]; repoSlug?: string; repoPath?: string; defaultBranch?: string; bootstrapStrategy?: "clone" | "worktree" }
  | { kind: "workflow-generate"; projectId: string; defaultBranch?: string; bootstrapStrategy?: "clone" | "worktree" }
  | { kind: "agent-list"; projectId?: string }
  | { kind: "agent-catalog" }
  | { kind: "people-list" }
  | { kind: "agent-install"; sourceKind: "local_package" | "registry_package"; ref: string; trustState?: "trusted" | "restricted" | "quarantined" }
  | { kind: "agent-assign-project"; agentId: string; projectId: string }
  | { kind: "task-create"; projectId: string; title: string; description: string; lane: string }
  | { kind: "task-list"; projectId?: string; status?: string }
  | { kind: "task-assign"; taskId: string; agentId: string }
  | { kind: "task-autoassign"; taskId: string }
  | { kind: "task-status"; taskId: string; status: string }
  | { kind: "task-handoff"; taskId: string; lane: string }
  | { kind: "task-work"; taskId: string }
  | { kind: "task-sync"; taskId: string; provider: string }
  | { kind: "task-recommend"; projectId?: string; threadId?: string; taskId?: string; query?: string }
  | { kind: "consult-list"; taskId?: string; threadId?: string; status?: string }
  | { kind: "consult-request"; taskId: string; agentId: string; reason: string; instructions?: string }
  | { kind: "consult-resolve"; consultationId: string; response: string }
  | { kind: "review-list"; taskId?: string; threadId?: string; status?: string }
  | { kind: "review-request"; taskId: string; reviewerId: string; reason: string }
  | { kind: "review-complete"; reviewId: string; outcome: "approved" | "changes_requested"; notes?: string }
  | { kind: "approval-list"; taskId?: string; threadId?: string; status?: string }
  | { kind: "approval-request"; action: string; reason: string; taskId?: string; actorId?: string }
  | { kind: "approval-decide"; approvalId: string; decision: "granted" | "denied"; actorId?: string; notes?: string }
  | { kind: "sync-list"; provider?: string; projectId?: string; status?: string }
  | { kind: "sync-push"; provider: string; reason?: string }
  | { kind: "sync-retry"; provider: string; projectId?: string; taskId?: string; reason?: string }
  | { kind: "session-list"; actorId?: string; activeOnly: boolean }
  | { kind: "session-create"; actorId: string; label?: string }
  | { kind: "session-revoke"; sessionId: string }
  | { kind: "connector-ingest"; provider: "telegram" | "discord" | "slack"; body: string; senderId: string; senderName?: string; threadId?: string; title?: string }
  | { kind: "thread-create"; title: string }
  | { kind: "thread-list" }
  | { kind: "thread-show"; threadId: string }
  | { kind: "thread-continue"; threadId: string }
  | { kind: "thread-ask"; threadId: string; body: string }
  | { kind: "memory-list"; projectId?: string; threadId?: string; taskId?: string; query?: string }
  | { kind: "memory-recommend"; projectId?: string; threadId?: string; taskId?: string; query?: string }
  | { kind: "event-list"; limit?: number }
  | { kind: "message-send"; threadId: string; role: "user" | "agent" | "system"; body: string }
  | { kind: "message-list"; threadId?: string }
  | { kind: "message-promote"; messageId: string; projectId?: string; lane?: string; title?: string }
  | { kind: "intake-create"; title: string; body: string; projectId?: string; lane?: string };

export type ParsedArgs = {
  configPath: string;
  command: Command;
};

type CommandEntry = {
  match: (argv: string[], index: number) => boolean;
  parse: (argv: string[], index: number, configPath: string) => ParsedArgs;
};

export const COMMAND_REGISTRY: CommandEntry[] = [
  {
    match: (argv, index) => argv[index] === "init",
    parse: (argv, _index, configPath) => ({ configPath, command: { kind: "init", force: argv.includes("--force") } })
  },
  {
    match: (argv, index) => argv[index] === "validate",
    parse: (_argv, _index, configPath) => ({ configPath, command: { kind: "validate" } })
  },
  {
    match: (argv, index) => argv[index] === "smoke-test",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 1);
      return { configPath, command: { kind: "smoke-test", projectId: getOptionValue(args, "--project") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "server" && argv[index + 1] === "start",
    parse: (_argv, _index, configPath) => ({ configPath, command: { kind: "server-start" } })
  },
  {
    match: (argv, index) => argv[index] === "project" && argv[index + 1] === "list",
    parse: (_argv, _index, configPath) => ({ configPath, command: { kind: "project-list" } })
  },
  {
    match: (argv, index) => argv[index] === "project" && argv[index + 1] === "overview",
    parse: (_argv, _index, configPath) => ({ configPath, command: { kind: "project-overview" } })
  },
  {
    match: (argv, index) => argv[index] === "project" && argv[index + 1] === "create",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      const rawLanes = requireOptionValue(args, "--lanes");
      return {
        configPath,
        command: {
          kind: "project-create",
          projectId: requireOptionValue(args, "--id"),
          name: requireOptionValue(args, "--name"),
          purpose: getOptionValue(args, "--purpose"),
          lanes: rawLanes.split(",").map((lane) => lane.trim()).filter(Boolean),
          repoSlug: getOptionValue(args, "--repo-slug")
        }
      };
    }
  },
  {
    match: (argv, index) => argv[index] === "project" && argv[index + 1] === "provision",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      const rawLanes = requireOptionValue(args, "--lanes");
      return {
        configPath,
        command: {
          kind: "project-provision",
          projectId: requireOptionValue(args, "--id"),
          name: requireOptionValue(args, "--name"),
          purpose: getOptionValue(args, "--purpose"),
          lanes: rawLanes.split(",").map((lane) => lane.trim()).filter(Boolean),
          repoSlug: getOptionValue(args, "--repo-slug"),
          repoPath: getOptionValue(args, "--repo-path"),
          defaultBranch: getOptionValue(args, "--default-branch"),
          bootstrapStrategy: parseBootstrapStrategy(getOptionValue(args, "--bootstrap-strategy"))
        }
      };
    }
  },
  {
    match: (argv, index) => argv[index] === "workflow" && argv[index + 1] === "generate",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return {
        configPath,
        command: {
          kind: "workflow-generate",
          projectId: requireOptionValue(args, "--project"),
          defaultBranch: getOptionValue(args, "--default-branch"),
          bootstrapStrategy: parseBootstrapStrategy(getOptionValue(args, "--bootstrap-strategy"))
        }
      };
    }
  },
  {
    match: (argv, index) => argv[index] === "agent" && argv[index + 1] === "list",
    parse: (argv, index, configPath) => ({
      configPath,
      command: { kind: "agent-list", projectId: getOptionValue(argv.slice(index + 2), "--project") }
    })
  },
  {
    match: (argv, index) => argv[index] === "agent" && argv[index + 1] === "catalog",
    parse: (_argv, _index, configPath) => ({ configPath, command: { kind: "agent-catalog" } })
  },
  {
    match: (argv, index) => argv[index] === "people" && argv[index + 1] === "list",
    parse: (_argv, _index, configPath) => ({ configPath, command: { kind: "people-list" } })
  },
  {
    match: (argv, index) => argv[index] === "agent" && argv[index + 1] === "install",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      const sourceKind = requireOptionValue(args, "--source-kind");
      if (!["local_package", "registry_package"].includes(sourceKind)) {
        throw new Error("agent install --source-kind must be local_package or registry_package");
      }
      return {
        configPath,
        command: {
          kind: "agent-install",
          sourceKind: sourceKind as "local_package" | "registry_package",
          ref: requireOptionValue(args, "--ref"),
          trustState: getOptionValue(args, "--trust") as "trusted" | "restricted" | "quarantined" | undefined
        }
      };
    }
  },
  {
    match: (argv, index) => argv[index] === "agent" && argv[index + 1] === "assign-project",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return {
        configPath,
        command: {
          kind: "agent-assign-project",
          agentId: requireOptionValue(args, "--agent"),
          projectId: requireOptionValue(args, "--project")
        }
      };
    }
  },
  {
    match: (argv, index) => argv[index] === "task" && argv[index + 1] === "create",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return {
        configPath,
        command: {
          kind: "task-create",
          projectId: requireOptionValue(args, "--project"),
          title: requireOptionValue(args, "--title"),
          description: getOptionValue(args, "--description") ?? "",
          lane: getOptionValue(args, "--lane") ?? "build"
        }
      };
    }
  },
  {
    match: (argv, index) => argv[index] === "task" && argv[index + 1] === "list",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "task-list", projectId: getOptionValue(args, "--project"), status: getOptionValue(args, "--status") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "task" && argv[index + 1] === "assign",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "task-assign", taskId: requireOptionValue(args, "--task"), agentId: requireOptionValue(args, "--agent") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "task" && argv[index + 1] === "autoassign",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "task-autoassign", taskId: requireOptionValue(args, "--task") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "task" && argv[index + 1] === "status",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "task-status", taskId: requireOptionValue(args, "--task"), status: requireOptionValue(args, "--status") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "task" && argv[index + 1] === "handoff",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "task-handoff", taskId: requireOptionValue(args, "--task"), lane: requireOptionValue(args, "--lane") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "task" && argv[index + 1] === "work",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "task-work", taskId: requireOptionValue(args, "--task") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "task" && argv[index + 1] === "sync",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "task-sync", taskId: requireOptionValue(args, "--task"), provider: requireOptionValue(args, "--provider") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "task" && argv[index + 1] === "recommend",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return {
        configPath,
        command: {
          kind: "task-recommend",
          projectId: getOptionValue(args, "--project"),
          threadId: getOptionValue(args, "--thread"),
          taskId: getOptionValue(args, "--task"),
          query: getOptionValue(args, "--query")
        }
      };
    }
  },
  {
    match: (argv, index) => argv[index] === "consult" && argv[index + 1] === "list",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return {
        configPath,
        command: {
          kind: "consult-list",
          taskId: getOptionValue(args, "--task"),
          threadId: getOptionValue(args, "--thread"),
          status: getOptionValue(args, "--status")
        }
      };
    }
  },
  {
    match: (argv, index) => argv[index] === "consult" && argv[index + 1] === "request",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return {
        configPath,
        command: {
          kind: "consult-request",
          taskId: requireOptionValue(args, "--task"),
          agentId: requireOptionValue(args, "--agent"),
          reason: requireOptionValue(args, "--reason"),
          instructions: getOptionValue(args, "--instructions")
        }
      };
    }
  },
  {
    match: (argv, index) => argv[index] === "consult" && argv[index + 1] === "resolve",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "consult-resolve", consultationId: requireOptionValue(args, "--consultation"), response: requireOptionValue(args, "--response") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "review" && argv[index + 1] === "list",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "review-list", taskId: getOptionValue(args, "--task"), threadId: getOptionValue(args, "--thread"), status: getOptionValue(args, "--status") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "review" && argv[index + 1] === "request",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "review-request", taskId: requireOptionValue(args, "--task"), reviewerId: requireOptionValue(args, "--reviewer"), reason: requireOptionValue(args, "--reason") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "review" && argv[index + 1] === "complete",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      const outcome = requireOptionValue(args, "--outcome");
      if (!["approved", "changes_requested"].includes(outcome)) {
        throw new Error("review complete --outcome must be approved or changes_requested");
      }
      return { configPath, command: { kind: "review-complete", reviewId: requireOptionValue(args, "--review"), outcome: outcome as "approved" | "changes_requested", notes: getOptionValue(args, "--notes") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "approval" && argv[index + 1] === "list",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "approval-list", taskId: getOptionValue(args, "--task"), threadId: getOptionValue(args, "--thread"), status: getOptionValue(args, "--status") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "approval" && argv[index + 1] === "request",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "approval-request", action: requireOptionValue(args, "--action"), reason: requireOptionValue(args, "--reason"), taskId: getOptionValue(args, "--task"), actorId: getOptionValue(args, "--actor") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "approval" && argv[index + 1] === "decide",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      const decision = requireOptionValue(args, "--decision");
      if (!["granted", "denied"].includes(decision)) {
        throw new Error("approval decide --decision must be granted or denied");
      }
      return { configPath, command: { kind: "approval-decide", approvalId: requireOptionValue(args, "--approval"), decision: decision as "granted" | "denied", actorId: getOptionValue(args, "--actor"), notes: getOptionValue(args, "--notes") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "sync" && argv[index + 1] === "list",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "sync-list", provider: getOptionValue(args, "--provider"), projectId: getOptionValue(args, "--project"), status: getOptionValue(args, "--status") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "sync" && argv[index + 1] === "push",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "sync-push", provider: requireOptionValue(args, "--provider"), reason: getOptionValue(args, "--reason") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "sync" && argv[index + 1] === "retry",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "sync-retry", provider: requireOptionValue(args, "--provider"), projectId: getOptionValue(args, "--project"), taskId: getOptionValue(args, "--task"), reason: getOptionValue(args, "--reason") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "session" && argv[index + 1] === "list",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "session-list", actorId: getOptionValue(args, "--actor"), activeOnly: args.includes("--active-only") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "session" && argv[index + 1] === "create",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "session-create", actorId: requireOptionValue(args, "--actor"), label: getOptionValue(args, "--label") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "session" && argv[index + 1] === "revoke",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "session-revoke", sessionId: requireOptionValue(args, "--session") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "connector" && argv[index + 1] === "ingest",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      const provider = requireOptionValue(args, "--provider");
      if (!["telegram", "discord", "slack"].includes(provider)) {
        throw new Error("connector ingest --provider must be telegram, discord, or slack");
      }
      return {
        configPath,
        command: {
          kind: "connector-ingest",
          provider: provider as "telegram" | "discord" | "slack",
          body: requireOptionValue(args, "--body"),
          senderId: requireOptionValue(args, "--sender-id"),
          senderName: getOptionValue(args, "--sender-name"),
          threadId: getOptionValue(args, "--thread"),
          title: getOptionValue(args, "--title")
        }
      };
    }
  },
  {
    match: (argv, index) => argv[index] === "thread" && argv[index + 1] === "create",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "thread-create", title: requireOptionValue(args, "--title") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "thread" && argv[index + 1] === "list",
    parse: (_argv, _index, configPath) => ({ configPath, command: { kind: "thread-list" } })
  },
  {
    match: (argv, index) => argv[index] === "thread" && argv[index + 1] === "show",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "thread-show", threadId: requireOptionValue(args, "--thread") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "thread" && argv[index + 1] === "continue",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "thread-continue", threadId: requireOptionValue(args, "--thread") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "thread" && argv[index + 1] === "ask",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "thread-ask", threadId: requireOptionValue(args, "--thread"), body: requireOptionValue(args, "--body") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "memory" && argv[index + 1] === "list",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "memory-list", projectId: getOptionValue(args, "--project"), threadId: getOptionValue(args, "--thread"), taskId: getOptionValue(args, "--task"), query: getOptionValue(args, "--query") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "memory" && argv[index + 1] === "recommend",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "memory-recommend", projectId: getOptionValue(args, "--project"), threadId: getOptionValue(args, "--thread"), taskId: getOptionValue(args, "--task"), query: getOptionValue(args, "--query") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "event" && argv[index + 1] === "list",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      const rawLimit = getOptionValue(args, "--limit");
      return { configPath, command: { kind: "event-list", limit: rawLimit ? Number(rawLimit) : undefined } };
    }
  },
  {
    match: (argv, index) => argv[index] === "message" && argv[index + 1] === "send",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      const roleValue = getOptionValue(args, "--role") ?? "user";
      if (!["user", "agent", "system"].includes(roleValue)) {
        throw new Error("message send --role must be one of: user, agent, system");
      }
      return { configPath, command: { kind: "message-send", threadId: requireOptionValue(args, "--thread"), role: roleValue as "user" | "agent" | "system", body: requireOptionValue(args, "--body") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "message" && argv[index + 1] === "list",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "message-list", threadId: getOptionValue(args, "--thread") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "message" && argv[index + 1] === "promote",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "message-promote", messageId: requireOptionValue(args, "--message"), projectId: getOptionValue(args, "--project"), lane: getOptionValue(args, "--lane"), title: getOptionValue(args, "--title") } };
    }
  },
  {
    match: (argv, index) => argv[index] === "intake" && argv[index + 1] === "create",
    parse: (argv, index, configPath) => {
      const args = argv.slice(index + 2);
      return { configPath, command: { kind: "intake-create", title: requireOptionValue(args, "--title"), body: requireOptionValue(args, "--body"), projectId: getOptionValue(args, "--project"), lane: getOptionValue(args, "--lane") } };
    }
  }
];

export function parseCommand(argv: string[], index: number, configPath: string): ParsedArgs {
  const entry = COMMAND_REGISTRY.find((candidate) => candidate.match(argv, index));
  if (!entry) {
    throw new Error("No command matched");
  }
  return entry.parse(argv, index, configPath);
}

function getOptionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function requireOptionValue(args: string[], name: string): string {
  const value = getOptionValue(args, name);
  if (!value) {
    throw new Error(`Missing value after ${name}`);
  }
  return value;
}

function parseBootstrapStrategy(value?: string): "clone" | "worktree" | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "clone" || value === "worktree") {
    return value;
  }
  throw new Error("--bootstrap-strategy must be clone or worktree");
}
