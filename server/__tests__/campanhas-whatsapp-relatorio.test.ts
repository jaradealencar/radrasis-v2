import { describe, expect, it } from "vitest";
import {
  montarRelatorioJornada,
  type RelatorioJornadaEntrada,
} from "../services/campanhasWhatsappRelatorio";

function entradaBase(): RelatorioJornadaEntrada {
  return {
    inicio: "2026-11-01",
    fim: "2026-11-30",
    hoje: "2026-11-30",
    agora: "2026-11-30T20:00:00.000Z",
    janelaDias: 30,
    campanhas: [
      {
        id: 1,
        nome: "Campanha A",
        categoria: "outbound",
        status: "ativa",
        tipo: "recorrente",
        templateConfigurado: false,
        fontesAtivas: 0,
        disparosNoPeriodo: 1,
        contatosEnviadosNoPeriodo: 1,
        contatosApiNoPeriodo: 1,
      },
      {
        id: 2,
        nome: "Campanha B",
        categoria: "outbound",
        status: "ativa",
        tipo: "recorrente",
        templateConfigurado: true,
        fontesAtivas: 1,
        disparosNoPeriodo: 1,
        contatosEnviadosNoPeriodo: 1,
        contatosApiNoPeriodo: 1,
      },
    ],
    contatos: [
      { campanhaId: 1, telefone: "(11) 99999-9000", enviadoEm: "2026-11-01" },
      { campanhaId: 2, telefone: "+55 11 99999-9000", enviadoEm: "2026-11-02" },
    ],
    respostas: [
      {
        campanhaId: 1,
        telefone: "5511999999000",
        recebidoEm: "2026-11-03",
        tipoMensagem: "text",
        ehBot: false,
        bufferAte: "2026-11-03",
        processado: true,
      },
      {
        campanhaId: 1,
        telefone: "5511999999000",
        recebidoEm: "2026-11-03",
        tipoMensagem: "button_reply",
        ehBot: false,
        bufferAte: "2026-11-03",
        processado: true,
      },
      {
        campanhaId: 1,
        telefone: "5511999999000",
        recebidoEm: "2026-11-03",
        tipoMensagem: "text",
        ehBot: true,
        bufferAte: "2026-11-03",
        processado: true,
      },
      {
        campanhaId: 2,
        telefone: "5511999999000",
        recebidoEm: "2026-11-04",
        tipoMensagem: "text",
        ehBot: false,
        bufferAte: "2026-11-04",
        processado: true,
      },
      {
        campanhaId: null,
        telefone: "5511888888000",
        recebidoEm: "2026-11-05",
        tipoMensagem: "text",
        ehBot: false,
        bufferAte: "2026-11-05",
        processado: false,
      },
    ],
    leads: [
      {
        campanhaId: 1,
        telefone: "5511999999000",
        analisadoEm: "2026-11-03",
        icpFitScore: 82,
        nivelInteresse: 4,
      },
      {
        campanhaId: 2,
        telefone: "5511999999000",
        analisadoEm: "2026-11-04",
        icpFitScore: 91,
        nivelInteresse: 5,
      },
    ],
    orcamentos: [
      {
        id: "Q-100",
        telefone: "5511999999000",
        data: "2026-11-05",
        status: "aberto",
        valor: 1000,
      },
    ],
    ordens: [
      {
        id: "OS-100",
        telefone: "5511999999000",
        data: "2026-11-10",
        valor: 2000,
      },
    ],
    optouts: 7,
    telefonesNaQuarentena: 11,
    agendamentosAtrasados: 2,
  };
}

describe("relatório da jornada de campanhas WhatsApp", () => {
  it("monta o funil por coorte, elimina respostas repetidas e expõe sobreposição de campanhas", () => {
    const relatorio = montarRelatorioJornada(entradaBase());
    const a = relatorio.porCampanha.find(c => c.id === 1)!;
    const b = relatorio.porCampanha.find(c => c.id === 2)!;

    expect(a.respostasHumanas).toBe(1);
    expect(a.respostasBot).toBe(1);
    expect(a.cliquesCta).toBe(1);
    expect(a.oportunidadesEstimadas).toBe(1);
    expect(a.orcamentosAbertos).toBe(1);
    expect(a.ordensServico).toBe(1);
    expect(a.receitaAssociada).toBe(2000);
    expect(b.receitaAssociada).toBe(2000);
    expect(relatorio.kpis.respostasHumanas).toBe(1);
    expect(relatorio.kpis.orcamentos).toBe(1);
    expect(relatorio.kpis.ordensServico).toBe(1);
    expect(relatorio.kpis.receitaIdentificadaUnica).toBe(2000);
    expect(relatorio.kpis.receitaAssociadaPorCampanha).toBe(4000);
    expect(relatorio.auditoria.contatosEmMaisDeUmaCampanha).toBe(1);
    expect(relatorio.auditoria.ordensAssociadasAMaisDeUmaCampanha).toBe(1);
    expect(relatorio.auditoria.orcamentosAssociadosAMaisDeUmaCampanha).toBe(1);
    expect(relatorio.auditoria.respostasSemCampanha).toBe(1);
    expect(relatorio.auditoria.mensagensPendentes).toBe(1);
    expect(relatorio.auditoria.campanhasAtivasSemTemplate).toEqual([
      { id: 1, nome: "Campanha A" },
    ]);
    expect(relatorio.auditoria.campanhasRecorrentesSemFonte).toEqual([
      { id: 1, nome: "Campanha A" },
    ]);
    expect(relatorio.auditoria.agendamentosAtrasados).toBe(2);
    expect(relatorio.auditoria.totalOptouts).toBe(7);
  });

  it("ignora resultados anteriores ao envio, fora da janela ou depois de hoje", () => {
    const entrada = entradaBase();
    entrada.janelaDias = 7;
    entrada.ordens[0].data = "2026-11-07";
    entrada.ordens.push(
      {
        id: "OS-OLD",
        telefone: "5511999999000",
        data: "2026-10-30",
        valor: 400,
      },
      {
        id: "OS-LATE",
        telefone: "5511999999000",
        data: "2026-11-20",
        valor: 900,
      },
      {
        id: "OS-FUTURE",
        telefone: "5511999999000",
        data: "2026-12-01",
        valor: 800,
      }
    );
    const relatorio = montarRelatorioJornada(entrada);
    const a = relatorio.porCampanha.find(c => c.id === 1)!;
    expect(a.ordensServico).toBe(1);
    expect(a.receitaAssociada).toBe(2000);
  });
});
