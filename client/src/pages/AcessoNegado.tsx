import { ShieldOff, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function AcessoNegado() {
  const [, navigate] = useLocation();

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#f1f5f9" }}
    >
      <div className="text-center max-w-md px-6">
        {/* Ícone */}
        <div
          className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "oklch(0.96 0.01 20)" }}
        >
          <ShieldOff size={40} style={{ color: "oklch(0.55 0.22 25)" }} />
        </div>

        {/* Código */}
        <div
          className="text-7xl font-black mb-2"
          style={{ color: "oklch(0.55 0.22 25)" }}
        >
          403
        </div>

        {/* Título */}
        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          Acesso Negado
        </h1>

        {/* Descrição */}
        <p className="text-gray-500 mb-8 leading-relaxed">
          Você não tem permissão para acessar esta página. Se acredita que isso
          é um erro, entre em contato com o administrador do sistema.
        </p>

        {/* Ações */}
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Voltar
          </Button>
          <Button
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
            style={{ background: "oklch(0.52 0.18 240)", color: "white" }}
          >
            <Home size={16} />
            Ir ao Painel
          </Button>
        </div>
      </div>
    </div>
  );
}
