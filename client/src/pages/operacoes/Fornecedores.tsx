import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Building2, FileText, Loader2, Mail, MessageCircle, Phone, Plus, Save, Search, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enviarArquivo, type ArquivoEnviado } from "@/lib/upload";

const CATEGORIES = ["Matéria-Prima", "Embalagem", "Serviços", "Tecnologia", "Logística", "Manutenção", "Outros"];

const EMPTY_FORM = { name: "", company: "", category: "Matéria-Prima", supplies: "", contact: "", phone: "", email: "", paymentTerms: "", notes: "" };
const EMPTY_NFE = {
  nfeCnpj: "",
  nfeRazaoSocial: "",
  nfeNomeFantasia: "",
  nfeNumero: "",
  nfeSerie: "",
  nfeChaveAcesso: "",
};
const NFE_MAX_BYTES = 32 * 1024 * 1024;

export default function Fornecedores() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<number | null>(null);
  const [nfeDialogId, setNfeDialogId] = useState<number | null>(null);
  const [nfeFile, setNfeFile] = useState<File | null>(null);
  const [nfeUploadedFile, setNfeUploadedFile] = useState<ArquivoEnviado | null>(null);
  const [nfeForm, setNfeForm] = useState({ ...EMPTY_NFE });
  const [nfeDragging, setNfeDragging] = useState(false);
  const [nfeUploading, setNfeUploading] = useState(false);
  const [nfeExtracting, setNfeExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.suppliers.list.useQuery({ search, category });
  const createMut = trpc.suppliers.create.useMutation({ onSuccess: () => { utils.suppliers.list.invalidate(); setShowForm(false); setForm({ ...EMPTY_FORM }); toast.success("Fornecedor cadastrado!"); } });
  const updateMut = trpc.suppliers.update.useMutation({ onSuccess: () => { utils.suppliers.list.invalidate(); setEditId(null); setShowForm(false); setForm({ ...EMPTY_FORM }); toast.success("Fornecedor atualizado!"); } });
  const deleteMut = trpc.suppliers.delete.useMutation({ onSuccess: () => { utils.suppliers.list.invalidate(); toast.success("Fornecedor removido."); } });
  const uploadNfeMut = trpc.fornecedorNfe.upload.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
      fecharNfeDialog();
      toast.success("NF-e anexada ao fornecedor!");
    },
  });
  const extractNfeMut = trpc.fornecedorNfe.extrair.useMutation();

  const items = data ?? [];
  const nfeReady = nfeFile !== null || nfeUploadedFile !== null;

  function openEdit(item: typeof items[0]) {
    setForm({ name: item.name, company: item.company ?? "", category: item.category, supplies: item.supplies ?? "", contact: item.contact ?? "", phone: item.phone ?? "", email: item.email ?? "", paymentTerms: item.paymentTerms ?? "", notes: item.notes ?? "" });
    setEditId(item.id);
    setShowForm(true);
  }

  function handleSave() {
    if (editId) {
      updateMut.mutate({ id: editId, data: form });
    } else {
      createMut.mutate(form);
    }
  }

  function abrirNfeDialog(item: typeof items[number]) {
    setNfeDialogId(item.id);
    setNfeFile(null);
    setNfeForm({
      nfeCnpj: item.nfeCnpj ?? "",
      nfeRazaoSocial: item.nfeRazaoSocial ?? "",
      nfeNomeFantasia: item.nfeNomeFantasia ?? "",
      nfeNumero: item.nfeNumero ?? "",
      nfeSerie: item.nfeSerie ?? "",
      nfeChaveAcesso: item.nfeChaveAcesso ?? "",
    });
    setNfeUploadedFile(
      item.nfeArquivoUrl && item.nfeArquivoKey
        ? {
            url: item.nfeArquivoUrl,
            key: item.nfeArquivoKey,
            fileName: item.nfeArquivoNome ?? "NF-e.pdf",
            mimeType: "application/pdf",
            fileSize: 0,
          }
        : null
    );
    setShowForm(false);
  }

  function fecharNfeDialog() {
    setNfeDialogId(null);
    setNfeFile(null);
    setNfeUploadedFile(null);
    setNfeForm({ ...EMPTY_NFE });
    setNfeDragging(false);
    setNfeUploading(false);
    setNfeExtracting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function selecionarNfe(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
      toast.error("Selecione um arquivo PDF.");
      return;
    }
    if (file.size > NFE_MAX_BYTES) {
      toast.error("O PDF da NF-e não pode ultrapassar 32 MB.");
      return;
    }
    setNfeFile(file);
    setNfeUploadedFile(null);
  }

  async function enviarNfeSeNecessario() {
    if (nfeUploadedFile) return nfeUploadedFile;
    if (!nfeFile) throw new Error("Selecione um PDF da NF-e.");
    const enviado = await enviarArquivo("documento", nfeFile);
    setNfeUploadedFile(enviado);
    return enviado;
  }

  async function extrairDadosNfe() {
    if (!nfeDialogId) return;
    setNfeExtracting(true);
    try {
      const arquivo = await enviarNfeSeNecessario();
      const dados = await extractNfeMut.mutateAsync({
        id: nfeDialogId,
        arquivoUrl: arquivo.url,
        arquivoKey: arquivo.key,
      });
      setNfeForm({
        nfeCnpj: dados.nfeCnpj ?? "",
        nfeRazaoSocial: dados.nfeRazaoSocial ?? "",
        nfeNomeFantasia: dados.nfeNomeFantasia ?? "",
        nfeNumero: dados.nfeNumero ?? "",
        nfeSerie: dados.nfeSerie ?? "",
        nfeChaveAcesso: dados.nfeChaveAcesso ?? "",
      });
      toast.success("Dados extraídos. Revise os campos antes de salvar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível extrair os dados da NF-e.");
    } finally {
      setNfeExtracting(false);
    }
  }

  async function salvarNfe() {
    if (!nfeDialogId) return;
    setNfeUploading(true);
    try {
      const arquivo = await enviarNfeSeNecessario();
      await uploadNfeMut.mutateAsync({
        id: nfeDialogId,
        nfeCnpj: nfeForm.nfeCnpj.trim() || null,
        nfeRazaoSocial: nfeForm.nfeRazaoSocial.trim() || null,
        nfeNomeFantasia: nfeForm.nfeNomeFantasia.trim() || null,
        nfeNumero: nfeForm.nfeNumero.trim() || null,
        nfeSerie: nfeForm.nfeSerie.trim() || null,
        nfeChaveAcesso: nfeForm.nfeChaveAcesso.trim() || null,
        nfeArquivoNome: arquivo.fileName,
        nfeArquivoKey: arquivo.key,
        nfeArquivoUrl: arquivo.url,
        nfeUltimaAtualizacao: new Date().toISOString(),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o anexo da NF-e.");
    } finally {
      setNfeUploading(false);
    }
  }

  function formatarCnpj(cnpj: string) {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return cnpj;
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "oklch(0.52 0.18 240 / 0.1)" }}>
            <Building2 size={18} style={{ color: "oklch(0.52 0.18 240)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>Fornecedores</h1>
            <p className="text-sm text-gray-500">Gerencie os fornecedores e parceiros da empresa</p>
          </div>
        </div>
        <button
          onClick={() => { setEditId(null); setForm({ ...EMPTY_FORM }); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ background: "oklch(0.52 0.18 240)" }}
        >
          <Plus size={15} /> Novo Fornecedor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: "Total", value: items.length, color: "oklch(0.52 0.18 240)" },
          { label: "Ativos", value: items.filter(i => i.active === "sim").length, color: "#16a34a" },
          { label: "Inativos", value: items.filter(i => i.active === "nao").length, color: "#dc2626" },
          { label: "Categorias", value: new Set(items.map(i => i.category)).size, color: "#d97706" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search size={15} className="text-gray-400" />
          <input className="flex-1 text-sm outline-none bg-transparent" placeholder="Buscar por nome, empresa ou insumo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">{editId ? "Editar Fornecedor" : "Novo Fornecedor"}</h3>
            <button onClick={() => { setShowForm(false); setEditId(null); }}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {[
              { label: "Nome *", key: "name", placeholder: "Nome do contato" },
              { label: "Empresa", key: "company", placeholder: "Razão social" },
              { label: "Contato", key: "contact", placeholder: "Nome do responsável" },
              { label: "Telefone", key: "phone", placeholder: "(67) 99999-9999" },
              { label: "E-mail", key: "email", placeholder: "email@empresa.com" },
              { label: "Condições de Pagamento", key: "paymentTerms", placeholder: "ex: 30/60/90 dias" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">{f.label}</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder={f.placeholder} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Categoria</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Insumos Fornecidos</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="ex: aço inox, acrílico, perfis" value={form.supplies} onChange={e => setForm(p => ({ ...p, supplies: e.target.value }))} />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Observações</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancelar</button>
            <button onClick={handleSave} disabled={!form.name} className="px-4 py-2 text-sm rounded-lg text-white font-semibold disabled:opacity-50" style={{ background: "oklch(0.52 0.18 240)" }}>
              {editId ? "Salvar Alterações" : "Cadastrar"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
            <EmptyTitle>Nenhum fornecedor encontrado.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm text-white" style={{ background: "oklch(0.52 0.18 240)" }}>
                {(item.company ?? item.name).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Nome da empresa em destaque (campo company ou name como fallback) */}
                  <span className="font-semibold text-sm" style={{ color: "#0f172a" }}>{item.company || item.name}</span>
                  {/* Contato aparece como informação secundária */}
                  {item.contact && <span className="text-xs text-gray-500">· {item.contact}</span>}
                  {!item.company && item.name && <span className="text-xs text-gray-400">· {item.name}</span>}
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.52 0.18 240 / 0.1)", color: "oklch(0.42 0.18 240)" }}>{item.category}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.active === "sim" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{item.active === "sim" ? "Ativo" : "Inativo"}</span>
                </div>
                {item.supplies && <p className="text-xs text-gray-500 mt-0.5">Insumos: {item.supplies}</p>}
                {(item.nfeCnpj || item.nfeNumero || item.nfeChaveAcesso || item.nfeArquivoUrl) && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
                    <FileText size={12} className="text-amber-600" />
                    <span>
                      {item.nfeCnpj || item.nfeNumero || item.nfeChaveAcesso
                        ? "NF-e" + (item.nfeNumero ? " nº " + item.nfeNumero : "")
                        : "NF-e anexada"}
                      {item.nfeSerie ? " · série " + item.nfeSerie : ""}
                      {item.nfeCnpj ? " · CNPJ " + formatarCnpj(item.nfeCnpj) : ""}
                    </span>
                    {item.nfeArquivoUrl && (
                      <a
                        href={item.nfeArquivoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 font-medium text-amber-700 hover:underline"
                      >
                        Abrir PDF
                      </a>
                    )}
                  </div>
                )}
                {/* Auditoria: quem cadastrou / editou */}
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {item.createdByNome && (
                    <span className="text-xs text-gray-400" title={`Cadastrado em ${new Date(item.createdAt).toLocaleDateString('pt-BR')}`}>
                      👤 Cadastrado por <span className="font-medium text-gray-500">{item.createdByNome}</span>
                    </span>
                  )}
                  {item.updatedByNome && item.updatedByNome !== item.createdByNome && (
                    <span className="text-xs text-gray-400" title={`Última edição em ${new Date(item.updatedAt).toLocaleDateString('pt-BR')}`}>
                      · Editado por <span className="font-medium text-gray-500">{item.updatedByNome}</span>
                    </span>
                  )}
                  {item.updatedByNome && item.updatedByNome === item.createdByNome && item.updatedAt !== item.createdAt && (
                    <span className="text-xs text-gray-400">
                      · Editado em {new Date(item.updatedAt).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                  {item.phone && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone size={11} />{item.phone}
                    </span>
                  )}
                  {item.email && <span className="flex items-center gap-1 text-xs text-gray-500"><Mail size={11} />{item.email}</span>}
                  {item.paymentTerms && <span className="text-xs text-gray-500">Pgto: {item.paymentTerms}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Botão WhatsApp — abre conversa diretamente */}
                {item.phone && (() => {
                  const digits = item.phone.replace(/\D/g, "");
                  const waNumber = digits.startsWith("55") ? digits : `55${digits}`;
                  return (
                    <a
                      href={`https://wa.me/${waNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                      title="Abrir WhatsApp"
                    >
                      <MessageCircle size={15} />
                    </a>
                  );
                })()}
                {user && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => abrirNfeDialog(item)}
                  >
                    <FileText size={14} />
                    Anexar / editar NF-e
                  </Button>
                )}
                <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors text-xs font-medium px-2">Editar</button>
                <button onClick={() => { if (confirm("Remover fornecedor?")) deleteMut.mutate({ id: item.id }); }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={nfeDialogId !== null}
        onOpenChange={open => {
          if (!open) fecharNfeDialog();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={18} className="text-amber-600" />
              NF-e do fornecedor
            </DialogTitle>
            <DialogDescription>
              Anexe o PDF para extrair os dados automaticamente. Revise e ajuste os campos antes de salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
              }}
              onDragOver={event => {
                event.preventDefault();
                setNfeDragging(true);
              }}
              onDragLeave={() => setNfeDragging(false)}
              onDrop={event => {
                event.preventDefault();
                setNfeDragging(false);
                selecionarNfe(event.dataTransfer.files[0]);
              }}
              className={"cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors " + (
                nfeDragging ? "border-amber-500 bg-amber-50" : "border-gray-300 hover:border-amber-400 hover:bg-amber-50/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onClick={event => event.stopPropagation()}
                onChange={event => selecionarNfe(event.target.files?.[0])}
              />
              {nfeFile || nfeUploadedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText size={24} className="shrink-0 text-amber-600" />
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {nfeFile?.name ?? nfeUploadedFile?.fileName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {nfeFile
                        ? (nfeFile.size / 1024 / 1024).toFixed(2) + " MB"
                        : "PDF anexado · clique para substituir"}
                    </p>
                  </div>
                  {(nfeFile || nfeUploadedFile) && (
                    <button
                      type="button"
                      className="ml-2 shrink-0 text-slate-400 hover:text-red-500"
                      aria-label="Remover PDF selecionado"
                      onClick={event => {
                        event.stopPropagation();
                        setNfeFile(null);
                        setNfeUploadedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <Upload size={30} className="mx-auto mb-2 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700">Arraste um PDF ou clique para selecionar</p>
                  <p className="mt-1 text-xs text-slate-500">Tamanho máximo: 32 MB</p>
                </>
              )}
            </div>

            {nfeReady && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-2"
                    disabled={nfeExtracting || nfeUploading}
                    onClick={extrairDadosNfe}
                  >
                    {nfeExtracting ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                    {nfeExtracting ? "Extraindo..." : "Extrair dados da NF-e"}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700"
                    disabled={nfeUploading || nfeExtracting}
                    onClick={salvarNfe}
                  >
                    {nfeUploading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {nfeUploading ? "Salvando..." : "Salvar anexo"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="nfe-cnpj">CNPJ</Label>
                    <Input id="nfe-cnpj" value={nfeForm.nfeCnpj} onChange={event => setNfeForm(prev => ({ ...prev, nfeCnpj: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="nfe-razao-social">Razão social</Label>
                    <Input id="nfe-razao-social" value={nfeForm.nfeRazaoSocial} onChange={event => setNfeForm(prev => ({ ...prev, nfeRazaoSocial: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="nfe-nome-fantasia">Nome fantasia</Label>
                    <Input id="nfe-nome-fantasia" value={nfeForm.nfeNomeFantasia} onChange={event => setNfeForm(prev => ({ ...prev, nfeNomeFantasia: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="nfe-numero">Número</Label>
                    <Input id="nfe-numero" value={nfeForm.nfeNumero} onChange={event => setNfeForm(prev => ({ ...prev, nfeNumero: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="nfe-serie">Série</Label>
                    <Input id="nfe-serie" value={nfeForm.nfeSerie} onChange={event => setNfeForm(prev => ({ ...prev, nfeSerie: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="nfe-chave-acesso">Chave de acesso</Label>
                    <Input id="nfe-chave-acesso" value={nfeForm.nfeChaveAcesso} onChange={event => setNfeForm(prev => ({ ...prev, nfeChaveAcesso: event.target.value }))} />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={fecharNfeDialog}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
