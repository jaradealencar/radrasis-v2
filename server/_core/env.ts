export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  MUBISYS_ACCESS_TOKEN: process.env.MUBISYS_ACCESS_TOKEN ?? "",
  MUBISYS_PUBLIC_KEY: process.env.MUBISYS_PUBLIC_KEY ?? "",
  // Radar de Mercado (Inteligência de Clientes) — SerpAPI (serpapi.com). Trocado
  // do Google Custom Search JSON API em 2026-09 porque o Google fechou essa API
  // para contas novas em 2025 (ver docs/radar-mercado.md). Sem essa chave, o
  // radar fica com a configuração pronta mas a busca desativada.
  serpapiKey: process.env.SERPAPI_KEY ?? "",
};
