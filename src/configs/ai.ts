export interface AiConfig {
  apiEndpoint: string;
  model: string;
  systemPrompt: string;
}

const ai: AiConfig = {
  apiEndpoint: "/api/agent",
  model: "deepseek-chat",
  systemPrompt: "You are a helpful AI assistant. Keep responses concise."
};

export default ai;
