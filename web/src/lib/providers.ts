export interface Provider {
  id: string;
  name: string;
  logo: string;
  models: string[];
  url: string;
  color: string;
}

export const providers: Provider[] = [
  {
    id: "openai",
    name: "OpenAI",
    logo: "/providers/openai.svg",
    models: ["GPT-4o", "GPT-4o-mini", "o1", "o1-mini", "o3-mini"],
    url: "https://openai.com",
    color: "#10a37f",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    logo: "/providers/anthropic.svg",
    models: ["Claude 4 Opus", "Claude 4 Sonnet", "Claude 3.5 Haiku"],
    url: "https://anthropic.com",
    color: "#d4a574",
  },
  {
    id: "google",
    name: "Google",
    logo: "/providers/google.svg",
    models: ["Gemini 2.5 Pro", "Gemini 2.0 Flash", "Gemini 2.0 Flash-Lite"],
    url: "https://deepmind.google",
    color: "#4285f4",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    logo: "/providers/deepseek.svg",
    models: ["DeepSeek-V3", "DeepSeek-R1"],
    url: "https://deepseek.com",
    color: "#4d6bfe",
  },
  {
    id: "xai",
    name: "xAI",
    logo: "/providers/xai.svg",
    models: ["Grok-3", "Grok-3-mini"],
    url: "https://x.ai",
    color: "#ffffff",
  },
  {
    id: "zhipu",
    name: "Zhipu AI",
    logo: "/providers/zhipu.svg",
    models: ["GLM-4-Plus", "GLM-4-Flash"],
    url: "https://zhipuai.cn",
    color: "#5b6cf9",
  },
  {
    id: "moonshot",
    name: "Moonshot",
    logo: "/providers/moonshot.svg",
    models: ["Kimi k2"],
    url: "https://moonshot.cn",
    color: "#6c5ce7",
  },
];
