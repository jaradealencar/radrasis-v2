import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COLOR_SPACE_PADRAO_POR_TIPO,
  ROTULO_MATERIAL_FAMILY,
  type CpqMaterialFamily,
  type CpqPbrParameters,
  type CpqTextureKind,
} from "@shared/cpq-render3d";
import { presetPbr } from "@shared/cpq-render3d-presets";
import {
  atualizarPerfil,
  criarPerfil,
  enviarMapa,
  excluirPerfil,
  listarAdmin,
  removerMapa,
  salvarVinculo,
  type CatalogoAdmin,
  type MateriaAdmin,
  type PerfilAdmin,
  type StatusMaterial3d,
} from "../api";
import { PreviewMaterial } from "./PreviewMaterial";

const ROTULO_STATUS: Record<StatusMaterial3d, { texto: string; classe: string }> = {
  sem_mapeamento: { texto: "Sem mapeamento", classe: "b-neutral" },
  incompleto: { texto: "Incompleto", classe: "b-bad" },
  estimado: { texto: "Estimado", classe: "b-warn" },
  aprovado: { texto: "Aprovado", classe: "b-ok" },
};

const ROTULO_MAPA: Record<CpqTextureKind, string> = {
  baseColor: "Cor base (sem luz gravada)",
  normal: "Normal",
  roughness: "Rugosidade",
  metalness: "Metalicidade",
  anisotropy: "Anisotropia (veio)",
  ao: "Oclusão ambiente",
  emissive: "Emissão",
  reference: "Foto de referência (só comparação)",
};

const CAMPOS_NUMERICOS: Array<{ chave: keyof CpqPbrParameters; rotulo: string; min: number; max: number; passo: number }> = [
  { chave: "metalness", rotulo: "Metalicidade", min: 0, max: 1, passo: 0.01 },
  { chave: "roughness", rotulo: "Rugosidade", min: 0, max: 1, passo: 0.01 },
  { chave: "transmission", rotulo: "Transmissão", min: 0, max: 1, passo: 0.01 },
  { chave: "ior", rotulo: "Índice de refração (IOR)", min: 1, max: 2.5, passo: 0.01 },
  { chave: "clearcoat", rotulo: "Verniz (clearcoat)", min: 0, max: 1, passo: 0.01 },
  { chave: "clearcoatRoughness", rotulo: "Rugosidade do verniz", min: 0, max: 1, passo: 0.01 },
  { chave: "specularIntensity", rotulo: "Intensidade especular", min: 0, max: 1, passo: 0.01 },
  { chave: "anisotropy", rotulo: "Anisotropia", min: 0, max: 1, passo: 0.01 },
  { chave: "emissiveIntensityDay", rotulo: "Emissão de dia", min: 0, max: 20, passo: 0.05 },
  { chave: "emissiveIntensityNight", rotulo: "Emissão à noite", min: 0, max: 20, passo: 0.05 },
];

interface Formulario {
  perfilId: number | null;
  nome: string;
  familia: CpqMaterialFamily;
  acabamento: string;
  notas: string;
  calibrado: boolean;
  pbr: CpqPbrParameters;
  corOverride: string;
  rotacaoOverrideGraus: string;
}

function formularioDoPerfil(perfil: PerfilAdmin, materia: MateriaAdmin | null): Formulario {
  const overrides = materia?.vinculo?.overrides ?? null;
  return {
    perfilId: perfil.id,
    nome: perfil.nome,
    familia: perfil.familia,
    acabamento: perfil.acabamento ?? "",
    notas: perfil.notas ?? "",
    calibrado: perfil.calibrado,
    pbr: perfil.pbr as unknown as CpqPbrParameters,
    corOverride: overrides?.colorHex ?? "",
    rotacaoOverrideGraus: overrides?.anisotropyRotationRad != null ? String(Math.round((overrides.anisotropyRotationRad * 180) / Math.PI)) : "",
  };
}

function formularioNovo(familia: CpqMaterialFamily, nome: string): Formulario {
  return { perfilId: null, nome, familia, acabamento: "", notas: "", calibrado: false, pbr: presetPbr(familia), corOverride: "", rotacaoOverrideGraus: "" };
}

const estiloCaixa = (cor: "warn" | "bad" | "ok") => ({ background: `var(--${cor}-soft)`, border: `1px solid color-mix(in oklab, var(--${cor}) 35%, var(--border))`, borderRadius: 10, padding: "9px 12px", fontSize: 12.5 });

/**
 * Administração > Materiais 3D (gestor, admin e master): liga cada matéria-prima do MubiSys a um perfil visual (PBR) versionado,
 * com mapas de textura, escala real, calibração e comparação com a foto da amostra. Presets são só ponto de partida.
 */
export function AdminMateriais3D() {
  const [catalogo, setCatalogo] = useState<CatalogoAdmin | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<StatusMaterial3d | "todos">("todos");
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setCatalogo(await listarAdmin());
      setErro(null);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar os materiais 3D.");
    }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const materia = useMemo(() => catalogo?.materias.find(item => item.id === selecionada) ?? null, [catalogo, selecionada]);
  const perfilAtual = useMemo(() => (form?.perfilId ? catalogo?.perfis.find(perfil => perfil.id === form.perfilId) ?? null : null), [catalogo, form?.perfilId]);

  const selecionar = (item: MateriaAdmin) => {
    setSelecionada(item.id);
    setAviso(null);
    const perfil = item.vinculo ? catalogo?.perfis.find(candidato => candidato.id === item.vinculo!.profileId) : null;
    setForm(perfil ? formularioDoPerfil(perfil, item) : formularioNovo("generic_dielectric", item.nome.slice(0, 120)));
  };

  const lista = useMemo(() => (catalogo?.materias ?? []).filter(item => {
    if (filtro !== "todos" && item.status !== filtro) return false;
    const termo = busca.trim().toLowerCase();
    return !termo || item.nome.toLowerCase().includes(termo) || String(item.id) === termo.replace("#", "");
  }).slice(0, 300), [catalogo, busca, filtro]);

  const salvar = async () => {
    if (!form || !materia) return;
    setOcupado(true);
    setAviso(null);
    try {
      const entrada = { nome: form.nome, familia: form.familia, acabamento: form.acabamento || null, notas: form.notas || null, calibrado: form.calibrado, pbr: form.pbr as unknown as Record<string, unknown> };
      let perfilId = form.perfilId;
      let mensagem = "Perfil salvo e vinculado.";
      if (perfilId) {
        const resposta = await atualizarPerfil(perfilId, entrada);
        perfilId = resposta.id;
        if (resposta.novaVersao) mensagem = `Este perfil já foi usado em propostas aprovadas: criada a versão ${resposta.versao}, e os vínculos foram repontados. Propostas antigas continuam com a versão anterior.`;
      } else {
        perfilId = (await criarPerfil(entrada)).id;
      }
      const overrides = {
        ...(form.corOverride ? { colorHex: form.corOverride } : {}),
        ...(form.rotacaoOverrideGraus !== "" && Number.isFinite(Number(form.rotacaoOverrideGraus)) ? { anisotropyRotationRad: (Number(form.rotacaoOverrideGraus) * Math.PI) / 180 } : {}),
      };
      await salvarVinculo(materia.id, { profileId: perfilId, overrides: Object.keys(overrides).length ? overrides : null });
      await carregar();
      setForm(valor => (valor ? { ...valor, perfilId } : valor));
      setAviso(mensagem);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar.");
    } finally {
      setOcupado(false);
    }
  };

  const desvincular = async () => {
    if (!materia) return;
    setOcupado(true);
    try {
      await salvarVinculo(materia.id, { profileId: null });
      await carregar();
      setForm(formularioNovo("generic_dielectric", materia.nome.slice(0, 120)));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível desvincular.");
    } finally {
      setOcupado(false);
    }
  };

  const trocarPerfil = (id: string) => {
    if (!catalogo || !materia) return;
    if (id === "novo") { setForm(formularioNovo("generic_dielectric", materia.nome.slice(0, 120))); return; }
    const perfil = catalogo.perfis.find(candidato => candidato.id === Number(id));
    if (perfil) setForm(formularioDoPerfil(perfil, materia.vinculo?.profileId === perfil.id ? materia : null));
  };

  const atualizarPbr = (chave: keyof CpqPbrParameters, valor: unknown) => setForm(atual => (atual ? { ...atual, pbr: { ...atual.pbr, [chave]: valor } as CpqPbrParameters } : atual));

  if (!catalogo && !erro) return <div className="card"><div className="role-note">Carregando materiais 3D…</div></div>;
  if (!catalogo) return <div className="card"><div style={estiloCaixa("bad")}>{erro}</div></div>;

  const perfisAtivos = catalogo.perfis.filter(perfil => perfil.ativo);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="cardhead">
          <div>
            <h3>Materiais 3D</h3>
            <p>Liga cada matéria-prima do MubiSys a um perfil visual (PBR). Os valores iniciais são pontos de calibração, não dados do fabricante: compare com a amostra física e marque "calibrado". Perfis usados em propostas aprovadas são imutáveis — editar cria uma nova versão.</p>
          </div>
        </div>
        {catalogo.catalogoErro && <div style={estiloCaixa("warn")}>{catalogo.catalogoErro}</div>}
        {erro && <div style={estiloCaixa("bad")} role="alert">{erro}</div>}
        {aviso && <div style={estiloCaixa("ok")} role="status">{aviso}</div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <input type="text" placeholder="Buscar por nome ou #código" value={busca} onChange={evento => setBusca(evento.target.value)} aria-label="Buscar matéria-prima" style={{ minWidth: 240 }} />
          <select value={filtro} onChange={evento => setFiltro(evento.target.value as StatusMaterial3d | "todos")} aria-label="Filtrar por situação">
            <option value="todos">Todas as situações</option>
            {(Object.keys(ROTULO_STATUS) as StatusMaterial3d[]).map(status => <option key={status} value={status}>{ROTULO_STATUS[status].texto}</option>)}
          </select>
          <span className="role-note">{lista.length} de {catalogo.materias.length} matérias-primas</span>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card" style={{ padding: 0 }}>
          <div className="tablewrap" style={{ maxHeight: 640, overflowY: "auto" }}>
            <table>
              <thead><tr><th>Matéria-prima</th><th>Tipo</th><th>Espessura</th><th>Situação</th></tr></thead>
              <tbody>
                {lista.map(item => (
                  <tr key={item.id} onClick={() => selecionar(item)} style={{ cursor: "pointer", background: item.id === selecionada ? "var(--accent-soft)" : undefined }}>
                    <td><b>#{item.id}</b> {item.nome}<div className="role-note" style={{ fontSize: 11.5 }}>{item.categoriaLocal ?? item.categoriaMubisys}</div></td>
                    <td>{item.tipoFisico}</td>
                    <td className="num">{item.espessuraMm ? `${item.espessuraMm} mm` : "—"}</td>
                    <td><span className={`badge ${ROTULO_STATUS[item.status].classe}`}>{ROTULO_STATUS[item.status].texto}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          {!materia || !form ? <div className="role-note">Escolha uma matéria-prima para ver e editar o perfil visual.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 14 }}>#{materia.id} · {materia.nome}</h3>
                <div className="role-note" style={{ fontSize: 12 }}>
                  Dados físicos herdados do cadastro: {materia.tipoFisico}
                  {materia.espessuraMm ? ` · espessura ${materia.espessuraMm} mm` : " · espessura não cadastrada"}
                  {materia.perfilAlturaMm ? ` · perfil ${materia.perfilAlturaMm} × ${materia.perfilLarguraMm ?? "?"} mm` : ""}. Edite-os em Administração &gt; Produtos &gt; Matérias-primas.
                </div>
              </div>

              <label className="field">Perfil visual
                <select value={form.perfilId ?? "novo"} onChange={evento => trocarPerfil(evento.target.value)}>
                  <option value="novo">+ Novo perfil (a partir de um preset)</option>
                  {perfisAtivos.map(perfil => <option key={perfil.id} value={perfil.id}>{perfil.nome} · v{perfil.versao}{perfil.calibrado ? " · calibrado" : ""}</option>)}
                </select>
              </label>
              {perfilAtual?.travado && <div style={estiloCaixa("warn")}>Este perfil já foi usado em propostas aprovadas. Ao salvar, será criada uma nova versão (as propostas antigas não mudam).</div>}
              {perfilAtual && perfilAtual.vinculos > 1 && <div className="role-note">Usado por {perfilAtual.vinculos} matérias-primas.</div>}

              <div className="grid2">
                <label className="field">Nome<input type="text" value={form.nome} maxLength={160} onChange={evento => setForm({ ...form, nome: evento.target.value })} /></label>
                <label className="field">Família
                  <select value={form.familia} onChange={evento => { const familia = evento.target.value as CpqMaterialFamily; setForm({ ...form, familia, pbr: form.perfilId ? form.pbr : presetPbr(familia) }); }}>
                    {catalogo.familias.map(familia => <option key={familia} value={familia}>{ROTULO_MATERIAL_FAMILY[familia]}</option>)}
                  </select>
                </label>
                <label className="field">Acabamento (ex.: escovado 180 grit, PU fosco)<input type="text" value={form.acabamento} maxLength={160} onChange={evento => setForm({ ...form, acabamento: evento.target.value })} /></label>
                <label className="field">Cor base<input type="color" value={form.pbr.colorHex} onChange={evento => atualizarPbr("colorHex", evento.target.value)} /></label>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setForm({ ...form, pbr: presetPbr(form.familia) })}>Restaurar o preset da família</button>

              <div className="grid2">
                {CAMPOS_NUMERICOS.map(campo => (
                  <label className="field" key={campo.chave}>{campo.rotulo}: {(form.pbr[campo.chave] as number).toFixed(2)}
                    <input type="range" min={campo.min} max={campo.max} step={campo.passo} value={form.pbr[campo.chave] as number} onChange={evento => atualizarPbr(campo.chave, Number(evento.target.value))} />
                  </label>
                ))}
                <label className="field">Direção do veio (graus)
                  <input type="number" step={5} value={Math.round((form.pbr.anisotropyRotationRad * 180) / Math.PI)} onChange={evento => atualizarPbr("anisotropyRotationRad", (Number(evento.target.value) * Math.PI) / 180)} />
                </label>
                <label className="field">Distância de atenuação (mm, vazio = nenhuma)
                  <input type="number" min={1} value={form.pbr.attenuationDistanceMm ?? ""} onChange={evento => atualizarPbr("attenuationDistanceMm", evento.target.value === "" ? null : Number(evento.target.value))} />
                </label>
                <label className="field">Cor de atenuação<input type="color" value={form.pbr.attenuationColorHex} onChange={evento => atualizarPbr("attenuationColorHex", evento.target.value)} /></label>
                <label className="field">Cor da emissão<input type="color" value={form.pbr.emissiveHex} onChange={evento => atualizarPbr("emissiveHex", evento.target.value)} /></label>
              </div>

              <div className="grid2">
                <label className="field">Override do vínculo · cor (opcional)<input type="text" placeholder="#rrggbb" value={form.corOverride} onChange={evento => setForm({ ...form, corOverride: evento.target.value })} /></label>
                <label className="field">Override do vínculo · veio (graus, opcional)<input type="number" step={5} value={form.rotacaoOverrideGraus} onChange={evento => setForm({ ...form, rotacaoOverrideGraus: evento.target.value })} /></label>
              </div>

              <label className="field">Notas de calibração (origem dos valores, amostra usada)
                <textarea rows={3} value={form.notas} maxLength={4000} onChange={evento => setForm({ ...form, notas: evento.target.value })} style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: 8, fontFamily: "inherit" }} />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={form.calibrado} onChange={evento => setForm({ ...form, calibrado: evento.target.checked })} />
                Calibrado contra a amostra física (compare abaixo com a foto de referência)
              </label>

              <PreviewMaterial pbr={form.pbr} familia={form.familia} espessuraMm={materia.espessuraMm} assets={perfilAtual?.assets ?? []} />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-primary" disabled={ocupado || form.nome.trim().length < 2} onClick={() => void salvar()}>{form.perfilId ? "Salvar perfil e vincular" : "Criar perfil e vincular"}</button>
                {materia.vinculo && <button type="button" className="btn btn-ghost" disabled={ocupado} onClick={() => void desvincular()}>Desvincular</button>}
                {perfilAtual && !perfilAtual.travado && perfilAtual.vinculos <= 1 && (
                  <button type="button" className="btn btn-ghost" disabled={ocupado} onClick={() => { if (window.confirm("Excluir este perfil visual?")) { void desvincular().then(() => excluirPerfil(perfilAtual.id)).then(carregar).catch(falha => setErro(falha instanceof Error ? falha.message : "Não foi possível excluir.")); } }}>Excluir perfil</button>
                )}
              </div>

              {perfilAtual
                ? <MapasDoPerfil perfil={perfilAtual} recarregar={carregar} aoErro={setErro} />
                : <div className="role-note">Salve o perfil para poder enviar mapas de textura e fotos de referência.</div>}
            </div>
          )}
        </div>
      </div>
      <GuiaAtivos />
    </div>
  );
}

function MapasDoPerfil({ perfil, recarregar, aoErro }: { perfil: PerfilAdmin; recarregar: () => Promise<void>; aoErro: (mensagem: string | null) => void }) {
  const [tipo, setTipo] = useState<CpqTextureKind>("baseColor");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [larguraTile, setLarguraTile] = useState("");
  const [alturaTile, setAlturaTile] = useState("");
  const [calibrado, setCalibrado] = useState(false);
  const [origem, setOrigem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const referencia = tipo === "reference";

  const enviar = async () => {
    if (!arquivo) return;
    setEnviando(true);
    aoErro(null);
    try {
      await enviarMapa(perfil.id, arquivo, {
        kind: tipo,
        tileWidthMm: referencia ? undefined : Number(larguraTile),
        tileHeightMm: referencia ? undefined : Number(alturaTile),
        calibrated: calibrado,
        sourceNote: origem || undefined,
      });
      setArquivo(null);
      await recarregar();
    } catch (falha) {
      aoErro(falha instanceof Error ? falha.message : "Não foi possível enviar a imagem.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      <h4 style={{ fontSize: 13.5, marginBottom: 6 }}>Mapas e fotos</h4>
      {perfil.travado && <div style={{ ...estiloCaixa("warn"), marginBottom: 8 }}>Perfil já usado em propostas: para trocar mapas, salve o perfil (cria a nova versão) e envie os mapas nela.</div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        {perfil.assets.map(asset => (
          <figure key={asset.id} style={{ margin: 0, width: 130 }}>
            <img src={asset.url} alt={ROTULO_MAPA[asset.kind]} loading="lazy" style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
            <figcaption style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {ROTULO_MAPA[asset.kind]}<br />
              {asset.widthPx}×{asset.heightPx}px{asset.tileWidthMm ? ` · tile ${asset.tileWidthMm}×${asset.tileHeightMm} mm` : ""}{asset.calibrated ? " · calibrado" : ""}
            </figcaption>
            {!perfil.travado && <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 3 }} onClick={() => void removerMapa(perfil.id, asset.id).then(recarregar).catch(falha => aoErro(falha instanceof Error ? falha.message : "Falha ao remover."))}>Remover</button>}
          </figure>
        ))}
        {!perfil.assets.length && <span className="role-note">Nenhum mapa enviado: o perfil usa só os valores paramétricos.</span>}
      </div>
      {!perfil.travado && (
        <div className="grid2">
          <label className="field">Tipo de mapa
            <select value={tipo} onChange={evento => setTipo(evento.target.value as CpqTextureKind)}>
              {Object.entries(ROTULO_MAPA).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
          </label>
          <label className="field">Imagem (PNG, JPEG ou WebP, até 4 MB e 4096 px)
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={evento => setArquivo(evento.target.files?.[0] ?? null)} />
          </label>
          {!referencia && <>
            <label className="field">O tile mede (largura, mm reais)<input type="number" min={1} value={larguraTile} onChange={evento => setLarguraTile(evento.target.value)} /></label>
            <label className="field">O tile mede (altura, mm reais)<input type="number" min={1} value={alturaTile} onChange={evento => setAlturaTile(evento.target.value)} /></label>
          </>}
          <label className="field">Origem / observação<input type="text" maxLength={500} value={origem} onChange={evento => setOrigem(evento.target.value)} /></label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={calibrado} onChange={evento => setCalibrado(evento.target.checked)} /> Mapa calibrado</label>
          <div className="role-note" style={{ gridColumn: "1 / -1", fontSize: 12 }}>Espaço de cor: {COLOR_SPACE_PADRAO_POR_TIPO[tipo] === "srgb" ? "sRGB (cor)" : "dados, sem conversão (normal, rugosidade, metalicidade, anisotropia, AO)"}.</div>
          <div><button type="button" className="btn btn-soft" disabled={enviando || !arquivo || (!referencia && !(Number(larguraTile) > 0 && Number(alturaTile) > 0))} onClick={() => void enviar()}>{enviando ? "Enviando…" : "Enviar mapa"}</button></div>
        </div>
      )}
    </div>
  );
}

function GuiaAtivos() {
  return (
    <div className="card">
      <div className="cardhead"><div><h3>Como criar ativos reais de um material</h3><p>Foto de referência e mapa PBR são coisas diferentes: a foto serve para comparar; o mapa alimenta o shader.</p></div></div>
      <ol style={{ margin: "0 0 0 18px", padding: 0, fontSize: 13, lineHeight: 1.6 }}>
        <li>Fotografe a amostra plana e limpa, com a câmera perpendicular e luz difusa.</li>
        <li>Use um cartão de cor/cinza na cena.</li>
        <li>Remova luz, reflexos e vinheta do mapa de cor base (ele não pode ter luz gravada).</li>
        <li>Faça o tile sem emenda sem apagar o caráter do material.</li>
        <li>Meça quantos milímetros reais o tile representa e informe ao enviar.</li>
        <li>Capture ou produza normal e rugosidade separadamente (não derive tudo de uma foto comum).</li>
        <li>Em inox escovado, registre a direção e a escala do veio.</li>
        <li>Em acrílico, cadastre a cor, a transmissão de luz e a espessura.</li>
        <li>Em pintura PU, cadastre a tinta e o acabamento; o metal só aparece em borda exposta.</li>
        <li>Compare Dia e Noite no HDRI padrão com fotos reais antes de marcar "calibrado".</li>
      </ol>
    </div>
  );
}
