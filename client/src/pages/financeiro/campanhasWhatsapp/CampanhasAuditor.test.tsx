// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CAMPANHAS_AUDITOR_CATALOGO } from "@shared/campanhas-auditor-catalogo";

const mockState = vi.hoisted(() => ({
  mutate: vi.fn(),
  catalogData: [] as unknown[],
  historyData: [] as unknown[],
  detailData: undefined as unknown,
}));

vi.mock("@/lib/trpc", () => {
  const invalidate = vi.fn();
  return {
    trpc: {
      useUtils: () => ({
        campanhasWhatsapp: {
          auditor: {
            catalogo: { invalidate },
            historico: { invalidate },
            detalhe: { invalidate },
          },
        },
      }),
      campanhasWhatsapp: {
        auditor: {
          catalogo: {
            useQuery: () => ({
              data: mockState.catalogData,
              isLoading: false,
              isError: false,
              isFetching: false,
            }),
          },
          historico: {
            useQuery: () => ({ data: mockState.historyData, isLoading: false }),
          },
          detalhe: {
            useQuery: () => ({ data: mockState.detailData, isFetching: false }),
          },
          executar: {
            useMutation: () => ({ mutate: mockState.mutate, isPending: false }),
          },
        },
      },
    },
  };
});

import CampanhasAuditor from "./CampanhasAuditor";

describe("Robô Auditor — painel administrativo", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mockState.mutate.mockReset();
    mockState.catalogData = CAMPANHAS_AUDITOR_CATALOGO.map(item => ({
      id: item.id,
      nome: item.name,
      descricao: item.description,
      modulo: item.module,
      criteriosAceite: item.acceptanceCriteria,
      testesAssociados: [...item.associatedTests],
      criticidade: item.criticality,
      statusAtual: item.initialStatus,
      evidencia: item.initialEvidence,
      ultimaVerificacao: null,
      versaoSoftware: null,
    }));
    mockState.historyData = [];
    mockState.detailData = undefined;
  });

  it("AUDITOR-CRITICAL: o botão inicia a auditoria completa", () => {
    render(<CampanhasAuditor />);
    fireEvent.click(screen.getByRole("button", { name: "Executar auditoria" }));
    expect(mockState.mutate).toHaveBeenCalledWith({ escopo: "completo" });
  });

  it("envia o escopo de módulo selecionado e exibe requisitos", () => {
    render(<CampanhasAuditor />);
    fireEvent.change(
      screen.getByLabelText("Escopo da auditoria e filtro de requisitos"),
      { target: { value: "Robô Auditor" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Executar auditoria" }));
    expect(mockState.mutate).toHaveBeenCalledWith({
      escopo: "modulo",
      modulo: "Robô Auditor",
    });
    expect(screen.getByText("CAMP-084")).toBeTruthy();
  });
});
