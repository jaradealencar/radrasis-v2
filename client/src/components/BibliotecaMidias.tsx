import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown, ChevronUp, Copy, Check, Eye, FolderPlus, ImagePlus, Images, Loader2, Pencil, Search, Trash2, UploadCloud,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  blobParaBase64, converterParaPng, dataUrlParaBlob, formatarTamanho, gerarMiniatura, mensagemDeErroEnvio, tituloDoArquivo,
} from "@/lib/imagemPng";

const CHAVE_ABERTA = "crm_biblioteca_midias_aberta";
const TIPO_ARRASTE = "application/x-midia-id"; // arrastar um cartão para a aba de uma galeria

/** Aba selecionada: todas as imagens, só as sem galeria, ou uma galeria (id). */
type Selecao = "todas" | "sem" | number;

function lerAberta(): boolean {
  try { return localStorage.getItem(CHAVE_ABERTA) !== "0"; } catch { return true; }
}

/**
 * Biblioteca de mídias do CRM: o arsenal de imagens da equipe, organizado em galerias. Clicar numa
 * imagem COPIA o arquivo para a área de transferência — é só apertar Ctrl+V na conversa do
 * WhatsApp. Aceita subir várias imagens de uma vez (botão ou arrastando para cá) e mover imagens
 * entre galerias arrastando o cartão para a aba; tudo vira PNG reduzido no navegador.
 */
export function BibliotecaMidias() {
  const utils = trpc.useUtils();
  const [aberta, setAberta] = useState(lerAberta);
  const [busca, setBusca] = useState("");
  const [selecao, setSelecao] = useState<Selecao>("todas");
  const [enviando, setEnviando] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const [alvoDrop, setAlvoDrop] = useState<Selecao | null>(null);
  const [copiadaId, setCopiadaId] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [editando, setEditando] = useState<{ id: number; titulo: string; galeriaId: number | null } | null>(null);
  const [excluindo, setExcluindo] = useState<{ id: number; titulo: string } | null>(null);
  const [dialogGaleria, setDialogGaleria] = useState<{ id: number | null; nome: string } | null>(null);
  const [excluindoGaleria, setExcluindoGaleria] = useState<{ id: number; nome: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Imagens inteiras já pedidas ao servidor (a listagem só traz miniaturas). Guarda a promessa
  // para que passar o mouse (pré-carga) e clicar (copiar) compartilhem a mesma busca.
  const blobs = useRef(new Map<number, Promise<Blob>>());

  const { data, isLoading } = trpc.midiasBiblioteca.list.useQuery(undefined, { staleTime: 60 * 1000 });
  const itens = data?.itens ?? [];
  const galerias = data?.galerias ?? [];
  const nomeDaGaleria = (id: number | null) => galerias.find(g => g.id === id)?.nome ?? null;
  const galeriaAtual = typeof selecao === "number" ? galerias.find(g => g.id === selecao) ?? null : null;

  const adicionar = trpc.midiasBiblioteca.add.useMutation();
  const atualizar = trpc.midiasBiblioteca.update.useMutation({
    onSuccess: () => { utils.midiasBiblioteca.list.invalidate(); setEditando(null); toast.success("Imagem atualizada."); },
    onError: e => toast.error(e.message),
  });
  const mover = trpc.midiasBiblioteca.update.useMutation({
    onSuccess: (_r, vars) => {
      utils.midiasBiblioteca.list.invalidate();
      toast.success(vars.galeriaId == null ? "Imagem movida para \"Sem galeria\"." : `Imagem movida para a galeria "${nomeDaGaleria(vars.galeriaId) ?? ""}".`);
    },
    onError: e => toast.error(e.message),
  });
  const remover = trpc.midiasBiblioteca.remover.useMutation({
    onSuccess: (_r, vars) => {
      blobs.current.delete(vars.id);
      utils.midiasBiblioteca.list.invalidate();
      setExcluindo(null);
      toast.success("Imagem excluída.");
    },
    onError: e => toast.error(e.message),
  });
  const registrarUso = trpc.midiasBiblioteca.registrarUso.useMutation();
  const criarGaleria = trpc.midiasBiblioteca.criarGaleria.useMutation({
    onSuccess: r => { utils.midiasBiblioteca.list.invalidate(); setDialogGaleria(null); setSelecao(r.id); toast.success("Galeria criada. As próximas imagens que você adicionar entram nela."); },
    onError: e => toast.error(e.message),
  });
  const renomearGaleria = trpc.midiasBiblioteca.renomearGaleria.useMutation({
    onSuccess: () => { utils.midiasBiblioteca.list.invalidate(); setDialogGaleria(null); toast.success("Galeria renomeada."); },
    onError: e => toast.error(e.message),
  });
  const excluirGaleria = trpc.midiasBiblioteca.excluirGaleria.useMutation({
    onSuccess: () => { utils.midiasBiblioteca.list.invalidate(); setExcluindoGaleria(null); setSelecao("todas"); toast.success("Galeria excluída. As imagens continuam na biblioteca."); },
    onError: e => toast.error(e.message),
  });

  const contagem = useMemo(() => {
    const porGaleria = new Map<number, number>();
    let sem = 0;
    for (const i of itens) {
      if (i.galeriaId == null) sem++;
      else porGaleria.set(i.galeriaId, (porGaleria.get(i.galeriaId) ?? 0) + 1);
    }
    return { porGaleria, sem };
  }, [itens]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter(i => {
      if (selecao === "sem" && i.galeriaId != null) return false;
      if (typeof selecao === "number" && i.galeriaId !== selecao) return false;
      if (!termo) return true;
      const galeria = galerias.find(g => g.id === i.galeriaId)?.nome ?? "";
      return i.titulo.toLowerCase().includes(termo) || galeria.toLowerCase().includes(termo);
    });
  }, [itens, galerias, busca, selecao]);

  function alternar() {
    const nova = !aberta;
    setAberta(nova);
    try { localStorage.setItem(CHAVE_ABERTA, nova ? "1" : "0"); } catch { /* sem armazenamento: só não lembra */ }
  }

  // Busca a imagem inteira (uma vez por imagem) como Blob PNG
  function obterBlob(id: number): Promise<Blob> {
    let p = blobs.current.get(id);
    if (!p) {
      p = utils.midiasBiblioteca.getImagem.fetch({ id }, { staleTime: 10 * 60 * 1000 })
        .then(r => dataUrlParaBlob(r.dataUrl));
      p.catch(() => blobs.current.delete(id)); // falhou: deixa tentar de novo no próximo clique
      blobs.current.set(id, p);
    }
    return p;
  }

  async function copiar(item: { id: number; titulo: string }) {
    try {
      // O Blob pode ainda estar a caminho: o navegador aceita uma Promise no ClipboardItem, o que
      // mantém a cópia dentro do "gesto" do clique mesmo com a imagem sendo baixada.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": obterBlob(item.id) })]);
      setCopiadaId(item.id);
      setTimeout(() => setCopiadaId(atual => (atual === item.id ? null : atual)), 4000);
      registrarUso.mutate({ id: item.id });
      toast.success(`"${item.titulo}" copiada! Na conversa, aperte Ctrl+V.`, { duration: 6000 });
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      console.error("[Biblioteca de mídias] não consegui copiar:", erro);
      toast.error(`Não consegui copiar a imagem (${motivo}).`, { duration: 10000 });
    }
  }

  async function adicionarArquivos(arquivos: File[]) {
    const imagens = arquivos.filter(a => a.type.startsWith("image/"));
    if (imagens.length === 0) {
      toast.error("Escolha arquivos de imagem (PNG, JPG ou WEBP).");
      return;
    }
    const galeriaId = typeof selecao === "number" ? selecao : null; // entra na galeria que está aberta
    setEnviando(imagens.length);
    let enviadas = 0;
    const falhas: string[] = [];
    for (const arquivo of imagens) {
      try {
        const png = await converterParaPng(arquivo);
        const [base64, miniatura] = await Promise.all([blobParaBase64(png.blob), gerarMiniatura(png.blob)]);
        const titulo = tituloDoArquivo(arquivo.name);
        await adicionar.mutateAsync({ titulo, galeriaId, nomeArquivo: `${titulo}.png`.slice(0, 200), base64, miniatura });
        enviadas++;
      } catch (erro) {
        falhas.push(`${arquivo.name}: ${mensagemDeErroEnvio(erro, "erro desconhecido")}`);
      }
      setEnviando(n => n - 1);
    }
    await utils.midiasBiblioteca.list.invalidate();
    if (enviadas > 0) {
      const onde = galeriaAtual ? ` na galeria "${galeriaAtual.nome}"` : "";
      toast.success(`${enviadas} imagem${enviadas > 1 ? "ns adicionadas" : " adicionada"}${onde}.`);
    }
    if (falhas.length > 0) toast.error(falhas.join("\n"), { duration: 12000 });
  }

  // Aba que recebe o cartão arrastado (galeria ou "Sem galeria")
  function propsDrop(alvo: Selecao) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(TIPO_ARRASTE) || alvo === "todas") return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setAlvoDrop(alvo);
      },
      onDragLeave: () => setAlvoDrop(atual => (atual === alvo ? null : atual)),
      onDrop: (e: React.DragEvent) => {
        const idTexto = e.dataTransfer.getData(TIPO_ARRASTE);
        setAlvoDrop(null);
        if (!idTexto || alvo === "todas") return;
        e.preventDefault();
        e.stopPropagation();
        const item = itens.find(i => i.id === Number(idTexto));
        const destino = alvo === "sem" ? null : alvo;
        if (item && item.galeriaId !== destino) mover.mutate({ id: item.id, titulo: item.titulo, galeriaId: destino });
      },
    };
  }

  function abaClasse(chave: Selecao) {
    const ativa = selecao === chave;
    const alvo = alvoDrop === chave;
    return `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
      alvo ? "border-green-600 bg-green-100 text-green-800 ring-2 ring-green-400"
        : ativa ? "border-green-600 bg-green-600 text-white"
        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-green-400 hover:bg-green-50"}`;
  }

  const totalBytes = data?.totalBytes ?? 0;

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm transition-colors ${arrastando ? "border-green-500 bg-green-50 ring-2 ring-green-300" : "border-slate-200"}`}
      onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setArrastando(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false); }}
      onDrop={e => { if (!e.dataTransfer.types.includes("Files")) return; e.preventDefault(); setArrastando(false); adicionarArquivos(Array.from(e.dataTransfer.files)); }}
    >
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" onClick={alternar} className="flex items-center gap-2 text-left" title={aberta ? "Recolher" : "Expandir"}>
          <Images className="h-4 w-4 text-green-600" />
          <span className="text-sm font-semibold text-slate-800">Biblioteca de mídias</span>
          <Badge variant="secondary" className="text-[10px]">{itens.length}</Badge>
          {aberta ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        <span className="hidden text-xs text-slate-400 md:inline">
          Clique numa imagem para copiar e aperte Ctrl+V na conversa do WhatsApp.
        </span>
        <div className="ml-auto flex items-center gap-2">
          {aberta && itens.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar imagem..." className="h-8 w-44 pl-7 text-xs" />
            </div>
          )}
          <Button size="sm" className="h-8 gap-1.5 bg-green-600 text-xs hover:bg-green-700" onClick={() => inputRef.current?.click()} disabled={enviando > 0}>
            {enviando > 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            {enviando > 0 ? `Enviando (${enviando})...` : galeriaAtual ? `Adicionar em "${galeriaAtual.nome.length > 14 ? galeriaAtual.nome.slice(0, 14) + "…" : galeriaAtual.nome}"` : "Adicionar imagens"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={e => { const arquivos = Array.from(e.target.files ?? []); e.target.value = ""; if (arquivos.length) adicionarArquivos(arquivos); }}
          />
        </div>
      </div>

      {aberta && (
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
          {/* Galerias */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Galerias</span>
            <button type="button" className={abaClasse("todas")} onClick={() => setSelecao("todas")}>Todas ({itens.length})</button>
            {galerias.map(g => (
              <button key={g.id} type="button" className={abaClasse(g.id)} onClick={() => setSelecao(g.id)} {...propsDrop(g.id)}>
                {g.nome} ({contagem.porGaleria.get(g.id) ?? 0})
              </button>
            ))}
            {(contagem.sem > 0 || alvoDrop === "sem") && galerias.length > 0 && (
              <button type="button" className={abaClasse("sem")} onClick={() => setSelecao("sem")} {...propsDrop("sem")}>
                Sem galeria ({contagem.sem})
              </button>
            )}
            <button
              type="button"
              onClick={() => setDialogGaleria({ id: null, nome: "" })}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-green-500 px-2.5 py-0.5 text-[11px] font-medium text-green-700 transition-colors hover:bg-green-50"
            >
              <FolderPlus className="h-3 w-3" /> Nova galeria
            </button>
          </div>

          {galeriaAtual && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
              <span>Galeria <strong className="text-slate-700">{galeriaAtual.nome}</strong> — as imagens novas entram aqui.</span>
              <button type="button" onClick={() => setDialogGaleria({ id: galeriaAtual.id, nome: galeriaAtual.nome })} className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-700">
                <Pencil className="h-3 w-3" /> Renomear
              </button>
              <button type="button" onClick={() => setExcluindoGaleria({ id: galeriaAtual.id, nome: galeriaAtual.nome })} className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600">
                <Trash2 className="h-3 w-3" /> Excluir galeria
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando biblioteca...
            </div>
          ) : itens.length === 0 ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-8 text-slate-500 transition-colors hover:border-green-400 hover:bg-green-50"
            >
              <UploadCloud className="h-8 w-8" />
              <span className="text-sm font-medium">A biblioteca está vazia</span>
              <span className="text-xs">Clique aqui ou arraste as imagens (PNG, JPG ou WEBP) para adicionar{galeriaAtual ? ` à galeria "${galeriaAtual.nome}"` : ""}</span>
            </button>
          ) : filtrados.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              {busca.trim() ? "Nenhuma imagem encontrada." : galeriaAtual ? "Esta galeria está vazia. Adicione imagens ou arraste cartões de outra galeria para cá." : "Nenhuma imagem aqui."}
            </p>
          ) : (
            <div className="grid max-h-[26rem] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {filtrados.map(item => {
                const copiada = copiadaId === item.id;
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData(TIPO_ARRASTE, String(item.id)); e.dataTransfer.effectAllowed = "move"; }}
                    className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => copiar(item)}
                      onMouseEnter={() => { obterBlob(item.id).catch(() => {}); }} // pré-carrega: o clique copia na hora
                      onFocus={() => { obterBlob(item.id).catch(() => {}); }}
                      className="relative block aspect-square w-full bg-slate-100"
                      title="Clique para copiar a imagem (ou arraste para outra galeria)"
                    >
                      <img src={item.miniatura} alt={item.titulo} className="h-full w-full object-contain" loading="lazy" draggable={false} />
                      <span className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1 text-[11px] font-semibold text-white transition-opacity ${
                        copiada ? "bg-green-600 opacity-100" : "bg-black/60 opacity-0 group-hover:opacity-100"
                      }`}>
                        {copiada ? <><Check className="h-3 w-3" /> Copiada!</> : <><Copy className="h-3 w-3" /> Copiar</>}
                      </span>
                    </button>
                    <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button type="button" title="Ampliar" onClick={() => setPreviewId(item.id)} className="rounded bg-white/90 p-1 text-slate-600 shadow hover:text-green-700"><Eye className="h-3.5 w-3.5" /></button>
                      <button type="button" title="Renomear / mudar de galeria" onClick={() => setEditando({ id: item.id, titulo: item.titulo, galeriaId: item.galeriaId })} className="rounded bg-white/90 p-1 text-slate-600 shadow hover:text-blue-700"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" title="Excluir" onClick={() => setExcluindo({ id: item.id, titulo: item.titulo })} className="rounded bg-white/90 p-1 text-slate-600 shadow hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="truncate text-xs font-medium text-slate-700" title={item.titulo}>{item.titulo}</div>
                      <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400">
                        <span className="truncate">{nomeDaGaleria(item.galeriaId) ?? "Sem galeria"}</span>
                        {item.usos > 0 && <span title={`Copiada ${item.usos} vez(es)`}>{item.usos}×</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {data && itens.length > 0 && (
            <p className="text-[10px] text-slate-400">
              {itens.length} de {data.limiteItens} imagens · {formatarTamanho(totalBytes)} de {formatarTamanho(data.limiteBytes)} · arraste um cartão para a aba de uma galeria para movê-lo · arraste arquivos para cá para adicionar
            </p>
          )}
        </div>
      )}

      {/* Ampliar */}
      <PreviewMidia id={previewId} titulo={itens.find(i => i.id === previewId)?.titulo} onClose={() => setPreviewId(null)} onCopiar={() => { const i = itens.find(x => x.id === previewId); if (i) copiar(i); }} />

      {/* Renomear imagem / mudar de galeria */}
      <Dialog open={!!editando} onOpenChange={aberto => { if (!aberto) setEditando(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar imagem</DialogTitle></DialogHeader>
          {editando && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Título</label>
                <Input value={editando.titulo} onChange={e => setEditando({ ...editando, titulo: e.target.value })} maxLength={160} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Galeria</label>
                <select
                  value={editando.galeriaId ?? ""}
                  onChange={e => setEditando({ ...editando, galeriaId: e.target.value === "" ? null : Number(e.target.value) })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">Sem galeria</option>
                  {galerias.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button
              disabled={!editando || editando.titulo.trim().length === 0 || atualizar.isPending}
              onClick={() => editando && atualizar.mutate({ id: editando.id, titulo: editando.titulo, galeriaId: editando.galeriaId })}
            >
              {atualizar.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Criar / renomear galeria */}
      <Dialog open={!!dialogGaleria} onOpenChange={aberto => { if (!aberto) setDialogGaleria(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{dialogGaleria?.id == null ? "Nova galeria" : "Renomear galeria"}</DialogTitle></DialogHeader>
          {dialogGaleria && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Nome da galeria</label>
              <Input
                value={dialogGaleria.nome}
                onChange={e => setDialogGaleria({ ...dialogGaleria, nome: e.target.value })}
                onKeyDown={e => {
                  if (e.key !== "Enter" || dialogGaleria.nome.trim().length === 0) return;
                  if (dialogGaleria.id == null) criarGaleria.mutate({ nome: dialogGaleria.nome });
                  else renomearGaleria.mutate({ id: dialogGaleria.id, nome: dialogGaleria.nome });
                }}
                maxLength={60}
                placeholder="Ex.: Institucional, Produtos, Promoções"
                autoFocus
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogGaleria(null)}>Cancelar</Button>
            <Button
              disabled={!dialogGaleria || dialogGaleria.nome.trim().length === 0 || criarGaleria.isPending || renomearGaleria.isPending}
              onClick={() => {
                if (!dialogGaleria) return;
                if (dialogGaleria.id == null) criarGaleria.mutate({ nome: dialogGaleria.nome });
                else renomearGaleria.mutate({ id: dialogGaleria.id, nome: dialogGaleria.nome });
              }}
            >
              {dialogGaleria?.id == null ? "Criar galeria" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão da imagem */}
      <AlertDialog open={!!excluindo} onOpenChange={aberto => { if (!aberto) setExcluindo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imagem?</AlertDialogTitle>
            <AlertDialogDescription>
              "{excluindo?.titulo}" sai da biblioteca para toda a equipe. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => excluindo && remover.mutate({ id: excluindo.id })}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar exclusão da galeria (as imagens ficam) */}
      <AlertDialog open={!!excluindoGaleria} onOpenChange={aberto => { if (!aberto) setExcluindoGaleria(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a galeria "{excluindoGaleria?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              As imagens dela NÃO são apagadas: continuam na biblioteca, em "Sem galeria".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => excluindoGaleria && excluirGaleria.mutate({ id: excluindoGaleria.id })}>
              Excluir galeria
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Imagem em tamanho grande (busca o arquivo inteiro só quando abre). */
function PreviewMidia({ id, titulo, onClose, onCopiar }: { id: number | null; titulo?: string; onClose: () => void; onCopiar: () => void }) {
  const { data, isLoading } = trpc.midiasBiblioteca.getImagem.useQuery({ id: id ?? 0 }, { enabled: id !== null, staleTime: 10 * 60 * 1000 });
  return (
    <Dialog open={id !== null} onOpenChange={aberto => { if (!aberto) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{titulo ?? "Imagem"}</DialogTitle></DialogHeader>
        {isLoading && <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {data && <img src={data.dataUrl} alt={titulo} className="mx-auto max-h-[68vh] w-auto rounded border border-slate-200" />}
        <DialogFooter>
          <Button className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={onCopiar}><Copy className="h-4 w-4" /> Copiar imagem</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
