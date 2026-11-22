/** Publica uma continuação curta da fila no QStash já configurado para campanhas. */
export async function acordarFilaProgramada(delaySegundos = 1): Promise<boolean> {
  const token = process.env.QSTASH_TOKEN?.trim();
  const destino = process.env.CAMPANHAS_CADENCIA_WORKER_URL?.trim();
  const chave = process.env.CAMPANHAS_API_KEY?.trim();
  if (!token || !destino || !chave) return false;
  const url = new URL(destino);
  if (url.protocol !== "https:" || url.pathname !== "/api/v1/campaigns/process-cadence" || url.search || url.hash) {
    throw new Error("CAMPANHAS_CADENCIA_WORKER_URL precisa apontar para /api/v1/campaigns/process-cadence em HTTPS.");
  }
  const response = await fetch(`https://qstash.upstash.io/v2/publish/${destino}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Upstash-Delay": `${Math.max(1, Math.ceil(delaySegundos))}s`,
      "Upstash-Retries": "3",
      "Upstash-Forward-x-api-key": chave,
    },
    body: JSON.stringify({ origem: "fila-programada" }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`QStash recusou a continuação da fila (HTTP ${response.status}).`);
  return true;
}
