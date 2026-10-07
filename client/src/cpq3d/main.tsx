/**
 * Ilha React do 3D dentro do HTML legado do CPQ (client/cpq-letreiros-express.html).
 *
 * O legado reconstrói `#shell` inteiro a cada `render()`, o que destruiria um canvas WebGL a cada clique. Por isso cada tela da
 * ilha vive num HOST persistente (um <div> com a própria raiz React) que é MOVIDO para o ponto de montagem novo depois de cada
 * render do legado (`sync()`), em vez de recriar o React/WebGL. Um host que fica sem ponto de montagem por mais de 25 s é
 * desmontado (libera a GPU). Os módulos pesados (Three.js, R3F) são carregados sob demanda.
 */
import { Component, lazy, Suspense, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { sugerirRenderRole } from "@shared/cpq-render3d";
import { notificarMudancaDoLegado } from "./bridge";

const App3d = lazy(() => import("./components/CpqRender3dApp").then(modulo => ({ default: modulo.CpqRender3dApp })));
const Admin3d = lazy(() => import("./components/AdminMateriais3D").then(modulo => ({ default: modulo.AdminMateriais3D })));
const Publico3d = lazy(() => import("./components/PublicRender3d").then(modulo => ({ default: modulo.PublicRender3d })));

class LimiteDeErro extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  componentDidCatch(erro: unknown) { console.error("[CPQ 3D] Falha na ilha:", erro); }
  render() {
    return this.state.erro
      ? <div className="card"><div className="role-note">Não foi possível carregar a visualização 3D. Recarregue a página (Ctrl+F5).</div></div>
      : this.props.children;
  }
}

const carregando = <div className="role-note" style={{ padding: 12 }}>Carregando o 3D…</div>;
const envolver = (conteudo: ReactNode) => <LimiteDeErro><Suspense fallback={carregando}>{conteudo}</Suspense></LimiteDeErro>;

interface Host {
  container: HTMLDivElement;
  root: Root;
  semAlvoDesde: number | null;
}

const hosts = new Map<string, Host>();
const LIMITE_SEM_ALVO_MS = 25_000;
let temporizadorLimpeza: number | null = null;

function obterHost(chave: string, criar: () => ReactNode): Host {
  let host = hosts.get(chave);
  if (!host) {
    const container = document.createElement("div");
    container.dataset.cpq3dHost = chave;
    const root = createRoot(container);
    root.render(criar());
    host = { container, root, semAlvoDesde: null };
    hosts.set(chave, host);
  }
  return host;
}

function posicionar(chave: string, alvo: Element | null, criar: () => ReactNode): void {
  if (alvo) {
    const host = obterHost(chave, criar);
    host.semAlvoDesde = null;
    if (host.container.parentElement !== alvo) alvo.appendChild(host.container);
    return;
  }
  const host = hosts.get(chave);
  if (host && host.semAlvoDesde == null) host.semAlvoDesde = Date.now();
}

function limparHostsAbandonados(): void {
  const agora = Date.now();
  for (const [chave, host] of hosts) {
    if (host.semAlvoDesde != null && agora - host.semAlvoDesde > LIMITE_SEM_ALVO_MS) {
      host.root.unmount();
      host.container.remove();
      hosts.delete(chave);
    }
  }
}

function sync(): void {
  posicionar("render3d", document.getElementById("cpq-render3d-root"), () => envolver(<App3d />));
  posicionar("admin3d", document.getElementById("cpq-materiais3d-root"), () => envolver(<Admin3d />));

  const publicos = new Set<string>();
  document.querySelectorAll<HTMLElement>("[data-cpq-3d-publico]").forEach(elemento => {
    const token = elemento.dataset.token || undefined;
    const grupoId = elemento.dataset.grupo || undefined;
    if (!token && !grupoId) return;
    const chave = `publico:${grupoId ?? token}`;
    publicos.add(chave);
    posicionar(chave, elemento, () => envolver(<Publico3d token={token} grupoId={grupoId} />));
  });
  for (const chave of hosts.keys()) if (chave.startsWith("publico:") && !publicos.has(chave)) posicionar(chave, null, () => null);

  notificarMudancaDoLegado();
  if (temporizadorLimpeza != null) window.clearTimeout(temporizadorLimpeza);
  temporizadorLimpeza = window.setTimeout(() => { temporizadorLimpeza = null; limparHostsAbandonados(); }, LIMITE_SEM_ALVO_MS + 1000);
}

window.CPQ3DIsland = { sync, sugerirRenderRole, versao: "1" };
// O legado pode ter renderizado antes deste módulo (script deferido) carregar.
sync();
