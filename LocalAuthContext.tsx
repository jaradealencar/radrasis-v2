import React, { createContext, useContext, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export type LocalUser = {
  id: number;
  name: string;
  email: string | null;
  role: "master" | "admin" | "gestor" | "vendas" | "logistica" | "producao" | "financeiro" | "empacotamento";
  permissions: string[];
};

type LocalAuthContextType = {
  localUser: LocalUser | null;
  isLoading: boolean;
  canAccess: (pageKey: string) => boolean;
  refetch: () => void;
};

const LocalAuthContext = createContext<LocalAuthContextType>({
  localUser: null,
  isLoading: true,
  canAccess: () => false,
  refetch: () => {},
});

export function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, refetch } = trpc.localAuth.me.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const localUser = data ?? null;

  const canAccess = (pageKey: string): boolean => {
    // Sem usuário logado: modo aberto — tudo visível
    if (!localUser) return true;
    if (localUser.role === "master" || localUser.role === "admin") return true;
    return localUser.permissions.includes(pageKey);
  };

  return (
    <LocalAuthContext.Provider value={{ localUser, isLoading, canAccess, refetch }}>
      {children}
    </LocalAuthContext.Provider>
  );
}

export function useLocalAuth() {
  return useContext(LocalAuthContext);
}
