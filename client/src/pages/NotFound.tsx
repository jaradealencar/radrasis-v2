import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center blueprint-bg">
      <div className="tech-card corner-bracket rounded-lg p-10 max-w-md w-full mx-4 text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full animate-pulse" style={{ background: "rgba(255,68,68,0.15)" }} />
            <AlertCircle className="relative h-16 w-16" style={{ color: "#ff4444" }} />
          </div>
        </div>
        <h1 className="text-5xl font-bold mb-2 metric-value" style={{ color: "#ff4444" }}>404</h1>
        <h2 className="text-lg font-semibold mb-3 text-white">Página Não Encontrada</h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: "var(--bp-text-dim)" }}>
          A página que você está procurando não existe ou foi movida.
        </p>
        <Button
          onClick={() => setLocation("/")}
          className="gap-2 font-semibold"
          style={{ background: "var(--bp-blue)", color: "white" }}
        >
          <Home className="w-4 h-4" />
          Voltar ao Início
        </Button>
      </div>
    </div>
  );
}
