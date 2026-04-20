const AGENT_API_BASE_URL = (process.env.NEXT_PUBLIC_AGENT_API_BASE_URL ?? "").trim();
const AGENT_ENVIRONMENT_ID = (process.env.NEXT_PUBLIC_AGENT_ENVIRONMENT_ID ?? "").trim();

export interface AgentStepStartedEvent {
  type: "step_started";
  step: number;
  maxSteps: number;
}

export interface AgentAssistantDeltaEvent {
  type: "assistant_delta";
  delta: string;
}

export interface AgentAssistantMessageEvent {
  type: "assistant_message";
  content: string;
  toolCalls?: Array<unknown>;
}

export interface AgentToolCallEvent {
  type: "tool_call";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface AgentToolResultEvent {
  type: "tool_result";
  toolCallId: string;
  toolName: string;
  success: boolean;
  content: string;
  error?: string;
}

export interface AgentRunCompletedEvent {
  type: "run_completed";
  content: string;
  totalTokens: number;
  exhausted: boolean;
}

export interface AgentResultEvent {
  type: "result";
  sessionId: string;
  runId: string;
  environmentId: string;
  assistantMessage: string;
  messageCount: number;
  totalTokens: number;
}

export interface AgentErrorEvent {
  type: "error";
  message: string;
}

export type AgentStreamEvent =
  | AgentStepStartedEvent
  | AgentAssistantDeltaEvent
  | AgentAssistantMessageEvent
  | AgentToolCallEvent
  | AgentToolResultEvent
  | AgentRunCompletedEvent
  | AgentResultEvent
  | AgentErrorEvent;

interface StreamAgentMessageInput {
  content: string;
  onEvent: (event: AgentStreamEvent) => void;
  sessionId: string;
  signal?: AbortSignal;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function getAgentConfig() {
  if (!AGENT_API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_AGENT_API_BASE_URL.");
  }

  if (!AGENT_ENVIRONMENT_ID) {
    throw new Error("Missing NEXT_PUBLIC_AGENT_ENVIRONMENT_ID.");
  }

  return {
    apiBaseUrl: normalizeBaseUrl(AGENT_API_BASE_URL),
    environmentId: AGENT_ENVIRONMENT_ID
  };
}

function parseSseEvent(rawEvent: string): AgentStreamEvent | null {
  let eventType = "";
  const dataLines: string[] = [];

  for (const line of rawEvent.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      eventType = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  if (!eventType || dataLines.length === 0) {
    return null;
  }

  const payload = JSON.parse(dataLines.join("\n")) as Omit<AgentStreamEvent, "type">;
  return {
    type: eventType as AgentStreamEvent["type"],
    ...payload
  } as AgentStreamEvent;
}

function getEventBoundary(buffer: string): {
  index: number;
  length: number;
} | null {
  const crlfBoundary = buffer.indexOf("\r\n\r\n");
  const lfBoundary = buffer.indexOf("\n\n");

  if (crlfBoundary === -1 && lfBoundary === -1) {
    return null;
  }

  if (crlfBoundary === -1) {
    return {
      index: lfBoundary,
      length: 2
    };
  }

  if (lfBoundary === -1) {
    return {
      index: crlfBoundary,
      length: 4
    };
  }

  return crlfBoundary < lfBoundary
    ? {
        index: crlfBoundary,
        length: 4
      }
    : {
        index: lfBoundary,
        length: 2
      };
}

async function consumeSseStream(
  response: Response,
  onEvent: (event: AgentStreamEvent) => void
): Promise<void> {
  if (!response.body) {
    throw new Error("The agent response body is empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let eventBoundary = getEventBoundary(buffer);
    while (eventBoundary) {
      const rawEvent = buffer.slice(0, eventBoundary.index).trim();
      buffer = buffer.slice(eventBoundary.index + eventBoundary.length);

      const event = parseSseEvent(rawEvent);
      if (event) {
        onEvent(event);
      }

      eventBoundary = getEventBoundary(buffer);
    }

    if (done) {
      break;
    }
  }

  const trailingEvent = parseSseEvent(buffer.trim());
  if (trailingEvent) {
    onEvent(trailingEvent);
  }
}

export async function streamAgentMessage(input: StreamAgentMessageInput): Promise<void> {
  const { apiBaseUrl, environmentId } = getAgentConfig();
  const response = await fetch(
    `${apiBaseUrl}/sessions/${encodeURIComponent(input.sessionId)}/messages/stream`,
    {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: input.content,
        environmentId
      }),
      signal: input.signal
    }
  );

  if (!response.ok) {
    let message = `Agent request failed with status ${response.status}.`;

    try {
      const data = (await response.json()) as {
        error?: {
          message?: string;
        };
      };
      if (data.error?.message) {
        message = data.error.message;
      }
    } catch {
      // Ignore JSON parsing failures and use the fallback message above.
    }

    throw new Error(message);
  }

  await consumeSseStream(response, input.onEvent);
}
