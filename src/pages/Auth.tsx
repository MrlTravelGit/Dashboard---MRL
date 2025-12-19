import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 6;
  }, [email, password]);

  async function handleSubmit() {
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        alert("Conta criada! Agora faça login.");
        setMode("signin");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      alert(err?.message ?? "Erro ao autenticar");
      console.error("AUTH ERROR:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <Input
            placeholder="Senha (mínimo 6 caracteres)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading
              ? "Aguarde..."
              : mode === "signin"
                ? "Entrar"
                : "Criar conta"}
          </Button>

          <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
            <span>
              {mode === "signin" ? "Não tem conta?" : "Já tem conta?"}
            </span>

            <button
              className="underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              type="button"
            >
              {mode === "signin" ? "Criar conta" : "Entrar"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
