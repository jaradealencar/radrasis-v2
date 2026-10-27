# Estúdio de Arte — aplicativo independente

Ferramenta de redesenho, vetorização e nesting opcional, preparada para ter sua própria hospedagem e domínio. O domínio abre a ferramenta diretamente em `/`.

## O que está separado

- Página inicial e abas próprias, sem o menu do Radrasys.
- Servidor Express dedicado em `server/arte/`, com senha, sessão e chave de integração exclusivos.
- Sem Better Auth, banco PostgreSQL, ERP, catálogo, clientes, orçamentos ou regras comerciais do Radrasys.
- Reaproveita os serviços de desenho e geometria existentes. O build verifica que o servidor não importou banco nem autenticação do ERP.
- O artefato gerado contém somente os arquivos e dependências necessários. Não copie o `.env` do Radrasys para ele.

## Funcionalidades

1. Enviar PNG/JPG e usar original ou redesenhar com GPT Image. Correções por texto usam a imagem atual como referência para uma nova chamada.
2. Vetorizar localmente sem API paga; escolher Vectorizer.AI ou GPT explicitamente. A correção textual de vetor é interpretada somente pelo GPT, que refaz o SVG a partir da imagem aprovada.
3. Preparar o SVG em escala física, escolher peças e organizar até dez grupos reordenáveis. Cada grupo escolhe formato, margem, folga e rotação. Até cem peças por grupo, até oito chapas por cálculo.
4. Consultar referência rápida original/redesenhada, métricas por chapa e totais, baixar SVG em mm com caminhos de corte.
5. Dashboard por projeto: imagens, vetores, nestings, chapas, tentativas e tempo somado de redesenho/vetor; calculadora com custo médio em R$/chamada. Registros com erro/interrupção podem ter cobrança e ficam sem estimativa.
6. Aba explicativa de economia e arquitetura. Integração com contrato OpenAPI, exemplos e indicadores de configuração sem expor chaves.

## Estado local e custos

Histórico e valores por projeto, nomes e formatos de chapa ficam no `localStorage` do navegador. As imagens, SVGs e grupos em edição ficam em memória. Reabrir um projeto recupera seus indicadores, não o arquivo de trabalho; ao trocar de projeto o editor é limpo para não misturar imagens/medidas. Exporte os SVGs e o histórico JSON antes de fechar. Esse armazenamento não é compartilhado entre navegadores ou domínios; mudar o domínio não transfere dados locais automaticamente. Chamadas externas de integração não entram no dashboard do navegador.

O dashboard apresenta estimativas com os valores atuais cadastrados pelo operador, não valores faturados automaticamente. Campo vazio é custo desconhecido. Tokens e créditos são mostrados quando retornados pelo provedor. Hospedagem, impostos e eventual serviço externo de Deepnest não fazem parte da calculadora. A duração inclui tentativas com falha, exclui revisão humana e nesting.

Referências oficiais dos campos de consumo: [Images edits](https://developers.openai.com/api/reference/resources/images/methods/edit) e [Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create). A consulta de autenticação OpenAI não confirma saldo financeiro ou acesso a um modelo específico.

## Desenvolvimento local (sem publicar)

Na raiz do repositório:

```powershell
Copy-Item arte.env.example .env.arte
# Edite .env.arte com senha/segredos exclusivos e ARTE_PUBLIC_URL=http://localhost:4320.
# Configure as chaves de provedor somente se for efetivamente usar as ações pagas.
corepack yarn dev:arte
```

Abra `http://localhost:4320/`. O comando não lê o `.env` do Radrasys e não precisa de banco. Os serviços pagos não têm retentativa nem fallback automático. O nesting funciona com o motor interno quando Deepnest não está configurado.

## Gerar e entregar a aplicação

```powershell
corepack yarn check:arte
corepack yarn build:arte
```

A pasta `dist/arte/` é a entrega independente: `public/index.html`, assets, `server/index.mjs`, `api/index.mjs`, prompts, `package.json`, `yarn.lock`, `.env.example`, `vercel.json` e este guia. O build não publica nada nem altera banco.

### Hospedagem Node

Transfira apenas `dist/arte/` para o servidor. Na raiz dessa pasta, instale com `corepack yarn install --frozen-lockfile --production`. Configure as variáveis do `.env.example` pela hospedagem ou num `.env` privado e execute `corepack yarn start`. Use um proxy HTTPS; a aplicação atende na variável `PORT` (padrão 4320). A pasta de trabalho deve ser a raiz da entrega para os prompts serem encontrados.

### Projeto Vercel separado

Crie um projeto **exclusivo** para a pasta gerada `dist/arte/`; não use o projeto de produção do Radrasys. Ela contém a configuração própria com a página `/` e roteamento `/api/*` para sua função. O responsável precisa conferir se o plano suporta a duração configurada (300 s), o tamanho de upload e as chamadas de IA/nesting. Não há publicação automática no build.

Referências de hospedagem: [funções Node e arquivos .mjs](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration) e [configuração do projeto](https://vercel.com/docs/project-configuration/vercel-json).

Cadastre as variáveis somente nesse projeto. `ARTE_PUBLIC_URL` deve ser a origem HTTPS exata usada pelo navegador, sem barra final. Após comprar o domínio, associe-o ao novo projeto, configure o DNS conforme a hospedagem e ajuste `ARTE_PUBLIC_URL`. URLs de preview diferentes não são aceitas para ações até que a configuração corresponda à origem de uso. Não há domínio comprado ou publicação realizada por esta implementação.

## Credenciais

| Variável                                       | Uso                                                             |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `ARTE_PUBLIC_URL`                              | Origem própria; HTTPS obrigatório em produção                   |
| `ARTE_ACCESS_PASSWORD`                         | Senha privada da interface, mínimo 16 caracteres                |
| `ARTE_SESSION_SECRET`                          | Segredo aleatório de 32+ caracteres para cookies/tickets        |
| `ARTE_INTEGRATION_API_KEY`                     | Bearer de 32+ caracteres para servidor-servidor; vazio desativa |
| `OPENAI_API_KEY`                               | Imagem e SVG por GPT                                            |
| `VECTORIZER_API_ID`, `VECTORIZER_API_SECRET`   | API Vectorizer.AI                                               |
| `CPQ_GPT_SVG_MODEL`                            | Modelo SVG já utilizado; precisa estar habilitado na conta      |
| `DEEPNEST_REMOTE_URL`, `DEEPNEST_REMOTE_TOKEN` | Opcionais; sem eles usa nesting interno                         |

A interface tem um acesso privado compartilhado; não é um sistema de múltiplos usuários com cadastro/roles. Cookie HttpOnly/SameSite Strict, duração de oito horas; alterar a senha invalida as sessões. Alterar o segredo invalida sessões e tickets. A API externa usa chave separada; não a coloque em JavaScript público. Não há tela que leia ou revele secrets. A aba informa se cada credencial está configurada. Limites locais em memória: dez tentativas de login a cada quinze minutos e vinte operações/minuto por IP; em múltiplas instâncias, a hospedagem deve aplicar limites globais no gateway se necessários.

## API para o programador

Contrato autenticado: `GET /api/v1/openapi.json` (também baixável na aba Integração). Todas as chamadas usam `Authorization: Bearer <ARTE_INTEGRATION_API_KEY>` ou sessão da própria ferramenta. `GET /api/health` é público.

- `GET /api/v1/servicos`: credenciais/créditos quando consultáveis, sem consumo de tokens de modelo.
- `GET /api/v1/integracao`: origem, modelos e booleans de configuração.
- `POST /api/v1/redesenho?qualidade=high`: PNG/JPG bruto, retorna PNG e `X-Redesenho-Token`.
- `POST /api/v1/imagem/aprovar`: aprova gratuitamente o original, retorna ticket de seus bytes exatos.
- `POST /api/v1/vetor/vectorizer` ou `/vetor/gpt`: bytes aprovados + ticket; GPT requer PNG; retorna SVG.
- `POST /api/v1/nesting-arte/preparar`: JSON `{svg, larguraMm, alturaMm}`. O SVG deve estar normalizado em caminhos fechados, sem transforms/textos/scripts. O frontend reutilizável `client/src/lib/arte-svg.ts` normaliza formas e transforms antes deste endpoint.
- `POST /api/v1/nesting-arte/calcular`: JSON com grupo, chapa, margens, rotação e peças devolvidas na preparação; confira o contrato completo.

Imagem até 4 MB (a hospedagem pode ter limite menor), JSON até 2 MB. Ticket de imagem dura trinta minutos e é vinculado à sessão/chave e aos bytes exatos. `X-Arte-Instrucoes` usa `encodeURIComponent`, até dois mil caracteres. `X-Arte-Uso` é JSON de contagens disponíveis, não preço. `X-Request-Id` é rastreamento. Não repita uma chamada paga automaticamente se ocorrer timeout: a geração pode ter sido cobrada.

## Validação e publicação

Use fixtures e mocks para validar sem banco, chaves produtivas nem cobranças. A integração real com provedores depende de credenciais válidas, saldo e acesso aos modelos. Publicação, DNS e secrets remotos exigem autorização específica conforme o `AGENTS.md` do repositório.
