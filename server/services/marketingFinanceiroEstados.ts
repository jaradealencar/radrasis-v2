const UFS_VALIDAS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export interface ClientePrimeiraCompraEstado {
  clienteKey: string;
  estado: string | null;
}

export interface PropostaClienteNovoEstado {
  id: number;
  orcNumero: string | null;
  clienteKey: string;
  estado: string | null;
}

function normalizarUf(estado: string | null): string | null {
  const uf = estado?.trim().toUpperCase() ?? "";
  return UFS_VALIDAS.has(uf) ? uf : null;
}

/** Resume a origem dos clientes da primeira compra e das propostas emitidas
 * antes de uma compra anterior, sem inferir UF por telefone/DDD. */
export function resumirEstadosNovos(
  clientes: ClientePrimeiraCompraEstado[],
  propostas: PropostaClienteNovoEstado[],
) {
  const clientesPorUf = new Map<string, Set<string>>();
  const clientesSemUf = new Set<string>();
  const clientesVistos = new Set<string>();

  for (const cliente of clientes) {
    const chave = cliente.clienteKey.trim();
    if (!chave || clientesVistos.has(chave)) continue;
    clientesVistos.add(chave);
    const uf = normalizarUf(cliente.estado);
    if (!uf) {
      clientesSemUf.add(chave);
      continue;
    }
    const conjunto = clientesPorUf.get(uf) ?? new Set<string>();
    conjunto.add(chave);
    clientesPorUf.set(uf, conjunto);
  }

  const propostasPorUf = new Map<string, { chaves: Set<string>; clientes: Set<string> }>();
  const propostasSemUf = new Set<string>();
  const propostasVistas = new Set<string>();

  for (const proposta of propostas) {
    const numero = proposta.orcNumero?.trim();
    const chave = numero ? `orc:${numero}` : `id:${proposta.id}`;
    if (propostasVistas.has(chave)) continue;
    propostasVistas.add(chave);

    const uf = normalizarUf(proposta.estado);
    if (!uf) {
      propostasSemUf.add(chave);
      continue;
    }
    const resumo = propostasPorUf.get(uf) ?? { chaves: new Set<string>(), clientes: new Set<string>() };
    resumo.chaves.add(chave);
    if (proposta.clienteKey) resumo.clientes.add(proposta.clienteKey);
    propostasPorUf.set(uf, resumo);
  }

  return {
    clientesPrimeiraCompra: [...clientesPorUf.entries()]
      .map(([uf, clientesUf]) => ({ uf, clientes: clientesUf.size }))
      .sort((a, b) => b.clientes - a.clientes || a.uf.localeCompare(b.uf)),
    totalClientesPrimeiraCompra: clientesVistos.size,
    clientesPrimeiraCompraSemUf: clientesSemUf.size,
    propostasNovosClientes: [...propostasPorUf.entries()]
      .map(([uf, resumo]) => ({ uf, propostas: resumo.chaves.size, clientes: resumo.clientes.size }))
      .sort((a, b) => b.propostas - a.propostas || a.uf.localeCompare(b.uf)),
    totalPropostasNovosClientes: propostasVistas.size,
    propostasNovosClientesSemUf: propostasSemUf.size,
  };
}
