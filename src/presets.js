// Built-in provider presets. Data only — adding a provider in settings clones one of
// these (or a blank custom object) and fills in the API key.
export const PRESETS = [
  { id: "keyless", name: "Free (Google Translate)", adapter: "keyless", apiUrl: "", apiKey: "", model: "" },
  { id: "openai", name: "OpenAI", adapter: "openai-compat", apiUrl: "https://api.openai.com/v1/chat/completions", apiKey: "", model: "gpt-4o-mini" },
  { id: "deepseek", name: "DeepSeek", adapter: "openai-compat", apiUrl: "https://api.deepseek.com/chat/completions", apiKey: "", model: "deepseek-chat" },
  { id: "groq", name: "Groq", adapter: "openai-compat", apiUrl: "https://api.groq.com/openai/v1/chat/completions", apiKey: "", model: "llama-3.3-70b-versatile" },
  { id: "openrouter", name: "OpenRouter", adapter: "openai-compat", apiUrl: "https://openrouter.ai/api/v1/chat/completions", apiKey: "", model: "openai/gpt-4o-mini" },
  { id: "ollama", name: "Ollama (local)", adapter: "openai-compat", apiUrl: "http://localhost:11434/v1/chat/completions", apiKey: "ollama", model: "llama3.1" },
  { id: "deepl", name: "DeepL", adapter: "classic-mt", apiUrl: "https://api-free.deepl.com/v2/translate", apiKey: "", model: "", variant: "deepl" },
  { id: "google-cloud", name: "Google Cloud Translate", adapter: "classic-mt", apiUrl: "https://translation.googleapis.com/language/translate/v2", apiKey: "", model: "", variant: "google-cloud" },
  { id: "anthropic", name: "Anthropic (Claude)", adapter: "anthropic", apiUrl: "https://api.anthropic.com/v1/messages", apiKey: "", model: "claude-haiku-4-5-20251001" },
];
