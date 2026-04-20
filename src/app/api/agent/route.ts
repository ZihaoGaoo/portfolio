import { NextRequest } from "next/server";

const AGENT_URL = process.env.AGENT_HTTP_URL ?? "http://127.0.0.1:3002";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await fetch(`${AGENT_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ environmentId: "local-dev", ...body })
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Missing session id" }, { status: 400 });
  const res = await fetch(`${AGENT_URL}/sessions/${id}`);
  return Response.json(await res.json());
}
