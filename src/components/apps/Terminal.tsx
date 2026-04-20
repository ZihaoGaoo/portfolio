import React, { useEffect, useRef, useState, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Session {
  sessionId: string;
  environmentId: string;
  currentAgent: string;
  messageCount: number;
  totalTokens: number;
}

const renderContent = (content: string): React.ReactNode => {
  if (!content) return null;
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  lines.forEach((line, i) => {
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLines = [];
      } else {
        elements.push(
          <pre
            key={"code-" + i}
            style={{
              background: "rgba(0,0,0,0.5)",
              borderRadius: "6px",
              padding: "10px 14px",
              margin: "6px 0",
              overflowX: "auto",
              fontSize: "12px",
              lineHeight: "1.6",
              border: "0.5px solid rgba(255,255,255,0.06)",
              color: "#e2e8f0",
              fontFamily: "ui-monospace,'SF Mono',Menlo,monospace"
            }}
          >
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        inCodeBlock = false;
        codeLines = [];
      }
    } else if (inCodeBlock) {
      codeLines.push(line);
    } else {
      const boldRe = /\*\*(.+?)\*\*/g;
      const codeRe = /`(.+?)`/g;
      const linkRe = /\[(.+?)\]\((.+?)\)/g;
      const formatted = line
        .replace(boldRe, "<strong>$1</strong>")
        .replace(
          codeRe,
          '<code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;">$1</code>'
        )
        .replace(
          linkRe,
          '<a style="color:#60a5fa;text-decoration:underline" href="$2" target="_blank">$1</a>'
        );
      elements.push(
        <div
          key={"line-" + i}
          style={{ lineHeight: "1.65", fontSize: "13px", color: "#d1d5db" }}
          dangerouslySetInnerHTML={{ __html: formatted || "&nbsp;" }}
        />
      );
    }
  });
  return elements;
};

export default function Terminal() {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyIndex = useRef(-1);
  const history = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Raw accumulator — updated immediately on each SSE delta
  const rawContentRef = useRef("");
  // Display content — synced to React state at a steady cadence
  const displayContentRef = useRef("");
  const displayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // In-flight flag to avoid duplicate setMessages during the same flush
  const flushingRef = useRef(false);

  useEffect(() => {
    fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    })
      .then((r) => r.json())
      .then((data: Session) => {
        setSession(data);
      })
      .catch(() => setError("Failed to connect to agent service"));
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);
  const focusInput = () => {
    inputRef.current?.focus();
  };
  useEffect(() => {
    focusInput();
  }, []);

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsLoading(false);
    // Flush any remaining raw content before stopping
    displayContentRef.current = rawContentRef.current;
    setMessages((prev) => {
      const msgs = [...prev];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
        msgs[msgs.length - 1] = { role: "assistant", content: rawContentRef.current };
      }
      return msgs;
    });
  };

  // Sync display state from raw accumulator at ~30fps (every 33ms)
  const startFlush = () => {
    if (displayTimerRef.current) return;
    displayTimerRef.current = setInterval(() => {
      if (flushingRef.current || rawContentRef.current === displayContentRef.current)
        return;
      flushingRef.current = true;
      const toShow = rawContentRef.current;
      displayContentRef.current = toShow;
      setMessages((prev) => {
        const msgs = [...prev];
        if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
          msgs[msgs.length - 1] = { role: "assistant", content: toShow };
        }
        return msgs;
      });
      flushingRef.current = false;
    }, 33);
  };

  const stopFlush = () => {
    if (displayTimerRef.current) {
      clearInterval(displayTimerRef.current);
      displayTimerRef.current = null;
    }
    // Final flush — show everything
    displayContentRef.current = rawContentRef.current;
    setMessages((prev) => {
      const msgs = [...prev];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
        msgs[msgs.length - 1] = { role: "assistant", content: rawContentRef.current };
      }
      return msgs;
    });
  };

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !session || isLoading) return;
    const userMsg = inputText.trim();
    history.current.push(userMsg);
    historyIndex.current = -1;

    const newMessages = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(newMessages);
    setInputText("");
    setIsLoading(true);
    setError(null);

    // Reset accumulators
    rawContentRef.current = "";
    displayContentRef.current = "";
    flushingRef.current = false;
    startFlush();

    // Placeholder
    setMessages((prev) => [...prev, { role: "assistant" as const, content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/agent/" + session.sessionId + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg }),
        signal: controller.signal
      });

      if (!res.ok) throw new Error("Request failed: " + res.status);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let rawBuf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        rawBuf += decoder.decode(value, { stream: true });
        const lines = rawBuf.split("\n");
        rawBuf = lines.pop() ?? "";

        let eventType = "";
        let eventData = "";

        for (const rawLine of lines) {
          const line = rawLine.trimEnd();
          if (line === "") {
            if (eventType === "assistant_delta" && eventData) {
              try {
                const parsed = JSON.parse(eventData);
                if (parsed.delta) rawContentRef.current += parsed.delta;
              } catch {}
              eventType = "";
              eventData = "";
            }
          } else if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            eventData = line.slice(5);
          }
        }
      }

      stopFlush();
    } catch (err) {
      stopFlush();
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [inputText, session, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) {
      sendMessage();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex.current < history.current.length - 1) {
        historyIndex.current++;
        setInputText(history.current[history.current.length - 1 - historyIndex.current]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex.current > 0) {
        historyIndex.current--;
        setInputText(history.current[history.current.length - 1 - historyIndex.current]);
      } else if (historyIndex.current === 0) {
        historyIndex.current = -1;
        setInputText("");
      }
    }
  };

  return (
    <div
      className="relative h-full flex flex-col"
      style={{
        background: "#1e1e1e",
        fontFamily: "ui-monospace,'SF Mono',Menlo,monospace"
      }}
      onClick={focusInput}
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div
            style={{
              color: "#6b7280",
              fontSize: "11px",
              fontFamily: "ui-monospace,monospace"
            }}
          >
            {"┌──────────────────────────────────────────────────┐"}
            <br />
            {"│  AI Terminal · mini-agent · deepseek-chat     │"}
            <br />
            {"│  Enter to send · ↑↓ history                   │"}
            <br />
            {"└──────────────────────────────────────────────────┘"}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "user" ? (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <span style={{ color: "#60a5fa", fontSize: "13px", flexShrink: 0 }}>
                  ❯
                </span>
                <span style={{ color: "#93c5fd", fontSize: "13px" }}>{msg.content}</span>
              </div>
            ) : (
              <div
                style={{
                  paddingLeft: "20px",
                  borderLeft: "2px solid rgba(74,222,128,0.15)",
                  marginLeft: "6px",
                  padding: "4px 0 4px 14px"
                }}
              >
                {renderContent(msg.content)}
                {i === messages.length - 1 && isLoading && (
                  <span style={{ color: "#6b7280", animation: "blink 1.2s infinite" }}>
                    ▋
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && messages.length === 0 && (
          <div style={{ color: "#6b7280", fontSize: "12px", paddingLeft: "20px" }}>
            <span style={{ display: "inline-block", animation: "blink 1.2s infinite" }}>
              ◦
            </span>
            {" thinking..."}
          </div>
        )}

        {error && (
          <div
            style={{
              color: "#f87171",
              fontSize: "12px",
              padding: "8px 12px",
              background: "rgba(239,68,68,0.08)",
              borderRadius: "6px",
              border: "0.5px solid rgba(239,68,68,0.2)"
            }}
          >
            Error: {error}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 14px",
          borderTop: "0.5px solid rgba(255,255,255,0.06)",
          background: "#161616"
        }}
      >
        <span style={{ color: "#fbbf24", fontSize: "12px" }}>zihao</span>
        <span style={{ color: "#6b7280", fontSize: "12px" }}>@</span>
        <span style={{ color: "#34d399", fontSize: "12px" }}>macbook-pro</span>
        <span style={{ color: "#6b7280", fontSize: "12px" }}>·</span>
        <span style={{ color: "#60a5fa", fontSize: "12px" }}>~</span>
        <span style={{ color: "#f87171", fontSize: "13px" }}>›</span>
        <input
          ref={inputRef}
          type="text"
          style={{
            flex: 1,
            background: "transparent",
            color: "white",
            fontSize: "13px",
            outline: "none",
            fontFamily: "inherit",
            caretColor: "#60a5fa"
          }}
          placeholder={isLoading ? "waiting..." : "ask something..."}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          autoFocus
        />
        {isLoading && (
          <button
            onClick={stopGeneration}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "0.5px solid rgba(255,255,255,0.1)",
              borderRadius: "5px",
              color: "rgba(255,255,255,0.5)",
              fontSize: "11px",
              padding: "2px 8px",
              cursor: "pointer"
            }}
          >
            ⏹ stop
          </button>
        )}
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }`}</style>
    </div>
  );
}
