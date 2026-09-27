/**
 * Integração com o banco real (o `.env` local aponta para um banco de teste — nunca produção). Usa telefones
 * fictícios 55 67 99000-99xx e apaga tudo o que criou no `afterAll`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray, like } from "drizzle-orm";
import { getDb } from "../db/db";
import { getPool } from "../db/db-connection";
import { campanhasWhatsapp, campanhasWhatsappCategorias, campanhasWhatsappQuarentena } from "../../drizzle/schema";
import { hojeCampoGrande, somarDias } from "../../shared/campanhas-whatsapp";
import { campanhasWhatsappRouter, checarQuarentenaNoBanco, registrarDisparoNoBanco } from "../routers/campanhasWhatsapp";

const hoje = hojeCampoGrande();
const dia = (n: number) => somarDias(hoje, n);
const TEL = { A: "(67) 99000-9901", B: "(67) 99000-9902", C: "(67) 99000-9903", D: "(67) 99000-9904", E: "(67) 99000-9905" };
const norm = (t: string) => `55${t.replace(/\D/g, "")}`;

const ctxAdmin: any = { user: { id: "t1", name: "Teste Admin", email: "t@x.com", role: "admin" }, req: {}, res: {} };
const ctxVendas: any = { user: { id: "t2", name: "Teste Vendas", email: "v@x.com", role: "vendas" }, req: {}, res: {} };
const admin = () => campanhasWhatsappRouter.createCaller(ctxAdmin);

const criadas: number[] = [];
const categoriasCriadas: number[] = [];
let recorrenteId: number;
let gatilhoId: number;

async function ultimoContato(telefone: string): Promise<string | null> {
  const r = await getPool().query(
    "SELECT ultimo_contato_em::text AS u FROM campanhas_whatsapp_quarentena WHERE telefone = $1", [norm(telefone)],
  );
  return r.rows[0]?.u ?? null;
}

const disparo = (campanhaId: number, dataEnvio: string, contatos: Array<{ telefone: string; nome?: string; osNumero?: string }>, aplicarQuarentena = true) =>
  registrarDisparoNoBanco({ campanhaId, dataEnvio, contatos, origem: "app", registradoPor: "Teste", aplicarQuarentena });

beforeAll(async () => {
  const a = await admin().criar({ nome: "TESTE recorrente", categoria: "reativacao_inativo", tipo: "recorrente", frequenciaDias: 15, quarentenaDias: 30 });
  const b = await admin().criar({ nome: "TESTE pós-venda", categoria: "pos_venda", tipo: "gatilho_venda", frequenciaDias: 30, quarentenaDias: 30, gatilhoAPartirDe: dia(-15) });
  recorrenteId = a.id;
  gatilhoId = b.id;
  criadas.push(a.id, b.id);
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  // Campanhas primeiro (o cascade leva disparos e gatilhos); categorias depois (sem FK entre as duas, mas a
  // ordem evita deixar categoria "em uso" órfã se algum teste falhar no meio); quarentena por último.
  if (criadas.length) await db.delete(campanhasWhatsapp).where(inArray(campanhasWhatsapp.id, criadas));
  if (categoriasCriadas.length) await db.delete(campanhasWhatsappCategorias).where(inArray(campanhasWhatsappCategorias.id, categoriasCriadas));
  await db.delete(campanhasWhatsappQuarentena).where(like(campanhasWhatsappQuarentena.telefone, "5567990009%"));
});

describe("registrarDisparoNoBanco", () => {
  it("1º disparo: normaliza, remove duplicado/inválido e grava log + quarentena + próxima data", async () => {
    const r = await disparo(recorrenteId, dia(-20), [
      { telefone: TEL.A, nome: "Ana" },
      { telefone: TEL.B, nome: "Bia" },
      { telefone: "67 99000-9901", nome: "Ana repetida" },
      { telefone: "123", nome: "Lixo" },
    ]);
    expect(r).toMatchObject({ registrado: true, recebidos: 4, enviados: 2, ignorados: 0, invalidos: 2, proximaData: dia(-5) });
    expect(r.enviar.map(c => c.telefone)).toEqual([norm(TEL.A), norm(TEL.B)]);
    expect(await ultimoContato(TEL.A)).toBe(dia(-20));
  });

  it("2º disparo: quem recebeu há menos de 30 dias é ignorado por quarentena e não é regravado", async () => {
    const r = await disparo(recorrenteId, dia(-10), [{ telefone: TEL.A, nome: "Ana" }, { telefone: TEL.C, nome: "Caio" }]);
    expect(r).toMatchObject({ registrado: true, enviados: 1, ignorados: 1, invalidos: 0 });
    expect(r.ignoradosQuarentena[0]).toMatchObject({ telefone: norm(TEL.A), ultimoContatoEm: dia(-20), disponivelEm: dia(10) });
    expect(await ultimoContato(TEL.A)).toBe(dia(-20)); // A não foi contatada de novo
    expect(await ultimoContato(TEL.C)).toBe(dia(-10));
  });

  it("registro retroativo não faz a quarentena recuar no tempo", async () => {
    // B foi contatada em dia(-20); um disparo antigo (dia(-60)) passa (40 dias de folga) mas não pode apagar o contato mais recente.
    const r = await disparo(recorrenteId, dia(-60), [{ telefone: TEL.B, nome: "Bia" }]);
    expect(r.enviados).toBe(1);
    expect(await ultimoContato(TEL.B)).toBe(dia(-20));
  });

  it("modo webhook (aplicarQuarentena=false): registra tudo que é válido e apenas reporta a violação", async () => {
    const r = await disparo(recorrenteId, dia(-5), [{ telefone: TEL.A, nome: "Ana" }, { telefone: TEL.D, nome: "Duda" }], false);
    expect(r).toMatchObject({ registrado: true, enviados: 2, ignorados: 0, violacoesQuarentena: 1 });
    expect(await ultimoContato(TEL.A)).toBe(dia(-5)); // a quarentena avança: quem recebeu de fato fica registrado
  });

  it("se ninguém pode ser enviado, nada é gravado (o próximo envio não é adiado à toa)", async () => {
    const antes = await admin().historico({ campanhaId: recorrenteId });
    const r = await disparo(recorrenteId, hoje, [{ telefone: TEL.A, nome: "Ana" }]);
    expect(r).toMatchObject({ registrado: false, disparoId: null, enviados: 0, ignorados: 1 });
    const depois = await admin().historico({ campanhaId: recorrenteId });
    expect(depois.disparos).toHaveLength(antes.disparos.length);
  });

  it("recusa data futura e campanha pausada", async () => {
    await expect(disparo(recorrenteId, dia(2), [{ telefone: TEL.E }])).rejects.toThrow(/futuro/);
    await admin().atualizar({ id: recorrenteId, status: "pausada" });
    await expect(disparo(recorrenteId, hoje, [{ telefone: TEL.E }])).rejects.toThrow(/pausada/);
    await admin().atualizar({ id: recorrenteId, status: "ativa" });
  });

  it("gatilho de venda: só as OS dos contatos enviados viram 'contatadas'; a ignorada por quarentena segue pendente", async () => {
    const r = await disparo(gatilhoId, hoje, [
      { telefone: TEL.E, nome: "Eva", osNumero: "TESTE-OS-1" },
      { telefone: TEL.A, nome: "Ana", osNumero: "TESTE-OS-2" }, // A está em quarentena (contato em dia(-5))
    ]);
    expect(r).toMatchObject({ enviados: 1, ignorados: 1, proximaData: null });
    const g = await getPool().query("SELECT os_numero FROM campanhas_whatsapp_gatilhos WHERE campanha_id = $1", [gatilhoId]);
    expect(g.rows.map((x: any) => x.os_numero)).toEqual(["TESTE-OS-1"]);
  });
});

describe("checarQuarentenaNoBanco", () => {
  it("classifica em quarentena, disponível e inválido", async () => {
    const r = await checarQuarentenaNoBanco([TEL.A, "(67) 99000-9999", "abc"], 30, hoje);
    expect(r.resultados.map(x => [x.emQuarentena, !!x.telefone])).toEqual([[true, true], [false, true], [false, false]]);
    expect(r.resumo).toEqual({ total: 3, emQuarentena: 1, disponiveis: 1, invalidos: 1 });
    expect(r.resultados[0]).toMatchObject({ ultimoContatoEm: dia(-5), disponivelEm: dia(25) });
  });

  it("quarentenaDias = 0 nunca bloqueia", async () => {
    const r = await checarQuarentenaNoBanco([TEL.A], 0, hoje);
    expect(r.resultados[0].emQuarentena).toBe(false);
  });
});

describe("router (tRPC)", () => {
  it("listar traz a campanha recorrente com o último envio e a frequência aplicada", async () => {
    const { campanhas, resumo } = await admin().listar();
    const c = campanhas.find(x => x.id === recorrenteId)!;
    expect(c.ultimoEnvio).toBe(dia(-5));
    expect(c.proximoEnvio).toBe(dia(10)); // último envio + 15
    expect(c.semaforo).toBe("verde");
    expect(c.primeiroDisparoPendente).toBe(false);
    expect(resumo.ativas).toBeGreaterThanOrEqual(2);
  });

  it("editar a frequência muda o próximo envio e o semáforo na hora", async () => {
    await admin().atualizar({ id: recorrenteId, frequenciaDias: 5 });
    const { campanhas } = await admin().listar();
    const c = campanhas.find(x => x.id === recorrenteId)!;
    expect(c.proximoEnvio).toBe(hoje);
    expect(c.semaforo).toBe("vermelho");
  });

  it("calendário traz disparos executados e datas previstas", async () => {
    const { eventos } = await admin().calendario({ inicio: dia(-30), fim: dia(30) });
    const mine = eventos.filter(e => e.campanhaId === recorrenteId);
    expect(mine.filter(e => e.evento === "executado").length).toBeGreaterThanOrEqual(3);
    expect(mine.some(e => e.evento === "previsto")).toBe(true);
    await expect(admin().calendario({ inicio: dia(-30), fim: dia(60) })).rejects.toThrow(/Intervalo/);
  });

  it("pós-venda: recusa consulta de vendas numa campanha recorrente e responde na de gatilho", async () => {
    await expect(admin().vendasPosVenda({ campanhaId: recorrenteId })).rejects.toThrow(/gatilho/);
    const r = await admin().vendasPosVenda({ campanhaId: gatilhoId });
    expect(r.totalPendentes).toBeGreaterThanOrEqual(0);
    expect(r.pendentes.length).toBeLessThanOrEqual(500);
  });

  it("role fora de admin/master/gestor é barrada no servidor", async () => {
    await expect(campanhasWhatsappRouter.createCaller(ctxVendas).listar()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(campanhasWhatsappRouter.createCaller({ ...ctxVendas, user: null }).listar()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("categorias (editáveis pelo usuário)", () => {
  it("cria com slug derivado do label; label repetido ganha sufixo numérico no slug", async () => {
    const a = await admin().criarCategoria({ label: "TESTE Categoria" });
    const b = await admin().criarCategoria({ label: "TESTE Categoria" });
    categoriasCriadas.push(a.id, b.id);
    expect(a.chave).toBe("teste_categoria");
    expect(b.chave).toBe("teste_categoria_2");
    expect(a.ativo).toBe(true);
  });

  it("renomear muda só o label — a chave gravada nas campanhas continua igual", async () => {
    const c = await admin().criarCategoria({ label: "TESTE Renomear" });
    categoriasCriadas.push(c.id);
    await admin().renomearCategoria({ id: c.id, label: "TESTE Renomeada" });
    const atual = (await admin().listarCategorias()).find(x => x.id === c.id)!;
    expect(atual.label).toBe("TESTE Renomeada");
    expect(atual.chave).toBe(c.chave);
  });

  it("arquivar tira do padrão sem apagar; reativar devolve", async () => {
    const c = await admin().criarCategoria({ label: "TESTE Arquivar" });
    categoriasCriadas.push(c.id);
    await admin().arquivarCategoria({ id: c.id, ativo: false });
    expect((await admin().listarCategorias()).find(x => x.id === c.id)!.ativo).toBe(false);
    await admin().arquivarCategoria({ id: c.id, ativo: true });
    expect((await admin().listarCategorias()).find(x => x.id === c.id)!.ativo).toBe(true);
  });

  it("criar (ou editar) campanha com categoria que não existe é rejeitado", async () => {
    const camposBase = { nome: "TESTE categoria invalida", tipo: "recorrente" as const, frequenciaDias: 30, quarentenaDias: 0 };
    await expect(admin().criar({ ...camposBase, categoria: "chave-inexistente-xyz" })).rejects.toThrow(/[Cc]ategoria/);
    await expect(admin().atualizar({ id: recorrenteId, categoria: "chave-inexistente-xyz" })).rejects.toThrow(/[Cc]ategoria/);
  });

  it("listarCategorias reporta quantas campanhas usam cada uma; exclusão só é permitida sem nenhum uso", async () => {
    const usada = await admin().criarCategoria({ label: "TESTE Em Uso" });
    const semUso = await admin().criarCategoria({ label: "TESTE Sem Uso" });
    categoriasCriadas.push(usada.id, semUso.id);

    const camp = await admin().criar({ nome: "TESTE usa categoria", categoria: usada.chave, tipo: "recorrente", frequenciaDias: 10, quarentenaDias: 0 });
    criadas.push(camp.id);

    const lista = await admin().listarCategorias();
    expect(lista.find(x => x.id === usada.id)!.emUso).toBe(1);
    expect(lista.find(x => x.id === semUso.id)!.emUso).toBe(0);

    await expect(admin().excluirCategoria({ id: usada.id })).rejects.toThrow(/arquive/i);

    await admin().excluirCategoria({ id: semUso.id });
    expect((await admin().listarCategorias()).some(x => x.id === semUso.id)).toBe(false);
    categoriasCriadas.splice(categoriasCriadas.indexOf(semUso.id), 1); // já excluída — não precisa (nem pode) limpar de novo
  });
});
