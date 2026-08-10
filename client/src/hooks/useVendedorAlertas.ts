import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Gera um beep sintético usando Web Audio API
function playBeep(type: "empacotamento" | "logistica") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === "empacotamento") {
      // Dois bips ascendentes — pedido entrou no empacotamento
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } else {
      // Três bips — pedido saiu para logística
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, ctx.currentTime);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.30);
      gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.6);
    }
  } catch {
    // Silencia erros de AudioContext em ambientes sem suporte
  }
}

export function useVendedorAlertas(vendedorNome: string | null | undefined) {
  // Mapa de id → kanbanStatus anterior
  const prevStatusMap = useRef<Map<number, string>>(new Map());
  const initialized = useRef(false);

  const { data: pedidos } = trpc.empacotamento.pedidos.listPorVendedor.useQuery(
    { vendedorNome: vendedorNome ?? "" },
    {
      enabled: !!vendedorNome,
      refetchInterval: 15_000, // polling a cada 15 segundos
      refetchIntervalInBackground: true,
    }
  );

  useEffect(() => {
    if (!pedidos || !vendedorNome) return;

    if (!initialized.current) {
      // Primeira carga: apenas registrar o estado atual, sem disparar alertas
      for (const p of pedidos) {
        prevStatusMap.current.set(p.id, p.kanbanStatus);
      }
      initialized.current = true;
      return;
    }

    for (const p of pedidos) {
      const prev = prevStatusMap.current.get(p.id);
      const curr = p.kanbanStatus;

      if (prev === undefined) {
        // Pedido novo que não existia antes → entrou no empacotamento
        if (curr === "aguardando" || curr === "embalando") {
          playBeep("empacotamento");
          toast.success(
            `📦 Pedido #${p.numeroPedido} — ${p.cliente} entrou no Empacotamento!`,
            {
              duration: 8000,
              style: {
                background: "#dcfce7",
                border: "2px solid #16a34a",
                color: "#15803d",
                fontWeight: "600",
              },
            }
          );
        }
      } else if (prev !== curr) {
        if ((curr === "aguardando" || curr === "embalando") && prev !== "aguardando" && prev !== "embalando") {
          // Voltou para empacotamento (improvável, mas cobre o caso)
          playBeep("empacotamento");
          toast.success(
            `📦 Pedido #${p.numeroPedido} — ${p.cliente} entrou no Empacotamento!`,
            {
              duration: 8000,
              style: {
                background: "#dcfce7",
                border: "2px solid #16a34a",
                color: "#15803d",
                fontWeight: "600",
              },
            }
          );
        } else if (curr === "patio") {
          // Saiu do empacotamento → foi para a logística
          playBeep("logistica");
          toast.info(
            `🚚 Pedido #${p.numeroPedido} — ${p.cliente} saiu do Empacotamento e entrou na Logística!`,
            {
              duration: 10000,
              style: {
                background: "#dbeafe",
                border: "2px solid #2563eb",
                color: "#1d4ed8",
                fontWeight: "600",
              },
            }
          );
        }
      }

      prevStatusMap.current.set(p.id, curr);
    }
  }, [pedidos, vendedorNome]);
}
