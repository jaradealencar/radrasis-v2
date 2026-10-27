export type ArteConfig = {
  origin: string;
  password: string;
  secret: string;
  integrationKey: string;
  production: boolean;
};

/** Apenas as variáveis deste aplicativo autorizam acesso; não reutiliza login do ERP. */
export function carregarConfigArte(): ArteConfig {
  const production = process.env.NODE_ENV === "production";
  const origin = process.env.ARTE_PUBLIC_URL?.trim() || "http://localhost:4320";
  const url = new URL(origin);
  if (url.origin !== origin || (production && url.protocol !== "https:"))
    throw new Error(
      "ARTE_PUBLIC_URL deve ser uma origem completa, sem barra final, e HTTPS em produção."
    );
  const password = process.env.ARTE_ACCESS_PASSWORD ?? "";
  const secret = process.env.ARTE_SESSION_SECRET ?? "";
  const integrationKey = process.env.ARTE_INTEGRATION_API_KEY ?? "";
  if (password.length < 16 || secret.length < 32)
    throw new Error(
      "Configure ARTE_ACCESS_PASSWORD (16+ caracteres) e ARTE_SESSION_SECRET (32+) no servidor da ferramenta."
    );
  if (integrationKey && integrationKey.length < 32)
    throw new Error(
      "ARTE_INTEGRATION_API_KEY precisa ter pelo menos 32 caracteres ou ficar vazia para desativar integrações."
    );
  return { origin, password, secret, integrationKey, production };
}
