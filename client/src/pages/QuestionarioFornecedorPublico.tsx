import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Store,
  Upload,
  CheckCircle2,
  Building2,
  MapPin,
  MessageCircle,
  Instagram,
  Globe,
  Plus,
  X,
  Loader2,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PRODUTOS_FORNECEDOR_PADRAO } from "@shared/guia-fornecedores";

export default function QuestionarioFornecedorPublico() {
  const [, params] = useRoute("/fornecedor/:token");
  const token = params?.token ?? "";

  const {
    data: q,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.guiaFornecedores.obterQuestionarioPublico.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const responderMutation = trpc.guiaFornecedores.responderQuestionarioPublico.useMutation();
  const uploadLogoMutation = trpc.guiaFornecedores.uploadLogoPublico.useMutation();

  // Estados do formulário
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [atendeCidadesVizinhas, setAtendeCidadesVizinhas] = useState(false);
  const [raioKm, setRaioKm] = useState<string>("");
  const [cidadesAtendidas, setCidadesAtendidas] = useState("");
  const [produtos, setProdutos] = useState<string[]>([]);
  const [outrosProdutos, setOutrosProdutos] = useState<string[]>([]);
  const [novoOutroProduto, setNovoOutroProduto] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [telefoneContato, setTelefoneContato] = useState("");
  const [instagram, setInstagram] = useState("");
  const [site, setSite] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviadoComSucesso, setEnviadoComSucesso] = useState(false);

  // Inicializa com dados já existentes se houver
  useEffect(() => {
    if (q) {
      if (q.logoUrl) setLogoUrl(q.logoUrl);
      setAtendeCidadesVizinhas(q.atendeCidadesVizinhas ?? false);
      if (q.raioAtendimentoKm) setRaioKm(String(q.raioAtendimentoKm));
      if (q.cidadesAtendidas) setCidadesAtendidas(q.cidadesAtendidas);
      if (q.produtos && q.produtos.length > 0) setProdutos(q.produtos);
      if (q.outrosProdutos && q.outrosProdutos.length > 0) setOutrosProdutos(q.outrosProdutos);
      if (q.whatsapp) setWhatsapp(q.whatsapp);
      if (q.telefoneContato) setTelefoneContato(q.telefoneContato);
      if (q.instagram) setInstagram(q.instagram);
      if (q.site) setSite(q.site);
      if (q.descricao) setDescricao(q.descricao);
    }
  }, [q]);

  const toggleProduto = (label: string) => {
    setProdutos((prev) =>
      prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label]
    );
  };

  const adicionarOutroProduto = () => {
    const limpo = novoOutroProduto.trim();
    if (!limpo) return;
    if (outrosProdutos.includes(limpo) || produtos.includes(limpo)) {
      toast.info("Este item já foi adicionado.");
      return;
    }
    setOutrosProdutos((prev) => [...prev, limpo]);
    setNovoOutroProduto("");
  };

  const removerOutroProduto = (item: string) => {
    setOutrosProdutos((prev) => prev.filter((p) => p !== item));
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem (PNG, JPG, etc.).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setEnviandoLogo(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await uploadLogoMutation.mutateAsync({
          token,
          base64,
          contentType: file.type,
          nomeArquivo: file.name,
        });
        setLogoUrl(res.logoUrl);
        toast.success("Logo enviada com sucesso!");
      } catch (err: any) {
        toast.error(err.message || "Erro no upload da logo.");
      } finally {
        setEnviandoLogo(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (produtos.length === 0 && outrosProdutos.length === 0) {
      toast.error("Por favor, selecione ao menos um produto que sua empresa fabrica.");
      return;
    }

    try {
      await responderMutation.mutateAsync({
        token,
        logoUrl,
        atendeCidadesVizinhas,
        raioAtendimentoKm: raioKm ? parseInt(raioKm, 10) : null,
        cidadesAtendidas: cidadesAtendidas.trim() || null,
        produtos,
        outrosProdutos,
        telefoneContato: telefoneContato.trim() || null,
        whatsapp: whatsapp.trim() || null,
        instagram: instagram.trim() || null,
        site: site.trim() || null,
        descricao: descricao.trim() || null,
      });

      setEnviadoComSucesso(true);
      toast.success("Perfil atualizado com sucesso!");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Não foi possível enviar o formulário.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Carregando questionário de parceiro...</p>
        </div>
      </div>
    );
  }

  if (isError || !q) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Link não encontrado</h2>
          <p className="mt-1 text-sm text-slate-600">
            {error?.message || "Este link de questionário é inválido ou expirou. Entre em contato com a Letreiros Express para receber um novo link."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white pb-16">
      {/* Topo / Header da Marca */}
      <header className="border-b border-blue-950/20 bg-gradient-to-r from-blue-900 to-blue-800 text-white shadow-md">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-8 text-center sm:px-6">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-blue-200 uppercase">
            <Store className="h-4 w-4" />
            <span>Guia de Fornecedores · Letreiros Express</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Perfil do Parceiro de Comunicação Visual
          </h1>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm backdrop-blur-xs">
            <Building2 className="h-4 w-4 text-amber-300" />
            <strong className="text-white">{q.empresaNome}</strong>
            {q.cidade && q.estado && (
              <>
                <span className="text-blue-300">·</span>
                <span className="flex items-center gap-1 text-blue-100">
                  <MapPin className="h-3.5 w-3.5" />
                  {q.cidade} - {q.estado}
                </span>
              </>
            )}
          </div>
          <p className="mt-4 max-w-xl text-xs sm:text-sm text-blue-100/90 leading-relaxed">
            Preencha as informações abaixo para destacar sua empresa na lista oficial de indicações da <strong>Letreiros Express</strong> para clientes finais da sua região.
          </p>
        </div>
      </header>

      {/* Conteúdo do Formulário */}
      <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        {enviadoComSucesso && (
          <div className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-900 shadow-xs">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-emerald-950">
                  Perfil atualizado com sucesso!
                </h3>
                <p className="mt-1 text-sm text-emerald-800 leading-relaxed">
                  Suas informações e logo já foram registradas e aparecerão no Guia de Fornecedores da Letreiros Express. Caso deseje fazer qualquer alteração no futuro, você pode usar este mesmo link.
                </p>
              </div>
            </div>
          </div>
        )}

        {q.status === "preenchido" && !enviadoComSucesso && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-xs text-blue-900">
            <span className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-blue-700" />
              <span>Este perfil já foi preenchido anteriormente. Você pode atualizar qualquer informação abaixo.</span>
            </span>
            <Badge variant="outline" className="border-blue-300 bg-white text-blue-800">
              Preenchido
            </Badge>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Logo */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">1</span>
              Logomarca da sua empresa (PNG ou Imagem)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Envie sua logo (preferencialmente com fundo transparente) para ser exibida ao lado do nome da sua empresa no Guia.
            </p>

            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
              {logoUrl ? (
                <div className="relative flex h-28 w-28 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-inner">
                  <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow-xs hover:bg-red-700"
                    title="Remover logo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400">
                  <Store className="h-10 w-10 opacity-40" />
                </div>
              )}

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-blue-700">
                  {enviandoLogo ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Enviando logo...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 text-blue-600" />
                      <span>{logoUrl ? "Trocar imagem" : "Selecionar arquivo de logo"}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleUploadLogo}
                    disabled={enviandoLogo}
                  />
                </label>
                <p className="text-[11px] text-slate-400">Formatos aceitos: PNG, JPG, WEBP ou SVG (até 5 MB).</p>
              </div>
            </div>
          </div>

          {/* Card 2: Região de Atendimento */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">2</span>
              Área de atendimento e cidades vizinhas
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Muitos clientes procuram instaladores ou fabricantes em cidades vizinhas em um raio de até 300 km.
            </p>

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
                <Checkbox
                  checked={atendeCidadesVizinhas}
                  onCheckedChange={(v) => setAtendeCidadesVizinhas(v === true)}
                />
                <div className="text-sm">
                  <strong className="text-slate-800">Sim, atendemos cidades vizinhas e outras regiões</strong>
                  <p className="text-xs text-slate-500">
                    Sua empresa receberá destaque quando clientes das redondezas procurarem parceiros próximos.
                  </p>
                </div>
              </label>

              {atendeCidadesVizinhas && (
                <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Raio aproximado de atendimento (em km)</label>
                    <Input
                      type="number"
                      placeholder="Ex: 150 (km)"
                      value={raioKm}
                      onChange={(e) => setRaioKm(e.target.value)}
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Principais cidades ou regiões atendidas (opcional)</label>
                    <Input
                      placeholder="Ex: Região Metropolitana, Campinas, etc."
                      value={cidadesAtendidas}
                      onChange={(e) => setCidadesAtendidas(e.target.value)}
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Produtos Fabricados */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">3</span>
              Quais produtos sua empresa fabrica ou instala?
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Marque os produtos do seu catálogo para que o cliente saiba exatamente o que você fornece:
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {PRODUTOS_FORNECEDOR_PADRAO.map((prod) => {
                const ativo = produtos.includes(prod.label);
                return (
                  <label
                    key={prod.id}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer transition-colors ${
                      ativo
                        ? "border-blue-400 bg-blue-50/70 text-blue-950 font-medium"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Checkbox
                      checked={ativo}
                      onCheckedChange={() => toggleProduto(prod.label)}
                    />
                    <span className="text-xs sm:text-sm">{prod.label}</span>
                  </label>
                );
              })}
            </div>

            {/* Adicionar outros produtos */}
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
              <label className="text-xs font-semibold text-slate-700">
                Fabrica outros produtos ou tem outros serviços que não estão na lista?
              </label>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Ex: Corte a Laser, Letra Block, Neon LED..."
                  value={novoOutroProduto}
                  onChange={(e) => setNovoOutroProduto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarOutroProduto();
                    }
                  }}
                  className="bg-white text-xs sm:text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={adicionarOutroProduto}
                  className="gap-1 shrink-0 bg-white hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>

              {outrosProdutos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {outrosProdutos.map((item) => (
                    <Badge
                      key={item}
                      variant="secondary"
                      className="gap-1 bg-white px-2.5 py-1 text-xs border border-slate-200"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() => removerOutroProduto(item)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Contatos e Apresentação */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">4</span>
              Canais de Contato e Apresentação Comercial
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Confirme para onde os clientes interessados devem enviar mensagens:
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp para orçamentos
                </label>
                <Input
                  placeholder="Ex: (19) 99999-8888"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <Instagram className="h-3.5 w-3.5 text-pink-600" /> Instagram (@empresa)
                </label>
                <Input
                  placeholder="Ex: @suaempresa"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <Globe className="h-3.5 w-3.5 text-blue-600" /> Site ou portfólio
                </label>
                <Input
                  placeholder="Ex: www.suaempresa.com.br"
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">
                  Telefone fixo ou alternativo
                </label>
                <Input
                  placeholder="Ex: (19) 3333-2222"
                  value={telefoneContato}
                  onChange={(e) => setTelefoneContato(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-slate-700">
                Breve apresentação da empresa ou diferencial (opcional)
              </label>
              <Textarea
                rows={3}
                placeholder="Ex: Mais de 10 anos de experiência em comunicação visual, equipe própria de instalação e frota dedicada..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>
          </div>

          {/* Botão de Envio */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={responderMutation.isPending}
              className="w-full bg-blue-700 py-6 text-base font-bold text-white shadow-md hover:bg-blue-800"
            >
              {responderMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Salvando perfil...
                </>
              ) : (
                "Salvar e Atualizar Meu Perfil no Guia"
              )}
            </Button>
            <p className="mt-2 text-center text-xs text-slate-400">
              Ao salvar, suas informações ficarão disponíveis para potenciais clientes no Guia de Fornecedores parceiros da Letreiros Express.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
