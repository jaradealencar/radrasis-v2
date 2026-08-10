/**
 * Helpers puros usados na importação do CSV de transportadoras (Frenet).
 * Extraídos do script para poderem ser cobertos por testes automatizados.
 */

/** Nomes que nunca devem ser importados (exclusão solicitada pelo usuário). */
export const NOMES_BLOQUEADOS = ['loggi'];

/**
 * Normaliza o nome para comparação: remove acentos, caixa, pontuação e
 * sufixos de marketplace como "via Frenet", "[Melhor Envio]", "[Frenet]".
 */
export function normalizarNomeTransportadora(nome: string): string {
  return String(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\bvia\s+frenet\b/g, ' ')
    .replace(/\bvia\s+melhor\s*envio\b/g, ' ')
    .replace(/\b(transportes?|transportadora|logistica|log|express|expresso|cargas?|encomendas?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Indica se o nome está na lista de bloqueio (ex.: Loggi). */
export function estaBloqueado(nome: string): boolean {
  const normalizado = normalizarNomeTransportadora(nome);
  return NOMES_BLOQUEADOS.some(bloqueado => normalizado === bloqueado || normalizado.split(' ').includes(bloqueado));
}

/** Divide uma linha CSV simples (o nome pode conter vírgulas). */
export function parseLinhaCsv(linha: string): [string, string, string] {
  const partes = linha.split(',');
  if (partes.length <= 3) {
    const [nome = '', status = '', tipo = ''] = partes.map(p => p.trim());
    return [nome, status, tipo];
  }
  const tipo = (partes.pop() ?? '').trim();
  const status = (partes.pop() ?? '').trim();
  return [partes.join(',').trim(), status, tipo];
}

/**
 * Decide quais nomes do CSV devem ser inseridos, considerando os já
 * cadastrados e a lista de bloqueio. Retorna também o que foi ignorado.
 */
export function planejarImportacao(nomesCsv: string[], nomesExistentes: string[]) {
  const existentes = new Set(nomesExistentes.map(normalizarNomeTransportadora));
  const inserir: string[] = [];
  const duplicados: string[] = [];
  const bloqueados: string[] = [];

  for (const nome of nomesCsv) {
    const limpo = nome.trim();
    if (!limpo) continue;
    if (estaBloqueado(limpo)) { bloqueados.push(limpo); continue; }
    const chave = normalizarNomeTransportadora(limpo);
    if (!chave) continue;
    if (existentes.has(chave)) { duplicados.push(limpo); continue; }
    existentes.add(chave); // evita duplicidade dentro do próprio CSV
    inserir.push(limpo);
  }

  return { inserir, duplicados, bloqueados };
}
