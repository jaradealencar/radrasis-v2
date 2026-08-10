import { useState, useEffect } from "react";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/contexts/LocalAuthContext";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const WARNING_DURATION_MS = 2 * 60 * 1000; // 2 minutos de aviso
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;    // 30 minutos de inatividade

export default function IdleTimeoutWarning() {
  const { localUser, refetch } = useLocalAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARNING_DURATION_MS / 1000));

  const utils = trpc.useUtils();
  const logoutMut = trpc.localAuth.logout.useMutation({
    onSuccess: () => {
      utils.localAuth.me.invalidate();
      window.location.href = "/";
    },
  });

  const handleLogout = () => {
    setShowWarning(false);
    logoutMut.mutate();
  };

  const { resetTimers } = useIdleTimeout({
    enabled: !!localUser,
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: WARNING_DURATION_MS,
    onWarn: () => {
      setShowWarning(true);
      setSecondsLeft(Math.floor(WARNING_DURATION_MS / 1000));
    },
    onLogout: handleLogout,
  });

  // Contador regressivo enquanto o aviso está visível
  useEffect(() => {
    if (!showWarning) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showWarning]);

  const handleContinue = () => {
    setShowWarning(false);
    resetTimers();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!showWarning || !localUser) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <div
        className="rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center gap-5"
        style={{ background: "#ffffff" }}
      >
        {/* Ícone */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "oklch(0.96 0.02 50)" }}
        >
          <Clock size={32} style={{ color: "oklch(0.60 0.20 40)" }} />
        </div>

        {/* Título */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-1">Sessão prestes a expirar</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Você ficou inativo por um tempo. Por segurança, a sessão será encerrada em:
          </p>
        </div>

        {/* Contador */}
        <div
          className="text-5xl font-black tabular-nums"
          style={{ color: secondsLeft <= 30 ? "oklch(0.55 0.22 25)" : "oklch(0.55 0.18 240)" }}
        >
          {formatTime(secondsLeft)}
        </div>

        {/* Ações */}
        <div className="flex gap-3 w-full">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex-1 flex items-center gap-2 justify-center"
          >
            <LogOut size={15} />
            Sair agora
          </Button>
          <Button
            onClick={handleContinue}
            className="flex-1 flex items-center gap-2 justify-center"
            style={{ background: "oklch(0.52 0.18 240)", color: "white" }}
          >
            <RefreshCw size={15} />
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
