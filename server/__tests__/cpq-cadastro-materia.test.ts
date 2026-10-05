import { describe, expect, it } from "vitest";
import { statusCadastroMateriaPrima, type EntradaStatusCadastro } from "../services/cpqCadastroMateria";

const nenhuma = { usaDadosChapa: false, usaDadosBobina: false, usaDadosPerfil: false };
const cadastroVazio: NonNullable<EntradaStatusCadastro["cadastro"]> = {
  espessuraMm: null, densidadeKgM3: null, perfilFormato: null, perfilAlturaMm: null, perfilLarguraMm: null,
  perfilComprimentoMm: null, bobinaCustoBase: null, bobinaComprimentoRoloMm: null,
};

describe("situação do cadastro de matéria-prima", () => {
  it("sem categoria", () => {
    expect(statusCadastroMateriaPrima({ categoria: null, cadastro: null, formatosAtivos: 0 }))
      .toEqual({ status: "sem_categoria", pendencias: ["Sem categoria"] });
  });

  it("categoria sem dados técnicos exigidos já conta como atualizada", () => {
    expect(statusCadastroMateriaPrima({ categoria: nenhuma, cadastro: null, formatosAtivos: 0 }).status).toBe("atualizada");
  });

  it("chapa: pede espessura, densidade e formato ativo", () => {
    const categoria = { ...nenhuma, usaDadosChapa: true };
    const incompleta = statusCadastroMateriaPrima({ categoria, cadastro: { ...cadastroVazio, espessuraMm: 3 }, formatosAtivos: 0 });
    expect(incompleta.status).toBe("incompleta");
    expect(incompleta.pendencias).toEqual(["densidade", "ao menos um formato de chapa"]);
    expect(statusCadastroMateriaPrima({ categoria, cadastro: { ...cadastroVazio, espessuraMm: 3, densidadeKgM3: 1190 }, formatosAtivos: 1 }).status)
      .toBe("atualizada");
  });

  it("bobina: pede largura, espessura, densidade e base de custo; por rolo exige o comprimento", () => {
    const categoria = { ...nenhuma, usaDadosBobina: true };
    expect(statusCadastroMateriaPrima({ categoria, cadastro: { ...cadastroVazio, espessuraMm: 0.08, bobinaCustoBase: "m2" }, formatosAtivos: 1 }).pendencias)
      .toEqual(["densidade"]);
    expect(statusCadastroMateriaPrima({ categoria, cadastro: { ...cadastroVazio, espessuraMm: 0.08, densidadeKgM3: 1_400 }, formatosAtivos: 1 }).pendencias)
      .toEqual(["como o custo é cobrado"]);
    expect(statusCadastroMateriaPrima({ categoria, cadastro: { ...cadastroVazio, espessuraMm: 0.08, densidadeKgM3: 1_400, bobinaCustoBase: "rolo" }, formatosAtivos: 1 }).pendencias)
      .toEqual(["comprimento do rolo"]);
    expect(statusCadastroMateriaPrima({ categoria, cadastro: { ...cadastroVazio, espessuraMm: 0.08, densidadeKgM3: 1_400, bobinaCustoBase: "m2" }, formatosAtivos: 1 }).status)
      .toBe("atualizada");
    expect(statusCadastroMateriaPrima({ categoria, cadastro: { ...cadastroVazio, espessuraMm: 0.08, densidadeKgM3: 1_400, bobinaCustoBase: "rolo", bobinaComprimentoRoloMm: 200_000 }, formatosAtivos: 1 }).status)
      .toBe("atualizada");
  });

  it("perfil tubo exige altura, largura, espessura, comprimento e densidade; barra redonda dispensa altura e espessura", () => {
    const categoria = { ...nenhuma, usaDadosPerfil: true };
    expect(statusCadastroMateriaPrima({ categoria, cadastro: { ...cadastroVazio, perfilFormato: "tubo" }, formatosAtivos: 0 }).pendencias)
      .toEqual(["altura do perfil", "largura do perfil", "espessura", "comprimento da barra", "densidade"]);
    expect(statusCadastroMateriaPrima({
      categoria,
      cadastro: { ...cadastroVazio, perfilFormato: "redonda", perfilLarguraMm: 12, perfilComprimentoMm: 6_000, densidadeKgM3: 7_850 },
      formatosAtivos: 0,
    }).status).toBe("atualizada");
  });

  it("perfil com espessura que não cabe na seção fica incompleto", () => {
    const resultado = statusCadastroMateriaPrima({
      categoria: { ...nenhuma, usaDadosPerfil: true },
      cadastro: { ...cadastroVazio, perfilFormato: "tubo", perfilAlturaMm: 20, perfilLarguraMm: 20, espessuraMm: 15, perfilComprimentoMm: 6_000, densidadeKgM3: 7_850 },
      formatosAtivos: 0,
    });
    expect(resultado).toEqual({ status: "incompleta", pendencias: ["medidas que formem uma seção válida"] });
  });
});
