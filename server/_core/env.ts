export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // Consultor de IA do Painel da Meta (server/services/consultorLlm.ts): tenta os provedores
  // com chave configurada, nesta ordem — Gemini (tem plano gratuito), Claude, OpenAI.
  // CONSULTOR_IA_PROVEDOR ("gemini" | "anthropic" | "openai") força um só provedor.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  consultorProvedor: process.env.CONSULTOR_IA_PROVEDOR ?? "",
  consultorModeloAnthropic: process.env.CONSULTOR_ANTHROPIC_MODEL ?? "claude-sonnet-5",
  MUBISYS_ACCESS_TOKEN: process.env.MUBISYS_ACCESS_TOKEN ?? "",
  MUBISYS_PUBLIC_KEY: process.env.MUBISYS_PUBLIC_KEY ?? "",
  // Radar de Mercado (Inteligência de Clientes) — SerpAPI (serpapi.com). Trocado
  // do Google Custom Search JSON API em 2026-09 porque o Google fechou essa API
  // para contas novas em 2025 (ver docs/radar-mercado.md). Sem essa chave, o
  // radar fica com a configuração pronta mas a busca desativada.
  serpapiKey: process.env.SERPAPI_KEY ?? "",
};
