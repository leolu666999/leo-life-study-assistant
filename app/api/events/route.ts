import { getRealtimeEmitter, type DataChangeEvent } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  const encoder = new TextEncoder();
  const emitter = getRealtimeEmitter();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let handleChange: ((event: DataChangeEvent) => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(encodeSse(event, data)));
      };
      handleChange = (event: DataChangeEvent) => send("data-change", event);
      heartbeat = setInterval(() => {
        send("heartbeat", { time: new Date().toISOString() });
      }, 25000);

      send("connected", { time: new Date().toISOString() });
      emitter.on("data-change", handleChange);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (handleChange) emitter.off("data-change", handleChange);
    }
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no"
    }
  });
}
