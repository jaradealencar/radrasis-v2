// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from '@/lib/trpc';
import { DadosFixosCard, OpcoesFreteNoCard } from './Solicitacoes';

/**
 * Providers mínimos para renderizar componentes que usam hooks do tRPC.
 * Nenhuma requisição é disparada: os testes apenas inspecionam o DOM.
 */
function comProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpcClient = trpc.createClient({
    links: [httpBatchLink({ url: 'http://localhost:3000/api/trpc', transformer: superjson })],
  });
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </trpc.Provider>
  );
}

/**
 * Prova de renderização: os dados obrigatórios do card precisam estar
 * VISÍVEIS (no DOM, sem cliques ou expansões) nos 5 estágios do Kanban.
 */
const ESTAGIOS = ['aberta', 'cotando', 'selecao', 'cotada', 'enviada'] as const;

const cotacaoBase = {
  id: 1,
  osNumero: '6808',
  destinatarioNome: 'MOREIRA COMUNICACAO VISUAL',
  destinatarioCnpj: '12.345.678/0001-90',
  municipio: 'SAO PAULO',
  estado: 'SP',
  pesoKg: '25.5',
  valorNf: '0',
  observacoes: null,
  observacaoGol: null,
  fotoUrl: null,
  empacotamentoId: null,
  dimensoesLargura: null,
  dimensoesAltura: null,
  dimensoesComprimento: null,
  cepDestino: '01310-100',
  quantidadeVolumes: 2,
  volumesJson: JSON.stringify([
    { largura: 40, comprimento: 60, altura: 30, peso: 12.5 },
    { largura: 50, comprimento: 80, altura: 25, peso: 13 },
  ]),
  status: 'aberta',
  solicitanteNome: 'Usuário Teste',
  empacotadores: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  opcoes: [],
} as any;

afterEach(() => cleanup());

describe('Bloco fixo do card — visível em todos os estágios', () => {
  for (const status of ESTAGIOS) {
    it(`mostra CEP, cidade, dimensões e volume total no estágio "${status}"`, () => {
      render(<DadosFixosCard cotacao={{ ...cotacaoBase, status }} />);

      // CEP e cidade
      expect(screen.getByText('01310-100')).toBeTruthy();
      expect(screen.getByText('SAO PAULO/SP')).toBeTruthy();

      // Quantidade de volumes e peso somado dos volumes
      expect(screen.getByText('2')).toBeTruthy();
      expect(screen.getByText(/25,50 kg/)).toBeTruthy();

      // Dimensões de cada volume
      expect(screen.getByText('40×60×30 cm')).toBeTruthy();
      expect(screen.getByText('50×80×25 cm')).toBeTruthy();

      // Volume total cubado: 40*60*30 + 50*80*25 = 72.000 + 100.000 = 172.000 cm³ = 0,172 m³
      expect(screen.getByText('0,172 m³')).toBeTruthy();
    });
  }

  it('usa cm³ quando a cubagem é pequena, em vez de exibir 0,000 m³', () => {
    render(
      <DadosFixosCard
        cotacao={{
          ...cotacaoBase,
          quantidadeVolumes: 1,
          volumesJson: JSON.stringify([{ largura: 1, comprimento: 1, altura: 1, peso: 1 }]),
        }}
      />,
    );
    expect(screen.getByText('1 cm³')).toBeTruthy();
    expect(screen.queryByText('0,000 m³')).toBeNull();
  });

  it('cai para as dimensões soltas quando não há volumesJson', () => {
    render(
      <DadosFixosCard
        cotacao={{
          ...cotacaoBase,
          volumesJson: null,
          quantidadeVolumes: 1,
          dimensoesLargura: '20',
          dimensoesComprimento: '30',
          dimensoesAltura: '10',
        }}
      />,
    );
    expect(screen.getByText('20×30×10 cm')).toBeTruthy();
  });
});

describe('Transportadoras selecionadas no card — campos de valor e dias úteis', () => {
  const opcoes = [
    { id: 11, transportadoraNome: 'Braspress', valorFrete: '320.90', prazoDias: 3, tipoPrazo: 'uteis', selecionada: 'nao' },
    { id: 12, transportadoraNome: 'Correios', valorFrete: '350.00', prazoDias: 7, tipoPrazo: 'uteis', selecionada: 'nao' },
    { id: 13, transportadoraNome: 'Jadlog', valorFrete: '289.40', prazoDias: 5, tipoPrazo: 'uteis', selecionada: 'sim' },
  ] as any;

  it('lista as 3 transportadoras com nome, valor e prazo preenchidos', () => {
    render(comProviders(<OpcoesFreteNoCard cotacaoId={1} opcoes={opcoes} onRefresh={() => {}} />));

    expect(screen.getByText('Transportadoras selecionadas (3)')).toBeTruthy();
    expect(screen.getByText('Braspress')).toBeTruthy();
    expect(screen.getByText('Correios')).toBeTruthy();
    expect(screen.getByText('Jadlog')).toBeTruthy();

    const valores = screen.getAllByLabelText(/^Valor do frete/) as HTMLInputElement[];
    expect(valores).toHaveLength(3);
    expect(valores.map(i => i.value)).toEqual(['320,90', '350,00', '289,40']);

    const dias = screen.getAllByLabelText(/^Dias úteis de entrega/) as HTMLInputElement[];
    expect(dias).toHaveLength(3);
    expect(dias.map(i => i.value)).toEqual(['3', '7', '5']);
  });

  it('renderiza os campos editáveis mesmo sem valor informado', () => {
    render(
      comProviders(
        <OpcoesFreteNoCard
          cotacaoId={1}
          opcoes={[{ id: 21, transportadoraNome: 'Andorinha', valorFrete: '0', prazoDias: null, tipoPrazo: 'uteis', selecionada: 'nao' }] as any}
          onRefresh={() => {}}
        />,
      ),
    );
    const valor = screen.getByLabelText(/^Valor do frete/) as HTMLInputElement;
    const dias = screen.getByLabelText(/^Dias úteis de entrega/) as HTMLInputElement;
    expect(valor.value).toBe('');
    expect(dias.value).toBe('');
    expect(valor.readOnly).toBe(false);
    expect(dias.readOnly).toBe(false);
  });
});
