import type { IncomingMessage, ServerResponse } from "node:http";

type MutationContext<TState> = {
  request: IncomingMessage;
  response: ServerResponse;
  state: TState & { events: unknown[] };
};

type MutationUtilities<TState> = {
  broadcastEvents: (eventClients: Set<ServerResponse>, events: any[]) => void;
  eventClients: Set<ServerResponse>;
  readJsonBody: (request: IncomingMessage) => Promise<Record<string, unknown>>;
  requireActorForMutation: (
    request: IncomingMessage,
    minimumRole: "operator" | "reviewer" | "admin"
  ) => void;
  saveState: () => void;
  writeJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
};

export function createMutationWrapper<TState>(utilities: MutationUtilities<TState>) {
  return function runMutation(
    context: MutationContext<TState>,
    options: { minimumRole?: "operator" | "reviewer" | "admin"; successStatus?: number },
    handler: (payload: Record<string, unknown>) => unknown | Promise<unknown>
  ): void {
    void (async () => {
      try {
        const payload = await utilities.readJsonBody(context.request);
        if (options.minimumRole) {
          utilities.requireActorForMutation(context.request, options.minimumRole);
        }
        const before = context.state.events.length;
        const result = await handler(payload);
        utilities.saveState();
        utilities.broadcastEvents(utilities.eventClients, context.state.events.slice(before));
        utilities.writeJson(context.response, options.successStatus ?? 201, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        utilities.writeJson(context.response, 400, { error: "bad_request", message });
      }
    })();
  };
}
