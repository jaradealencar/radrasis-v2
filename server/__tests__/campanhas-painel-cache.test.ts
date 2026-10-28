import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAMPANHAS_PAINEL_CACHE_TTL_MS,
  comCacheCampanhasPainel,
  invalidarCacheCampanhasPainel,
  limparCacheCampanhasPainelParaTeste,
} from "../services/campanhasPainelCache";

describe("cache curto do painel de campanhas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    limparCacheCampanhasPainelParaTeste();
  });

  afterEach(() => {
    limparCacheCampanhasPainelParaTeste();
    vi.useRealTimers();
  });

  it("reaproveita o resumo até o TTL expirar", async () => {
    const carregar = vi
      .fn()
      .mockResolvedValueOnce({ total: 1 })
      .mockResolvedValueOnce({ total: 2 });

    await expect(
      comCacheCampanhasPainel("audiencias", carregar)
    ).resolves.toEqual({ total: 1 });
    await expect(
      comCacheCampanhasPainel("audiencias", carregar)
    ).resolves.toEqual({ total: 1 });
    expect(carregar).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(CAMPANHAS_PAINEL_CACHE_TTL_MS);
    await expect(
      comCacheCampanhasPainel("audiencias", carregar)
    ).resolves.toEqual({ total: 2 });
    expect(carregar).toHaveBeenCalledTimes(2);
  });

  it("coalesce chamadas simultâneas para a mesma contagem", async () => {
    const carregar = vi.fn(async () => 7);
    const [primeira, segunda] = await Promise.all([
      comCacheCampanhasPainel("pos-venda", carregar),
      comCacheCampanhasPainel("pos-venda", carregar),
    ]);

    expect([primeira, segunda]).toEqual([7, 7]);
    expect(carregar).toHaveBeenCalledTimes(1);
  });

  it("não guarda falhas", async () => {
    const carregar = vi
      .fn()
      .mockRejectedValueOnce(new Error("falha transitória"))
      .mockResolvedValueOnce({ total: 3 });

    await expect(
      comCacheCampanhasPainel("audiencias", carregar)
    ).rejects.toThrow("falha transitória");
    await expect(
      comCacheCampanhasPainel("audiencias", carregar)
    ).resolves.toEqual({ total: 3 });
    expect(carregar).toHaveBeenCalledTimes(2);
  });

  it("invalida resultados e leituras antigas que ainda estão em andamento", async () => {
    let concluirLeituraAntiga!: (valor: number) => void;
    const carregarAntigo = vi.fn(
      () =>
        new Promise<number>(resolve => {
          concluirLeituraAntiga = resolve;
        })
    );
    const antiga = comCacheCampanhasPainel("pos-venda", carregarAntigo);

    invalidarCacheCampanhasPainel();
    await expect(
      comCacheCampanhasPainel("pos-venda", async () => 2)
    ).resolves.toBe(2);
    concluirLeituraAntiga(1);
    await expect(antiga).resolves.toBe(1);
    await expect(
      comCacheCampanhasPainel("pos-venda", async () => 3)
    ).resolves.toBe(2);
    expect(carregarAntigo).toHaveBeenCalledTimes(1);
  });
});
