# Robô Auditor — Campanhas WhatsApp

**Fase:** implementação do Prompt 02

**Catálogo:** CAMP-001…CAMP-074 importados de `docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md`, mais CAMP-075…CAMP-084
**Estado:** código em preparação nesta branch; a implantação e o primeiro CI ainda precisam ser confirmados.

## O que foi implementado

- Aba administrativa **Robô Auditor** no módulo Campanhas, visível para `admin` e `master`; catálogo, histórico e execução também são protegidos por role no servidor.
- Catálogo com ID estável, nome, descrição, módulo, critérios de aceite, criticidade, referências de teste, estado inicial e evidência documental. O sincronizador do servidor persiste os 84 itens em `campanhas_auditor_requisitos` sem substituir o estado/evidência das verificações já realizadas.
- Estados independentes: não implementado, implementado/não testado, aprovado em simulação, aprovado em integração real, aprovado em ambiente publicado, reprovado, bloqueado por dependência e inconclusivo.
- Execução manual segura: valida catálogo, verifica `SELECT 1`, confirma as tabelas do Auditor e roda sete autotestes sintéticos. Não dispara WhatsApp, chama MubiSys/Ceci.Chat, consulta clientes, cria O.S. ou altera dados comerciais.
- Histórico por execução em `campanhas_auditor_execucoes`, com escopo, executor, metadados de versão, resumo, resultados e evidências sanitizadas. Um trigger bloqueia alterações e exclusões depois que a execução é finalizada; execuções interrompidas permanecem identificadas como não finalizadas.
- Tela com filtro por módulo, cobertura de requisitos verificados e taxa de aprovação de testes em indicadores separados, pendências, alertas, detalhes de falhas, histórico, identificação disponível do runtime, download JSON e cópia técnica.
- Autotestes de falhas controladas para botão sem ação, cálculo divergente, recurso ausente, teste ignorado, bypass de opt-out, evento duplicado e SHA divergente. São fixtures em memória; não exercitam os fluxos reais do produto.
- GitHub Actions em pull request, push para `main`/branch desta fase, execução manual e agendamento semanal. O job usa PostgreSQL 16 efêmero, aplica migrations, executa typecheck, testes, build e um gate que falha se os testes críticos do manifesto estiverem ausentes, ignorados ou reprovados.

## Como interpretar uma execução

**Cobertura** significa quantos requisitos no escopo tiveram pelo menos um check executado naquela execução. **Taxa de aprovação** significa quantos checks executados passaram. Nenhum desses percentuais representa a porcentagem de funcionalidades comerciais funcionando.

A execução manual cobre o catálogo, a classificação sem aprovação por presença de código, a sanitização, autotestes, conectividade e persistência do próprio histórico. As funcionalidades comerciais que não foram verificadas mantêm seu estado documental e aparecem como não verificadas nesta execução. A aprovação dos autotestes vale para o comportamento sintético do detector; não aprova botão, opt-out, cálculos, eventos ou integração comercial real.

`CAMP-068` fica inconclusivo: o painel pode exibir SHA/branch fornecidos pelo runtime, mas não consulta GitHub nem a plataforma de deploy para confirmar push, branch remota ou versão efetivamente publicada. Push e deploy continuam sendo estados separados.

## Segurança e ambiente de testes

O workflow cria um PostgreSQL descartável por execução. O modo `AUDITOR_TEST_DATABASE=1` troca as consultas do driver Neon para conexão TCP local, somente durante esse job. O teste que confirma imutabilidade do histórico se recusa a executar a menos que o host seja `localhost`/`127.0.0.1` e o banco se chame exatamente `radrasys_campaigns_ci`. Os testes locais que acessam banco continuam sujeitos às regras gerais de `AGENTS.md`; não devem usar um banco de produção.

O painel manual escreve somente nas duas tabelas do Auditor, pois precisa guardar catálogo e histórico. As consultas de prontidão são somente leitura. Tokens, URLs de banco, e-mails e telefones são removidos dos textos registrados; os autotestes usam valores fictícios.

## Limites e trabalho ainda pendente

- O teste de painel usa Testing Library + jsdom; ainda não há automação Playwright do navegador.
- Os testes de fluxo inbound, eventos reais, bot/humano, lead, identidade ERP, atribuição de venda, faturamento, margem, ROI, A/B e relatórios comerciais continuam pendentes conforme o catálogo. O Auditor não os substitui.
- Os testes de integração só são considerados executados depois que o workflow for rodado em CI. O ambiente desta implementação não tem PostgreSQL local/Docker, então as suítes que escrevem no banco não foram executadas localmente.
- O workflow está versionado, mas não configura sozinho proteção de branch nem o gate de deploy da Vercel. É necessário tornar o check **“Typecheck, migrations, testes e build isolados”** obrigatório nas regras do GitHub e confirmar a configuração de builds/deploy externo.
- A auditoria periódica do CI produz logs e artefato JSON do Vitest por 14 dias; ela ainda não grava resultados agendados na tabela de histórico da aplicação.
- Integrações reais e homologação do provedor não são testadas pelo botão manual. Exigem sandbox/credenciais e validação explícita separadas.

## Migration e implantação

A migration deste módulo cria catálogo, histórico, índices e proteção de imutabilidade. Ela deve ser revisada e aplicada pelo pipeline normal após merge/deploy autorizado. Nenhuma migration foi aplicada neste ambiente durante a implementação. Concluir commit/push desta branch não equivale a publicar o sistema.
