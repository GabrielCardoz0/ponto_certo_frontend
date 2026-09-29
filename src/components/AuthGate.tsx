import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/components/LoginPage";
import App from "@/App";

/** Decide entre tela de login e o app, uma vez sabido se há sessão (cookie httpOnly) válida. */
export function AuthGate() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="flex h-svh w-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return usuario ? <App /> : <LoginPage />;
}
