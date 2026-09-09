/**
 * Higienização de base de contatos — valida se cada número tem WhatsApp
 * ativo, em cascata por 4 APIs (Z-API → Evolution API → Whapi.cloud → Wassenger).
 *
 * COMO USAR:
 * 1. Abra a planilha no Google Sheets.
 * 2. Extensões > Apps Script, cole este arquivo inteiro.
 * 3. Preencha as chaves na seção CONFIG abaixo.
 * 4. Ajuste CONFIG.ABA_ORIGEM e CONFIG.COLUNA_TELEFONE se necessário.
 * 5. Rode a função `validarWhatsApp` (menu Executar > validarWhatsApp).
 * 6. Na primeira execução o Google vai pedir autorização (é normal, o script
 *    só acessa esta planilha e faz chamadas HTTP às 4 APIs configuradas).
 *
 * COMPORTAMENTO (decisão de projeto — leia antes de rodar):
 * Em vez de apagar linhas direto na planilha original, o script gera duas
 * abas novas: uma só com os números confirmados com WhatsApp (a "lista limpa"
 * pedida) e outra com os removidos, para auditoria. A planilha original
 * NUNCA é alterada. Isso evita perda de dado caso as 4 APIs falhem ao mesmo
 * tempo — nesse caso (esgotada a cascata sem nenhuma resposta), a linha é
 * enviada para uma terceira aba "Revisar manualmente" em vez de descartada
 * como se fosse inválida. Se você realmente preferir apagar linhas na
 * planilha original em vez de gerar abas novas, veja `MODO_DESTRUTIVO` no
 * final do arquivo.
 */

// ─── CONFIG — preencha suas chaves aqui ──────────────────────────────────────
const CONFIG = {
  // Nome da aba de origem e da coluna (letra ou cabeçalho) que tem o telefone
  ABA_ORIGEM: "Celular (válidos)",
  COLUNA_TELEFONE_HEADER: "Telefone", // nome do cabeçalho na primeira linha

  // Ordem da cascata — pode reordenar, remover, ou deixar chave vazia p/ pular
  ORDEM_CASCATA: ["zapi", "evolution", "whapi", "wassenger"],

  ZAPI: {
    INSTANCE: "",       // ID da instância Z-API
    TOKEN: "",          // Token da instância
    CLIENT_TOKEN: "",   // Client-Token da conta (obrigatório em contas novas)
  },
  EVOLUTION: {
    BASE_URL: "",        // ex: "https://sua-instancia.evolution-api.com"
    INSTANCE: "",        // nome da instância criada na Evolution API
    API_KEY: "",         // apikey global ou da instância
  },
  WHAPI: {
    TOKEN: "",           // token do canal (Bearer)
    BASE_URL: "https://gate.whapi.cloud",
  },
  WASSENGER: {
    API_KEY: "",         // Token gerado no painel da Wassenger
  },

  PAUSA_ENTRE_CHAMADAS_MS: 400, // evita bater limite de taxa das APIs
};

// ─── Ponto de entrada ─────────────────────────────────────────────────────────
function validarWhatsApp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaOrigem = ss.getSheetByName(CONFIG.ABA_ORIGEM);
  if (!abaOrigem) throw new Error(`Aba "${CONFIG.ABA_ORIGEM}" não encontrada.`);

  const dados = abaOrigem.getDataRange().getValues();
  const cabecalho = dados[0];
  const colTelefone = cabecalho.indexOf(CONFIG.COLUNA_TELEFONE_HEADER);
  if (colTelefone === -1) {
    throw new Error(`Coluna "${CONFIG.COLUNA_TELEFONE_HEADER}" não encontrada no cabeçalho.`);
  }

  const validos = [cabecalho.concat(["Status WhatsApp", "Validado via"])];
  const removidos = [cabecalho.concat(["Status WhatsApp", "Validado via"])];
  const revisar = [cabecalho.concat(["Status WhatsApp", "Validado via"])];

  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];
    const telefoneOriginal = linha[colTelefone];
    const telefone = normalizaTelefone_(telefoneOriginal);

    if (!telefone) {
      Logger.log(`Linha ${i + 1}: telefone vazio/inválido ("${telefoneOriginal}") — enviada p/ revisar manualmente.`);
      revisar.push(linha.concat(["sem_telefone_valido", "-"]));
      continue;
    }

    const resultado = checarWhatsApp_(telefone);
    Utilities.sleep(CONFIG.PAUSA_ENTRE_CHAMADAS_MS);

    if (resultado.existe === true) {
      Logger.log(`Linha ${i + 1} (${telefone}): TEM WhatsApp — validado via ${resultado.api}.`);
      validos.push(linha.concat(["tem_whatsapp", resultado.api]));
    } else if (resultado.existe === false) {
      Logger.log(`Linha ${i + 1} (${telefone}): SEM WhatsApp — validado via ${resultado.api}. Linha removida da lista limpa.`);
      removidos.push(linha.concat(["sem_whatsapp", resultado.api]));
    } else {
      Logger.log(`Linha ${i + 1} (${telefone}): INCONCLUSIVO — todas as APIs da cascata falharam. Enviada p/ revisar manualmente.`);
      revisar.push(linha.concat(["inconclusivo", "nenhuma_respondeu"]));
    }
  }

  escreverAba_(ss, "WhatsApp - Válidos", validos);
  escreverAba_(ss, "WhatsApp - Removidos (sem WhatsApp)", removidos);
  escreverAba_(ss, "WhatsApp - Revisar manualmente", revisar);

  Logger.log(`Concluído. Válidos: ${validos.length - 1} | Removidos: ${removidos.length - 1} | Revisar: ${revisar.length - 1}`);
}

function escreverAba_(ss, nome, linhas) {
  let aba = ss.getSheetByName(nome);
  if (aba) ss.deleteSheet(aba);
  aba = ss.insertSheet(nome);
  if (linhas.length > 1) {
    aba.getRange(1, 1, linhas.length, linhas[0].length).setValues(linhas);
  } else {
    aba.getRange(1, 1, 1, linhas[0].length).setValues([linhas[0]]);
  }
}

// ─── Normalização de telefone (DDI 55 + só dígitos) ──────────────────────────
function normalizaTelefone_(raw) {
  if (!raw) return null;
  let digitos = String(raw).replace(/\D/g, "");
  if (!digitos) return null;
  // remove DDI 55 duplicado ou zero inicial de discagem
  if (digitos.startsWith("0")) digitos = digitos.replace(/^0+/, "");
  if (!digitos.startsWith("55")) digitos = "55" + digitos;
  // Um celular BR válido com DDI: 55 + DDD(2) + 9 + 8 dígitos = 13 dígitos
  if (digitos.length !== 13) return null;
  return digitos;
}

// ─── Cascata de verificação ───────────────────────────────────────────────────
function checarWhatsApp_(telefoneComDdi) {
  const cascata = {
    zapi: checarZApi_,
    evolution: checarEvolution_,
    whapi: checarWhapi_,
    wassenger: checarWassenger_,
  };

  for (const nomeApi of CONFIG.ORDEM_CASCATA) {
    const fn = cascata[nomeApi];
    if (!fn) continue;
    try {
      const r = fn(telefoneComDdi);
      if (r.ok) return { existe: r.existe, api: nomeApi };
      Logger.log(`  [${nomeApi}] não deu resposta conclusiva (${r.motivo || "erro"}); tentando próxima API da cascata...`);
    } catch (e) {
      Logger.log(`  [${nomeApi}] erro: ${e.message}; tentando próxima API da cascata...`);
    }
  }
  return { existe: null, api: "nenhuma" };
}

// Cada checarX_ retorna { ok: bool, existe: bool|null, motivo?: string }
// ok=false significa "essa API não respondeu de forma confiável, tente a próxima".

function checarZApi_(telefone) {
  const { INSTANCE, TOKEN, CLIENT_TOKEN } = CONFIG.ZAPI;
  if (!INSTANCE || !TOKEN) return { ok: false, existe: null, motivo: "sem credenciais configuradas" };

  const url = `https://api.z-api.io/instances/${INSTANCE}/token/${TOKEN}/phone-exists/${telefone}`;
  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    headers: CLIENT_TOKEN ? { "Client-Token": CLIENT_TOKEN } : {},
    muteHttpExceptions: true,
  });
  const codigo = resp.getResponseCode();
  if (codigo >= 400) return { ok: false, existe: null, motivo: `HTTP ${codigo}` };

  const json = JSON.parse(resp.getContentText());
  // Z-API costuma responder { exists: true/false } — confirme no seu painel/doc atual.
  if (typeof json.exists === "boolean") return { ok: true, existe: json.exists };
  return { ok: false, existe: null, motivo: "formato de resposta inesperado" };
}

function checarEvolution_(telefone) {
  const { BASE_URL, INSTANCE, API_KEY } = CONFIG.EVOLUTION;
  if (!BASE_URL || !INSTANCE || !API_KEY) return { ok: false, existe: null, motivo: "sem credenciais configuradas" };

  const url = `${BASE_URL.replace(/\/$/, "")}/chat/whatsappNumbers/${INSTANCE}`;
  const resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { apikey: API_KEY },
    payload: JSON.stringify({ numbers: [telefone] }),
    muteHttpExceptions: true,
  });
  const codigo = resp.getResponseCode();
  if (codigo >= 400) return { ok: false, existe: null, motivo: `HTTP ${codigo}` };

  const json = JSON.parse(resp.getContentText());
  // Evolution API costuma responder uma lista: [{ exists: true/false, jid, number }]
  const item = Array.isArray(json) ? json[0] : json;
  if (item && typeof item.exists === "boolean") return { ok: true, existe: item.exists };
  return { ok: false, existe: null, motivo: "formato de resposta inesperado" };
}

function checarWhapi_(telefone) {
  const { TOKEN, BASE_URL } = CONFIG.WHAPI;
  if (!TOKEN) return { ok: false, existe: null, motivo: "sem credenciais configuradas" };

  const url = `${BASE_URL.replace(/\/$/, "")}/contacts/check`;
  const resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${TOKEN}` },
    payload: JSON.stringify({ contacts: [telefone] }),
    muteHttpExceptions: true,
  });
  const codigo = resp.getResponseCode();
  if (codigo >= 400) return { ok: false, existe: null, motivo: `HTTP ${codigo}` };

  const json = JSON.parse(resp.getContentText());
  // Formato pode variar bastante entre versões do Whapi — verifique a doc atual.
  // Tenta alguns formatos plausíveis defensivamente:
  const item = (json.contacts && json.contacts[0]) || (Array.isArray(json) ? json[0] : json);
  if (item) {
    if (typeof item.valid === "boolean") return { ok: true, existe: item.valid };
    if (typeof item.exists === "boolean") return { ok: true, existe: item.exists };
    if (typeof item.status === "string") return { ok: true, existe: item.status === "valid" };
  }
  return { ok: false, existe: null, motivo: "formato de resposta inesperado" };
}

function checarWassenger_(telefone) {
  const { API_KEY } = CONFIG.WASSENGER;
  if (!API_KEY) return { ok: false, existe: null, motivo: "sem credenciais configuradas" };

  const url = `https://api.wassenger.com/v1/numbers/exists?phone=${encodeURIComponent("+" + telefone)}`;
  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { Token: API_KEY },
    muteHttpExceptions: true,
  });
  const codigo = resp.getResponseCode();
  if (codigo >= 400) return { ok: false, existe: null, motivo: `HTTP ${codigo}` };

  const json = JSON.parse(resp.getContentText());
  if (typeof json.exists === "boolean") return { ok: true, existe: json.exists };
  return { ok: false, existe: null, motivo: "formato de resposta inesperado" };
}

/**
 * MODO_DESTRUTIVO (opcional): se você preferir apagar linhas sem WhatsApp
 * direto na planilha original (como o prompt original pedia), troque a
 * chamada de `validarWhatsApp()` por esta função. Ela reaproveita a mesma
 * cascata de checagem, mas deleta linhas da própria ABA_ORIGEM de baixo
 * para cima (senão os índices bagunçam). NÃO tem desfazer — faça uma cópia
 * da planilha antes de rodar isto.
 */
function validarWhatsAppModoDestrutivo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(CONFIG.ABA_ORIGEM);
  if (!aba) throw new Error(`Aba "${CONFIG.ABA_ORIGEM}" não encontrada.`);

  const dados = aba.getDataRange().getValues();
  const cabecalho = dados[0];
  const colTelefone = cabecalho.indexOf(CONFIG.COLUNA_TELEFONE_HEADER);
  if (colTelefone === -1) throw new Error(`Coluna "${CONFIG.COLUNA_TELEFONE_HEADER}" não encontrada.`);

  const linhasParaRemover = [];

  for (let i = 1; i < dados.length; i++) {
    const telefone = normalizaTelefone_(dados[i][colTelefone]);
    if (!telefone) continue; // sem telefone válido — mantém, não deleta por engano
    const resultado = checarWhatsApp_(telefone);
    Utilities.sleep(CONFIG.PAUSA_ENTRE_CHAMADAS_MS);
    if (resultado.existe === false) {
      Logger.log(`Linha ${i + 1} será removida (${telefone}, via ${resultado.api}).`);
      linhasParaRemover.push(i + 1); // +1 porque getValues é 0-index e a planilha é 1-index
    }
  }

  linhasParaRemover.sort((a, b) => b - a).forEach(numLinha => aba.deleteRow(numLinha));
  Logger.log(`${linhasParaRemover.length} linha(s) removida(s) da aba "${CONFIG.ABA_ORIGEM}".`);
}
