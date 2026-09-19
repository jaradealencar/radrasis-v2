import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Copy, Check, Eye, ImagePlus, Images, Loader2, Pencil, Search, Trash2, UploadCloud } from "lucide-react";
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

function lerAberta(): boolean {
  try { return localStorage.getItem(CHAVE_ABERTA) !== "0"; } catch { return true; }
}

/**
 * Biblioteca de mídias do CRM: o arsenal de imagens da equipe. Clicar numa imagem COPIA o arquivo
 * para a área de transferência — é só apertar Ctrl+V na conversa do WhatsApp. Aceita subir várias
 * imagens de uma vez (botão ou arrastando para cá); tudo vira PNG reduzido no navegador.
 */
export function BibliotecaMidias() {
  const utils = trpc.useUtils();
  const [aberta, setAberta] = useState(lerAberta);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const [copiadaId, setCopiadaId] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [editando, setEditando] = useState<{ id: number; titulo: string; categoria: string } | null>(null);
  const [excluindo, setExcluindo] = useState<{ id: number; titulo: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Imagens inteiras já pedidas ao servidor (a listagem só traz miniaturas). Guarda a promessa
  // para que passar o mouse (pré-carga) e clicar (copiar) compartilhem a mesma busca.
  const blobs = useRef(new Map<number, Promise<Blob>>());

  const { data, isLoading } = trpc.midiasBiblioteca.list.useQuery(undefined, { staleTime: 60 * 1000 });
  const itens = data?.itens ?? [];

  const adicionar = trpc.midiasBiblioteca.add.useMutation();
  const atualizar = trpc.midiasBiblioteca.update.useMutation({
    onSuccess: () => { utils.midiasBiblioteca.list.invalidate(); setEditando(null); toast.success("Imagem atualizada."); },
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

  const categorias = useMemo(
    () => Array.from(new Set(itens.map(i => i.categoria).filter((c): c is string => !!c))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [itens],
  );
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter(i =>
      (!categoriaFiltro || i.categoria === categoriaFiltro) &&
      (!termo || i.titulo.toLowerCase().includes(termo) || (i.categoria ?? "").toLowerCase().includes(termo)));
  }, [itens, busca, categoriaFiltro]);

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
    setEnviando(imagens.length);
    let enviadas = 0;
    const falhas: string[] = [];
    for (const arquivo of imagens) {
      try {
        const png = await converterParaPng(arquivo);
        const [base64, miniatura] = await Promise.all([blobParaBase64(png.blob), gerarMiniatura(png.blob)]);
        const titulo = tituloDoArquivo(arquivo.name);
        await adicionar.mutateAsync({
          titulo, categoria: categoriaFiltro, nomeArquivo: `${titulo}.png`.slice(0, 200), base64, miniatura,
        });
        enviadas++;
      } catch (erro) {
        falhas.push(`${arquivo.name}: ${mensagemDeErroEnvio(erro, "erro desconhecido")}`);
      }
      setEnviando(n => n - 1);
    }
    await utils.midiasBiblioteca.list.invalidate();
    if (enviadas > 0) toast.success(`${enviadas} imagem${enviadas > 1 ? "ns adicionadas" : " adicionada"} à biblioteca.`);
    if (falhas.length > 0) toast.error(falhas.join("\n"), { duration: 12000 });
  }

  const totalBytes = data?.totalBytes ?? 0;

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm transition-colors ${arrastando ? "border-green-500 bg-green-50 ring-2 ring-green-300" : "border-slate-200"}`}
      onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setArrastando(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false); }}
      onDrop={e => { e.preventDefault(); setArrastando(false); adicionarArquivos(Array.from(e.dataTransfer.files)); }}
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
            {enviando > 0 ? `Enviando (${enviando})...` : "Adicionar imagens"}
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
          {/* Filtro por categoria */}
          {categorias.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {[null, ...categorias].map(c => (
                <button
                  key={c ?? "todas"}
                  type="button"
                  onClick={() => setCategoriaFiltro(c)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    categoriaFiltro === c
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-green-400 hover:bg-green-50"
                  }`}
                >
                  {c ?? "Todas"}
                </button>
              ))}
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
              <span className="text-xs">Clique aqui ou arraste as imagens (PNG, JPG ou WEBP) para adicionar</span>
            </button>
          ) : filtrados.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nenhuma imagem encontrada.</p>
          ) : (
            <div className="grid max-h-[26rem] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {filtrados.map(item => {
                const copiada = copiadaId === item.id;
                return (
                  <div key={item.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => copiar(item)}
                      onMouseEnter={() => { obterBlob(item.id).catch(() => {}); }} // pré-carrega: o clique copia na hora
                      onFocus={() => { obterBlob(item.id).catch(() => {}); }}
                      className="relative block aspect-square w-full bg-slate-100"
                      title="Clique para copiar a imagem"
                    >
                      <img src={item.miniatura} alt={item.titulo} className="h-full w-full object-contain" loading="lazy" />
                      <span className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1 text-[11px] font-semibold text-white transition-opacity ${
                        copiada ? "bg-green-600 opacity-100" : "bg-black/60 opacity-0 group-hover:opacity-100"
                      }`}>
                        {copiada ? <><Check className="h-3 w-3" /> Copiada!</> : <><Copy className="h-3 w-3" /> Copiar</>}
                      </span>
                    </button>
                    <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button type="button" title="Ampliar" onClick={() => setPreviewId(item.id)} className="rounded bg-white/90 p-1 text-slate-600 shadow hover:text-green-700"><Eye className="h-3.5 w-3.5" /></button>
                      <button type="button" title="Renomear / categoria" onClick={() => setEditando({ id: item.id, titulo: item.titulo, categoria: item.categoria ?? "" })} className="rounded bg-white/90 p-1 text-slate-600 shadow hover:text-blue-700"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" title="Excluir" onClick={() => setExcluindo({ id: item.id, titulo: item.titulo })} className="rounded bg-white/90 p-1 text-slate-600 shadow hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="truncate text-xs font-medium text-slate-700" title={item.titulo}>{item.titulo}</div>
                      <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400">
                        <span className="truncate">{item.categoria ?? "Sem categoria"}</span>
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
              {itens.length} de {data.limiteItens} imagens · {formatarTamanho(totalBytes)} de {formatarTamanho(data.limiteBytes)} · arraste arquivos para cá para adicionar
            </p>
          )}
        </div>
      )}

      {/* Ampliar */}
      <PreviewMidia id={previewId} titulo={itens.find(i => i.id === previewId)?.titulo} onClose={() => setPreviewId(null)} onCopiar={() => { const i = itens.find(x => x.id === previewId); if (i) copiar(i); }} />

      {/* Renomear / categoria */}
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
                <label className="text-xs font-medium text-slate-600">Categoria (opcional)</label>
                <Input
                  value={editando.categoria}
                  onChange={e => setEditando({ ...editando, categoria: e.target.value })}
                  list="categorias-biblioteca"
                  maxLength={64}
                  placeholder="Ex.: Institucional, Produtos, Promoções"
                />
                <datalist id="categorias-biblioteca">{categorias.map(c => <option key={c} value={c} />)}</datalist>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button
              disabled={!editando || editando.titulo.trim().length === 0 || atualizar.isPending}
              onClick={() => editando && atualizar.mutate({ id: editando.id, titulo: editando.titulo, categoria: editando.categoria })}
            >
              {atualizar.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
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
