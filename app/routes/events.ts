import type { Route } from "./+types/events";
import { getCurrentUser } from "../auth.server";
import { subscribeToPresence, subscribeToUser } from "../realtime.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const requestedPresenceUserId = Number(url.searchParams.get("presenceUserId"));
  const presenceUserId = Number.isInteger(requestedPresenceUserId) && requestedPresenceUserId > 0 ? requestedPresenceUserId : undefined;
  const user = await getCurrentUser(request);
  if (!user && !presenceUserId) return new Response("Unauthorized", { status: 401 });
  const requestedPeerId = Number(url.searchParams.get("peerId"));
  const peerId = Number.isInteger(requestedPeerId) && requestedPeerId > 0 ? requestedPeerId : undefined;

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      send({ type: "connected" });
      cleanup = presenceUserId
        ? subscribeToPresence(presenceUserId, send)
        : subscribeToUser(user!.id, send, peerId);
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 20_000);
      const close = () => {
        clearInterval(heartbeat);
        cleanup();
        try { controller.close(); } catch {}
      };
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
