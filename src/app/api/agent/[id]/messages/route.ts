import { NextRequest } from "next/server";

const AGENT_URL = process.env.AGENT_HTTP_URL ?? "http://127.0.0.1:3002";

// In-flight request deduplication
const inFlight = new Set<string>();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // Reject duplicate in-flight requests for the same session
  if (inFlight.has(id)) {
    return Response.json(
      {
        error: {
          message: "Request with the provided ID has already finished loading",
          statusCode: 409
        }
      },
      { status: 409 }
    );
  }
  inFlight.add(id);

  try {
    const res = await fetch(`${AGENT_URL}/sessions/${id}/messages/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: body.content })
    });

    if (!res.ok) {
      const err = await res.json();
      return Response.json(err, { status: res.status });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } finally {
          reader.releaseLock();
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    });
  } finally {
    // Small delay before releasing the lock to catch rapid duplicate calls
    setTimeout(() => inFlight.delete(id), 500);
  }
}
