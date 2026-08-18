import { useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLocation } from "wouter";
import { AlertCircle, LogIn } from "lucide-react";

// Mesma normalização usada em server/routers.ts (localUsers.create) pra
// virar o `username` de contas sem e-mail real — permite que o usuário
// continue digitando o nome como sempre digitou (ex. "João Silva").
function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return slug || "usuario";
}

export default function LocalLogin() {
  const [emailOrName, setEmailOrName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [, navigate] = useLocation();
  const { refetch: refetchSession } = useSession();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsPending(true);
    const isEmail = emailOrName.includes("@");
    const username = isEmail ? emailOrName.trim().toLowerCase() : slugifyName(emailOrName);
    const { error: signInError } = await authClient.signIn.username({ username, password });
    if (signInError) {
      setIsPending(false);
      setError(signInError.message || "Credenciais inválidas");
      return;
    }
    // O signIn resolve antes da store de sessão do Better Auth (a mesma
    // usada por useAuth()/AuthGate) ser atualizada — ela é sincronizada de
    // forma assíncrona/adiada em segundo plano. Esperar esse refetch aqui
    // garante que a store já reflete o usuário logado antes de navegar; sem
    // isso, o AuthGate ainda enxerga `user === null` no primeiro clique e
    // devolve pro login.
    await refetchSession();
    setIsPending(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-900 rounded-2xl mb-4">
            <span className="text-white font-bold text-xl">LE</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">LETREIROS EXPRESS</h1>
          <p className="text-gray-500 text-sm mt-1">Portal de Gestão — Controle de Retrabalhos</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Entrar no sistema</CardTitle>
            <CardDescription>Use seu e-mail ou nome de usuário e senha</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="emailOrName">E-mail ou nome de usuário</Label>
                <Input
                  id="emailOrName"
                  type="text"
                  placeholder="seu@email.com ou Nome Completo"
                  value={emailOrName}
                  onChange={e => setEmailOrName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                disabled={isPending}
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Entrar
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          Problemas de acesso? Contate o administrador do sistema.
        </p>
      </div>
    </div>
  );
}
