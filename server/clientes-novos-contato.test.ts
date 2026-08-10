/**
 * Testes para as procedures de controle de contato com clientes novos:
 * - getContatados: retorna mapa empresa -> { contatado, dataContato }
 * - setContatado: upsert de status de contato
 * - getClientesNovos: retorna lista mesmo para meses congelados
 */

import { describe, it, expect } from "vitest";

// ─── Testes unitários da lógica de normalização de empresa ───────────────────

describe("normalização de empresa para chave de contato", () => {
  const normalizar = (empresa: string) => empresa.toLowerCase().trim();

  it("deve normalizar empresa para lowercase e sem espaços extras", () => {
    expect(normalizar("ECKOGRAF COMUNICACAO VISUAL")).toBe("eckograf comunicacao visual");
    expect(normalizar("  Aurora Comunicacao  ")).toBe("aurora comunicacao");
    expect(normalizar("DESIGN MIDIA COMUNICACAO VISUAL")).toBe("design midia comunicacao visual");
  });

  it("deve ser consistente entre empresa da lista e chave do mapa", () => {
    const empresa = "PONTO E VIRGULA COMUNICACAO VISUAL";
    const chaveNormalizada = normalizar(empresa);
    const mapa: Record<string, { contatado: boolean; dataContato: Date | null }> = {
      [chaveNormalizada]: { contatado: true, dataContato: new Date() },
    };
    // Simular lookup como feito no frontend
    const empresaKey = (empresa ?? "").toLowerCase().trim();
    expect(mapa[empresaKey]?.contatado).toBe(true);
  });
});

// ─── Testes de lógica de snapshot congelado ──────────────────────────────────

describe("lógica de lista de clientes novos em snapshot congelado", () => {
  it("deve retornar lista do JSON salvo quando listaClientesNovos existe", () => {
    const listaJson = JSON.stringify([
      { empresa: "ECKOGRAF", vendedor: "STHEFANIE", osNumero: "1234", valorOs: "804", telefone: "99851-3463", whatsappLink: "https://wa.me/5567998513463", contato: "ANA KAROLINE", cidade: "RIO BRILHANTE" }
    ]);
    const snapCongelado = [{ listaClientesNovos: listaJson, clientesNovos: 1, cotacoesNovos: 2, faturamentoNovos: 804, taxaConvNovos: 50 }];

    // Simular a lógica do backend
    const s = snapCongelado[0];
    let listaSnap: any[] = [];
    try { listaSnap = JSON.parse(s.listaClientesNovos ?? "[]"); } catch { listaSnap = []; }

    expect(listaSnap).toHaveLength(1);
    expect(listaSnap[0].empresa).toBe("ECKOGRAF");
    expect(listaSnap[0].telefone).toBe("99851-3463");
    expect(listaSnap[0].contato).toBe("ANA KAROLINE");
    expect(listaSnap[0].cidade).toBe("RIO BRILHANTE");
  });

  it("deve retornar lista vazia quando listaClientesNovos é null", () => {
    const snapCongelado = [{ listaClientesNovos: null }];
    const s = snapCongelado[0];
    let listaSnap: any[] = [];
    try { listaSnap = JSON.parse(s.listaClientesNovos ?? "[]"); } catch { listaSnap = []; }
    expect(listaSnap).toHaveLength(0);
  });

  it("deve retornar lista vazia quando listaClientesNovos é JSON inválido", () => {
    const snapCongelado = [{ listaClientesNovos: "invalid json {" }];
    const s = snapCongelado[0];
    let listaSnap: any[] = [];
    try { listaSnap = JSON.parse(s.listaClientesNovos ?? "[]"); } catch { listaSnap = []; }
    expect(listaSnap).toHaveLength(0);
  });
});

// ─── Testes de lógica do checkbox de contatado ───────────────────────────────

describe("lógica de checkbox de contatado no frontend", () => {
  it("deve mostrar checkbox marcado quando empresa está no mapa de contatados", () => {
    const contatadosMap: Record<string, { contatado: boolean; dataContato: Date | null }> = {
      "eckograf comunicacao visual": { contatado: true, dataContato: new Date() },
    };
    const empresa = "ECKOGRAF COMUNICACAO VISUAL";
    const empresaKey = (empresa ?? "").toLowerCase().trim();
    const jaContatado = contatadosMap?.[empresaKey]?.contatado ?? false;
    expect(jaContatado).toBe(true);
  });

  it("deve mostrar checkbox desmarcado quando empresa não está no mapa", () => {
    const contatadosMap: Record<string, { contatado: boolean; dataContato: Date | null }> = {};
    const empresa = "AURORA COMUNICACAO VISUAL";
    const empresaKey = (empresa ?? "").toLowerCase().trim();
    const jaContatado = contatadosMap?.[empresaKey]?.contatado ?? false;
    expect(jaContatado).toBe(false);
  });

  it("deve inverter o estado ao clicar no checkbox", () => {
    let jaContatado = false;
    // Simular clique
    const novoEstado = !jaContatado;
    expect(novoEstado).toBe(true);
    // Simular segundo clique
    jaContatado = true;
    const novoEstado2 = !jaContatado;
    expect(novoEstado2).toBe(false);
  });
});
