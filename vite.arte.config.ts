import { resolve } from "node:path";
import { defineConfig, type UserConfig } from "vite";
export const configArteVite: UserConfig = {
  root: resolve("client"),
  publicDir: false,
  envPrefix: "ARTE_CLIENT_PUBLIC_",
  plugins: [
    {
      name: "arte-independente",
      transformIndexHtml(html) {
        return html
          .replace(
            "</head>",
            '<meta name="arte-standalone" content="true" /></head>'
          )
          .replaceAll("CPQ Letreiros Express", "Estúdio de Arte")
          .replaceAll("Radrasys / API", "Estúdio / API")
          .replaceAll("API do Radrasys", "API da ferramenta")
          .replaceAll("Entrar no Radrasys", "Entrar na ferramenta")
          .replaceAll("Entre no Radrasys", "Entre na ferramenta")
          .replaceAll(
            "Painel restrito aos perfis administrador e master.",
            "Entre com o acesso desta ferramenta para consultar os serviços."
          );
      },
    },
  ],
  build: {
    outDir: resolve("dist/arte/public"),
    emptyOutDir: true,
    rollupOptions: { input: resolve("client/cpq-redesenho-vetorizacao.html") },
  },
};
export default defineConfig(configArteVite);
