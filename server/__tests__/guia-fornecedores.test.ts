import { describe, expect, it } from "vitest";
import { calcularFornecedoresAtivos } from "../routers/guiaFornecedores";

// "Hoje" fixo para os testes: 21/09/2026 (mesma data desta sprint)
const HOJE = new Date(2026, 8, 21); // mês 0-indexado no Date nativo

type Linha = { empresa: string | null; cidade: string | null; estado: string | null; telefone: string | null; tipoOs: string | null; status: string | null; mes: number; ano: number };
const os = (p: Partial<Linha> & { empresa: string; mes: number; ano: number }): Linha => ({
  cidade: "Campo Grande", estado: "ms", telefone: "+5567999998888", tipoOs: "", status: "Entregue", ...p,
});

describe("calcularFornecedoresAtivos", () => {
  it("inclui quem tem 2+ O.S. válidas nos últimos 12 meses e comprou há no máximo 4 meses", () => {
    const linhas = [
      os({ empresa: "Grafica Sol", mes: 6, ano: 2026 }),
      os({ empresa: "Grafica Sol", mes: 8, ano: 2026 }), // há 1 mês — ativo
    ];
    const r = calcularFornecedoresAtivos(linhas, [], HOJE);
    expect(r.map(f => f.nome)).toEqual(["Grafica Sol"]);
    expect(r[0].origem).toBe("automatico");
  });

  it("exclui quem teve só 1 O.S. válida na janela de 12 meses", () => {
    const linhas = [os({ empresa: "Unica Compra", mes: 8, ano: 2026 })];
    expect(calcularFornecedoresAtivos(linhas, [], HOJE)).toHaveLength(0);
  });

  it("exclui quem tem 2+ compras mas sumiu há mais de 4 meses (a recência pesa mais que a contagem)", () => {
    // 21/09/2026 - 5 meses = abril/2026: gap de 5 meses, deveria sair
    const linhas = [
      os({ empresa: "Sumiu Ha Tempos", mes: 2, ano: 2026 }),
      os({ empresa: "Sumiu Ha Tempos", mes: 4, ano: 2026 }),
    ];
    expect(calcularFornecedoresAtivos(linhas, [], HOJE)).toHaveLength(0);
  });

  it("inclui no limite exato: última compra há 3 meses de gap (dentro dos 4), exclui com gap de 4", () => {
    const dentro = [
      os({ empresa: "No Limite Dentro", mes: 5, ano: 2026 }),
      os({ empresa: "No Limite Dentro", mes: 6, ano: 2026 }), // gap = 21/09 -> mês 6: 9-6=3
    ];
    const fora = [
      os({ empresa: "No Limite Fora", mes: 4, ano: 2026 }),
      os({ empresa: "No Limite Fora", mes: 5, ano: 2026 }), // gap = 9-5=4
    ];
    expect(calcularFornecedoresAtivos(dentro, [], HOJE).map(f => f.nome)).toEqual(["No Limite Dentro"]);
    expect(calcularFornecedoresAtivos(fora, [], HOJE)).toHaveLength(0);
  });

  it("não conta O.S. Cancelada, Retrabalho, Amostra ou Cortesia", () => {
    const linhas = [
      os({ empresa: "Tipos Invalidos", mes: 6, ano: 2026, status: "Cancelada" }),
      os({ empresa: "Tipos Invalidos", mes: 7, ano: 2026, tipoOs: "Retrabalho" }),
      os({ empresa: "Tipos Invalidos", mes: 8, ano: 2026, tipoOs: "Amostra" }),
      os({ empresa: "Tipos Invalidos", mes: 8, ano: 2026, tipoOs: "Cortesia" }),
      os({ empresa: "Tipos Invalidos", mes: 8, ano: 2026 }), // só esta é válida
    ];
    expect(calcularFornecedoresAtivos(linhas, [], HOJE)).toHaveLength(0);
  });

  it("respeita a janela rolante de 12 meses: compra de 13 meses atrás não conta para o total", () => {
    // 21/09/2026 - 13 meses = agosto/2025 (fora da janela); -11 meses = outubro/2025 (dentro)
    const linhas = [
      os({ empresa: "Antiga Demais", mes: 8, ano: 2025 }), // 13 meses atrás — fora
      os({ empresa: "Antiga Demais", mes: 8, ano: 2026 }), // recente — só 1 válida na janela
    ];
    expect(calcularFornecedoresAtivos(linhas, [], HOJE)).toHaveLength(0);
  });

  it("override 'excluir' tira um fornecedor que qualificaria", () => {
    const linhas = [
      os({ empresa: "Vai Sair", mes: 7, ano: 2026 }),
      os({ empresa: "Vai Sair", mes: 8, ano: 2026 }),
    ];
    const overrides = [{ empresaChave: "vai sair", empresaNome: "Vai Sair", acao: "excluir" as const, telefone: null, cidade: null, estado: null }];
    expect(calcularFornecedoresAtivos(linhas, overrides, HOJE)).toHaveLength(0);
  });

  it("override 'incluir' força um fornecedor que não tem nenhuma O.S., com dados manuais", () => {
    const overrides = [{
      empresaChave: "parceiro estrategico", empresaNome: "Parceiro Estratégico", acao: "incluir" as const,
      telefone: "5567988887777", cidade: "Dourados", estado: "ms",
    }];
    const r = calcularFornecedoresAtivos([], overrides, HOJE);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ nome: "Parceiro Estratégico", cidade: "Dourados", estado: "MS", telefone: "5567988887777", origem: "manual" });
  });

  it("override 'incluir' também funciona para quem JÁ tem O.S. mas não qualificaria sozinho", () => {
    const linhas = [os({ empresa: "Comprou Uma Vez", mes: 8, ano: 2026, cidade: "Corumbá", estado: "ms" })];
    const overrides = [{ empresaChave: "comprou uma vez", empresaNome: "Comprou Uma Vez", acao: "incluir" as const, telefone: null, cidade: null, estado: null }];
    const r = calcularFornecedoresAtivos(linhas, overrides, HOJE);
    expect(r).toHaveLength(1);
    // sem telefone/cidade manuais no override, usa o que veio da última O.S.
    expect(r[0]).toMatchObject({ nome: "Comprou Uma Vez", cidade: "Corumbá", estado: "MS" });
  });

  it("rejeita telefone placeholder (DDD 00) mesmo com a empresa qualificando", () => {
    const linhas = [
      os({ empresa: "Telefone Falso", mes: 7, ano: 2026, telefone: "+55 (00) 00000-0000" }),
      os({ empresa: "Telefone Falso", mes: 8, ano: 2026, telefone: "+55 (00) 00000-0000" }),
    ];
    const r = calcularFornecedoresAtivos(linhas, [], HOJE);
    expect(r).toHaveLength(1);
    expect(r[0].telefone).toBeNull();
  });

  it('exclui "Mubis" e outras contas administrativas mesmo com 2+ compras', () => {
    for (const nome of ["Mubis", "Cliente Diversos", "Cliente Teste Contratos"]) {
      const linhas = [os({ empresa: nome, mes: 7, ano: 2026 }), os({ empresa: nome, mes: 8, ano: 2026 })];
      expect(calcularFornecedoresAtivos(linhas, [], HOJE)).toHaveLength(0);
    }
  });

  it("junta variações de grafia do mesmo nome (maiúsculas/minúsculas) num só fornecedor, usando a mais frequente", () => {
    const linhas = [
      os({ empresa: "grafica sol", mes: 6, ano: 2026 }),
      os({ empresa: "GRAFICA SOL", mes: 7, ano: 2026 }),
      os({ empresa: "GRAFICA SOL", mes: 8, ano: 2026 }),
    ];
    const r = calcularFornecedoresAtivos(linhas, [], HOJE);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("GRAFICA SOL");
  });
});
