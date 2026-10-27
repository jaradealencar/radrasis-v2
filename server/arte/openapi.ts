export function criarOpenApiArte(origin: string) {
  const image = {
    required: true,
    content: Object.fromEntries(
      ["image/png", "image/jpeg"].map(type => [
        type,
        { schema: { type: "string", format: "binary" } },
      ])
    ),
  };
  const instructions = {
    name: "X-Arte-Instrucoes",
    in: "header",
    description:
      "Texto encodeURIComponent, até 2.000 caracteres, aplicado em redesenho/GPT",
    schema: { type: "string" },
  };
  const ticket = {
    name: "X-Redesenho-Token",
    in: "header",
    required: true,
    schema: { type: "string" },
  };
  const errors = {
    "400": { description: "Entrada inválida" },
    "401": { description: "Chave inválida ou sessão expirada" },
    "409": { description: "Ticket expirado ou imagem diferente" },
    "413": { description: "Corpo acima do limite" },
    "422": { description: "Geometria inválida" },
    "429": { description: "Limite ou créditos" },
    "502": { description: "Serviço indisponível" },
  };
  const output = (type: string) => ({
    description: "Arquivo gerado",
    content: { [type]: { schema: { type: "string", format: "binary" } } },
    headers: {
      "X-Redesenho-Token": {
        description: "Aprovação dos bytes da imagem, válida por 30 minutos",
        schema: { type: "string" },
      },
      "X-Arte-Uso": {
        description:
          "JSON com tokens entrada/saída/total e créditos quando informados; null significa indisponível",
        schema: { type: "string" },
      },
    },
  });
  const json = (schema: object) => ({
    required: true,
    content: { "application/json": { schema } },
  });
  const dimension = { type: "number", exclusiveMinimum: 0, maximum: 50000 };
  return {
    openapi: "3.1.0",
    info: {
      title: "Estúdio de Arte",
      version: "1.0.0",
      description:
        "API independente. Imagens até 4 MB; JSON até 2 MB. Cada chamada paga pode gerar nova cobrança. Sem retentativa automática.",
    },
    servers: [{ url: origin }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "ARTE_INTEGRATION_API_KEY configurada somente no servidor",
        },
      },
    },
    paths: {
      "/api/health": {
        get: {
          security: [],
          responses: { "200": { description: "Aplicação ativa" } },
        },
      },
      "/api/v1/servicos": {
        get: {
          responses: {
            "200": {
              description:
                "Credenciais e créditos quando consultáveis; autenticação não garante saldo OpenAI",
            },
            ...errors,
          },
        },
      },
      "/api/v1/integracao": {
        get: {
          responses: {
            "200": {
              description:
                "Origem, modelos e indicadores de configuração. Nenhuma chave é retornada.",
            },
            ...errors,
          },
        },
      },
      "/api/v1/imagem/aprovar": {
        post: {
          requestBody: image,
          responses: {
            "200": {
              ...output("application/json"),
              description: "Aprovação gratuita; ticket no cabeçalho",
            },
            ...errors,
          },
        },
      },
      "/api/v1/redesenho": {
        post: {
          parameters: [
            instructions,
            {
              name: "qualidade",
              in: "query",
              schema: {
                type: "string",
                enum: ["high", "xhigh"],
                default: "high",
              },
            },
          ],
          requestBody: image,
          responses: { "200": output("image/png"), ...errors },
        },
      },
      "/api/v1/vetor/vectorizer": {
        post: {
          parameters: [ticket],
          requestBody: image,
          responses: { "200": output("image/svg+xml"), ...errors },
        },
      },
      "/api/v1/vetor/gpt": {
        post: {
          parameters: [ticket, instructions],
          requestBody: {
            required: true,
            content: {
              "image/png": { schema: { type: "string", format: "binary" } },
            },
          },
          responses: { "200": output("image/svg+xml"), ...errors },
        },
      },
      "/api/v1/nesting-arte/preparar": {
        post: {
          requestBody: json({
            type: "object",
            additionalProperties: false,
            required: ["svg", "larguraMm", "alturaMm"],
            properties: {
              svg: { type: "string", maxLength: 1500000 },
              larguraMm: dimension,
              alturaMm: dimension,
            },
          }),
          responses: {
            "200": {
              description: "Peças físicas, cores, posições, áreas e perímetros",
            },
            ...errors,
          },
        },
      },
      "/api/v1/nesting-arte/calcular": {
        post: {
          requestBody: json({
            type: "object",
            additionalProperties: false,
            required: [
              "grupoId",
              "nome",
              "larguraChapaMm",
              "alturaChapaMm",
              "espacamentoMm",
              "margemBordaMm",
              "pecas",
            ],
            properties: {
              grupoId: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,80}$" },
              nome: { type: "string", maxLength: 100 },
              larguraChapaMm: { type: "integer", minimum: 10, maximum: 50000 },
              alturaChapaMm: { type: "integer", minimum: 10, maximum: 50000 },
              espacamentoMm: { type: "number", minimum: 0, maximum: 50 },
              margemBordaMm: { type: "number", minimum: 0, maximum: 50 },
              rotacao: {
                type: "string",
                enum: ["livre", "veio"],
                default: "livre",
              },
              pecas: {
                type: "array",
                minItems: 1,
                maxItems: 100,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "svg", "larguraMm", "alturaMm", "cor"],
                  properties: {
                    id: { type: "string" },
                    svg: { type: "string" },
                    larguraMm: dimension,
                    alturaMm: dimension,
                    cor: { type: "string", pattern: "^#[a-fA-F0-9]{6}$" },
                  },
                },
              },
            },
          }),
          responses: {
            "200": {
              description:
                "Chapas com SVG em mm e métricas por chapa/total (m² e m); motor interno ou Deepnest configurado",
            },
            ...errors,
          },
        },
      },
    },
  };
}
