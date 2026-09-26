import { describe, it, expect } from "vitest";
import { calcularFunilMensal } from "../services/inteligenciaClientes";

const HOJE = new Date(2026, 8, 15);

function orc(ano: number, mes: number, status: string, dataCadastro: string, validade = "15") {
  return { ano, mes, status, dataCadastro, validade };
}

describe("calcularFunilMensal", () => {
  const linhas = [
    // agosto/2026: 2 ganhos, 1 perdido formal, 1 em aberto vencido (=perdido), 1 em aberto ainda válido... (válido só em set)
    orc(2026, 8, "Aprovado", "03/08/2026 10:00"),
    orc(2026, 8, "Entregue", "05/08/2026 10:00"),
    orc(2026, 8, "Reprovado", "06/08/2026 10:00"),
    orc(2026, 8, "Em aberto", "07/08/2026 10:00", "15"), // venceu em 22/08 → perdido
    // julho/2026: 1 ganho e 3 em aberto vencidos
    orc(2026, 7, "Aprovado", "02/07/2026 10:00"),
    orc(2026, 7, "Em aberto", "03/07/2026 10:00", "10"),
    orc(2026, 7, "Em aberto", "04/07/2026 10:00", "10"),
    orc(2026, 7, "Em aberto", "05/07/2026 10:00", "10"),
    // setembro/2026 (mês corrente) não entra
    orc(2026, 9, "Aprovado", "02/09/2026 10:00"),
  ];
  const r = calcularFunilMensal(linhas, HOJE);

  it("considera só meses fechados, em ordem cronológica", () => {
    expect(r.mensal.map(m => m.mes)).toEqual(["07/2026", "08/2026"]);
  });

  it("conta 'em aberto' vencido como perdido e usa ganhos/(ganhos+perdidos)", () => {
    const ago = r.mensal[1];
    expect(ago.leads).toBe(4);
    expect(ago.ganhos).toBe(2);
    expect(ago.perdidos).toBe(2);
    expect(ago.conversaoPct).toBeCloseTo(50, 6);
    const jul = r.mensal[0];
    expect(jul.conversaoPct).toBeCloseTo(25, 6);
  });

  it("agrega conversão e leads por mês", () => {
    expect(r.conversaoPct).toBeCloseTo((3 / 8) * 100, 6); // 3 ganhos em 8 decididos
    expect(r.leadsPorMes).toBeCloseTo(4, 6);
  });
});
