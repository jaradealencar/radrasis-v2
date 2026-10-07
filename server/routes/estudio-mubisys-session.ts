import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { fromNodeHeaders } from "better-auth/node";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { auth } from "../_core/auth";
import { ENV } from "../_core/env";
import { importarComposicaoJson } from "../services/mubisysEspelho";
import { parsearComposicoesMubiSys } from "../services/mubisysBOMAutenticada";

const MUBISYS_HOST = "https://mubisys.com";
const MUBISYS_COMPOSICAO_URL = `${MUBISYS_HOST}/index.php?modulo=matModelos&acao=cadastrados`;
const COOKIE_NAME = "radrasys_mubisys_session";
// Persist for a year and renew on use while MubiSys still accepts its session.
const SESSAO_MAX_AGE_SEGUNDOS = 365 * 24 * 60 * 60;
const LIMITE_RESPOSTA_BOM_BYTES = 8 * 1024 * 1024;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

type CookieClaims = { cookie: string; expiresAt: number; radrasysUserId: string };
type CookieJar = Map<string, string>;

function erro(res: Response, status: number, mensagem: string): void {
  res.status(status).json({ error: mensagem });
}

function mesmaOrigem(req: Request, res: Response): boolean {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    if (new URL(origin).host === req.get("host")) return true;
  } catch {
    // Origin inválida é rejeitada abaixo.
  }
  erro(res, 403, "A solicitação precisa vir do próprio sistema.");
  return false;
}

async function exigirSessaoRadrasys(req: Request, res: Response): Promise<string | null> {
  const sessao = await auth.api
    .getSession({ headers: fromNodeHeaders(req.headers) })
    .catch(() => null);
  if (sessao) return sessao.user.id;
  erro(res, 401, "Entre no Radrasys para conectar ao MubiSys.");
  return null;
}

function chaveCriptografia(): Buffer {
  if (!ENV.cookieSecret) {
    throw new Error("A chave de sessão do Radrasys não está configurada.");
  }
  return createHmac("sha256", ENV.cookieSecret).update("estudio-mubisys-session-v1").digest();
}

function selarCookie(cookie: string, radrasysUserId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chaveCriptografia(), iv);
  const claims: CookieClaims = {
    cookie,
    expiresAt: Date.now() + SESSAO_MAX_AGE_SEGUNDOS * 1000,
    radrasysUserId,
  };
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(claims), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map(part => part.toString("base64url"))
    .join(".");
}

function abrirCookie(token: string, radrasysUserId: string): CookieClaims | null {
  try {
    const [ivEncoded, tagEncoded, ciphertextEncoded] = token.split(".");
    if (!ivEncoded || !tagEncoded || !ciphertextEncoded) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      chaveCriptografia(),
      Buffer.from(ivEncoded, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const claims = JSON.parse(plaintext) as CookieClaims;
    if (
      typeof claims.cookie !== "string" ||
      !claims.cookie ||
      typeof claims.expiresAt !== "number" ||
      claims.radrasysUserId !== radrasysUserId ||
      claims.expiresAt <= Date.now()
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

function lerCookieDoRadrasys(req: Request, radrasysUserId: string): CookieClaims | null {
  const cookieHeader = req.get("cookie") || "";
  const prefixo = `${COOKIE_NAME}=`;
  const token = cookieHeader
    .split(";")
    .map(item => item.trim())
    .find(item => item.startsWith(prefixo))
    ?.slice(prefixo.length);
  if (!token) return null;
  try {
    return abrirCookie(decodeURIComponent(token), radrasysUserId);
  } catch {
    return null;
  }
}

export function cookieSessaoMubiSys(req: Request, radrasysUserId: string): string | null {
  return lerCookieDoRadrasys(req, radrasysUserId)?.cookie ?? null;
}

function gravarCookieSessao(req: Request, res: Response, cookie: string, radrasysUserId: string): void {
  const secure = req.secure || ENV.isProduction;
  const valor = encodeURIComponent(selarCookie(cookie, radrasysUserId));
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${valor}; Path=/api/letra-caixa; Max-Age=${SESSAO_MAX_AGE_SEGUNDOS}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
}

function limparCookieSessao(req: Request, res: Response): void {
  const secure = req.secure || ENV.isProduction;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/api/letra-caixa; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
}

function extrairSetCookies(headers: Headers): string[] {
  const headersComSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const varios = headersComSetCookie.getSetCookie?.();
  if (varios?.length) return varios;
  const combinado = headers.get("set-cookie");
  if (!combinado) return [];
  return combinado.split(/,(?=\s*[^;,\s]+=)/g);
}

function atualizarCookies(jar: CookieJar, headers: Headers): void {
  for (const setCookie of extrairSetCookies(headers)) {
    const par = setCookie.split(";", 1)[0];
    const separador = par.indexOf("=");
    if (separador <= 0) continue;
    const nome = par.slice(0, separador).trim();
    const valor = par.slice(separador + 1).trim();
    if (valor) jar.set(nome, valor);
    else jar.delete(nome);
  }
}

function serializarCookies(jar: CookieJar): string {
  return [...jar.entries()].map(([nome, valor]) => `${nome}=${valor}`).join("; ");
}

function atributoHtml(tag: string, nome: string): string | null {
  const escaped = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*([\"'])(.*?)\\1`, "i"));
  return match?.[2] ?? null;
}

function camposOcultos(html: string): Record<string, string> {
  const formulario = html.match(/<form\b[^>]*class=["'][^"']*form-acesso[^"']*["'][^>]*>([\s\S]*?)<\/form>/i)?.[1];
  if (!formulario) throw new Error("Não foi possível identificar o formulário de acesso do MubiSys.");
  const campos: Record<string, string> = {};
  for (const input of formulario.match(/<input\b[^>]*>/gi) ?? []) {
    if ((atributoHtml(input, "type") || "").toLowerCase() !== "hidden") continue;
    const nome = atributoHtml(input, "name");
    if (nome) campos[nome] = atributoHtml(input, "value") || "";
  }
  return campos;
}

async function buscarComCookies(
  urlInicial: string,
  jar: CookieJar,
  init: RequestInit = {},
): Promise<globalThis.Response> {
  let url = new URL(urlInicial);
  let metodo = init.method || "GET";
  let body = init.body;

  for (let tentativa = 0; tentativa < 6; tentativa++) {
    if (url.hostname !== "mubisys.com" && url.hostname !== "www.mubisys.com") {
      throw new Error("O MubiSys redirecionou a conexão para um endereço inesperado.");
    }
    const headers = new Headers(init.headers);
    headers.set("User-Agent", USER_AGENT);
    headers.set("Referer", MUBISYS_COMPOSICAO_URL);
    const cookie = serializarCookies(jar);
    if (cookie) headers.set("Cookie", cookie);

    const response = await fetch(url, {
      ...init,
      method: metodo,
      headers,
      body: metodo === "GET" || metodo === "HEAD" ? undefined : body,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    atualizarCookies(jar, response.headers);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return response;
      url = new URL(location, url);
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && metodo === "POST")) {
        metodo = "GET";
        body = undefined;
      }
      continue;
    }
    return response;
  }
  throw new Error("O MubiSys redirecionou a conexão muitas vezes.");
}

function pareceTelaDeLogin(html: string): boolean {
  return /class=["'][^"']*form-acesso/i.test(html) && /name=["']senha["']/i.test(html);
}

async function obterCookieMubiSys(credenciais: {
  codigo: string;
  usuario: string;
  senha: string;
}): Promise<string> {
  const jar: CookieJar = new Map();
  const loginUrl = `${MUBISYS_HOST}/index.php?modulo=matModelos&acao=cadastrados`;
  const paginaLogin = await buscarComCookies(loginUrl, jar, {
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  if (!paginaLogin.ok) throw new Error("Não foi possível abrir a tela do MubiSys.");
  const htmlLogin = await paginaLogin.text();
  if (!pareceTelaDeLogin(htmlLogin)) {
    throw new Error("A resposta do MubiSys não correspondeu à tela de acesso esperada.");
  }

  const dados = new URLSearchParams(camposOcultos(htmlLogin));
  dados.set("codigo", credenciais.codigo);
  dados.set("usuario", credenciais.usuario);
  dados.set("senha", credenciais.senha);
  const respostaLogin = await buscarComCookies(loginUrl, jar, {
    method: "POST",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: MUBISYS_HOST,
    },
    body: dados.toString(),
  });
  const htmlAposLogin = await respostaLogin.text();
  if (!respostaLogin.ok || pareceTelaDeLogin(htmlAposLogin)) {
    throw new Error("O MubiSys não aceitou o acesso. Confira os dados e tente novamente.");
  }

  // Login e leitura da BOM são etapas distintas. Uma falha HTTP 500 no endpoint da ficha
  // não deve descartar a sessão criada com sucesso.
  const cookie = serializarCookies(jar);
  if (!cookie) throw new Error("O MubiSys não forneceu uma sessão reutilizável.");
  return cookie;
}

/** Consulta o AJAX interno do MubiSys usando a sessão cifrada mantida no navegador do usuário. */
export async function buscarComposicoesMubiSys(cookie: string): Promise<{
  conteudo: unknown;
  contentType: string;
  unauthorized: boolean;
  cookie: string;
}> {
  const jar: CookieJar = new Map();
  for (const par of cookie.split(";")) {
    const separador = par.indexOf("=");
    if (separador <= 0) continue;
    jar.set(par.slice(0, separador).trim(), par.slice(separador + 1).trim());
  }
  const response = await buscarComCookies(MUBISYS_COMPOSICAO_URL, jar, {
    headers: {
      Accept: "application/json, text/html, */*",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  const tamanhoInformado = Number(response.headers.get("content-length"));
  if (Number.isFinite(tamanhoInformado) && tamanhoInformado > LIMITE_RESPOSTA_BOM_BYTES) {
    throw new Error("A ficha técnica do MubiSys excedeu o limite de 8 MB.");
  }
  const leitor = response.body?.getReader();
  const partes: Uint8Array[] = [];
  let totalBytes = 0;
  if (leitor) {
    try {
      while (true) {
        const { done, value } = await leitor.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > LIMITE_RESPOSTA_BOM_BYTES) {
          await leitor.cancel().catch(() => undefined);
          throw new Error("A ficha técnica do MubiSys excedeu o limite de 8 MB.");
        }
        partes.push(value);
      }
    } finally {
      leitor.releaseLock();
    }
  }
  const bytes = Buffer.concat(partes.map(parte => Buffer.from(parte)), totalBytes);
  const text = new TextDecoder().decode(bytes);
  const unauthorized = response.status === 401 || response.status === 403 || pareceTelaDeLogin(text);
  if (!response.ok && !unauthorized) {
    throw new Error(`O MubiSys respondeu HTTP ${response.status} ao consultar a ficha técnica.`);
  }
  let conteudo: unknown = text;
  if (!unauthorized) {
    try {
      conteudo = JSON.parse(text);
    } catch {
      // Algumas telas internas devolvem uma tabela HTML em vez de JSON.
    }
  }
  return {
    conteudo,
    contentType: response.headers.get("content-type") || "",
    unauthorized,
    cookie: serializarCookies(jar),
  };
}

const ROLES_GESTAO = new Set(["admin", "master", "gestor"]);

async function exigirGestao(req: Request, res: Response): Promise<string | null> {
  const sessao = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (!sessao) { erro(res, 401, "Entre no Radrasys para sincronizar a BOM."); return null; }
  if (!ROLES_GESTAO.has(String(sessao.user.role ?? ""))) {
    erro(res, 403, "Somente gestor, admin ou master pode atualizar a BOM compartilhada.");
    return null;
  }
  return sessao.user.id;
}

const tentativasLoginMubiSys = new Map<string, { inicio: number; total: number }>();
function permitirTentativaLogin(userId: string): boolean {
  const agora = Date.now();
  const atual = tentativasLoginMubiSys.get(userId);
  if (!atual || agora - atual.inicio >= 60_000) {
    tentativasLoginMubiSys.set(userId, { inicio: agora, total: 1 });
    return true;
  }
  if (atual.total >= 5) return false;
  atual.total++;
  return true;
}
const credenciaisSchema = z
  .object({
    codigo: z.string().trim().min(1).max(80),
    usuario: z.string().trim().min(1).max(160),
    senha: z.string().min(1).max(256),
  })
  .strict();

/** Conexão por navegador do Radrasys: a senha não é persistida; somente a sessão MubiSys cifrada fica no cookie HttpOnly do usuário. */
export function registrarRotasEstudioMubiSysSession(app: Express): void {
  app.get("/api/letra-caixa/mubisys/sessao", (req: Request, res: Response) => {
    void (async () => {
      if (!mesmaOrigem(req, res)) return;
      const radrasysUserId = await exigirSessaoRadrasys(req, res);
      if (!radrasysUserId) return;
      res.setHeader("Cache-Control", "private, no-store");
      const sessaoMubiSys = lerCookieDoRadrasys(req, radrasysUserId);
      if (sessaoMubiSys) gravarCookieSessao(req, res, sessaoMubiSys.cookie, radrasysUserId);
      res.json({ connected: !!sessaoMubiSys });
    })().catch(error => {
      console.error("[EstudioMubiSys] Falha ao consultar a sessão.", error);
      if (!res.headersSent) erro(res, 500, "Não foi possível consultar a conexão com o MubiSys.");
    });
  });

  app.post("/api/letra-caixa/mubisys/sessao", (req: Request, res: Response) => {
    void (async () => {
      if (!mesmaOrigem(req, res)) return;
      const radrasysUserId = await exigirSessaoRadrasys(req, res);
      if (!radrasysUserId) return;
      if (!permitirTentativaLogin(radrasysUserId)) { erro(res, 429, "Muitas tentativas de conexão. Aguarde um minuto."); return; }
      const parsed = credenciaisSchema.safeParse(req.body);
      if (!parsed.success) {
        erro(res, 400, "Informe o código da empresa, usuário e senha do MubiSys.");
        return;
      }
      if (!ENV.cookieSecret) {
        erro(res, 503, "A sessão segura do Radrasys não está configurada.");
        return;
      }

      let cookieMubiSys: string;
      try {
        cookieMubiSys = await obterCookieMubiSys(parsed.data);
      } catch (error) {
        console.warn("[EstudioMubiSys] Não foi possível conectar ao MubiSys.");
        erro(
          res,
          502,
          error instanceof Error
            ? error.message
            : "Não foi possível conectar ao MubiSys agora.",
        );
        return;
      }

      gravarCookieSessao(req, res, cookieMubiSys, radrasysUserId);
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ connected: true });
    })().catch(error => {
      console.error("[EstudioMubiSys] Falha na conexão.", error);
      if (!res.headersSent) erro(res, 500, "Não foi possível conectar ao MubiSys agora.");
    });
  });

  app.post("/api/letra-caixa/mubisys/composicoes/sincronizar", (req: Request, res: Response) => {
    void (async () => {
      if (!mesmaOrigem(req, res)) return;
      const radrasysUserId = await exigirGestao(req, res);
      if (!radrasysUserId) return;
      const cookie = cookieSessaoMubiSys(req, radrasysUserId);
      if (!cookie) { erro(res, 409, "Conecte o MubiSys neste navegador antes de sincronizar a BOM."); return; }
      let resposta: Awaited<ReturnType<typeof buscarComposicoesMubiSys>>;
      try { resposta = await buscarComposicoesMubiSys(cookie); }
      catch (error) {
        erro(res, 502, error instanceof Error ? error.message : "Falha ao consultar a ficha técnica no MubiSys.");
        return;
      }
      if (resposta.unauthorized) {
        limparCookieSessao(req, res);
        erro(res, 401, "A sessão do MubiSys expirou. Conecte novamente para atualizar a BOM.");
        return;
      }
      const linhas = parsearComposicoesMubiSys(resposta.conteudo);
      const resultado = await importarComposicaoJson({ items: linhas }, "mubisys-sessao.json");
      gravarCookieSessao(req, res, resposta.cookie || cookie, radrasysUserId);
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ ok: true, ...resultado, origem: "sessao-autenticada" });
    })().catch(error => {
      console.error("[EstudioMubiSys] Falha ao sincronizar BOM autenticada:", error instanceof Error ? error.name : "erro");
      if (!res.headersSent) erro(res, 422, error instanceof Error ? error.message : "A sincronização da BOM falhou sem substituir o espelho.");
    });
  });
  app.delete("/api/letra-caixa/mubisys/sessao", (req: Request, res: Response) => {
    void (async () => {
      if (!mesmaOrigem(req, res)) return;
      const radrasysUserId = await exigirSessaoRadrasys(req, res);
      if (!radrasysUserId) return;
      limparCookieSessao(req, res);
      res.json({ connected: false });
    })().catch(error => {
      console.error("[EstudioMubiSys] Falha ao encerrar a sessão.", error);
      if (!res.headersSent) erro(res, 500, "Não foi possível encerrar a conexão com o MubiSys.");
    });
  });
}
