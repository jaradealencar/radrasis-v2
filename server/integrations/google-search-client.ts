/**
 * Cliente para a Google Custom Search JSON API — usada pelo Radar de Mercado
 * (server/routers/radarMercado.ts). Requer GOOGLE_SEARCH_API_KEY e
 * GOOGLE_SEARCH_CX (ver .env.example para como criar as duas).
 */

import { ENV } from "../_core/env";

export interface GoogleSearchItem {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

export function buscaConfigurada(): boolean {
  return !!ENV.googleSearchApiKey && !!ENV.googleSearchCx;
}

export async function buscarNaWeb(query: string, num = 10): Promise<GoogleSearchItem[]> {
  if (!buscaConfigurada()) {
    throw new Error("Radar de Mercado sem busca configurada — defina GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX (ver .env.example).");
  }
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", ENV.googleSearchApiKey);
  url.searchParams.set("cx", ENV.googleSearchCx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(num, 10))); // API limita a 10 por chamada
  url.searchParams.set("gl", "br");
  url.searchParams.set("lr", "lang_pt");

  let resp: Response;
  try {
    resp = await fetch(url.toString());
  } catch (e: any) {
    throw new Error(`Falha de rede ao consultar Google Custom Search: ${e?.message ?? "erro desconhecido"}`);
  }
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    throw new Error(`Google Custom Search retornou status ${resp.status}: ${corpo.slice(0, 300)}`);
  }
  const json = await resp.json();
  const items = Array.isArray(json.items) ? json.items : [];
  return items.map((i: any) => ({
    title: i.title ?? "",
    link: i.link ?? "",
    snippet: i.snippet ?? "",
    displayLink: i.displayLink ?? "",
  }));
}
