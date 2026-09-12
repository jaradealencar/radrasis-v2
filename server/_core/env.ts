export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  MUBISYS_ACCESS_TOKEN: process.env.MUBISYS_ACCESS_TOKEN ?? "",
  MUBISYS_PUBLIC_KEY: process.env.MUBISYS_PUBLIC_KEY ?? "",
  // Radar de Mercado (Inteligência de Clientes) — Google Custom Search JSON API.
  // Sem essas duas, o radar fica com a configuração pronta mas a busca desativada
  // (ver server/integrations/google-search-client.ts e docs/radar-mercado.md).
  googleSearchApiKey: process.env.GOOGLE_SEARCH_API_KEY ?? "",
  googleSearchCx: process.env.GOOGLE_SEARCH_CX ?? "",
};
