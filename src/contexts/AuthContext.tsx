import { useEffect, useState, type ReactNode } from "react";
import { aoPerderSessao, getUsuarioLogado, login as loginApi, logout as logoutApi } from "@/lib/api";
import { AuthContext } from "@/contexts/authContextBase";

// O contexto fica em `authContextBase.ts` e o hook em `@/hooks/useAuth` — separados desse
// arquivo pra ele exportar só o componente `AuthProvider` (react-refresh/only-export-components).

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Sessão via cookie httpOnly: ao carregar a página, pergunta pro backend quem está logado
  // (não dá pra saber só olhando o front, o token não é acessível por JS).
  useEffect(() => {
    getUsuarioLogado()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCarregando(false));
  }, []);

  // Qualquer request autenticado que leve 401 (sessão expirou/foi revogada no meio do uso)
  // desloga o front também, sem esperar o usuário tentar algo e tomar erro sem explicação.
  useEffect(() => {
    aoPerderSessao(() => setUsuario(null));
    return () => aoPerderSessao(null);
  }, []);

  async function login(email: string, senha: string) {
    const dados = await loginApi(email, senha);
    setUsuario(dados);
  }

  async function logout() {
    await logoutApi();
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
