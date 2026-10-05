# Bobinas no CPQ — checklist para subir para produção

Contexto: bobinas (adesivo comum, papel kraft) têm só a largura fixa; o comprimento nunca é cadastrado.
O nesting mede o comprimento de rolo que o layout consome e cobra **largura × comprimento consumido**.
Detalhes técnicos: seção "Bobinas" de `AGENTS.md` (CPQ nesting backend). Pedido de 05/10/2026.

## 1. Banco de dados (obrigatório, antes de publicar o código)

O código novo lê colunas que só existem depois das migrations. Publicar sem migrar quebra o cadastro de
matérias-primas e o nesting.

- [ ] Conferir quais migrations o banco de produção já tem (`drizzle.__drizzle_migrations`): a **0078** e as
  seguintes (**0079 a 0082** na data deste documento) ainda não foram aplicadas lá.
- [ ] Aplicar com `npx drizzle-kit migrate` (nunca SQL solto). As migrations são só aditivas
  (colunas novas com default + um `INSERT` de seed), então não alteram dados existentes.
- [ ] **0078** (`0078_bobinas_materias_primas.sql`): `estudio_chapas.bobina` (default `false`),
  `materia_prima_categorias.usa_dados_bobina` (default `false`) e a categoria **Bobinas**. Se já existir uma
  categoria chamada "Bobinas", ela é apenas marcada como de bobina (`ON CONFLICT … DO UPDATE`).
- [ ] 0079 a 0082 (perfil, peso específico, `tem_cor`): vieram de outras tarefas, mas o cadastro de
  matérias-primas e a rota de chapas dependem delas junto com a 0078.
- [ ] Depois de migrar: `select nome, usa_dados_bobina from materia_prima_categorias` deve listar "Bobinas" com `true`.
- [ ] Rollback: as colunas novas são inofensivas se o código antigo voltar; não é preciso reverter a migration.

## 2. Cadastro inicial dos materiais (Produtos > Matérias-primas)

Fazer com um usuário **gestor, admin ou master**. Para cada material: **Editar** → Categoria **Bobinas** →
preencher → **Salvar**.

| Material (MubiSys) | Largura do rolo | Espessura (obrigatória) | Observação |
| --- | --- | --- | --- |
| Papel Kraft Pardo Embrulho Mercado Livre 120cm 200m 80g (#1098) | 1200 mm | informar (campo aceita mm ou µm) | confirmado no catálogo como 120 cm |
| Adesivo comum (não impresso) | 1200 mm | informar | **confirmar qual item do MubiSys é** — candidatos vistos no catálogo: #4448 "Adesivo Vinil Branco Impresso Recortado" e #4377 "Adesivo Vinil Transparente Impresso + Branco" (os nomes dizem "Impresso"; o adesivo comum pode ter outro cadastro) |

- [ ] O "Adesivo Imprimax Sortido 1,22" (#1147, mídia em rolo) tem **1220 mm**, não 1200. Só entra aqui se
  for consumido pelo nesting; se entrar, cadastrar 1220.
- [ ] Cada largura recebe uma identificação (ex.: "Bobina 1200 mm"; vazio assume esse padrão) e uma marcada como principal.
- [ ] **Unidade de custo no MubiSys:** o nesting só calcula custo de bobina quando a unidade é **m²** ou
  **metro linear (m/ml)**. O kraft #1098 aparece no MubiSys com unidade `Unidade/Gl/Lt/Kg`, que **não converte**:
  o orçamento fica bloqueado com o alerta "Unidade de custo … não converte em consumo de bobina". Antes de
  liberar para os vendedores, ajustar a unidade/custo no MubiSys (ou aceitar o bloqueio visível).
- [ ] Lembrar: a rota/tela antiga **Administração > Chapas para nesting** não edita bobinas (responde 409).

## 3. Validação em produção (depois de publicar)

- [ ] Em Produtos > Matérias-primas, abrir o kraft: aparece "Dados da bobina", a largura salva e a lista mostra
  "Bobina · 1200 mm".
- [ ] Abrir um orçamento no CPQ com um item que consome a bobina e rodar factibilidade + nesting: o cartão do
  material deve mostrar **"Bobina / Rolo … largura 1200 mm × comprimento consumido X mm"** e o custo do rolo consumido.
- [ ] Conferir o consumo: área cobrada = 1,2 m × comprimento consumido; custo = área × custo/m² (ou
  comprimento em metros × custo/m).
- [ ] Emitir uma proposta de teste e abrir o link público: a cotação não pode falhar na verificação do recibo
  de nesting ("As métricas de nesting foram alteradas…").

## 4. Validação do motor real (Deepnest) — ainda não feita

O ambiente de desenvolvimento usado até agora **não tem o Deepnest** (sem `DEEPNEST_NODE_BIN`/`DEEPNEST_NODE_ENTRY`,
sem Node 20, sem toolchain C++ para o addon). Os testes automáticos usam o motor simulado. Antes de confiar nos
números em produção, rodar na máquina que tem o Deepnest:

```bash
DEEPNEST_NODE_BIN="<caminho do node 20>" DEEPNEST_NODE_ENTRY="<caminho do módulo que exporta nest>" \
npx tsx server/scripts/validar-bobina-deepnest.ts
```

O script roda 6 cenários (peças pequenas, peça de 5 m, 30 letras, duas larguras de rolo, custo em ml e peça mais
larga que o rolo), mede o tempo de cada um (limite de 60 s) e checa: peças dentro da largura do rolo e do
comprimento consumido, cobrança = largura × comprimento, cobrado ≥ área líquida e quantidade de peças
posicionadas. Termina com código 1 se algo falhar.

Pontos a observar nessa rodada:

- **Timeout:** cada tentativa do motor tem 20 s. A bobina pode fazer 2 tentativas por largura cadastrada
  (comprimento inicial estimado e, se falhar, o teto de 50 000 mm), em sequência. Com duas larguras, o pior caso
  passa de 80 s. O worker real não devolve layout incompleto: ele falha por tempo, e o código trata esse erro
  repetindo com o teto.
- **Comprimento inicial:** é uma heurística (2 × área das caixas ÷ largura + maior lado). Confirmar se não está
  folgado demais (lento) nem apertado demais (cai na segunda tentativa).
- **Qualidade do encaixe:** comparar o comprimento consumido com o esperado por uma conta manual.

## 5. Limitações conhecidas

- Não existe margem lateral de borda do rolo (só o espaçamento entre peças).
- A factibilidade desconta 20 mm de margem de corte por borda (`MARGEM_CORTE_MM`) também no rolo. Pela leitura do
  código, uma peça com mais de 1160 mm de altura pediria emenda mesmo cabendo no rolo de 1200 mm; testado só com
  1500 mm (pede emenda) e com peça comprida de 500 mm de altura (passa), não na faixa 1161–1200 mm.
- No momento da escrita, o peso estimado do letreiro de bobinas usa o peso específico (kg por unidade de custo),
  não a espessura; esse cálculo está sendo movido para o servidor (`cpqPeso.ts`) e pode ter mudado.
- Dimensões de material ficam em mm; unidades de custo do MubiSys (m², ml) e o m²/m do resultado do nesting não foram convertidos.
