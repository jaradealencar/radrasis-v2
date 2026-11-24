const UFS_VALIDAS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export interface OrdemClientePrimeiraCompraEstado {
  chave: string;
  valor: number;
  estado?: string | null;
}

export interface ClientePrimeiraCompraEstado {
  clienteKey: string;
  estado: string | null;
  dataPrimeiraCompra: Date;
  mesPrimeiraCompra?: number | null;
  ordens: OrdemClientePrimeiraCompraEstado[];
}

export interface PropostaClienteNovoEstado {
  id: number;
  orcNumero: string | null;
  clienteKey: string;
  estado: string | null;
  dataProposta: Date;
  mesReferencia?: number;
  dataPrimeiraCompra: Date | null;
  valor: number | null;
}

function normalizarUf(estado: string | null): string | null {
  const uf = estado?.trim().toUpperCase() ?? "";
  return UFS_VALIDAS.has(uf) ? uf : null;
}

function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Repete a classificação mensal da Performance Comercial para o segmento puro:
 * clientes sem compra em meses anteriores. Todas as vendas da primeira compra
 * no mês contam como pedidos novos, inclusive se houver mais de uma O.S. */
export function ehClienteNovoPuroNoMes(
  mesReferencia: number,
  mesPrimeiraCompra: number | null,
  overrideStatus: "novo" | "recorrente" | null = null,
): boolean {
  return overrideStatus !== "recorrente"
    && (mesPrimeiraCompra == null || mesPrimeiraCompra >= mesReferencia);
}

function indiceMes(data: Date): number {
  return data.getFullYear() * 12 + data.getMonth();
}

/** Resume cotações e O.S. de clientes puros novos já classificados por mês.
 * Pedidos e faturamento são distribuídos pela UF de cada O.S.; cotações usam a
 * UF registrada para a proposta. O vínculo entre os eventos usa a empresa. */
export function resumirEstadosNovos(
  clientes: ClientePrimeiraCompraEstado[],
  propostas: PropostaClienteNovoEstado[],
) {
  const clientesPorChave = new Map<string, ClientePrimeiraCompraEstado>();
  const vendasPorUf = new Map<string, {
    clientes: Set<string>;
    ordens: Set<string>;
    faturamento: number;
    clientesComProposta: Set<string>;
    propostasAntesDaCompra: Set<string>;
    valorPropostasAntesDaCompra: number;
  }>();
  const clientesSemUf = new Set<string>();
  const ordensSemUf = new Set<string>();
  let faturamentoSemUf = 0;

  for (const cliente of clientes) {
    const chave = cliente.clienteKey.trim();
    if (!chave || clientesPorChave.has(chave)) continue;
    clientesPorChave.set(chave, cliente);
    const uf = normalizarUf(cliente.estado);
    const destino = uf ?? "";
    if (!uf) clientesSemUf.add(chave);
    const resumoCliente = vendasPorUf.get(destino) ?? {
      clientes: new Set<string>(),
      ordens: new Set<string>(),
      faturamento: 0,
      clientesComProposta: new Set<string>(),
      propostasAntesDaCompra: new Set<string>(),
      valorPropostasAntesDaCompra: 0,
    };
    resumoCliente.clientes.add(chave);
    vendasPorUf.set(destino, resumoCliente);
    for (const ordem of cliente.ordens) {
      const ufOrdem = normalizarUf(ordem.estado ?? null) ?? uf;
      const destinoOrdem = ufOrdem ?? "";
      const resumoOrdem = vendasPorUf.get(destinoOrdem) ?? {
        clientes: new Set<string>(),
        ordens: new Set<string>(),
        faturamento: 0,
        clientesComProposta: new Set<string>(),
        propostasAntesDaCompra: new Set<string>(),
        valorPropostasAntesDaCompra: 0,
      };
      if (resumoOrdem.ordens.has(ordem.chave)) continue;
      resumoOrdem.ordens.add(ordem.chave);
      resumoOrdem.faturamento += Number.isFinite(ordem.valor) ? ordem.valor : 0;
      if (!ufOrdem) {
        ordensSemUf.add(ordem.chave);
        faturamentoSemUf += Number.isFinite(ordem.valor) ? ordem.valor : 0;
      }
      vendasPorUf.set(destinoOrdem, resumoOrdem);
    }
  }

  const propostasPorUf = new Map<string, {
    chaves: Set<string>;
    clientes: Set<string>;
    clientesConvertidos: Set<string>;
    valor: number;
    semValor: number;
  }>();
  const propostasSemUf = new Set<string>();
  const propostasSemValor = new Set<string>();
  const propostasVistas = new Set<string>();
  const clientesComPropostaAntesDaCompra = new Set<string>();
  const propostasAntesDaCompra = new Set<string>();
  let valorPropostasTotal = 0;
  let valorPropostasSemUf = 0;
  let valorPropostasAntesDaCompraTotal = 0;

  for (const proposta of propostas) {
    const clienteKey = proposta.clienteKey.trim();
    const cliente = clientesPorChave.get(clienteKey);
    const mesProposta = proposta.mesReferencia ?? indiceMes(proposta.dataProposta);
    const mesPrimeiraCompra = cliente?.mesPrimeiraCompra ?? (cliente ? indiceMes(cliente.dataPrimeiraCompra) : null);
    if (cliente && mesPrimeiraCompra != null && mesProposta > mesPrimeiraCompra) continue;

    const numero = proposta.orcNumero?.trim();
    const chave = numero ? `orc:${numero}` : `id:${proposta.id}`;
    if (propostasVistas.has(chave)) continue;
    propostasVistas.add(chave);
    const valorValido = proposta.valor != null && Number.isFinite(proposta.valor);
    if (valorValido) valorPropostasTotal += proposta.valor!;
    else propostasSemValor.add(chave);

    const uf = normalizarUf(proposta.estado);
    if (!uf) {
      propostasSemUf.add(chave);
      if (valorValido) valorPropostasSemUf += proposta.valor!;
    } else {
      const resumo = propostasPorUf.get(uf) ?? {
        chaves: new Set<string>(),
        clientes: new Set<string>(),
        clientesConvertidos: new Set<string>(),
        valor: 0,
        semValor: 0,
      };
      resumo.chaves.add(chave);
      if (clienteKey) resumo.clientes.add(clienteKey);
      if (proposta.dataPrimeiraCompra && proposta.dataPrimeiraCompra > proposta.dataProposta) {
        resumo.clientesConvertidos.add(clienteKey);
      }
      if (valorValido) resumo.valor += proposta.valor!;
      else resumo.semValor++;
      propostasPorUf.set(uf, resumo);
    }

    if (!cliente || proposta.dataProposta >= cliente.dataPrimeiraCompra) continue;
    const ufCompra = normalizarUf(cliente.estado) ?? "";
    const resumoCompra = vendasPorUf.get(ufCompra);
    if (!resumoCompra) continue;
    resumoCompra.clientesComProposta.add(clienteKey);
    resumoCompra.propostasAntesDaCompra.add(chave);
    clientesComPropostaAntesDaCompra.add(clienteKey);
    propostasAntesDaCompra.add(chave);
    if (valorValido) {
      resumoCompra.valorPropostasAntesDaCompra += proposta.valor!;
      valorPropostasAntesDaCompraTotal += proposta.valor!;
    }
  }

  const clientesPrimeiraCompra = [...vendasPorUf.entries()]
    .filter(([uf]) => Boolean(uf))
    .map(([uf, resumo]) => ({
      uf,
      clientes: resumo.clientes.size,
      os: resumo.ordens.size,
      faturamento: arredondar(resumo.faturamento),
      ticketMedioPorCliente: resumo.clientes.size > 0 ? arredondar(resumo.faturamento / resumo.clientes.size) : 0,
      clientesComPropostaAntesDaCompra: resumo.clientesComProposta.size,
      propostasAntesDaCompra: resumo.propostasAntesDaCompra.size,
      valorPropostasAntesDaCompra: arredondar(resumo.valorPropostasAntesDaCompra),
    }))
    .sort((a, b) => b.faturamento - a.faturamento || b.clientes - a.clientes || a.uf.localeCompare(b.uf));

  const propostasNovosClientes = [...propostasPorUf.entries()]
    .map(([uf, resumo]) => ({
      uf,
      propostas: resumo.chaves.size,
      clientes: resumo.clientes.size,
      clientesConvertidos: resumo.clientesConvertidos.size,
      valorPropostas: arredondar(resumo.valor),
      propostasSemValor: resumo.semValor,
    }))
    .sort((a, b) => b.propostas - a.propostas || b.valorPropostas - a.valorPropostas || a.uf.localeCompare(b.uf));

  const compradores = [...vendasPorUf.values()];
  const vendasSemUfResumo = vendasPorUf.get("");
  const propostasAgrupadas = [...propostasPorUf.values()];
  return {
    clientesPrimeiraCompra,
    totalClientesPrimeiraCompra: clientesPorChave.size,
    clientesPrimeiraCompraSemUf: clientesSemUf.size,
    totalOsPrimeiraCompra: compradores.reduce((soma, resumo) => soma + resumo.ordens.size, 0),
    faturamentoPrimeiraCompra: arredondar(compradores.reduce((soma, resumo) => soma + resumo.faturamento, 0)),
    osPrimeiraCompraSemUf: ordensSemUf.size,
    faturamentoPrimeiraCompraSemUf: arredondar(faturamentoSemUf),
    clientesComPropostaAntesDaCompraSemUf: vendasSemUfResumo?.clientesComProposta.size ?? 0,
    propostasAntesDaCompraSemUf: vendasSemUfResumo?.propostasAntesDaCompra.size ?? 0,
    valorPropostasAntesDaCompraSemUf: arredondar(vendasSemUfResumo?.valorPropostasAntesDaCompra ?? 0),
    clientesComPropostaAntesDaCompra: clientesComPropostaAntesDaCompra.size,
    totalPropostasAntesDaCompra: propostasAntesDaCompra.size,
    valorPropostasAntesDaCompra: arredondar(valorPropostasAntesDaCompraTotal),
    propostasNovosClientes,
    totalPropostasNovosClientes: propostasVistas.size,
    valorPropostasNovosClientes: arredondar(valorPropostasTotal),
    propostasNovosClientesSemUf: propostasSemUf.size,
    valorPropostasNovosClientesSemUf: arredondar(valorPropostasSemUf),
    propostasNovosClientesSemValor: propostasSemValor.size,
    propostasNovosClientesComUfSemValor: propostasAgrupadas.reduce((soma, resumo) => soma + resumo.semValor, 0),
  };
}
