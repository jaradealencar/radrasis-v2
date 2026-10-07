import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  RENDER_ROLES,
  ROTULO_CONSTRUCTION_KIND,
  ROTULO_MATERIAL_FAMILY,
  ROTULO_RENDER_ROLE,
  type CpqRender3dBlocker,
  type CpqRender3dSpec,
  type CpqRenderRole,
} from "@shared/cpq-render3d";
import { ApiError, aprovarRender3d, enviarPreview, obterSpec } from "../api";
import { assinarMudancas, obterBridge, versaoAtual } from "../bridge";
import { capturarPreviews, type TipoPreview } from "../capture";
import { CpqRender3dViewer } from "./CpqRender3dViewer";
import { MaterialReferencePanel } from "./MaterialReferencePanel";

/** Hash rápido (cyrb53) só para detectar mudança do orçamento sem guardar o JSON (o SVG chega a 1,5 MB). */
function impressao(texto: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16)}${(h1 >>> 0).toString(16)}:${texto.length}`;
}

const CODIGOS_DE_PAPEL = new Set(["papel_nao_confirmado", "papel_ambiguo", "papel_incompativel"]);
const ROTULO_PREVIEW: Record<TipoPreview, string> = { dia: "vista diurna", noite: "vista noturna", explodido: "vista explodida" };

type EtapaAprovacao = { tipo: "parado" } | { tipo: "capturando"; preview: TipoPreview } | { tipo: "enviando" } | { tipo: "aprovando" };

/** Cores com que a peça é desenhada: as das regiões da face que usam o material, ou a cor do próprio material. */
function coresDaPeca(spec: CpqRender3dSpec, material: CpqRender3dSpec["materials"][number]): string[] {
  if (material.role === "face") {
    const doDesenho = [...new Set(spec.regions.filter(regiao => regiao.materialId === material.mubisysMateriaPrimaId && regiao.colorHex).map(regiao => regiao.colorHex!))];
    if (doDesenho.length) return doDesenho;
  }
  return [material.pbr.colorHex];
}

const caixa = (cor: "warn" | "bad" | "ok") => ({
  background: `var(--${cor}-soft)`,
  border: `1px solid color-mix(in oklab, var(--${cor}) 35%, var(--border))`,
  borderRadius: 12,
  padding: "11px 14px",
  fontSize: 13,
});

export function CpqRender3dApp() {
  const versao = useSyncExternalStore(assinarMudancas, versaoAtual);
  const bridge = obterBridge();
  const draft = useMemo(() => (bridge ? bridge.getDraftInput() : null), [bridge, versao]); // eslint-disable-line react-hooks/exhaustive-deps
  const chave = useMemo(() => (draft ? impressao(JSON.stringify(draft)) : ""), [draft]);
  const sourceId = bridge?.getSourceId() ?? "";

  const [spec, setSpec] = useState<CpqRender3dSpec | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisosCena, setAvisosCena] = useState<string[]>([]);
  const [etapa, setEtapa] = useState<EtapaAprovacao>({ tipo: "parado" });
  const [erroAprovacao, setErroAprovacao] = useState<{ mensagem: string; blockers: CpqRender3dBlocker[] } | null>(null);
  const rascunho = useRef(draft);
  rascunho.current = draft;

  /* --- spec resolvido pelo servidor (a cada mudança relevante do orçamento) --- */
  useEffect(() => {
    if (!rascunho.current || !sourceId) return;
    const controle = new AbortController();
    setCarregando(true);
    const atraso = setTimeout(() => {
      obterSpec(sourceId, rascunho.current!, controle.signal)
        .then(resposta => { setSpec(resposta); setErro(null); })
        .catch(falha => { if ((falha as Error).name !== "AbortError") setErro(falha instanceof Error ? falha.message : "Não foi possível montar o 3D."); })
        .finally(() => { if (!controle.signal.aborted) setCarregando(false); });
    }, 250);
    return () => { clearTimeout(atraso); controle.abort(); };
  }, [chave, sourceId]);

  const aprovacao = bridge?.getApproval() ?? null;
  const aprovadoVale = !!(aprovacao && spec && aprovacao.specHash === spec.specHash && spec.blockers.length === 0);
  // Aprovação de uma versão anterior do desenho/composição: invalida (o servidor também recusaria na emissão).
  useEffect(() => {
    if (aprovacao && spec && aprovacao.specHash !== spec.specHash) bridge?.invalidate("O orçamento mudou depois da aprovação do 3D.");
  }, [aprovacao, spec, bridge]);

  const semConstrucao = !!spec?.blockers.some(item => item.code === "construcao_ausente");
  const pendenciasDePapel = spec?.blockers.filter(item => CODIGOS_DE_PAPEL.has(item.code)) ?? [];
  const outrasPendencias = spec?.blockers.filter(item => !CODIGOS_DE_PAPEL.has(item.code)) ?? [];
  const estimado = spec?.materials.some(material => material.estimated) ?? false;
  const linhas = bridge?.getLinhasKit() ?? [];

  const definirPapel = useCallback((matId: number | null, papel: CpqRenderRole | null) => {
    for (const linha of bridge?.getLinhasKit() ?? []) if (linha.matId === matId) bridge?.setLineRole?.(linha.index, papel);
  }, [bridge]);

  const aprovar = async () => {
    if (!spec || !draft || etapa.tipo !== "parado") return;
    setErroAprovacao(null);
    try {
      const imagens = await capturarPreviews(spec, preview => setEtapa({ tipo: "capturando", preview }));
      setEtapa({ tipo: "enviando" });
      const [dia, noite, explodido] = await Promise.all((["dia", "noite", "explodido"] as const).map(tipo =>
        enviarPreview({ sourceId, specHash: spec.specHash, ticket: spec.ticket, tipo, imagem: imagens[tipo] })));
      setEtapa({ tipo: "aprovando" });
      const resposta = await aprovarRender3d({
        sourceId,
        snapshot: draft,
        specHash: spec.specHash,
        previewDayUrl: dia.url,
        previewNightUrl: noite.url,
        previewExplodedUrl: explodido.url,
      });
      bridge?.setApproval(resposta.approval, resposta.render3d);
    } catch (falha) {
      setErroAprovacao({
        mensagem: falha instanceof Error ? falha.message : "Não foi possível aprovar o 3D.",
        blockers: falha instanceof ApiError ? falha.blockers : [],
      });
    } finally {
      setEtapa({ tipo: "parado" });
    }
  };

  if (!bridge) return <div className="card"><div className="role-note">A ponte com o CPQ não está disponível nesta página.</div></div>;

  if (semConstrucao && spec) {
    return (
      <div className="card">
        <div className="cardhead">
          <div>
            <h3>Visualização 3D</h3>
            <p>Este produto ainda não tem a construção 3D cadastrada (profundidade, afastamento da parede, aba da face, LEDs).</p>
          </div>
          <span className="badge b-neutral">Não se aplica</span>
        </div>
        <p className="role-note">Para ativar o 3D neste produto, cadastre a construção em Administração &gt; Produtos &amp; kits &gt; "Construção 3D". Enquanto isso, o orçamento segue normalmente, sem a visualização.</p>
        <div className="footer-nav" style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 14 }}>
          <button type="button" className="btn btn-ghost" onClick={() => bridge.goToStep(7)}>← Voltar à composição</button>
          <button type="button" className="btn btn-primary" onClick={() => bridge.dispensar()}>Continuar sem 3D →</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="cardhead">
          <div>
            <h3>Visualização 3D</h3>
            <p>Montagem industrial do letreiro a partir do vetor aprovado, das medidas e dos materiais da composição. A aparência não altera o preço.</p>
          </div>
          {aprovadoVale
            ? <span className="badge b-ok">Aprovada</span>
            : spec?.blockers.length ? <span className="badge b-bad">Com pendências</span>
            : <span className="badge b-warn">Aguardando aprovação</span>}
        </div>
        {carregando && !spec && <div className="role-note">Montando a visualização no servidor…</div>}
        {erro && <div style={caixa("bad")}>{erro}</div>}
        {spec && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--text-dim)" }}>
            <span className="badge b-neutral">{ROTULO_CONSTRUCTION_KIND[spec.construction.kind]}</span>
            {spec.construction.boxDepthMm > 0 && <span className="badge b-neutral">Profundidade {spec.construction.boxDepthMm} mm</span>}
            <span className="badge b-neutral">{Math.round(spec.widthMm)} × {Math.round(spec.heightMm)} mm</span>
          </div>
        )}
      </div>

      {spec && outrasPendencias.length > 0 && (
        <div style={caixa("bad")} role="alert">
          <b>Pendências que impedem a aprovação</b>
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
            {outrasPendencias.map((item, indice) => <li key={`${item.code}-${indice}`}>{item.message}</li>)}
          </ul>
        </div>
      )}

      {spec && pendenciasDePapel.length > 0 && (
        <div className="card">
          <div className="cardhead">
            <div>
              <h3>Confirme o papel 3D das peças</h3>
              <p>O papel diz o que cada material faz na montagem (face, lateral, fundo...). Em kits antigos o sistema só sugere; confirme para liberar o 3D.</p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendenciasDePapel.map((item, indice) => {
              const linha = linhas.find(candidata => candidata.matId === item.mubisysMateriaPrimaId);
              return (
                <div key={`${item.mubisysMateriaPrimaId}-${indice}`} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ flex: "1 1 260px", fontSize: 13 }}>
                    <b>{linha?.nome ?? `Matéria-prima ${item.mubisysMateriaPrimaId}`}</b>
                    <div className="role-note" style={{ fontSize: 12 }}>{item.message}</div>
                  </div>
                  <select aria-label={`Papel 3D de ${linha?.nome ?? ""}`} value={linha?.renderRole ?? ""} onChange={evento => definirPapel(item.mubisysMateriaPrimaId, (evento.target.value || null) as CpqRenderRole | null)}>
                    <option value="">Escolher…</option>
                    {RENDER_ROLES.map(papel => <option key={papel} value={papel}>{ROTULO_RENDER_ROLE[papel]}</option>)}
                  </select>
                  {item.suggestion && (
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => definirPapel(item.mubisysMateriaPrimaId, item.suggestion!)}>
                      Usar sugestão: {ROTULO_RENDER_ROLE[item.suggestion]}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {spec && !semConstrucao && (
        <div className="card">
          {estimado && (
            <div style={{ ...caixa("warn"), marginBottom: 10 }} role="status">
              <b>Preview ESTIMADO.</b> Há materiais sem perfil visual cadastrado (Administração &gt; Materiais 3D): a aparência usa um preset genérico e a aprovação fica bloqueada até haver vínculo.
            </div>
          )}
          <CpqRender3dViewer spec={spec} altura={560} onAvisos={setAvisosCena} />
        </div>
      )}

      {spec && (
        <div className="card">
          <div className="cardhead"><div><h3>Materiais e perfis visuais</h3><p>O que o servidor resolveu para cada peça. As espessuras vêm do cadastro das matérias-primas.</p></div></div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Peça</th><th>Material</th><th>Cor no 3D</th><th>Perfil visual</th><th>Espessura</th><th>Situação</th></tr></thead>
              <tbody>
                {spec.materials.map(material => (
                  <tr key={`${material.role}-${material.mubisysMateriaPrimaId}`}>
                    <td>{ROTULO_RENDER_ROLE[material.role]}</td>
                    <td>{material.materialName}</td>
                    <td>
                      {material.role === "led" || material.role === "fixing" ? "—" : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }} title={material.overrides?.colorHex ? "Cor cadastrada na matéria-prima" : "Sem cor cadastrada na matéria-prima: cor aproximada do perfil visual (ou da arte aprovada)"}>
                          {coresDaPeca(spec, material).map(cor => (
                            <span key={cor} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <i style={{ width: 14, height: 14, borderRadius: 4, background: cor, border: "1px solid var(--border)", display: "inline-block" }} aria-hidden />
                              <span style={{ fontSize: 11.5 }}>{cor.toUpperCase()}</span>
                            </span>
                          ))}
                          {!material.overrides?.colorHex && <span className="badge b-neutral" style={{ fontSize: 10.5 }}>aproximada</span>}
                        </span>
                      )}
                    </td>
                    <td>{material.profileId > 0 ? `${material.profileName} (v${material.profileVersion}) · ${ROTULO_MATERIAL_FAMILY[material.family]}` : "—"}</td>
                    <td className="num">{material.thicknessMm ? `${material.thicknessMm} mm` : "—"}</td>
                    <td>{material.estimated ? <span className="badge b-warn">Estimado</span> : <span className="badge b-ok">Perfil cadastrado</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MaterialReferencePanel materiais={spec.materials} />
        </div>
      )}

      {(spec?.warnings.length || avisosCena.length) ? (
        <div style={caixa("warn")}>
          <b>Avisos</b>
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
            {[...new Set([...(spec?.warnings ?? []), ...avisosCena])].map(aviso => <li key={aviso}>{aviso}</li>)}
          </ul>
        </div>
      ) : null}

      {erroAprovacao && (
        <div style={caixa("bad")} role="alert">
          {erroAprovacao.mensagem}
          {erroAprovacao.blockers.length > 0 && <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>{erroAprovacao.blockers.map((item, indice) => <li key={indice}>{item.message}</li>)}</ul>}
        </div>
      )}

      <div className="card">
        {aprovadoVale && aprovacao && (
          <div style={{ ...caixa("ok"), marginBottom: 12 }} role="status">
            Visualização aprovada por <b>{aprovacao.approvedBy.name}</b> em {new Date(aprovacao.approvedAt).toLocaleString("pt-BR")}. Mudar vetor, medidas, composição, cores, materiais ou profundidade invalida esta aprovação.
          </div>
        )}
        <div className="role-note" style={{ marginBottom: 10 }}>
          Cores em monitor e a simulação de luz são aproximações. A amostra física aprovada é a referência final de fabricação.
        </div>
        <div className="footer-nav" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={() => bridge.goToStep(7)}>← Voltar à composição</button>
          {aprovadoVale ? (
            <button type="button" className="btn btn-primary" onClick={() => bridge.goToStep(9)}>Continuar para o orçamento →</button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={!spec || spec.blockers.length > 0 || etapa.tipo !== "parado" || carregando} onClick={() => void aprovar()}>
              {etapa.tipo === "capturando" ? `Gerando ${ROTULO_PREVIEW[etapa.preview]}…`
                : etapa.tipo === "enviando" ? "Enviando imagens…"
                : etapa.tipo === "aprovando" ? "Registrando aprovação…"
                : "Aprovar visualização 3D"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
