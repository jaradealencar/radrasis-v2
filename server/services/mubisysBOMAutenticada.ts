type Recorde = Record<string, unknown>;

const normalizarChave = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const escalar = (valor: unknown) => valor == null || ["string", "number", "boolean"].includes(typeof valor);

function numero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  const texto = valor.trim().replace(/\s/g, "");
  if (!texto) return null;
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const resultado = Number(normalizado);
  return Number.isFinite(resultado) ? resultado : null;
}

function texto(valor: unknown): string {
  return valor == null ? "" : String(valor).trim();
}

function camposEscalares(valor: Recorde): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  const visitar = (item: Recorde, prefixo = "", nivel = 0) => {
    if (nivel > 4) return;
    for (const [chave, filho] of Object.entries(item)) {
      const caminho = prefixo ? `${prefixo}.${chave}` : chave;
      if (escalar(filho)) saida[normalizarChave(caminho)] = filho;
      else if (filho && typeof filho === "object" && !Array.isArray(filho)) visitar(filho as Recorde, caminho, nivel + 1);
    }
  };
  visitar(valor);
  return saida;
}

function campo(campos: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    const chave = normalizarChave(alias);
    const encontrado = Object.entries(campos).find(([nome]) => nome === chave || nome.endsWith(chave));
    if (encontrado) return encontrado[1];
  }
  return undefined;
}

function listaAnexa(registro: Recorde, tipo: "acabamento" | "equipamento"): unknown[] {
  const chavesAnexo = tipo === "acabamento"
    ? new Set(["acabamento", "acabamentos", "finish", "finishes", "finishings", "adjunto", "adjuntos", "servico", "servicos", "service", "services", "processo", "processos", "processes", "itensacabamento", "composicaoacabamento", "composicaoacabamentos"])
    : new Set(["equipamento", "equipamentos", "maquina", "maquinas", "machine", "machines", "recurso", "recursos", "resource", "resources"]);
  const encontrados: unknown[] = [];
  const adicionar = (valor: unknown, nivel = 0) => {
    if (nivel > 4) return;
    if (Array.isArray(valor)) { for (const item of valor) adicionar(item, nivel + 1); return; }
    if (!valor || typeof valor !== "object") { if (typeof valor === "string" && valor.trim()) encontrados.push(valor); return; }
    const objeto = valor as Recorde;
    const wrapper = Object.entries(objeto).find(([chave, filho]) =>
      /^(data|dados|items|itens|rows|registros|lista|result|resultado|acabamentos|equipamentos)$/i.test(normalizarChave(chave)) &&
      filho && typeof filho === "object"
    );
    if (wrapper) adicionar(wrapper[1], nivel + 1); else encontrados.push(objeto);
  };
  const visitar = (objeto: Recorde, nivel: number) => {
    if (nivel > 2) return;
    for (const [chave, valor] of Object.entries(objeto)) {
      const normalizada = normalizarChave(chave);
      if (chavesAnexo.has(normalizada)) {
        if (typeof valor === "string" && valor.trim()) {
          try { adicionar(JSON.parse(valor)); } catch { adicionar(valor); }
        } else adicionar(valor);
      } else if (valor && typeof valor === "object" && !Array.isArray(valor)) visitar(valor as Recorde, nivel + 1);
    }
  };
  visitar(registro, 0);
  return encontrados;
}

function mapearAnexo(valor: unknown, indice: number, tipo: "acabamento" | "equipamento"): Recorde {
  const registro: Recorde = valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Recorde : {};
  const campos = camposEscalares(registro);
  const ler = (aliases: string[]) => campo(campos, aliases);
  const id = numero(ler(tipo === "acabamento"
    ? ["mubisys_acabamento_id", "acabamento_id", "id_acabamento", "id"]
    : ["mubisys_equipamento_id", "equipamento_id", "id_equipamento", "maquina_id", "id"]));
  const nome = texto(ler(tipo === "acabamento"
    ? ["acabamento_nome", "nome", "name", "titulo", "descricao"]
    : ["equipamento_nome", "maquina_nome", "nome", "name", "titulo", "descricao"]));
  if (!id || id <= 0 || !nome) {
    throw new Error(`${tipo === "acabamento" ? "Acabamento" : "Equipamento"} ${indice + 1} sem ID MubiSys ou nome legível; a importação foi interrompida.`);
  }
  if (tipo === "acabamento") {
    const tipoCalculoBruto = texto(ler(["tipo_calculo", "tipo_calculo_nome", "unidade_calculo", "base_calculo", "calculo"]));
    const unidade = texto(ler(["unidade", "unidade_medida"]));
    const chave = normalizarChave(tipoCalculoBruto || unidade);
    const tipoCalculo = chave.includes("m2") || chave.includes("metroquadrado") || chave.includes("area") ? "metro quadrado"
      : ["mt", "m", "ml", "metro", "metrolinear"].includes(chave) || chave.includes("metrolinear") ? "metro linear"
      : ["un", "unidade", "peca", "pecas", "porpeca"].includes(chave) || chave.includes("porpeca") ? "por unidade"
      : tipoCalculoBruto || unidade || "";
    return {
      id, nome, tipo: texto(ler(["tipo", "categoria"])), unidade,
      custo_mp: ler(["custo_materia_prima", "custo_mp", "custoMP"]),
      custo_mo: ler(["custo_mao_de_obra", "custo_mo", "custoMO"]),
      custo_adicional: ler(["custo_adicional", "custo_total", "valor_total", "valor"]),
      tipo_calculo: tipoCalculo,
      quantidade: ler(["quantidade", "multiplicador", "consumo"]) ?? 1,
      produtividade_hora: ler(["produtividade_hora", "unidades_por_hora", "pecas_hora"]),
      horas_equipamento: ler(["horas_equipamento", "horas_maquina", "tempo_horas"]),
      ordem: ler(["ordem", "sequencia", "posicao"]) ?? indice,
    };
  }
  return {
    id, nome, tipo: texto(ler(["tipo", "categoria"])),
    custo_hora: ler(["custo_hora", "valor_hora", "custo_por_hora"]),
    horas: ler(["horas", "horas_equipamento", "tempo_horas", "duracao_horas"]) ?? 0,
    quantidade: ler(["quantidade", "multiplicador"]) ?? 1,
    ordem: ler(["ordem", "sequencia", "posicao"]) ?? indice,
  };
}

function textoHtml(valor: string): string {
  return valor.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ").trim();
}

function registrosHtml(html: string): Recorde[] {
  const saida: Recorde[] = [];
  for (const tabela of html.match(/<table\b[\s\S]*?<\/table>/gi) ?? []) {
    const linhas = [...tabela.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    if (linhas.length < 2) continue;
    const celulas = (linha: string) => [...linha.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(item => textoHtml(item[1]));
    const cabecalho = celulas(linhas[0][1]);
    if (!cabecalho.some(item => /materia|material/i.test(item)) || !cabecalho.some(item => /quantidade|consumo|qtd/i.test(item))) continue;
    for (const linha of linhas.slice(1)) {
      const valores = celulas(linha[1]);
      const registro: Recorde = {};
      cabecalho.forEach((nome, i) => { if (nome && valores[i] !== undefined) registro[nome] = valores[i]; });
      saida.push(registro);
    }
  }
  return saida;
}

/** Converte o AJAX autenticado da ficha técnica para o contrato transacional do importador do espelho. */
export function parsearComposicoesMubiSys(conteudo: unknown): Recorde[] {
  let raiz = conteudo;
  if (typeof raiz === "string") {
    const html = raiz;
    try { raiz = JSON.parse(html); }
    catch { raiz = registrosHtml(html); }
  }
  const saida: Recorde[] = [];
  const chavesAcabamento = new Set(["acabamento", "acabamentos", "finish", "finishings", "adjuntos", "processos", "servicos", "itensacabamento"]);
  const chavesEquipamento = new Set(["equipamento", "equipamentos", "maquina", "maquinas", "machines", "recursos"]);
  const visitar = (valor: unknown, herdados: Record<string, unknown> = {}, nivel = 0) => {
    if (nivel > 12) return;
    if (Array.isArray(valor)) { for (const item of valor) visitar(item, herdados, nivel + 1); return; }
    if (!valor || typeof valor !== "object") return;
    const registro = valor as Recorde;
    const campos = { ...herdados, ...camposEscalares(registro) };
    const modeloId = numero(campo(campos, ["mubisys_modelo_id", "modelo_id", "id_modelo", "model_id", "modeloid", "idmod"]));
    const variacaoId = numero(campo(campos, ["mubisys_variacao_id", "variacao_id", "id_variacao", "variation_id", "variacaoid", "idvariante"]));
    const materiaPrimaId = numero(campo(campos, ["mubisys_materia_prima_id", "materia_prima_id", "id_materia_prima", "materiaPrimaId", "idmaterial", "material_id"]));
    const quantidade = numero(campo(campos, ["consumo_quantidade", "quantidade_consumo", "quantidade", "consumo", "qtd", "qtde"]));
    if (materiaPrimaId != null && materiaPrimaId > 0 && quantidade != null && quantidade > 0 && (modeloId != null || variacaoId != null)) {
      const acabamentoRegs = listaAnexa(registro, "acabamento");
      const equipamentoRegs = listaAnexa(registro, "equipamento");
      const perfil = texto(campo(campos, ["perfil_consumo_mubisys", "perfil_consumo", "perfil", "tipo_consumo", "forma_consumo", "regra_calculo", "base_calculo", "formula_consumo"]));
      const linha: Recorde = {
        mubisys_modelo_id: modeloId,
        mubisys_variacao_id: variacaoId,
        mubisys_materia_prima_id: materiaPrimaId,
        materia_prima_nome: texto(campo(campos, ["materia_prima_nome", "nome_materia_prima", "material_nome", "nome_material"])),
        unidade_consumo: texto(campo(campos, ["unidade_consumo", "unidade", "unidade_medida", "unidade_consumo_mp"])),
        consumo_quantidade: quantidade,
        perfil_consumo_mubisys: perfil,
        formula_consumo: texto(campo(campos, ["formula_cpq"])),
        largura_mm: campo(campos, ["largura_mm", "largura"]),
        altura_mm: campo(campos, ["altura_mm", "altura"]),
        espessura_mm: campo(campos, ["espessura_mm", "espessura"]),
        descritivo_composicao: texto(campo(campos, ["descritivo_composicao", "descritivo", "descricao_composicao"])),
        ordem: numero(campo(campos, ["ordem", "sequencia", "posicao"])) ?? saida.length,
        acabamentos: acabamentoRegs.map((item, i) => mapearAnexo(item, i, "acabamento")),
        equipamentos: equipamentoRegs.map((item, i) => mapearAnexo(item, i, "equipamento")),
      };
      saida.push(linha);
      return;
    }
    for (const [chave, filho] of Object.entries(registro)) {
      if (chavesAcabamento.has(normalizarChave(chave)) || chavesEquipamento.has(normalizarChave(chave))) continue;
      if (filho && typeof filho === "object") visitar(filho, campos, nivel + 1);
    }
  };
  visitar(raiz);
  if (!saida.length) throw new Error("O MubiSys respondeu, mas o formato da ficha técnica não foi reconhecido. Nenhuma alteração foi gravada; use o importador CSV/JSON ou revise o parser.");
  if (saida.length > 10_000) throw new Error("A ficha técnica ultrapassou o limite de 10.000 linhas por sincronização.");
  return saida;
}