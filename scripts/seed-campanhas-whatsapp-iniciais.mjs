/**
 * Cria as campanhas de WhatsApp pedidas pelo usuário (27-28/09/2026), já ligadas às fontes ERP quando a fonte
 * existe — as de prospecção externa (Google Maps por estado, Instagram) nascem sem fonte: o usuário ainda vai
 * subir as planilhas (upload) e vincular pela própria tela ("Fontes de dados" → "Gerenciar fontes"). Não
 * inclui "Reativação — Inativos 6+ meses": o usuário já criou essa campanha manualmente em produção (27/09).
 *
 * "Novos clientes do mês" e "Reativados do mês" são recorrentes com frequência de ~30 dias (aproximação —
 * não existe frequência "todo fim de mês" no schema); o usuário pediu para ficarem disponíveis no último dia
 * de cada mês, começando em setembro/2026 — use o Planner (aba Calendário → clicar no dia → "Agendar
 * campanha") para marcar 30/09, 31/10, 30/11 etc. e depois confirmar disparado/não disparado.
 *
 * Idempotente: pula qualquer campanha cujo NOME já exista (não recria, não duplica). Roda contra o banco de
 * DATABASE_URL do ambiente — rode uma vez contra o banco local (validação) e, quando quiser ter essas
 * campanhas no ambiente real, rode de novo com a DATABASE_URL de produção (ou crie pela própria tela, é mais
 * simples: nome + categoria + marcar a fonte, ver docs/campanhas-whatsapp.md).
 *
 * Frequência/quarentena aqui são RASCUNHO (sugestões dos tooltips do formulário) — o usuário disse que vai
 * mandar os números definitivos depois; edite pela tela quando tiver os valores certos.
 *
 * Uso: node scripts/seed-campanhas-whatsapp-iniciais.mjs
 */
import { neonConfig, Pool } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config();
neonConfig.poolQueryViaFetch = true;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** @typedef {{ nome: string, categoria: string, frequenciaDias: number, quarentenaDias: number, fonteChave?: string, observacao: string }} CampanhaSeed */

/** @type {CampanhaSeed[]} */
const CAMPANHAS = [
  {
    nome: "Follow-up — Orçaram e não compraram",
    categoria: "orcamento_perdido",
    frequenciaDias: 20,
    quarentenaDias: 15,
    fonteChave: "erp_orcaram_nao_compraram",
    observacao: "Orçaram mas nunca compraram — todo o histórico (sem limite de janela), decisão do usuário 27/09/2026.",
  },
  {
    nome: "Reengajamento — Compraram 1x e sumiram",
    categoria: "reativacao_inativo",
    frequenciaDias: 75,
    quarentenaDias: 15,
    fonteChave: "erp_compraram_uma_vez_sumiram",
    observacao: "Compraram uma única vez e essa compra já esfriou (6+ meses), nunca recompraram.",
  },
  {
    nome: "Prospecção Google Maps — MS",
    categoria: "outbound",
    frequenciaDias: 30,
    quarentenaDias: 15,
    observacao: "Lista externa (upload) — Mato Grosso do Sul. Suba a planilha em Arquivos/Fontes e vincule.",
  },
  {
    nome: "Prospecção Google Maps — PR",
    categoria: "outbound",
    frequenciaDias: 30,
    quarentenaDias: 15,
    observacao: "Lista externa (upload) — Paraná. Suba a planilha em Arquivos/Fontes e vincule.",
  },
  {
    nome: "Prospecção Google Maps — RS",
    categoria: "outbound",
    frequenciaDias: 30,
    quarentenaDias: 15,
    observacao: "Lista externa (upload) — Rio Grande do Sul. Suba a planilha em Arquivos/Fontes e vincule.",
  },
  {
    nome: "Prospecção Google Maps — SC",
    categoria: "outbound",
    frequenciaDias: 30,
    quarentenaDias: 15,
    observacao: "Lista externa (upload) — Santa Catarina. Suba a planilha em Arquivos/Fontes e vincule.",
  },
  {
    nome: "Leads Instagram — Sem cotação",
    categoria: "outbound",
    frequenciaDias: 15,
    quarentenaDias: 15,
    observacao: "Se interessaram pelo Instagram mas não chegaram a pedir cotação — lista externa (upload).",
  },
  {
    nome: "Clientes com Redução de Volume",
    categoria: "reativacao_inativo",
    frequenciaDias: 30,
    quarentenaDias: 15,
    fonteChave: "erp_reducao_volume",
    observacao: "Compraram menos nos últimos 3 meses do que nos 3 meses anteriores (queda de 30%+). Ainda compram, então é alerta precoce — não confundir com 'Reativação' (quem já parou de vez).",
  },
  {
    nome: "Compraram apenas 1 vez (todo o histórico)",
    categoria: "reativacao_inativo",
    frequenciaDias: 60,
    quarentenaDias: 15,
    fonteChave: "erp_compraram_uma_vez",
    observacao: "Só fizeram 1 compra na vida, sem filtro de data (mais abrangente que 'Compraram 1x e sumiram', que exige 6+ meses parado).",
  },
  {
    nome: "Novos clientes do mês — Agradecimento",
    categoria: "pos_venda",
    frequenciaDias: 30,
    quarentenaDias: 15,
    fonteChave: "erp_novos_do_mes",
    observacao: "Primeira compra da vida caiu no mês corrente — mensagem de agradecimento. Agende pelo Planner (Calendário) para o último dia de cada mês, começando em 30/09/2026.",
  },
  {
    nome: "Clientes Reativados do mês",
    categoria: "reativacao_inativo",
    frequenciaDias: 30,
    quarentenaDias: 15,
    fonteChave: "erp_reativados_do_mes",
    observacao: "Já tinham comprado antes e voltaram este mês, depois de 6+ meses parados. Agende pelo Planner (Calendário) para o último dia de cada mês, começando em 30/09/2026.",
  },
];

async function main() {
  console.log(`Conectando... (${new URL(process.env.DATABASE_URL).hostname})`);

  for (const c of CAMPANHAS) {
    const existente = await pool.query('SELECT id FROM campanhas_whatsapp WHERE nome = $1', [c.nome]);
    if (existente.rows.length) {
      console.log(`↷ já existe, pulando: "${c.nome}" (id ${existente.rows[0].id})`);
      continue;
    }

    const inserida = await pool.query(
      `INSERT INTO campanhas_whatsapp (nome, categoria, descricao, tipo, frequencia_dias, quarentena_dias, status)
       VALUES ($1, $2, $3, 'recorrente', $4, $5, 'ativa') RETURNING id`,
      [c.nome, c.categoria, c.observacao, c.frequenciaDias, c.quarentenaDias],
    );
    const campanhaId = inserida.rows[0].id;
    console.log(`✓ criada: "${c.nome}" (id ${campanhaId})`);

    if (c.fonteChave) {
      const fonte = await pool.query('SELECT id FROM campanhas_whatsapp_fontes WHERE chave = $1', [c.fonteChave]);
      if (fonte.rows.length) {
        await pool.query(
          `INSERT INTO campanhas_whatsapp_campanha_fontes (campanha_id, fonte_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [campanhaId, fonte.rows[0].id],
        );
        console.log(`  ↳ fonte vinculada: ${c.fonteChave}`);
      } else {
        console.warn(`  ⚠ fonte "${c.fonteChave}" não encontrada — rode as migrations (0049/0050) antes.`);
      }
    } else {
      console.log(`  ↳ sem fonte ainda — suba a planilha e vincule pela tela (Fontes de dados).`);
    }
  }

  console.log("\nConcluído.");
}

main()
  .catch(e => { console.error("Falhou:", e); process.exitCode = 1; })
  .finally(() => pool.end());
