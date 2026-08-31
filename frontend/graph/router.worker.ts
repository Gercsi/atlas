import { routeGraph } from "./router";
import type { RoutingInput } from "./model";
self.onmessage = (
  event: MessageEvent<{ version: number; input: RoutingInput }>,
) => {
  try {
    self.postMessage({
      version: event.data.version,
      result: routeGraph(event.data.input, (done, total) =>
        self.postMessage({
          version: event.data.version,
          progress: { done, total },
        }),
      ),
    });
  } catch (error) {
    self.postMessage({
      version: event.data.version,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
