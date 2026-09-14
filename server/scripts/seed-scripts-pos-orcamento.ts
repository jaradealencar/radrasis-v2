import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db/db";
import { crmScripts } from "../../drizzle/schema";

// Scripts enviados logo após o orçamento, antes do início do ciclo de
// follow-up (faixas 1/2/3) — ver client/src/components/ScriptsFaixaPopover.tsx
// (faixa 0, "Pós-orçamento") e o card correspondente em CRM.tsx.
const FAIXA = 0;
const SCRIPTS: { titulo: string; conteudo: string }[] = [
  {
    titulo: "Direta para o fechamento — minha principal escolha",
    conteudo: "{nome_cliente}, sua cotação está aí 👆 Já deixei material, acabamento e prazo detalhados para você conferir. Vamos confirmar esse pedido? Posso te encaminhar os dados para o pagamento da entrada.",
  },
  {
    titulo: "Para descobrir a objeção e negociar",
    conteudo: "{nome_cliente}, acabei de enviar sua cotação. Quero encontrar o melhor caminho para fecharmos esse projeto: tem algum ponto de valor, pagamento ou prazo que precisamos alinhar para você seguir com a Radra?",
  },
  {
    titulo: "Para puxar a decisão pela data de entrega",
    conteudo: "{nome_cliente}, orçamento enviado! Para esse letreiro chegar na data que você precisa, temos que considerar produção e transporte. Qual é sua data de entrega? Vamos alinhar isso agora e definir a confirmação do pedido.",
  },
  {
    titulo: "Para incentivar uma contraproposta",
    conteudo: "{nome_cliente}, orçamento enviado! Para esse letreiro chegar na data que você precisa, temos que considerar produção e transporte. Qual é sua data de entrega? Vamos alinhar isso agora e definir a confirmação do pedido.",
  },
];

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Não foi possível conectar ao banco (DATABASE_URL ausente ou inválida).");

  for (let i = 0; i < SCRIPTS.length; i++) {
    const s = SCRIPTS[i];
    const existing = await db.select({ id: crmScripts.id }).from(crmScripts)
      .where(and(eq(crmScripts.faixa, FAIXA), eq(crmScripts.titulo, s.titulo)));
    if (existing.length > 0) {
      console.log(`Script "${s.titulo}" já existe (id=${existing[0].id}) — pulando.`);
      continue;
    }
    const [inserted] = await db.insert(crmScripts).values({
      faixa: FAIXA,
      ordem: i,
      titulo: s.titulo,
      conteudo: s.conteudo,
    }).returning({ id: crmScripts.id });
    console.log(`Script "${s.titulo}" criado (id=${inserted.id}).`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Falha ao popular scripts de pós-orçamento:", error);
    process.exit(1);
  });
