import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Marca } from "@/components/Marca";
import { SuporteModal } from "@/components/SuporteModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [modalSuporteAberto, setModalSuporteAberto] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await login(email.trim(), senha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-svh w-screen items-center justify-center bg-muted/40 px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Marca tamanho="lg" />

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Acesso restrito — contas são criadas pelo administrador.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={mostrarSenha ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="pr-8"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setMostrarSenha((v) => !v)}
                    tabIndex={-1}
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => setModalSuporteAberto(true)}
                  className="self-end px-0 text-muted-foreground"
                >
                  Esqueceu a senha?
                </Button>
              </div>

              {erro && <p className="text-sm text-destructive">{erro}</p>}

              <Button type="submit" disabled={enviando} className="mt-1">
                {enviando && <Loader2 className="animate-spin" />}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <SuporteModal
        open={modalSuporteAberto}
        onOpenChange={setModalSuporteAberto}
        titulo="Esqueceu a senha?"
        descricao="Não há redefinição automática por enquanto — fale com o suporte pelo WhatsApp pra resetar sua senha."
      />
    </div>
  );
}
