import { useEffect, useState } from "react";
import type { CpqRender3dPublicView } from "@shared/cpq-render3d";
import { obterVisaoPublica } from "../api";
import { CpqRender3dViewer } from "./CpqRender3dViewer";

type Itens = Array<{ rotulo: string; visao: CpqRender3dPublicView }>;

/**
 * Visualização 3D do link público (read-only): Dia/Noite, órbita e visão explodida, sem custos, margem, fórmulas nem recibos.
 * Se o WebGL falhar, mostra as imagens estáticas aprovadas pelo vendedor.
 */
export function PublicRender3d({ token, grupoId }: { token?: string; grupoId?: string }) {
  const [itens, setItens] = useState<Itens | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let cancelado = false;
    obterVisaoPublica({ token, grupoId })
      .then(resposta => {
        if (cancelado) return;
        setItens("itens" in resposta
          ? resposta.itens.map(item => ({ rotulo: `${item.numero} · ${item.modeloNome}`, visao: item.visao }))
          : [{ rotulo: "", visao: resposta }]);
      })
      .catch(falha => { if (!cancelado) setErro(falha instanceof Error ? falha.message : "Não foi possível carregar o 3D."); });
    return () => { cancelado = true; };
  }, [token, grupoId]);

  if (erro) return null; // sem 3D (cotação antiga ou sem aprovação): a página segue só com as imagens
  if (!itens) return <div className="role-note">Carregando a visualização 3D…</div>;
  return (
    <section aria-label="Visualização 3D do letreiro" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {itens.map(item => (
        <div key={item.visao.specHash}>
          {item.rotulo && <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{item.rotulo}</div>}
          <CpqRender3dViewer
            spec={item.visao}
            publico
            altura={460}
            imagens={{ dia: item.visao.previewDayUrl, noite: item.visao.previewNightUrl, explodido: item.visao.previewExplodedUrl, animacao: item.visao.previewAnimationUrl ?? null }}
          />
        </div>
      ))}
    </section>
  );
}
