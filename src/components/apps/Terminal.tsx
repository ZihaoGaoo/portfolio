import React, { type JSX } from "react";
import { terminal } from "~/configs";
import {
  streamAgentMessage,
  type AgentAssistantMessageEvent,
  type AgentResultEvent,
  type AgentStreamEvent
} from "~/features/agent/http";
import type { TerminalData } from "~/types";

interface TerminalState {
  content: JSX.Element[];
}

interface ParsedInput {
  args?: string;
  cmd: string;
}

interface TerminalCommandContext {
  args?: string;
  id: number;
  rawInput: string;
}

type TerminalCommand = (context: TerminalCommandContext) => Promise<void> | void;

const TERMINAL_SUGGESTIONS = [
  "ask 你主要做什么方向？",
  "ask 你最近在做什么项目？",
  "ls",
  "cd about",
  "chat"
] as const;

const createSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sanitizeText = (text: string) => {
  return text.replace(/\s+/g, " ").trim();
};

const extractNodeText = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((item) => extractNodeText(item)).join("");
  }

  if (React.isValidElement<{ children?: React.ReactNode; href?: string }>(node)) {
    const childText = extractNodeText(node.props.children);
    const href = typeof node.props.href === "string" ? node.props.href : "";

    if (href && !childText.includes(href)) {
      return `${childText} (${href})`;
    }

    return childText;
  }

  return "";
};

const serializeTerminalEntries = (
  entries: TerminalData[],
  path: string[] = []
): string[] => {
  return entries.flatMap((item) => {
    const nextPath = [...path, item.title];
    const joinedPath = nextPath.join("/");

    if (item.type === "folder") {
      return [
        `[dir] ${joinedPath}`,
        ...serializeTerminalEntries(item.children ?? [], nextPath)
      ];
    }

    const content = item.content ? sanitizeText(extractNodeText(item.content)) : "";
    return [`[file] ${joinedPath}${content ? `: ${content}` : ""}`];
  });
};

const PORTFOLIO_CONTEXT_LINES = serializeTerminalEntries(terminal);

export default class Terminal extends React.Component<{}, TerminalState> {
  private history = [] as string[];
  private curHistory = 0;
  private curInputTimes = 0;
  private curDirPath = [] as any;
  private curChildren = terminal as any;
  private chatMode = false;
  private chatSessionId: string | null = null;
  private activeAbortController: AbortController | null = null;
  private commands: Record<string, TerminalCommand>;

  constructor(props: {}) {
    super(props);
    this.state = {
      content: []
    };
    this.commands = {
      cd: this.cd,
      ls: this.ls,
      cat: this.cat,
      ask: this.ask,
      chat: this.chat,
      exit: this.exitChat,
      clear: this.clear,
      help: this.help
    };
  }

  componentDidMount() {
    this.generateInputRow(this.curInputTimes);
    window.addEventListener("keydown", this.handleWindowKeyDown);
  }

  componentWillUnmount() {
    window.removeEventListener("keydown", this.handleWindowKeyDown);
    this.activeAbortController?.abort();
  }

  reset = () => {
    this.setState({
      content: []
    });
  };

  handleWindowKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "c" && this.activeAbortController) {
      event.preventDefault();
      this.activeAbortController.abort();
    }
  };

  addRow = (row: JSX.Element) => {
    this.setState((previousState) => {
      if (previousState.content.some((item) => item.key === row.key)) {
        return previousState;
      }

      return {
        content: [...previousState.content, row]
      };
    });
  };

  upsertRow = (row: JSX.Element) => {
    this.setState((previousState) => {
      const content = [...previousState.content];
      const index = content.findIndex((item) => item.key === row.key);

      if (index === -1) {
        content.push(row);
      } else {
        content[index] = row;
      }

      return {
        content
      };
    });
  };

  getCurDirName = () => {
    if (this.curDirPath.length === 0) return "~";
    else return this.curDirPath[this.curDirPath.length - 1];
  };

  getCurChildren = () => {
    let children = terminal as any;
    for (const name of this.curDirPath) {
      children = children.find((item: TerminalData) => {
        return item.title === name && item.type === "folder";
      }).children;
    }
    return children;
  };

  getCurPath = () => {
    return this.curDirPath.length === 0 ? "~" : `~/${this.curDirPath.join("/")}`;
  };

  getPromptLabel = () => {
    if (this.chatMode) {
      return {
        prefix: "ai@portfolio",
        suffix: "chat"
      };
    }

    return {
      prefix: "gao@macbook-pro",
      suffix: this.getCurDirName()
    };
  };

  parseInput = (text: string): ParsedInput => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return {
        cmd: ""
      };
    }

    const [cmd, ...rest] = trimmedText.split(" ");
    const args = rest.join(" ").trim();

    return {
      cmd,
      args: args || undefined
    };
  };

  buildAgentPrompt = (userMessage: string) => {
    return [
      "You are the assistant inside a simulated macOS terminal on a personal portfolio website.",
      "Answer in concise plain text.",
      "Ground your answer in the portfolio context below and do not invent experience that is not listed.",
      "If the answer is not fully available, say so briefly and suggest a relevant terminal command when helpful.",
      `Current working directory: ${this.getCurPath()}`,
      "Portfolio context:",
      ...PORTFOLIO_CONTEXT_LINES,
      "",
      "User request:",
      userMessage
    ].join("\n");
  };

  renderPlainTextRow = (label: string, text: string, streaming = false) => {
    return (
      <div className="whitespace-pre-wrap break-words">
        <span className="text-green-300">{label}&gt; </span>
        <span>{text}</span>
        {streaming && <span className="animate-pulse">▋</span>}
      </div>
    );
  };

  renderSystemTextRow = (text: string, colorClass = "text-gray-300") => {
    return <div className={`whitespace-pre-wrap break-words ${colorClass}`}>{text}</div>;
  };

  getChatSessionId = () => {
    if (!this.chatSessionId) {
      this.chatSessionId = createSessionId();
    }

    return this.chatSessionId;
  };

  runAgentTurn = async ({
    id,
    question,
    sessionId
  }: {
    id: number;
    question: string;
    sessionId: string;
  }) => {
    const assistantRowKey = `terminal-result-row-${id}-assistant`;
    const controller = new AbortController();
    let assistantText = "";
    let streamedAssistant = false;
    let metaRowCount = 0;

    this.activeAbortController = controller;
    this.upsertRow(
      <div key={assistantRowKey} className="break-all">
        {this.renderPlainTextRow("assistant", "", true)}
      </div>
    );

    try {
      await streamAgentMessage({
        sessionId,
        content: this.buildAgentPrompt(question),
        signal: controller.signal,
        onEvent: (event: AgentStreamEvent) => {
          if (event.type === "assistant_delta") {
            assistantText += event.delta;
            streamedAssistant = true;
            this.upsertRow(
              <div key={assistantRowKey} className="break-all">
                {this.renderPlainTextRow("assistant", assistantText, true)}
              </div>
            );
            return;
          }

          if (event.type === "assistant_message") {
            const assistantEvent = event as AgentAssistantMessageEvent;
            if (!streamedAssistant) {
              assistantText = assistantEvent.content;
              this.upsertRow(
                <div key={assistantRowKey} className="break-all">
                  {this.renderPlainTextRow("assistant", assistantText, true)}
                </div>
              );
            }
            return;
          }

          if (event.type === "step_started") {
            metaRowCount += 1;
            this.addRow(
              <div
                key={`terminal-result-row-${id}-meta-${metaRowCount}`}
                className="break-all"
              >
                {this.renderSystemTextRow(
                  `[step ${event.step}/${event.maxSteps}]`,
                  "text-gray-400"
                )}
              </div>
            );
            return;
          }

          if (event.type === "tool_call") {
            metaRowCount += 1;
            this.addRow(
              <div
                key={`terminal-result-row-${id}-meta-${metaRowCount}`}
                className="break-all"
              >
                {this.renderSystemTextRow(`tool> ${event.toolName}`, "text-cyan-300")}
              </div>
            );
            return;
          }

          if (event.type === "tool_result") {
            metaRowCount += 1;
            const resultText = event.success
              ? `tool-result> ${event.content}`
              : `tool-error> ${event.error ?? "Unknown error"}`;
            this.addRow(
              <div
                key={`terminal-result-row-${id}-meta-${metaRowCount}`}
                className="break-all"
              >
                {this.renderSystemTextRow(
                  resultText,
                  event.success ? "text-gray-300" : "text-red-300"
                )}
              </div>
            );
            return;
          }

          if (event.type === "result") {
            const resultEvent = event as AgentResultEvent;
            if (!assistantText) {
              assistantText = resultEvent.assistantMessage;
            }
            return;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      });

      const finalText = assistantText || "No response received.";
      this.upsertRow(
        <div key={assistantRowKey} className="break-all">
          {this.renderPlainTextRow("assistant", finalText)}
        </div>
      );
    } catch (error) {
      if (controller.signal.aborted) {
        this.upsertRow(
          <div key={assistantRowKey} className="break-all">
            {this.renderSystemTextRow("^C", "text-yellow-200")}
          </div>
        );
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.upsertRow(
        <div key={assistantRowKey} className="break-all">
          {this.renderSystemTextRow(`agent error: ${message}`, "text-red-300")}
        </div>
      );
    } finally {
      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
      }
    }
  };

  // move into a specified folder
  cd = ({ args, id }: TerminalCommandContext) => {
    if (args === undefined || args === "~") {
      // move to root
      this.curDirPath = [];
      this.curChildren = terminal;
    } else if (args === ".") {
      // stay in the current folder
      return;
    } else if (args === "..") {
      // move to parent folder
      if (this.curDirPath.length === 0) return;
      this.curDirPath.pop();
      this.curChildren = this.getCurChildren();
    } else {
      // move to certain child folder
      const target = this.curChildren.find((item: TerminalData) => {
        return item.title === args && item.type === "folder";
      });
      if (target === undefined) {
        this.generateResultRow(
          id,
          <span>{`cd: no such file or directory: ${args}`}</span>
        );
      } else {
        this.curChildren = target.children;
        this.curDirPath.push(target.title);
      }
    }
  };

  // display content of a specified folder
  ls = ({ id }: TerminalCommandContext) => {
    const result = [];
    for (const item of this.curChildren) {
      result.push(
        <span
          key={`terminal-result-ls-${id}-${item.id}`}
          className={`${item.type === "file" ? "text-white" : "text-purple-300"}`}
        >
          {item.title}
        </span>
      );
    }
    this.generateResultRow(id, <div className="grid grid-cols-4 w-full">{result}</div>);
  };

  // display content of a specified file
  cat = ({ args, id }: TerminalCommandContext) => {
    const file = this.curChildren.find((item: TerminalData) => {
      return item.title === args && item.type === "file";
    });

    if (file === undefined) {
      this.generateResultRow(
        id,
        <span>{`cat: ${args}: No such file or directory`}</span>
      );
    } else {
      this.generateResultRow(id, <span>{file.content}</span>);
    }
  };

  // clear terminal
  clear = () => {
    this.reset();
  };

  ask = async ({ args, id, rawInput }: TerminalCommandContext) => {
    const question = rawInput.replace(/^ask\s*/, "").trim() || args;

    if (!question) {
      this.generateResultRow(
        id,
        this.renderSystemTextRow("usage: ask <question>", "text-yellow-200")
      );
      return;
    }

    await this.runAgentTurn({
      id,
      question,
      sessionId: createSessionId()
    });
  };

  chat = ({ id }: TerminalCommandContext) => {
    this.chatMode = true;
    this.getChatSessionId();
    this.generateResultRow(
      id,
      this.renderSystemTextRow(
        "Chat mode enabled. Type anything to talk with the assistant, or `exit` to leave chat mode.",
        "text-cyan-300"
      )
    );
  };

  exitChat = ({ id }: TerminalCommandContext) => {
    if (!this.chatMode) {
      this.generateResultRow(
        id,
        this.renderSystemTextRow("exit: chat mode is not active.", "text-yellow-200")
      );
      return;
    }

    this.chatMode = false;
    this.chatSessionId = null;
    this.generateResultRow(
      id,
      this.renderSystemTextRow("Chat mode closed.", "text-cyan-300")
    );
  };

  help = ({ id }: TerminalCommandContext) => {
    const help = (
      <ul className="list-disc ml-6 pb-1.5">
        <li>
          <span className="text-red-400">cat {"<file>"}</span> - See the content of{" "}
          {"<file>"}
        </li>
        <li>
          <span className="text-red-400">cd {"<dir>"}</span> - Move into
          {" <dir>"}, "cd .." to move to the parent directory, "cd" or "cd ~" to return to
          root
        </li>
        <li>
          <span className="text-red-400">ls</span> - See files and directories in the
          current directory
        </li>
        <li>
          <span className="text-red-400">clear</span> - Clear the screen
        </li>
        <li>
          <span className="text-red-400">help</span> - Display this help menu
        </li>
        <li>
          <span className="text-red-400">ask {"<question>"}</span> - Ask the AI assistant
          a single question about this portfolio
        </li>
        <li>
          <span className="text-red-400">chat</span> - Enter continuous chat mode with the
          AI assistant
        </li>
        <li>
          <span className="text-red-400">exit</span> - Leave chat mode
        </li>
        <li>
          press <span className="text-red-400">up arrow / down arrow</span> - Select
          history commands
        </li>
        <li>
          press <span className="text-red-400">tab</span> - Auto complete
        </li>
        <li>
          press <span className="text-red-400">ctrl + c</span> - Cancel an in-flight AI
          response
        </li>
      </ul>
    );
    this.generateResultRow(id, help);
  };

  autoComplete = (text: string) => {
    if (text === "") return text;

    const { cmd, args } = this.parseInput(text);

    let result = text;

    if (args === undefined) {
      const guess = Object.keys(this.commands).find((item) => {
        return item.substring(0, cmd.length) === cmd;
      });
      if (guess !== undefined) result = guess;
    } else if (cmd === "cd" || cmd === "cat") {
      const type = cmd === "cd" ? "folder" : "file";
      const guess = this.curChildren.find((item: TerminalData) => {
        return item.type === type && item.title.substring(0, args.length) === args;
      });
      if (guess !== undefined) result = cmd + " " + guess.title;
    }
    return result;
  };

  keyPress = async (e: React.KeyboardEvent) => {
    const keyCode = e.key;
    const inputElement = document.querySelector(
      `#terminal-input-${this.curInputTimes}`
    ) as HTMLInputElement;
    const inputText = inputElement.value.trim();
    const { cmd, args } = this.parseInput(inputText);

    if (keyCode === "Enter") {
      if (!inputText) {
        return;
      }

      // ----------- run command -----------
      this.history.push(inputText);
      const currentInputId = this.curInputTimes;

      // we can't edit the past input
      inputElement.setAttribute("readonly", "true");

      try {
        if (cmd && Object.keys(this.commands).includes(cmd)) {
          await this.commands[cmd]({
            id: currentInputId,
            args,
            rawInput: inputText
          });
        } else if (this.chatMode) {
          await this.runAgentTurn({
            id: currentInputId,
            question: inputText,
            sessionId: this.getChatSessionId()
          });
        } else {
          this.generateResultRow(
            currentInputId,
            <span>{`zsh: command not found: ${cmd}. Try: ask "${inputText}"`}</span>
          );
        }
      } finally {
        // point to the last history command
        this.curHistory = this.history.length;

        // generate new input row
        this.curInputTimes += 1;
        this.generateInputRow(this.curInputTimes);
      }
    } else if (keyCode === "ArrowUp") {
      // ----------- previous history command -----------
      if (this.history.length > 0) {
        if (this.curHistory > 0) this.curHistory--;
        const historyCommand = this.history[this.curHistory];
        inputElement.value = historyCommand;
      }
    } else if (keyCode === "ArrowDown") {
      // ----------- next history command -----------
      if (this.history.length > 0) {
        if (this.curHistory < this.history.length) this.curHistory++;
        if (this.curHistory === this.history.length) inputElement.value = "";
        else {
          const historyCommand = this.history[this.curHistory];
          inputElement.value = historyCommand;
        }
      }
    } else if (keyCode === "Tab") {
      // ----------- auto complete -----------
      inputElement.value = this.autoComplete(inputText);
      // prevent tab outside the terminal
      e.preventDefault();
    }
  };

  focusOnInput = (id: number) => {
    const input = document.querySelector(
      `#terminal-input-${id}`
    ) as HTMLInputElement | null;
    input?.focus();
  };

  insertCommand = (command: string) => {
    const input = document.querySelector(
      `#terminal-input-${this.curInputTimes}`
    ) as HTMLInputElement | null;

    if (!input || input.hasAttribute("readonly")) {
      return;
    }

    input.value = command;
    input.focus();
    input.setSelectionRange(command.length, command.length);
  };

  renderWelcome = () => {
    return (
      <div className="space-y-2 border-b border-white/8 pb-3">
        <div>
          <span className="text-green-300">ヽ(ˋ▽ˊ)ノ</span> Ask about research, projects,
          or contact info right from the terminal.
        </div>
        <div className="text-gray-300">
          Type a command manually, or click an example below to insert it into the prompt.
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {TERMINAL_SUGGESTIONS.map((command) => (
            <button
              key={command}
              type="button"
              className="rounded border border-white/10 bg-white/5 px-2 py-1 text-left transition-colors hover:bg-white/10"
              onClick={(event) => {
                event.stopPropagation();
                this.insertCommand(command);
              }}
            >
              <span className="text-red-300">$</span>{" "}
              <span className="text-yellow-100">{command}</span>
            </button>
          ))}
        </div>
        <div className="text-gray-400">Type `help` to see the full command list.</div>
      </div>
    );
  };

  generateInputRow = (id: number) => {
    const prompt = this.getPromptLabel();
    const newRow = (
      <div key={`terminal-input-row-${id}`} className="flex">
        <div className="w-max hstack space-x-1.5">
          <span className="text-yellow-200">
            {prompt.prefix} <span className="text-green-300">{prompt.suffix}</span>
          </span>
          <span className="text-red-400">{">"}</span>
        </div>
        <input
          id={`terminal-input-${id}`}
          className="flex-1 px-1 text-white outline-none bg-transparent"
          onKeyDown={this.keyPress}
          autoFocus={true}
        />
      </div>
    );
    this.addRow(newRow);
  };

  generateResultRow = (id: number, result: JSX.Element, key?: string) => {
    const newRow = (
      <div key={key ?? `terminal-result-row-${id}`} className="break-all">
        {result}
      </div>
    );
    this.addRow(newRow);
  };

  render() {
    return (
      <div
        className="terminal font-terminal font-normal relative h-full overflow-y-scroll bg-gray-800/90 text-sm text-white"
        onClick={() => this.focusOnInput(this.curInputTimes)}
      >
        <div className="px-1.5 py-2">{this.renderWelcome()}</div>
        <div id="terminal-content" className="px-1.5 pb-2">
          {this.state.content}
        </div>
      </div>
    );
  }
}
