import { useState, useRef, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/../../client/src/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Upload, Search, FileText, FileImage, File, FileSpreadsheet,
  Download, Trash2, FolderOpen, Tag, Eye, X, Plus, Filter,
  BookOpen, HardDrive, TrendingDown, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Arquivo = {
  id: number;
  nome: string;
  descricao: string | null;
  categoria: string;
  subcategoria: string | null;
  tags: string | null;
  fileKey: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string | null;
  visualizacoes: number;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORIAS_PADRAO = [
  "Geral", "Comercial", "Financeiro", "Produção", "Logística",
  "RH", "Jurídico", "Qualidade", "Projetos", "Manutenção", "Outros"
];

const MAX_FILE_SIZE_MB = 15;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <FileImage size={20} className="text-blue-500" />;
  if (mimeType === "application/pdf") return <FileText size={20} className="text-red-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return <FileSpreadsheet size={20} className="text-green-600" />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText size={20} className="text-blue-600" />;
  return <File size={20} className="text-slate-500" />;
}

function getFileColor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "bg-blue-50 border-blue-200";
  if (mimeType === "application/pdf") return "bg-red-50 border-red-200";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return "bg-green-50 border-green-200";
  if (mimeType.includes("word") || mimeType.includes("document"))
    return "bg-blue-50 border-blue-200";
  return "bg-slate-50 border-slate-200";
}

function isPreviewable(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

// ─── Formulário de Edição ─────────────────────────────────────────────────────
function EditarArquivoForm({
  arquivo,
  onSave,
  onCancel,
  saving,
}: {
  arquivo: Arquivo;
  onSave: (dados: { nome: string; descricao?: string; categoria?: string; subcategoria?: string; tags?: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [nome, setNome] = useState(arquivo.nome);
  const [descricao, setDescricao] = useState(arquivo.descricao ?? "");
  const [categoria, setCategoria] = useState(arquivo.categoria ?? "Geral");
  const [subcategoria, setSubcategoria] = useState(arquivo.subcategoria ?? "");
  const [tags, setTags] = useState(arquivo.tags ?? "");

  return (
    <div className="space-y-4 py-2">
      <div>
        <Label className="text-xs font-medium text-slate-700">Nome do Arquivo *</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do arquivo" className="mt-1" />
      </div>
      <div>
        <Label className="text-xs font-medium text-slate-700">Descrição</Label>
        <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Breve descrição do conteúdo..." className="mt-1 text-sm" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-slate-700">Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS_PADRAO.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Subcategoria</Label>
          <Input value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} placeholder="Ex: Procedimentos" className="mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium text-slate-700">Tags (separadas por vírgula)</Label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ex: manual, qualidade, ISO" className="mt-1" />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button
          onClick={() => onSave({ nome: nome.trim(), descricao: descricao.trim() || undefined, categoria, subcategoria: subcategoria.trim() || undefined, tags: tags.trim() || undefined })}
          disabled={saving || !nome.trim()}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700"
        >
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function BibliotecaArquivos() {
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todos");
  const [modalUpload, setModalUpload] = useState(false);
  const [modalPreview, setModalPreview] = useState<Arquivo | null>(null);
  const [modalEditar, setModalEditar] = useState<Arquivo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form de upload
  const [formNome, setFormNome] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formCategoria, setFormCategoria] = useState("Geral");
  const [formSubcategoria, setFormSubcategoria] = useState("");
  const [formTags, setFormTags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Queries
  const { data: arquivos = [], refetch } = trpc.bibliotecaArquivos.list.useQuery({
    categoria: categoriaFiltro === "Todos" ? undefined : categoriaFiltro,
    busca: busca || undefined,
  });
  const { data: categorias = [] } = trpc.bibliotecaArquivos.categorias.useQuery();
  const { data: stats } = trpc.bibliotecaArquivos.stats.useQuery();

  // Mutations
  const uploadMutation = trpc.bibliotecaArquivos.upload.useMutation({
    onSuccess: () => { refetch(); toast.success("Arquivo enviado com sucesso!"); resetForm(); setModalUpload(false); },
    onError: (e) => toast.error("Erro ao enviar arquivo: " + e.message),
  });
  const deleteMutation = trpc.bibliotecaArquivos.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Arquivo removido."); },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });
  const updateMutation = trpc.bibliotecaArquivos.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Arquivo atualizado."); setModalEditar(null); },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });
  const viewMutation = trpc.bibliotecaArquivos.incrementView.useMutation();

  function resetForm() {
    setFormNome(""); setFormDescricao(""); setFormCategoria("Geral");
    setFormSubcategoria(""); setFormTags(""); setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileSelect(file: File) {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Máximo: ${MAX_FILE_SIZE_MB} MB`);
      return;
    }
    setSelectedFile(file);
    if (!formNome) setFormNome(file.name.replace(/\.[^/.]+$/, ""));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  async function handleUpload() {
    if (!selectedFile) { toast.error("Selecione um arquivo."); return; }
    if (!formNome.trim()) { toast.error("Informe um nome para o arquivo."); return; }
    if (!formCategoria) { toast.error("Selecione uma categoria."); return; }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        await uploadMutation.mutateAsync({
          nome: formNome.trim(),
          descricao: formDescricao.trim() || undefined,
          categoria: formCategoria,
          subcategoria: formSubcategoria.trim() || undefined,
          tags: formTags.trim() || undefined,
          fileName: selectedFile.name,
          fileBase64: base64,
          mimeType: selectedFile.type || "application/octet-stream",
          fileSize: selectedFile.size,
          uploadedBy: user?.name ?? undefined,
        });
        setUploading(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch {
      setUploading(false);
    }
  }

  function handleDownload(arquivo: Arquivo) {
    window.open(arquivo.fileUrl, "_blank");
  }
  function handleVisualizar(arquivo: Arquivo) {
    viewMutation.mutate({ id: arquivo.id });
    setModalPreview(arquivo);
  }

  function handleDelete(arquivo: Arquivo) {
    if (!confirm(`Remover "${arquivo.nome}"?`)) return;
    deleteMutation.mutate({ id: arquivo.id });
  }

  const todasCategorias = ["Todos", ...Array.from(new Set([...CATEGORIAS_PADRAO, ...categorias]))];

  return (
    <DashboardLayout>
    <div className="space-y-8 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <BookOpen size={24} className="text-indigo-600" />
            Biblioteca de Arquivos
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Repositório centralizado de documentos para consulta da equipe
          </p>
        </div>
        <Button onClick={() => setModalUpload(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Plus size={16} /> Enviar Arquivo
        </Button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total de Arquivos</p>
            <p className="text-3xl font-bold text-indigo-600 mt-1">{stats.totalArquivos}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Visualizações</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{stats.totalVisualizacoes}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Espaço Utilizado</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{formatBytes(stats.totalSize)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Categorias</p>
            <p className="text-3xl font-bold text-slate-700 mt-1">{Object.keys(stats.porCategoria).length}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nome, descrição, tags..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
            <SelectTrigger className="w-full md:w-48">
              <Filter size={14} className="mr-2 text-slate-400" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {todasCategorias.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de Arquivos */}
      {arquivos.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-16 text-center">
          <FolderOpen size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Nenhum arquivo encontrado</p>
          <p className="text-slate-400 text-sm mt-1">
            {busca || categoriaFiltro !== "Todos"
              ? "Tente ajustar os filtros de busca"
              : "Clique em \"Enviar Arquivo\" para começar"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(arquivos as Arquivo[]).map((arquivo) => (
            <div
              key={arquivo.id}
              className={`bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow ${getFileColor(arquivo.mimeType)}`}
            >
              {/* Cabeçalho do card */}
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm flex-shrink-0">
                  {getFileIcon(arquivo.mimeType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm leading-tight truncate" title={arquivo.nome}>
                    {arquivo.nome}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{arquivo.fileName}</p>
                </div>
              </div>

              {/* Descrição */}
              {arquivo.descricao && (
                <p className="text-xs text-slate-600 mb-3 line-clamp-2">{arquivo.descricao}</p>
              )}

              {/* Metadados */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <Badge variant="secondary" className="text-xs">{arquivo.categoria}</Badge>
                {arquivo.subcategoria && (
                  <Badge variant="outline" className="text-xs">{arquivo.subcategoria}</Badge>
                )}
                {arquivo.tags?.split(",").filter(Boolean).slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs text-indigo-600 border-indigo-200 bg-indigo-50">
                    <Tag size={10} className="mr-1" />{tag.trim()}
                  </Badge>
                ))}
              </div>

              {/* Rodapé */}
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                <span>{formatBytes(arquivo.fileSize)}</span>
                <span>{arquivo.visualizacoes ?? 0} visualizações</span>
                <span>{new Date(arquivo.createdAt).toLocaleDateString("pt-BR")}</span>
              </div>

              {/* Ações */}
              <div className="flex gap-2">
                {isPreviewable(arquivo.mimeType) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1 text-xs"
                    onClick={() => handleVisualizar(arquivo)}
                  >
                    <Eye size={12} /> Visualizar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1 text-xs bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                  onClick={() => handleDownload(arquivo)}
                >
                  <Download size={12} /> Baixar
                </Button>
                {user && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 px-2"
                    onClick={() => setModalEditar(arquivo)}
                    title="Editar"
                  >
                    <Pencil size={12} />
                  </Button>
                )}
                {user && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
                    onClick={() => handleDelete(arquivo)}
                  >
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Upload */}
      <Dialog open={modalUpload} onOpenChange={(o) => { if (!o) { resetForm(); } setModalUpload(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload size={18} className="text-indigo-600" /> Enviar Arquivo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Área de drop */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  {getFileIcon(selectedFile.type)}
                  <div className="text-left">
                    <p className="font-medium text-slate-700 text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(selectedFile.size)}</p>
                  </div>
                  <button
                    className="ml-2 text-slate-400 hover:text-red-500"
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-slate-600 font-medium text-sm">Arraste um arquivo ou clique para selecionar</p>
                  <p className="text-xs text-slate-400 mt-1">PDF, Word, Excel, imagens — máx. {MAX_FILE_SIZE_MB} MB</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.txt,.ppt,.pptx,.zip"
              />
            </div>

            {/* Campos do formulário */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Nome do Arquivo *</Label>
                <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Ex: Manual de Qualidade 2025" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Descrição</Label>
                <Textarea value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)} placeholder="Breve descrição do conteúdo..." className="mt-1 text-sm" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Categoria *</Label>
                  <Select value={formCategoria} onValueChange={setFormCategoria}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_PADRAO.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Subcategoria</Label>
                  <Input value={formSubcategoria} onChange={(e) => setFormSubcategoria(e.target.value)} placeholder="Ex: Procedimentos" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Tags (separadas por vírgula)</Label>
                <Input value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="Ex: manual, qualidade, ISO" className="mt-1" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setModalUpload(false); }}>Cancelar</Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !formNome.trim()}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {uploading ? (
                <><span className="animate-spin">⏳</span> Enviando...</>
              ) : (
                <><Upload size={14} /> Enviar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={!!modalEditar} onOpenChange={(o) => { if (!o) setModalEditar(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil size={16} className="text-indigo-600" />
              Editar Arquivo
            </DialogTitle>
          </DialogHeader>
          {modalEditar && (
            <EditarArquivoForm
              arquivo={modalEditar}
              onSave={(dados) => updateMutation.mutate({ id: modalEditar.id, ...dados })}
              onCancel={() => setModalEditar(null)}
              saving={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Modal de Preview */}
      <Dialog open={!!modalPreview} onOpenChange={(o) => { if (!o) setModalPreview(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              {modalPreview && getFileIcon(modalPreview.mimeType)}
              {modalPreview?.nome}
            </DialogTitle>
          </DialogHeader>
          {modalPreview && (
            <div className="overflow-auto max-h-[70vh] rounded-lg border border-slate-200">
              {modalPreview.mimeType.startsWith("image/") ? (
                <img src={modalPreview.fileUrl} alt={modalPreview.nome} className="w-full object-contain" />
              ) : modalPreview.mimeType === "application/pdf" ? (
                <iframe src={modalPreview.fileUrl} className="w-full h-[65vh]" title={modalPreview.nome} />
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPreview(null)}>Fechar</Button>
            {modalPreview && (
              <Button onClick={() => handleDownload(modalPreview)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                <Download size={14} /> Baixar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
