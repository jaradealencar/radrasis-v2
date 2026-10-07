import { useState } from "react";
import type { CpqRenderTextureAsset, CpqResolvedRenderMaterial } from "@shared/cpq-render3d";

/**
 * Fotos de referência dos perfis visuais, para o vendedor/gestor comparar o shader com o material de verdade.
 * Foto de referência é só comparação humana: nunca alimenta o shader (ver `kind = "reference"`).
 */
export function MaterialReferencePanel({ materiais }: { materiais: Array<Pick<CpqResolvedRenderMaterial, "materialName" | "assets" | "role">> }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const comFoto = materiais.flatMap(material => material.assets.filter((asset): asset is CpqRenderTextureAsset => asset.kind === "reference").map(asset => ({ material, asset })));
  if (!comFoto.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Fotos de referência (comparação humana)</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {comFoto.map(({ material, asset }) => (
          <figure key={asset.id} style={{ margin: 0, width: 150 }}>
            <button type="button" onClick={() => setAberta(aberta === asset.url ? null : asset.url)} aria-expanded={aberta === asset.url} style={{ padding: 0, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "none", width: "100%" }}>
              <img src={asset.url} alt={`Referência de ${material.materialName}`} loading="lazy" style={{ display: "block", width: "100%", height: 100, objectFit: "cover" }} />
            </button>
            <figcaption style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 3 }}>{material.materialName}{asset.sourceNote ? ` · ${asset.sourceNote}` : ""}</figcaption>
          </figure>
        ))}
      </div>
      {aberta && <img src={aberta} alt="Foto de referência ampliada" style={{ marginTop: 10, maxWidth: "100%", borderRadius: 10, border: "1px solid var(--border)" }} />}
    </div>
  );
}
