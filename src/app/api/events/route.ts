import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;
const NUDGE_MS = 45_000;

/**
 * Authenticated SSE stream for lightweight shell / chat refresh nudges.
 * Interval-based only — not a full pub/sub bus.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let nudgeTimer: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (nudgeTimer) clearInterval(nudgeTimer);
        heartbeatTimer = undefined;
        nudgeTimer = undefined;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const send = (event: string, data: unknown) => {
        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const nudge = () => {
        send("shell-alerts", { type: "shell-alerts" });
        send("chat", { type: "chat" });
      };

      nudge();

      heartbeatTimer = setInterval(() => {
        enqueue(": ping\n\n");
      }, HEARTBEAT_MS);

      nudgeTimer = setInterval(nudge, NUDGE_MS);

      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (nudgeTimer) clearInterval(nudgeTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
