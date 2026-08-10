import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

// ─── Mapeamento de categoria → grupo ───────────────────────────────────────
const grupoMap = {
  "Salários": "Pessoal",
  "Férias": "Pessoal",
  "13° Salário": "Pessoal",
  "Ajuda de custo": "Pessoal",
  "Alimentação Corporativa": "Pessoal",
  "Pró Labore": "Pessoal",
  "Exames Admissionais/Demissionais": "Pessoal",
  "Uniformes": "Pessoal",
  "EPI": "Pessoal",
  "Farmácia e Primeiros Socorros": "Pessoal",
  "Aluguel": "Instalações",
  "Energia": "Instalações",
  "Água": "Instalações",
  "Vigilância e Segurança": "Instalações",
  "Coleta de Resíduos": "Instalações",
  "Manutencao Predial": "Instalações",
  "Serviços Terceirizados de Limpeza e Manutenções Recorrentes": "Instalações",
  "Manutenção de Equipamentos": "Operacional",
  "Equipamentos e Imobilizados": "Operacional",
  "Equipamentos e Ferramentas (adm)": "Operacional",
  "Combustível": "Operacional",
  "Manutenção Frota": "Operacional",
  "Material de Escritório, Consumo e Limpeza": "Operacional",
  "Software de Gestão": "TI & Admin",
  "Serviços de TI": "TI & Admin",
  "Telefone e Internet": "TI & Admin",
  "Consulta SPC | Serasa": "TI & Admin",
  "Assessoria ou Consultorias": "Jurídico & Contábil",
  "Honorários Jurídicos": "Jurídico & Contábil",
  "Honorários Contábeis": "Jurídico & Contábil",
  "Marketing e Publicidade": "Comercial",
  "Pagto Empréstimos e Financiamentos": "Financeiro",
  "Consórcios": "Financeiro",
  "Seguros Bancários": "Financeiro",
  "Cesta Manutenção": "Financeiro",
  "Despesas e Tarifas Bancárias": "Financeiro",
};

// ─── Dados das despesas fixas (da aba "Fixa - Revisado") ───────────────────
const custosFixos = [
  // PESSOAL
  { plano: "2.5.1.2 - Salários", categoria: "Salários", fornecedor: "DIVERSOS", tipo: "Pagamento Colaborador", valor: 50670.98, vencimento: null, observacao: "Valor ref. abr/26." },
  { plano: "2.5.1.3 - Férias", categoria: "Férias", fornecedor: "DIVERSOS", tipo: "Pagamento Colaborador", valor: 0, vencimento: null, observacao: "Despesa anual - Realizar reserva mensal para pagamento" },
  { plano: "2.5.1.4 - 13° Salário", categoria: "13° Salário", fornecedor: "DIVERSOS", tipo: "Pagamento Colaborador", valor: 0, vencimento: null, observacao: "Despesa anual - Realizar reserva mensal para pagamento" },
  { plano: "2.5.1.5 - Ajuda de custo", categoria: "Ajuda de custo", fornecedor: "DIVERSOS", tipo: "Outros benefícios", valor: 3512, vencimento: 30, observacao: "Valor médio entre out/25 e mar/26" },
  { plano: "2.5.1.10 - Alimentação Corporativa", categoria: "Alimentação Corporativa", fornecedor: "DIVERSOS", tipo: "Operacional", valor: 250, vencimento: null, observacao: "Valor médio entre out/25 e mar/26" },
  { plano: "2.5.2.1 - Pró Labore", categoria: "Pró Labore", fornecedor: "Daniel Jara de Alencar", tipo: "Fixa", valor: 10000, vencimento: null, observacao: "" },
  { plano: "2.5.2.1 - Pró Labore", categoria: "Pró Labore", fornecedor: "Eliane Jara de Alencar", tipo: "Fixa", valor: 5605, vencimento: null, observacao: "" },
  { plano: "2.5.2.1 - Pró Labore", categoria: "Pró Labore", fornecedor: "Fernanda Jara de Alencar", tipo: "Fixa", valor: 5000, vencimento: null, observacao: "" },
  { plano: "2.5.2.1 - Pró Labore", categoria: "Pró Labore", fornecedor: "Rodrigo Jara de Alencar", tipo: "Fixa", valor: 5000, vencimento: null, observacao: "" },
  { plano: "2.5.2.3 - Exames Admissionais/Demissionais", categoria: "Exames Admissionais/Demissionais", fornecedor: "DIVERSOS", tipo: "Variavel", valor: 471.98, vencimento: null, observacao: "Valor médio entre out/25 e mar/26" },
  { plano: "2.5.2.4 - Uniformes", categoria: "Uniformes", fornecedor: "DIVERSOS", tipo: "Variavel", valor: 500, vencimento: null, observacao: "Valor médio entre out/25 e mar/26" },
  { plano: "2.5.2.5 - EPI", categoria: "EPI", fornecedor: "DIVERSOS", tipo: "Variavel", valor: 150, vencimento: null, observacao: "Valor médio entre out/25 e mar/26" },
  { plano: "2.5.2.6 - Farmácia e Primeiros Socorros", categoria: "Farmácia e Primeiros Socorros", fornecedor: "DIVERSOS", tipo: "Variavel", valor: 40, vencimento: null, observacao: "Valor médio entre out/25 e mar/26" },
  // INSTALAÇÕES
  { plano: "2.1.1 - Aluguel", categoria: "Aluguel", fornecedor: "LETREIROS EXPRESS LTDA", tipo: "Fixa", valor: 5000, vencimento: 5, observacao: "" },
  { plano: "2.1.1 - Aluguel", categoria: "Aluguel", fornecedor: "LETREIROS EXPRESS LTDA", tipo: "Fixa", valor: 1005, vencimento: 5, observacao: "Galpão Estoque" },
  { plano: "2.1.3 - Energia", categoria: "Energia", fornecedor: "COPEL", tipo: "Variavel", valor: 210, vencimento: null, observacao: "Valor médio entre out/25 e mar/26" },
  { plano: "2.1.4 - Água", categoria: "Água", fornecedor: "SANEPAR", tipo: "Variavel", valor: 815, vencimento: null, observacao: "Valor médio entre out/25 e mar/26" },
  { plano: "2.1.5 - Vigilância e Segurança", categoria: "Vigilância e Segurança", fornecedor: "DIVERSOS", tipo: "Fixa", valor: 293, vencimento: null, observacao: "" },
  { plano: "2.1.7 - Coleta de Resíduos", categoria: "Coleta de Resíduos", fornecedor: "ECOVILLE AMBIENTAL", tipo: "Fixa", valor: 526.49, vencimento: null, observacao: "" },
  { plano: "2.9.4 - Manutencao Predial", categoria: "Manutencao Predial", fornecedor: "DIVERSOS", tipo: "Operacional", valor: 700, vencimento: null, observacao: "Adicionado conforme solicitação WhatsApp." },
  { plano: "2.9.4 - Manutencao Predial", categoria: "Manutencao Predial", fornecedor: "MAPFRE SEGUROS GERAIS S.A.", tipo: "Fixa", valor: 317.16, vencimento: null, observacao: "" },
  { plano: "2.9.4 - Manutencao Predial", categoria: "Manutencao Predial", fornecedor: "MAPFRE SEGUROS GERAIS S.A", tipo: "Fixa", valor: 314.02, vencimento: null, observacao: "" },
  { plano: "2.9.4 - Manutencao Predial", categoria: "Manutencao Predial", fornecedor: "ALLIANZ SEGUROS S/A", tipo: "Fixa", valor: 479.51, vencimento: null, observacao: "" },
  { plano: "2.3.4 - Serviços Terceirizados de Limpeza e Manutenções Recorrentes", categoria: "Serviços Terceirizados de Limpeza e Manutenções Recorrentes", fornecedor: "DIVERSOS", tipo: "Fixa", valor: 1693, vencimento: null, observacao: "" },
  // OPERACIONAL
  { plano: "2.3.2 - Manutenção de Equipamentos", categoria: "Manutenção de Equipamentos", fornecedor: "CONSUMÍVEIS EQUIPAMENTOS", tipo: "Variavel", valor: 240, vencimento: null, observacao: "" },
  { plano: "2.3.2 - Manutenção de Equipamentos", categoria: "Manutenção de Equipamentos", fornecedor: "MANUTENÇÃO DE EQUIPAMENTOS", tipo: "Operacional", valor: 2000, vencimento: null, observacao: "" },
  { plano: "2.9.3 - Equipamentos e Imobilizados", categoria: "Equipamentos e Imobilizados", fornecedor: "DIVERSOS", tipo: "Operacional", valor: 2000, vencimento: null, observacao: "" },
  { plano: "2.6.4 - Equipamentos e Ferramentas (adm)", categoria: "Equipamentos e Ferramentas (adm)", fornecedor: "DIVERSOS", tipo: "Variavel", valor: 975, vencimento: null, observacao: "" },
  { plano: "2.4.1 - Combustível", categoria: "Combustível", fornecedor: "POSTO DE COMBUSTÍVEL", tipo: "Variavel", valor: 1220, vencimento: null, observacao: "Valor médio entre out/25 e mar/26" },
  { plano: "2.4.2 - Manutenção Frota", categoria: "Manutenção Frota", fornecedor: "DIVERSOS", tipo: "Variavel", valor: 1000, vencimento: null, observacao: "Valor médio entre out/25 e mar/26" },
  { plano: "2.6.2 - Material de Escritório, Consumo e Limpeza", categoria: "Material de Escritório, Consumo e Limpeza", fornecedor: "DIVERSOS", tipo: "Variavel", valor: 850, vencimento: null, observacao: "Valor médio entre out/25 e mar/26" },
  // TI & ADMIN
  { plano: "2.6.1 - Software de Gestão", categoria: "Software de Gestão", fornecedor: "MUBISYS", tipo: "Fixa", valor: 1285.04, vencimento: null, observacao: "" },
  { plano: "2.6.1 - Software de Gestão", categoria: "Software de Gestão", fornecedor: "ADOBE", tipo: "Fixa", valor: 398, vencimento: null, observacao: "" },
  { plano: "2.6.1 - Software de Gestão", categoria: "Software de Gestão", fornecedor: "MICROSOFT", tipo: "Fixa", valor: 600, vencimento: null, observacao: "" },
  { plano: "2.6.1 - Software de Gestão", categoria: "Software de Gestão", fornecedor: "OUTROS SOFTWARES", tipo: "Fixa", valor: 500, vencimento: null, observacao: "" },
  { plano: "2.6.3 - Serviços de TI", categoria: "Serviços de TI", fornecedor: "DIVERSOS", tipo: "Fixa", valor: 2404.10, vencimento: null, observacao: "" },
  { plano: "2.6.5 - Telefone e Internet", categoria: "Telefone e Internet", fornecedor: "CLARO/VIVO", tipo: "Fixa", valor: 470, vencimento: null, observacao: "" },
  { plano: "2.6.6 - Consulta SPC | Serasa", categoria: "Consulta SPC | Serasa", fornecedor: "SERASA", tipo: "Fixa", valor: 160, vencimento: null, observacao: "" },
  // JURÍDICO & CONTÁBIL
  { plano: "2.5.3 - Assessoria ou Consultorias", categoria: "Assessoria ou Consultorias", fornecedor: "DIVERSOS", tipo: "Fixa", valor: 3433.40, vencimento: null, observacao: "" },
  { plano: "2.5.4 - Honorários Jurídicos", categoria: "Honorários Jurídicos", fornecedor: "ESCRITÓRIO JURÍDICO", tipo: "Fixa", valor: 1621, vencimento: null, observacao: "" },
  { plano: "2.5.5 - Honorários Contábeis", categoria: "Honorários Contábeis", fornecedor: "ESCRITÓRIO CONTÁBIL", tipo: "Fixa", valor: 950, vencimento: null, observacao: "" },
  // COMERCIAL
  { plano: "2.7.1 - Marketing e Publicidade", categoria: "Marketing e Publicidade", fornecedor: "AGÊNCIA/PLATAFORMAS", tipo: "Variavel", valor: 2220, vencimento: null, observacao: "" },
  // FINANCEIRO
  { plano: "2.8.1 - Pagto Empréstimos e Financiamentos", categoria: "Pagto Empréstimos e Financiamentos", fornecedor: "FCO + BB PRONAMPE", tipo: "Fixa", valor: 15338.13, vencimento: null, observacao: "Média jan-mar/26 (FCO + PRONAMPE)" },
  { plano: "2.9.1 - Consórcios", categoria: "Consórcios", fornecedor: "BB ADMIN CONSÓRCIO", tipo: "Fixa", valor: 1178.42, vencimento: null, observacao: "Média jan-mar/26" },
  { plano: "2.8.5 - Cesta Manutenção", categoria: "Cesta Manutenção", fornecedor: "Tarifa Pacote de Serviços", tipo: "Fixa", valor: 218.30, vencimento: null, observacao: "" },
  { plano: "2.8.8 - Seguros Bancários", categoria: "Seguros Bancários", fornecedor: "BB SEGUROS", tipo: "Fixa", valor: 701.72, vencimento: null, observacao: "" },
  { plano: "2.8.8 - Seguros Bancários", categoria: "Seguros Bancários", fornecedor: "BBSEG OURO MAQUINAS", tipo: "Fixa", valor: 209.71, vencimento: null, observacao: "" },
  { plano: "2.8.9 - Despesas e Tarifas Bancárias", categoria: "Despesas e Tarifas Bancárias", fornecedor: "Débito Serviço Cobrança", tipo: "Operacional", valor: 35, vencimento: null, observacao: "Valor médio entre out/25 e mar/26" },
];

// ─── Dados das dívidas/parcelamentos (da aba "Planilha3") ──────────────────
const dividas = [
  { plano: "2.8.1 - Pagto Empréstimos e Financiamentos", categoria: "Empréstimos", fornecedor: "FCO Amortização (1)", jan: 6295.95, fev: 6849.71, mar: 6916.59, abr: null, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, media: 6687.42, observacao: "" },
  { plano: "2.8.1 - Pagto Empréstimos e Financiamentos", categoria: "Empréstimos", fornecedor: "FCO Amortização (2)", jan: 2443.17, fev: 2409.43, mar: 2342.64, abr: null, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, media: 2398.41, observacao: "" },
  { plano: "2.8.1 - Pagto Empréstimos e Financiamentos", categoria: "Empréstimos", fornecedor: "BB GIRO PRONAMPE (1)", jan: null, fev: 2071.35, mar: 1858.48, abr: null, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, media: 1964.92, observacao: "" },
  { plano: "2.8.1 - Pagto Empréstimos e Financiamentos", categoria: "Empréstimos", fornecedor: "BB GIRO PRONAMPE (2)", jan: 4312.23, fev: 4333.63, mar: 4216.30, abr: null, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, media: 4287.39, observacao: "" },
  { plano: "2.9.1 - Consórcios", categoria: "Consórcios", fornecedor: "BB ADMIN CONSÓRCIO", jan: 1202.48, fev: 1175.59, mar: 1157.18, abr: null, mai: null, jun: null, jul: null, ago: null, set: null, out: null, nov: null, dez: null, media: 1178.42, observacao: "" },
  { plano: "2.9.3 - Equipamentos e Imobilizados", categoria: "Parcelamentos", fornecedor: "MARIO SERGIO HERVAS TAGUTI", jan: null, fev: null, mar: 3350, abr: 3350, mai: 3350, jun: 3350, jul: 3350, ago: 3350, set: 3350, out: 3350, nov: 3350, dez: 3350, media: 3350, observacao: "Equipamento de impressão digital" },
  { plano: "2.2.7 - Insumos Gerais de Produção", categoria: "Parcelamentos", fornecedor: "EC", jan: 99, fev: 99, mar: 99, abr: 99, mai: 99, jun: 99, jul: 99, ago: 99, set: null, out: null, nov: null, dez: null, media: 99, observacao: "Parcelado no Cartão de Crédito" },
  { plano: "2.6.4 - Equipamentos e Ferramentas (adm)", categoria: "Parcelamentos", fornecedor: "SOLDAMAQ", jan: null, fev: 116.70, mar: 116.70, abr: 116.70, mai: 116.70, jun: 116.70, jul: null, ago: null, set: null, out: null, nov: null, dez: null, media: 116.70, observacao: "Parcelado no Cartão de Crédito" },
];

// ─── Inserir custos fixos ──────────────────────────────────────────────────
await conn.execute("DELETE FROM custos_fixos");
for (const c of custosFixos) {
  const grupo = grupoMap[c.categoria] || "Outros";
  await conn.execute(
    `INSERT INTO custos_fixos (plano, categoria, grupoCategoria, fornecedor, tipo, valor, vencimento, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [c.plano, c.categoria, grupo, c.fornecedor, c.tipo, c.valor, c.vencimento ?? null, c.observacao]
  );
}
console.log(`✅ ${custosFixos.length} custos fixos inseridos`);

// ─── Inserir dívidas/parcelamentos ────────────────────────────────────────
await conn.execute("DELETE FROM dividas_parcelamentos");
for (const d of dividas) {
  await conn.execute(
    `INSERT INTO dividas_parcelamentos (plano, categoria, fornecedor, jan_valor, fev_valor, mar_valor, abr_valor, mai_valor, jun_valor, jul_valor, ago_valor, set_valor, out_valor, nov_valor, dez_valor, media, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.plano, d.categoria, d.fornecedor, d.jan, d.fev, d.mar, d.abr, d.mai, d.jun, d.jul, d.ago, d.set, d.out, d.nov, d.dez, d.media, d.observacao]
  );
}
console.log(`✅ ${dividas.length} dívidas/parcelamentos inseridos`);

await conn.end();
console.log("✅ Seed concluído!");
