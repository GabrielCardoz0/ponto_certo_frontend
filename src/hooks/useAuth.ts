import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "@/contexts/authContextBase";

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de um AuthProvider");
  return ctx;
}
