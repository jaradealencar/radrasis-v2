/**
 * Cliente para o SerpAPI (serpapi.com) — usado pelo Radar de Mercado
 * (server/routers/radarMercado.ts). Escolhido em vez da Google Custom Search
 * JSON API porque o Google fechou essa API para contas novas em 2025 (ver
 * docs/radar-mercado.md) — SerpAPI é cadastro só com e-mail, sem a burocracia
 * de projeto/faturamento do Google Cloud. Requer SERPAPI_KEY.
 */

import { ENV } from "../_core/env";

export interface GoogleSearchItem {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

export function buscaConfigurada(): boolean {
  return !!ENV.serpapiKey;
}

export async function buscarNaWeb(query: string, num = 10): Promise<GoogleSearchItem[]> {
  if (!buscaConfigurada()) {
    throw new Error("Radar de Mercado sem busca configurada — defina SERPAPI_KEY (ver .env.example).");
  }
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("api_key", ENV.serpapiKey);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(num, 10)));
  url.searchParams.set("gl", "br");
  url.searchParams.set("hl", "pt");

  let resp: Response;
  try {
    resp = await fetch(url.toString());
  } catch (e: any) {
    throw new Error(`Falha de rede ao consultar o SerpAPI: ${e?.message ?? "erro desconhecido"}`);
  }
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    throw new Error(`SerpAPI retornou status ${resp.status}: ${corpo.slice(0, 300)}`);
  }
  const json = await resp.json();
  if (json.error) throw new Error(`SerpAPI: ${json.error}`);
  const items = Array.isArray(json.organic_results) ? json.organic_results : [];
  return items.map((i: any) => ({
    title: i.title ?? "",
    link: i.link ?? "",
    snippet: i.snippet ?? "",
    displayLink: i.displayed_link ?? (i.link ? new URL(i.link).hostname : ""),
  }));
}
