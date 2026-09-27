/**
 * Cria as campanhas iniciais de WhatsApp pedidas pelo usuário (27/09/2026), já ligadas às fontes ERP quando
 * a fonte existe — as de prospecção externa (Google Maps por estado, Instagram) nascem sem fonte: o usuário
 * ainda vai subir as planilhas (upload) e vincular pela própria tela ("Fontes de dados" → "Gerenciar fontes").
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
    nome: "Reativação — Inativos 6+ meses",
    categoria: "reativacao_inativo",
    frequenciaDias: 75,
    quarentenaDias: 15,
    fonteChave: "erp_inativos_6m",
    observacao: "Clientes que não compram há 6 meses ou mais (puxado ao vivo do histórico local do ERP).",
  },
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
