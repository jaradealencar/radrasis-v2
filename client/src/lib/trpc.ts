import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

/** Tipos inferidos do retorno de cada procedure — evita retipar manualmente o
 * shape de dados vindo do backend nos componentes que os recebem via prop. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
