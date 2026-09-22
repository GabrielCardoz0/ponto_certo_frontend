import { useEffect, useRef, useState } from "react";
import { Search, LogOut, Moon, Sun, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buscarSetores } from "@/lib/api";
import { useTheme } from "@/components/theme-provider";
import type { SetorResumo } from "@/types/setor";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

interface TopBarProps {
  onSelectResultado: (setor: SetorResumo) => void;
}

export function TopBar({ onSelectResultado }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<SetorResumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;

    // Efeito de busca com debounce: liga o estado de loading antes de agendar
    // o fetch, e limpa no cleanup se query mudar antes do timer disparar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setErro(null);
    const timer = setTimeout(() => {
      buscarSetores(trimmed)
        .then((data) => {
          setResultados(data);
          setAberto(true);
        })
        .catch(() => {
          setErro("Erro ao buscar setores.");
          setResultados([]);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(setor: SetorResumo) {
    onSelectResultado(setor);
    setQuery(`${setor.nmMunicipio} — ${setor.cdSetor}`);
    setAberto(false);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setResultados([]);
      setErro(null);
      setLoading(false);
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background px-4">
      <span className="shrink-0 text-base font-semibold tracking-tight">Ponto Certo</span>

      <div ref={containerRef} className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => resultados.length > 0 && setAberto(true)}
          placeholder="Buscar setor censitário, município ou UF..."
          className="pl-8"
        />

        {aberto && (query.trim().length >= MIN_QUERY_LENGTH) && (
          <div className="absolute top-full left-0 z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-md">
            {loading && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Buscando...</div>
            )}
            {!loading && erro && (
              <div className="px-3 py-2 text-sm text-destructive">{erro}</div>
            )}
            {!loading && !erro && resultados.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Nenhum setor encontrado.
              </div>
            )}
            {!loading &&
              !erro &&
              resultados.map((setor) => (
                <button
                  key={setor.cdSetor}
                  type="button"
                  onClick={() => handleSelect(setor)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="font-medium">
                    {setor.nmMunicipio} — {setor.uf}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Setor {setor.cdSetor} · {setor.regiao}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar>
              <AvatarFallback>
                <User className="size-4" />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="flex items-center gap-2.5 px-1.5 py-1.5">
              <Avatar size="lg">
                <AvatarFallback>
                  <User className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">Usuário</span>
                <span className="truncate text-xs text-muted-foreground">
                  usuario@pontocerto.com
                </span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between gap-2 px-1.5 py-1">
              <span className="flex items-center gap-1.5 text-sm">
                {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
                Tema escuro
              </span>
              <Switch
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
