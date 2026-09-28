/**
 * Integração com o banco real (o `.env` local aponta para um banco de teste — nunca produção). Usa telefones
 * fictícios 55 67 99000-99xx e apaga tudo o que criou no `afterAll`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray, like } from "drizzle-orm";
import { getDb } from "../db/db";
import { getPool } from "../db/db-connection";
import {
  campanhasWhatsapp, campanhasWhatsappArquivos, campanhasWhatsappCategorias, campanhasWhatsappFontes,
  campanhasWhatsappQuarentena, historicoOs,
} from "../../drizzle/schema";
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
const fontesCriadas: number[] = [];
const arquivosCriados: number[] = [];
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
  // Campanhas primeiro (o cascade leva disparos, gatilhos, contatos_historico e o vínculo com fontes);
  // fontes depois (sem FK das campanhas para elas); arquivos soltos e categorias por último; quarentena no fim.
  if (criadas.length) await db.delete(campanhasWhatsapp).where(inArray(campanhasWhatsapp.id, criadas));
  if (fontesCriadas.length) await db.delete(campanhasWhatsappFontes).where(inArray(campanhasWhatsappFontes.id, fontesCriadas));
  if (arquivosCriados.length) await db.delete(campanhasWhatsappArquivos).where(inArray(campanhasWhatsappArquivos.id, arquivosCriados));
  if (categoriasCriadas.length) await db.delete(campanhasWhatsappCategorias).where(inArray(campanhasWhatsappCategorias.id, categoriasCriadas));
  await db.delete(campanhasWhatsappQuarentena).where(like(campanhasWhatsappQuarentena.telefone, "5567990009%"));
  await db.delete(historicoOs).where(like(historicoOs.empresa, "TESTE FONTE ERP%"));
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

describe("modelos de mensagem por campanha", () => {
  it("adiciona, edita, incrementa cópia e remove (soft delete) — mesmo padrão de crm_scripts/retencao_scripts", async () => {
    const s1 = await admin().addScript({ campanhaId: recorrenteId, titulo: "Abertura", conteudo: "Oi {nome}, tudo bem?" });
    const s2 = await admin().addScript({ campanhaId: recorrenteId, conteudo: "Sem título" });
    expect(s1.ordem).toBeLessThan(s2.ordem);
    expect(s2.titulo).toBeNull();

    let lista = await admin().listScripts({ campanhaId: recorrenteId });
    expect(lista.map(s => s.id)).toEqual([s1.id, s2.id]);

    await admin().updateScript({ id: s1.id, titulo: "Abertura editada", conteudo: "Novo texto" });
    await admin().incrementCopiaScript({ id: s1.id });
    await admin().incrementCopiaScript({ id: s1.id });
    lista = await admin().listScripts({ campanhaId: recorrenteId });
    expect(lista.find(s => s.id === s1.id)).toMatchObject({ titulo: "Abertura editada", conteudo: "Novo texto", copiaCount: 2 });

    await admin().deleteScript({ id: s2.id });
    lista = await admin().listScripts({ campanhaId: recorrenteId });
    expect(lista.map(s => s.id)).toEqual([s1.id]); // soft delete: some da listagem (ativo=false), não é apagado

    await admin().deleteScript({ id: s1.id }); // limpeza
  });

  it("reorderScripts persiste a nova ordem", async () => {
    const a = await admin().addScript({ campanhaId: gatilhoId, conteudo: "A" });
    const b = await admin().addScript({ campanhaId: gatilhoId, conteudo: "B" });
    await admin().reorderScripts({ campanhaId: gatilhoId, orderedIds: [b.id, a.id] });
    const lista = await admin().listScripts({ campanhaId: gatilhoId });
    expect(lista.map(s => s.id)).toEqual([b.id, a.id]);
    await admin().deleteScript({ id: a.id });
    await admin().deleteScript({ id: b.id });
  });

  it("addScript numa campanha inexistente é rejeitado (404)", async () => {
    await expect(admin().addScript({ campanhaId: 999999, conteudo: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("arquivos da campanha (pasta de listas de contatos)", () => {
  it("adiciona, lista (mais recente primeiro) e remove", async () => {
    const a1 = await admin().adicionarArquivo({ campanhaId: recorrenteId, nome: "lista-setembro.xlsx", url: "https://exemplo.com/a1.xlsx", tamanhoBytes: 20480 });
    expect(a1.enviadoPor).toBe("Teste Admin");
    const a2 = await admin().adicionarArquivo({ campanhaId: recorrenteId, nome: "lista-outubro.csv", url: "https://exemplo.com/a2.csv" });
    expect(a2.tamanhoBytes).toBe(0); // default quando não informado

    const lista = await admin().listArquivos({ campanhaId: recorrenteId });
    expect(lista.map(a => a.id)).toEqual([a2.id, a1.id]); // mais recente primeiro

    await admin().removerArquivo({ id: a1.id });
    expect((await admin().listArquivos({ campanhaId: recorrenteId })).map(a => a.id)).toEqual([a2.id]);
    await admin().removerArquivo({ id: a2.id });
  });

  it("adicionarArquivo numa campanha inexistente é rejeitado (404)", async () => {
    await expect(admin().adicionarArquivo({ campanhaId: 999999, nome: "x.csv", url: "https://exemplo.com/x.csv" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("adicionarArquivo sem campanhaId cria um arquivo 'solto' (para virar Fonte reutilizável)", async () => {
    const a = await admin().adicionarArquivo({ nome: "solto.csv", url: "https://exemplo.com/solto.csv" });
    arquivosCriados.push(a.id);
    expect(a.campanhaId).toBeNull();
  });
});

describe("Fontes de Dados (ERP local + arquivo)", () => {
  const TEL_INATIVO = "(67) 99988-0001";
  let fonteInativosId: number;
  let fonteArquivoId: number;
  let arquivoSoltoId: number;
  let campanhaFontesId: number;

  beforeAll(async () => {
    // Empresa fictícia "inativa" (última compra ~8 meses atrás) para exercitar a fonte ERP erp_inativos_6m
    // sem depender do estado real (imprevisível) do banco de teste.
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    const dataAntiga = somarDias(hoje, -240); // ~8 meses
    await db.insert(historicoOs).values({
      osNumero: "TESTE-FONTE-ERP-1", tipoOs: "produto", status: "aprovada", empresa: "TESTE FONTE ERP Inativo",
      dataAprovacao: dataAntiga.split("-").reverse().join("/"), telefone: TEL_INATIVO, mes: Number(dataAntiga.slice(5, 7)), ano: Number(dataAntiga.slice(0, 4)),
    });

    const campanha = await admin().criar({
      nome: "TESTE campanha com fontes", categoria: "reativacao_inativo", tipo: "recorrente", frequenciaDias: 30, quarentenaDias: 0,
    });
    campanhaFontesId = campanha.id;
    criadas.push(campanha.id);
  });

  it("listarFontes traz as 5 fontes ERP pré-cadastradas (seed das migrations 0049/0050)", async () => {
    const fontes = await admin().listarFontes();
    const chaves = fontes.filter(f => f.tipo === "erp").map(f => f.chave);
    expect(chaves).toEqual(expect.arrayContaining([
      "erp_clientes_ativos", "erp_primeira_compra", "erp_inativos_6m", "erp_orcaram_nao_compraram", "erp_compraram_uma_vez_sumiram",
    ]));
    fonteInativosId = fontes.find(f => f.chave === "erp_inativos_6m")!.id;
    expect(fontes.find(f => f.chave === "erp_inativos_6m")!.ativo).toBe(true);
  });

  it("cria fonte tipo arquivo a partir de um arquivo já salvo (solto ou de qualquer campanha)", async () => {
    const arquivo = await admin().adicionarArquivo({ nome: "prospeccao-google-maps.csv", url: "https://exemplo.com/prospeccao.csv" });
    arquivoSoltoId = arquivo.id;
    arquivosCriados.push(arquivo.id);
    const fonte = await admin().criarFonteArquivo({ label: "TESTE Prospecção Google Maps", arquivoId: arquivo.id });
    fonteArquivoId = fonte.id;
    fontesCriadas.push(fonte.id);
    expect(fonte.chave).toBe("teste_prospeccao_google_maps");
    expect(fonte.tipo).toBe("arquivo");

    const fontes = await admin().listarFontes();
    const encontrada = fontes.find(f => f.id === fonte.id)!;
    expect(encontrada.arquivo?.id).toBe(arquivoSoltoId);
  });

  it("criarFonteArquivo com arquivo inexistente é rejeitado (404)", async () => {
    await expect(admin().criarFonteArquivo({ label: "TESTE Fonte Inválida", arquivoId: 999999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("arquivarFonte tira do padrão sem apagar", async () => {
    await admin().arquivarFonte({ id: fonteArquivoId, ativo: false });
    expect((await admin().listarFontes()).find(f => f.id === fonteArquivoId)!.ativo).toBe(false);
    await admin().arquivarFonte({ id: fonteArquivoId, ativo: true }); // reativa para o teste seguinte
  });

  it("vincularFontes/listarFontesDaCampanha: multi-seleção ERP + arquivo na mesma campanha", async () => {
    await admin().vincularFontes({ campanhaId: campanhaFontesId, fonteIds: [fonteInativosId, fonteArquivoId] });
    const vinculadas = await admin().listarFontesDaCampanha({ campanhaId: campanhaFontesId });
    expect(vinculadas.map(f => f.id).sort()).toEqual([fonteInativosId, fonteArquivoId].sort());

    // vincularFontes SUBSTITUI o conjunto — chamar de novo só com uma fonte remove a outra.
    await admin().vincularFontes({ campanhaId: campanhaFontesId, fonteIds: [fonteInativosId] });
    expect((await admin().listarFontesDaCampanha({ campanhaId: campanhaFontesId })).map(f => f.id)).toEqual([fonteInativosId]);
  });

  it("gerarListaDaCampanha sem nenhuma fonte vinculada é rejeitado", async () => {
    const semFontes = await admin().criar({ nome: "TESTE sem fontes", categoria: "outbound", tipo: "recorrente", frequenciaDias: 30, quarentenaDias: 0 });
    criadas.push(semFontes.id);
    await expect(admin().gerarListaDaCampanha({ campanhaId: semFontes.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("gerarListaDaCampanha resolve a fonte ERP e traz a empresa inativa de teste com telefone normalizado", async () => {
    const r = await admin().gerarListaDaCampanha({ campanhaId: campanhaFontesId });
    expect(r.porFonte.some(f => f.total > 0)).toBe(true);
    const encontrado = r.aprovados.find(c => c.nome === "TESTE FONTE ERP Inativo");
    expect(encontrado).toMatchObject({ telefone: "5567999880001" });
  }, 10_000); // recarrega historico_os inteiro — na suíte completa (muita carga concorrente no Neon via
  // HTTP), a latência varia o bastante para estourar o default de 5s à toa.

  it("cadência da campanha: quem acabou de receber ESTA campanha some de gerarListaDaCampanha (mas não de outras)", async () => {
    // gerarListaDaCampanha recarrega o historico_os inteiro (ver carregarContextoErp) — chamado 2x aqui.
    const antes = await admin().gerarListaDaCampanha({ campanhaId: campanhaFontesId });
    const contato = antes.aprovados.find(c => c.nome === "TESTE FONTE ERP Inativo")!;

    await admin().registrarDisparo({ campanhaId: campanhaFontesId, contatos: [{ telefone: contato.telefone, nome: contato.nome }] });

    const depois = await admin().gerarListaDaCampanha({ campanhaId: campanhaFontesId });
    expect(depois.aprovados.some(c => c.nome === "TESTE FONTE ERP Inativo")).toBe(false);
    expect(depois.ignoradosCadenciaCampanha.some(c => c.nome === "TESTE FONTE ERP Inativo")).toBe(true);

    await getPool().query("DELETE FROM campanhas_whatsapp_quarentena WHERE telefone = $1", [contato.telefone]); // limpeza extra
  }, 20_000); // já era o teste mais pesado da suíte (2x gerarListaDaCampanha); rodando a suíte inteira junto
    // com muitos outros testes de banco, a latência do Neon (HTTP) varia o bastante para estourar 15s à toa.
});

describe("duplicarCampanha", () => {
  it("copia categoria/tipo/cadência/quarentena/fontes/scripts sob um nome novo, sem levar arquivos nem histórico", async () => {
    const original = await admin().criar({
      nome: "TESTE Original Para Duplicar", categoria: "outbound", tipo: "recorrente", frequenciaDias: 45, quarentenaDias: 20,
    });
    criadas.push(original.id);

    const fonteInativos = (await admin().listarFontes()).find(f => f.chave === "erp_inativos_6m")!;
    await admin().vincularFontes({ campanhaId: original.id, fonteIds: [fonteInativos.id] });
    await admin().addScript({ campanhaId: original.id, titulo: "TESTE script", conteudo: "Olá {{nome}}, tudo bem?" });
    // Arquivo da pasta da campanha original — não deve aparecer na cópia (cada cópia recebe sua própria lista).
    const arquivo = await admin().adicionarArquivo({ campanhaId: original.id, nome: "lista-original.xlsx", url: "https://exemplo.local/lista-original.xlsx" });
    arquivosCriados.push(arquivo.id);

    const copia = await admin().duplicarCampanha({ id: original.id, novoNome: "TESTE Cópia Duplicada" });
    criadas.push(copia.id);

    expect(copia).toMatchObject({
      nome: "TESTE Cópia Duplicada", categoria: "outbound", tipo: "recorrente",
      frequenciaDias: 45, quarentenaDias: 20, status: "ativa",
    });

    const fontesDaCopia = await admin().listarFontesDaCampanha({ campanhaId: copia.id });
    expect(fontesDaCopia.map(f => f.id)).toEqual([fonteInativos.id]);

    const scriptsDaCopia = await admin().listScripts({ campanhaId: copia.id });
    expect(scriptsDaCopia).toHaveLength(1);
    expect(scriptsDaCopia[0]).toMatchObject({ titulo: "TESTE script", conteudo: "Olá {{nome}}, tudo bem?" });

    const arquivosDaCopia = await admin().listArquivos({ campanhaId: copia.id });
    expect(arquivosDaCopia).toHaveLength(0);

    const historicoDaCopia = await admin().historico({ campanhaId: copia.id });
    expect(historicoDaCopia.disparos).toHaveLength(0);
  });
});

describe("Planner (agendamentos) e relatório por período", () => {
  let campanhaId: number;
  let agendamentoId: number;

  beforeAll(async () => {
    const c = await admin().criar({ nome: "TESTE Relatório Período", categoria: "outbound", tipo: "recorrente", frequenciaDias: 30, quarentenaDias: 0 });
    campanhaId = c.id;
    criadas.push(c.id);
  });

  it("criarAgendamento nasce 'planejado'; listarAgendamentos traz nome/categoria da campanha", async () => {
    const criado = await admin().criarAgendamento({ campanhaId, dataAgendada: dia(3), observacoes: "TESTE lote 1" });
    agendamentoId = criado.id;
    expect(criado).toMatchObject({ campanhaId, dataAgendada: dia(3), status: "planejado", observacoes: "TESTE lote 1" });

    const lista = await admin().listarAgendamentos({ inicio: dia(0), fim: dia(7) });
    const encontrado = lista.find(a => a.id === agendamentoId);
    expect(encontrado).toMatchObject({ nome: "TESTE Relatório Período", categoria: "outbound", status: "planejado" });
  });

  it("marcarAgendamento alterna disparado/não disparado; removerAgendamento apaga", async () => {
    await admin().marcarAgendamento({ id: agendamentoId, status: "disparado" });
    let lista = await admin().listarAgendamentos({ inicio: dia(0), fim: dia(7) });
    expect(lista.find(a => a.id === agendamentoId)?.status).toBe("disparado");

    await admin().marcarAgendamento({ id: agendamentoId, status: "nao_disparado" });
    lista = await admin().listarAgendamentos({ inicio: dia(0), fim: dia(7) });
    expect(lista.find(a => a.id === agendamentoId)?.status).toBe("nao_disparado");

    await admin().removerAgendamento({ id: agendamentoId });
    lista = await admin().listarAgendamentos({ inicio: dia(0), fim: dia(7) });
    expect(lista.find(a => a.id === agendamentoId)).toBeUndefined();
  });

  it("relatorioPeriodo agrega disparos, contatos e agendamentos da campanha dentro do recorte de datas", async () => {
    // Isolado num período bem no passado para não colidir com disparos de outros testes deste arquivo.
    const inicio = dia(-400);
    const fim = dia(-395);
    await disparo(campanhaId, dia(-398), [{ telefone: TEL.E, nome: "Eva" }]);
    const novoAgendamento = await admin().criarAgendamento({ campanhaId, dataAgendada: dia(-397) });

    const r = await admin().relatorioPeriodo({ inicio, fim });
    expect(r.kpis.campanhasAtivas).toBeGreaterThanOrEqual(1);
    expect(r.periodo).toEqual({ inicio, fim });

    const linha = r.porCampanha.find(c => c.id === campanhaId)!;
    expect(linha).toMatchObject({ nome: "TESTE Relatório Período", disparosNoPeriodo: 1, contatosEnviadosNoPeriodo: 1 });
    expect(linha.agendamentos).toEqual([{ id: novoAgendamento.id, dataAgendada: dia(-397), status: "planejado", observacoes: null }]);

    await getPool().query("DELETE FROM campanhas_whatsapp_quarentena WHERE telefone = $1", [norm(TEL.E)]); // limpeza extra
  });

  it("relatorioPeriodo recusa período invertido", async () => {
    await expect(admin().relatorioPeriodo({ inicio: dia(5), fim: dia(0) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
