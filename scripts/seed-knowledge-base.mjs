import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);

const articles = [
  // ─── PDF 1: Base de Conhecimento Operacional ─────────────────────────────
  {
    title: "Público-Alvo e Qualificação de Leads",
    category: "Comercial",
    subcategory: "Qualificação",
    keywords: "público-alvo,lead,qualificado,gráfica,comunicação visual,revendedor",
    content: `## Público-Alvo (Regra Principal)

Atendemos exclusivamente:
- Gráficas
- Empresas de comunicação visual
- Prestadores de serviço que produzem letreiros, fachadas, luminosos, banners, painéis, sinalização
- Profissionais que revendem ou instalam comunicação visual

**Leads NÃO qualificados:**
- Pessoa física que quer produto final
- Lojas e comércios que querem comprar fachada para si mesmos
- Empresas que não atuam em comunicação visual
- Usuários que pedem arte, criação, placa individual, produto final

**Regra:** Somente leads qualificados podem pedir orçamento.

## Como Identificar Qualificados

Considerar **QUALIFICADO** quando o usuário disser:
- "Tenho uma gráfica"
- "Tenho empresa de comunicação visual"
- "Sou revendedor"
- "Trabalho com comunicação visual"
- "Sou prestador de serviço de letreiros"
- "Faço fachadas para meus clientes"
- "Sou impressão / plotter / adesivo"
- "Sou designer mas vendo letreiro para clientes"

Considerar **NÃO QUALIFICADO** quando disser:
- "Quero fazer um letreiro pra minha loja"
- "Sou pessoa física"
- "Quero uma fachada pra minha empresa"
- "Quero comprar um produto só"
- "Não tenho gráfica"`,
  },
  {
    title: "Regras de Orçamento — Dados Necessários",
    category: "Comercial",
    subcategory: "Orçamento",
    keywords: "orçamento,cotação,CNPJ,CPF,arquivo vetorizado,PJ,PF,dados cadastrais",
    content: `## Regras de Orçamento

### Para PJ (Pessoa Jurídica)
- CNPJ
- E-mail
- Arquivo vetorizado (PDF ou CDR)

### Para PF (Pessoa Física)
- Nome completo
- CPF
- Endereço completo com CEP
- E-mail
- Arquivo vetorizado

### Observações Importantes
- Arquivo deve ser vetorizado. **Imagens não são aceitas.**
- Se o cliente disser que enviará depois, o agente deve confirmar que aguardará.
- Depois que coletar os dados cadastrais e receber o arquivo, informar que o time comercial entrará em contato.`,
  },
  {
    title: "Respostas Padrão — Perguntas Frequentes",
    category: "Comercial",
    subcategory: "Atendimento",
    keywords: "resposta padrão,FAQ,ACM,prazo,catálogo,localização,frete,pagamento,parcelamento",
    content: `## Respostas Padrão da Base de Conhecimento

### A) Preço / Tabela
Não existe tabela de preços. Sempre solicitar o arquivo vetorizado para gerar orçamento.

### B) ACM
Não fabricamos letras em ACM. Oferecer galvanizado pintado ou sem pintura.

**Script:** "Não produzimos letreiros em ACM, mas posso te oferecer no galvanizado, nas opções pintado e sem pintura. Tudo bem?"

### C) Prazo de Produção
7 a 10 dias úteis. Varia conforme acabamento e complexidade. Um prazo preciso deve ser negociado junto ao vendedor no momento da cotação.

### D) Fotos / Vídeos / Catálogo
Não temos catálogo no momento. Conteúdos apenas no Instagram: **@letreirosexpress**

### E) Localização
Atendemos todo o Brasil. Estamos em Campo Grande – MS. Temos clientes em mais de 20 Estados.

### F) Frete
Frete **CIF** — pagamos o frete para o cliente por maior comodidade e por busca de menor custo, sem agregarmos margens de lucro. Simulação feita durante a cotação. Preço final só após mercadoria pronta.

### G) Pagamento
- 50% de entrada (sinal)
- 50% no dia do despacho, junto com o valor do frete
- Parcela em até 6x no cartão
- **Não faturamos no boleto**

### H) Atendimento Humano
- Se o lead for qualificado: informar que o time comercial assumirá em seguida.
- Se o lead NÃO for qualificado: encerrar informando que o atendimento é exclusivo para empresas de comunicação visual.`,
  },
  {
    title: "Redirecionamentos e Situações Especiais",
    category: "Comercial",
    subcategory: "Atendimento",
    keywords: "redirecionamento,WhatsApp,agradecimento,encerramento,arquivo posterior",
    content: `## Redirecionamentos Importantes

### Encerramento Positivo
Se o usuário agradecer e encerrar, enviar mensagem positiva curta.

Quando um cliente agradecer as informações ou prometer que entrará em contato no futuro, dizer: **"Obrigado! Tenho convicção que gostará muito do nosso atendimento e serviços!"**

### WhatsApp vs E-mail
Se quiser receber no WhatsApp ao invés do e-mail, aceitar, mas informar que o e-mail é obrigatório para cadastro.

### Arquivo Enviado Posteriormente
Se o cliente disse que enviará depois o arquivo, dizer que aguardará. Seja sempre o mais breve e conciso nas palavras.

### Lead Desqualificado
Quando ver que um lead é desqualificado, responder: **"Infelizmente não consigo te ajudar, nosso atendimento é exclusivo para empresas que atuam no seguimento de comunicação visual."**`,
  },
  // ─── PDF 2: Scripts de Atendimento (1ª Parte) ────────────────────────────
  {
    title: "Script — Resposta sobre Preços e Tabela de Valores",
    category: "Comercial",
    subcategory: "Scripts",
    keywords: "script,tabela de preços,média de valores,faixa de preço,cotação,vetorizado",
    content: `## Script: Resposta sobre Preços / Tabela de Valores

Sempre que perguntarem sobre média de preço, tabela de valores, faixa, faicha, de preços, preço de cada letra, quanto sai?, responder o seguinte:

---

"Não temos uma tabela de preço ou média de valores, infelizmente.

Precisamos sempre do arquivo vetorizado/editável em CDR/PDF para fazer o orçamento. Mas tenho boas coisas para dizer:
- Cotação em poucas horas;
- Podemos simular custos e prazo do frete;
- Se ficar muito fora do que espera ou pode, você pode nos dizer;

Bora fazer uma cotação?!"

---

**Nota:** Podemos simular custos e prazo do seu pedido no momento da cotação. Sem surpresas você terá todas as informações e pode comprar de modo seguro.`,
  },
  {
    title: "Script — Resposta sobre Localização e Abrangência",
    category: "Comercial",
    subcategory: "Scripts",
    keywords: "script,localização,Campo Grande,MS,Brasil,abrangência,atendimento nacional",
    content: `## Script: Resposta sobre Localização

Quando perguntarem sobre localização, responder:

---

"Nossa abrangência é nacional, atendemos todo o Brasil. Temos clientes em mais de 20 Estados."

**Estamos em Campo Grande MS.**

---

Podemos simular custos e prazo do seu pedido no momento da cotação. Sem surpresas você terá todas as informações e pode comprar de modo seguro.

Se perguntarem se atendemos determinada cidade ou região, diga que atendemos todo o Brasil.`,
  },
  // ─── PDF 3: Scripts de Atendimento (2ª Parte) ────────────────────────────
  {
    title: "Script — Qualificação e Desqualificação de Leads no Atendimento",
    category: "Comercial",
    subcategory: "Scripts",
    keywords: "script,qualificação,desqualificação,lead,comunicação visual,CNPJ,atendimento humano",
    content: `## Qualificação no Atendimento

É sempre importante deixar claro que nosso atendimento é exclusivo para empresas que atuam no seguimento de comunicação visual, **não basta ter CNPJ aberto ou empresa de qualquer ramo**.

### Lead Desqualificado
Quando ver que um lead é desqualificado, responder:

"Infelizmente não consigo te ajudar, nosso atendimento é exclusivo para empresas que atuam no seguimento de comunicação visual."

### Solicitação de Atendimento Humano
Quando pedirem para falar com atendimento humano ou falar com uma pessoa, diga que o quanto antes ele receberá sim um atendimento, desde que ele atue no seguimento de comunicação visual.

Quando notar que se trata de um cliente qualificado que quer fazer orçamentos, **perguntar sempre seu nome**.

### Fotos e Vídeos dos Produtos
Quando perguntarem se enviamos fotos e vídeos dos produtos, dizer que não dispomos de material publicitário. Nossos conteúdos, no momento, estão disponibilizados somente no Instagram **@letreirosexpress**.`,
  },
  {
    title: "Script — Frete, Pagamento e Condições Comerciais",
    category: "Comercial",
    subcategory: "Scripts",
    keywords: "script,frete,CIF,pagamento,parcelamento,cartão,boleto,sinal,despacho",
    content: `## Condições Comerciais — Scripts de Atendimento

### Frete
Quanto ao frete, podemos simular custos no momento da cotação. Mas o preço final só é estabelecido após a mercadoria estar pronta. Fazemos cotações com várias transportadoras para encontrar o melhor custo benefício.

Nossa forma de frete é **CIF** — pagamos o frete para o cliente por maior comodidade e por busca de menor custo, sem agregarmos margens de lucro.

### Pagamento
A forma de pagamento que trabalhamos é **50% de sinal/entrada e 50% no dia do despacho**, junto com o valor do frete.

Parcelamos no cartão em até **6x**. Não faturamos no boleto.

### Prazo de Produção
O prazo de produção pode variar de acordo com o nível de acabamento e dimensão do projeto, variando entre **7 a 10 dias úteis**. Um prazo preciso deve ser negociado junto ao vendedor no momento da cotação.`,
  },
];

console.log(`Inserindo ${articles.length} artigos na Base de Conhecimento...`);

let inserted = 0;
let skipped = 0;

for (const article of articles) {
  try {
    // Verificar se já existe um artigo com o mesmo título
    const [existing] = await connection.execute(
      "SELECT id FROM knowledge_base WHERE title = ?",
      [article.title]
    );
    if (existing.length > 0) {
      console.log(`  [SKIP] "${article.title}" já existe.`);
      skipped++;
      continue;
    }
    await connection.execute(
      "INSERT INTO knowledge_base (title, content, category, subcategory, keywords) VALUES (?, ?, ?, ?, ?)",
      [article.title, article.content, article.category, article.subcategory, article.keywords]
    );
    console.log(`  [OK] "${article.title}"`);
    inserted++;
  } catch (err) {
    console.error(`  [ERRO] "${article.title}":`, err.message);
  }
}

console.log(`\nConcluído: ${inserted} inseridos, ${skipped} ignorados.`);
await connection.end();
