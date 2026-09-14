import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db/db";
import { crmScripts } from "../../drizzle/schema";

// Scripts de follow-up para as faixas de dias úteis 1 (1-2 DU), 2 (3-5 DU) e
// 3 (6-10 DU) — ver client/src/components/ScriptsFaixaPopover.tsx e o card de
// cada faixa em CRM.tsx. Perfil do cliente considerado: decide rápido, baixa
// escolaridade, público masculino, atendimento por WhatsApp — por isso frases
// curtas, palavras simples, pergunta direta de sim/não em cada mensagem.
const SCRIPTS_POR_FAIXA: Record<1 | 2 | 3, { titulo: string; conteudo: string }[]> = {
  1: [
    {
      titulo: "Reforço direto — tirar dúvida e fechar",
      conteudo: "{nome_cliente}, seu orçamento do {produto} já está pronto ✅ Ficou alguma dúvida sobre material, prazo ou pagamento? Me chama que eu resolvo rapidinho e já deixamos tudo certo.",
    },
    {
      titulo: "Check rápido — já viu a cotação?",
      conteudo: "Oi {nome_cliente}! Passando aqui pra saber se você já deu uma olhada na cotação do {produto}. Posso te ajudar a decidir agora, é rapidinho 👍",
    },
    {
      titulo: "Confirmar e já separar o pedido",
      conteudo: "{nome_cliente}, tudo certo com o orçamento do {produto}? Se estiver de acordo, já posso separar seu pedido e te explico como fica o pagamento.",
    },
  ],
  2: [
    {
      titulo: "Aviso de prazo de produção",
      conteudo: "{nome_cliente}, seu orçamento do {produto} ainda está valendo, mas nossa produção está enchendo rápido essa semana. Quer que eu já garanta seu prazo?",
    },
    {
      titulo: "Ainda não fechamos? Vamos resolver",
      conteudo: "Oi {nome_cliente}! Vi que a gente ainda não fechou o {produto}. Se confirmar hoje ou amanhã, eu garanto que sai dentro do prazo que você precisa. Posso seguir?",
    },
    {
      titulo: "Não perder a vaga na produção",
      conteudo: "{nome_cliente}, não quero que você perca a vaga na produção do {produto}. Bora fechar agora e eu já deixo tudo certinho pra você?",
    },
  ],
  3: [
    {
      titulo: "Ainda tem interesse?",
      conteudo: "{nome_cliente}, já faz um tempo que te mandei o orçamento do {produto} e não tive retorno. Ainda tem interesse? Me avisa que eu resolvo rapidinho pra você.",
    },
    {
      titulo: "Última tentativa de contato",
      conteudo: "Oi {nome_cliente}! Essa é minha última tentativa sobre o {produto} 🙏 Se ainda quiser fechar, me responde hoje que eu garanto sua vaga na produção.",
    },
    {
      titulo: "Orçamento saindo da agenda",
      conteudo: "{nome_cliente}, seu orçamento do {produto} está quase saindo da nossa agenda de produção. Se ainda faz sentido pra você, me chama agora que eu cuido de tudo.",
    },
  ],
};

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Não foi possível conectar ao banco (DATABASE_URL ausente ou inválida).");

  for (const faixaStr of Object.keys(SCRIPTS_POR_FAIXA)) {
    const faixa = Number(faixaStr) as 1 | 2 | 3;
    const scripts = SCRIPTS_POR_FAIXA[faixa];
    for (let i = 0; i < scripts.length; i++) {
      const s = scripts[i];
      const existing = await db.select({ id: crmScripts.id }).from(crmScripts)
        .where(and(eq(crmScripts.faixa, faixa), eq(crmScripts.titulo, s.titulo)));
      if (existing.length > 0) {
        console.log(`Faixa ${faixa}: "${s.titulo}" já existe (id=${existing[0].id}) — pulando.`);
        continue;
      }
      const [inserted] = await db.insert(crmScripts).values({
        faixa,
        ordem: i,
        titulo: s.titulo,
        conteudo: s.conteudo,
      }).returning({ id: crmScripts.id });
      console.log(`Faixa ${faixa}: "${s.titulo}" criado (id=${inserted.id}).`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Falha ao popular scripts de follow-up:", error);
    process.exit(1);
  });
