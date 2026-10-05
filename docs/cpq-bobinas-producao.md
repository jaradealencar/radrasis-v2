# Bobinas no CPQ — checklist para subir para produção

Contexto: bobinas (adesivo comum, papel kraft) têm só a largura fixa; o comprimento nunca é cadastrado.
O nesting mede o comprimento de rolo que o layout consome e cobra **largura × comprimento consumido**.
Detalhes técnicos: seção "Bobinas" de `AGENTS.md` (CPQ nesting backend). Pedido de 05/10/2026.

## 1. Banco de dados (obrigatório, antes de publicar o código)

O código novo lê colunas que só existem depois das migrations. Publicar sem migrar quebra o cadastro de
matérias-primas e o nesting.

- [ ] Conferir quais migrations o banco de produção já tem (`drizzle.__drizzle_migrations`): a **0078** e as
  seguintes (**0079 a 0084** na data deste documento) ainda não foram aplicadas lá.
- [ ] Aplicar com `npx drizzle-kit migrate` (nunca SQL solto). As migrations são só aditivas
  (colunas novas com default + um `INSERT` de seed), então não alteram dados existentes.
- [ ] **0078** (`0078_bobinas_materias_primas.sql`): `estudio_chapas.bobina` (default `false`),
  `materia_prima_categorias.usa_dados_bobina` (default `false`) e a categoria **Bobinas**. Se já existir uma
  categoria chamada "Bobinas", ela é apenas marcada como de bobina (`ON CONFLICT … DO UPDATE`).
- [ ] **0083** (`0083_bobina_custo_base.sql`): `materia_prima_cadastros.bobina_custo_base` e
  `bobina_comprimento_rolo_mm` (como o custo do MubiSys é cobrado — ver seção 2).
- [ ] 0079 a 0082 e 0084 (perfil, peso específico, `tem_cor`, formato do perfil): vieram de outras tarefas, mas o
  cadastro de matérias-primas e a rota de chapas dependem delas junto com a 0078 e a 0083.
- [ ] Depois de migrar: `select nome, usa_dados_bobina from materia_prima_categorias` deve listar "Bobinas" com `true`.
- [ ] Rollback: as colunas novas são inofensivas se o código antigo voltar; não é preciso reverter a migration.

## 2. Cadastro inicial dos materiais (Produtos > Matérias-primas)

Fazer com um usuário **gestor, admin ou master**. Para cada material: **Editar** → Categoria **Bobinas** →
preencher → **Salvar**.

| Material (MubiSys) | Largura do rolo | Espessura (obrigatória) | Observação |
| --- | --- | --- | --- |
| Papel Kraft Pardo Embrulho Mercado Livre 120cm 200m 80g (#1098) | 1200 mm | informar (campo aceita mm ou µm; kraft 80 g ≈ 80–100 µm, conferir na ficha) | **Como o custo é cobrado:** o MubiSys traz R$ 2,61 por `Unidade/Gl/Lt/Kg` (movimentação em m²). Escolher a base correta (ver abaixo) |
| Adesivo comum (não impresso) | 1200 mm | informar | **Não existe no catálogo atual do MubiSys** (ver abaixo): criar o item lá ou indicar qual existente usar |

- [ ] O "Adesivo Imprimax Sortido 1,22" (#1147, mídia em rolo) tem **1220 mm**, não 1200. Só entra aqui se
  for consumido pelo nesting; se entrar, cadastrar 1220.
- [ ] Cada largura recebe uma identificação (ex.: "Bobina 1200 mm"; vazio assume esse padrão) e uma marcada como principal.
- [ ] **Adesivo comum — pendente de decisão.** Em 05/10/2026 o catálogo do MubiSys (359 itens) não tem um
  adesivo vinil comum, não impresso, de 1200 mm. O que existe: #4448 "Adesivo Vinil Branco Impresso Recortado"
  (m², R$ 50) e #4377 "Adesivo Vinil Transparente Impresso + Branco" (m², R$ 80), que são serviços de adesivo
  **impresso** (tratados pela análise de cores, não são o rolo comum); e #1147 "Adesivo Imprimax Sortido 1,22"
  (rolo de 1220 mm, metro linear, R$ 35). O MubiSys não aceita gravação pela API pública: **criar no MubiSys** um
  item (ex.: "Adesivo Vinil Comum 1,20 m", tipo Mídia, unidade de custo m² ou metro linear) e só então cadastrar a
  bobina aqui. Alternativa: se for o Imprimax, cadastrar com 1220 mm.
- [ ] **Como o custo do MubiSys é cobrado (campo obrigatório no cadastro da bobina).** O MubiSys nem sempre traz
  unidade de área ou comprimento (o kraft #1098 vem como `Unidade/Gl/Lt/Kg`). Por isso o gestor escolhe a base:
  **por m²** (custo × área cobrada), **por metro linear de rolo** (custo × comprimento consumido) ou **por rolo
  inteiro** (custo × fração do rolo consumida; exige o comprimento total do rolo em mm, ex.: 200 000 mm). A tela
  pré-seleciona m² ou metro linear quando a unidade do MubiSys é essa e deixa em branco nos demais casos: o sistema
  não adivinha. **Atenção ao kraft #1098:** R$ 2,61 por rolo de 200 m seria irreal; é mais provável R$ 2,61 por m²
  (o MubiSys movimenta em m²). Confirmar o valor com quem cuida do estoque antes de escolher "por m²" ou "por rolo".
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
