import { useEffect, useRef, useCallback } from "react";

/**
 * Hook que detecta inatividade do usuário e executa callbacks de aviso e logout.
 *
 * @param onWarn  Chamado quando o usuário está prestes a ser desconectado (warningMs antes do timeout)
 * @param onLogout Chamado quando o timeout de inatividade é atingido
 * @param timeoutMs Tempo total de inatividade em ms (padrão: 30 minutos)
 * @param warningMs Tempo antes do logout para exibir aviso (padrão: 2 minutos)
 * @param enabled Se false, o hook não faz nada (ex: usuário não logado)
 */
export function useIdleTimeout({
  onWarn,
  onLogout,
  timeoutMs = 30 * 60 * 1000,
  warningMs = 2 * 60 * 1000,
  enabled = true,
}: {
  onWarn: () => void;
  onLogout: () => void;
  timeoutMs?: number;
  warningMs?: number;
  enabled?: boolean;
}) {
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    if (!enabled) return;
    clearTimers();
    warnedRef.current = false;

    warnTimerRef.current = setTimeout(() => {
      warnedRef.current = true;
      onWarn();
      logoutTimerRef.current = setTimeout(() => {
        onLogout();
      }, warningMs);
    }, timeoutMs - warningMs);
  }, [enabled, clearTimers, onWarn, onLogout, timeoutMs, warningMs]);

  // Reinicia os timers ao detectar atividade do usuário
  useEffect(() => {
    if (!enabled) return;

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

    const handleActivity = () => {
      // Só reinicia se o aviso ainda não foi exibido (evita reiniciar durante o período de aviso)
      if (!warnedRef.current) {
        resetTimers();
      }
    };

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      clearTimers();
    };
  }, [enabled, resetTimers, clearTimers]);

  // Permite reiniciar manualmente (ex: após o usuário clicar "Continuar" no aviso)
  return { resetTimers };
}
