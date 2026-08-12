export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  MUBISYS_ACCESS_TOKEN: process.env.MUBISYS_ACCESS_TOKEN ?? "",
  MUBISYS_PUBLIC_KEY: process.env.MUBISYS_PUBLIC_KEY ?? "",
};
