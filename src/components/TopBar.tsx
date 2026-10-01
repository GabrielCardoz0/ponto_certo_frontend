import { useEffect, useRef, useState } from "react";
import { Search, LogOut, MessageCircle, Moon, ShieldUser, Sun } from "lucide-react";
import { Marca } from "@/components/Marca";
import { SuporteModal } from "@/components/SuporteModal";
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
import { localizarSetorPorPonto } from "@/lib/api";
import { buscarEnderecos, type SugestaoEndereco } from "@/lib/geocoding";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";
import type { SetorResumo } from "@/types/setor";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/** "Gabriel Cardozo" -> "GC"; um nome só vira só a primeira letra. */
function iniciaisUsuario(nome: string | undefined): string {
  if (!nome) return "";
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}

interface TopBarProps {
  onSelectResultado: (setor: SetorResumo, rotulo: string) => void;
  onAbrirAdmin?: () => void;
}

export function TopBar({ onSelectResultado, onAbrirAdmin }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const { usuario, logout } = useAuth();
  const isDark = theme === "dark";
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<SugestaoEndereco[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [suporteAberto, setSuporteAberto] = useState(false);
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
      buscarEnderecos(trimmed)
        .then((data) => {
          setResultados(data);
          setAberto(true);
        })
        .catch(() => {
          setErro("Erro ao buscar endereços.");
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

  async function handleSelect(sugestao: SugestaoEndereco) {
    setQuery(sugestao.texto);
    setAberto(false);
    setErro(null);
    try {
      const setor = await localizarSetorPorPonto(sugestao.localizacao.lat, sugestao.localizacao.lng);
      const resumo: SetorResumo = {
        cdSetor: setor.cdSetor,
        censoDate: setor.censoDate,
        cdMunicipio: setor.cdMunicipio,
        nmMunicipio: setor.nmMunicipio,
        uf: setor.uf,
        regiao: setor.regiao,
        localizacao: sugestao.localizacao,
      };
      onSelectResultado(resumo, sugestao.texto);
    } catch {
      setErro("Não foi possível localizar um setor censitário para este endereço.");
      setAberto(true);
    }
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
    <header className="grid h-14 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-border bg-background px-4">
      <Marca />

      <div className="flex justify-center">
        <div ref={containerRef} className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => resultados.length > 0 && setAberto(true)}
            placeholder="Buscar endereço, bairro ou cidade..."
            className="pl-8"
            name="busca-endereco-ponto-certo"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
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
                  Nenhum endereço encontrado.
                </div>
              )}
              {!loading &&
                !erro &&
                resultados.map((sugestao) => (
                  <button
                    key={sugestao.id}
                    type="button"
                    onClick={() => void handleSelect(sugestao)}
                    className="flex w-full cursor-pointer items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="font-medium">{sugestao.texto}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="justify-self-end">
        <DropdownMenu>
          <DropdownMenuTrigger className="cursor-pointer">
            <Avatar>
              <AvatarFallback>{iniciaisUsuario(usuario?.nome)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="flex items-center gap-2.5 px-1.5 py-1.5">
              <Avatar size="lg">
                <AvatarFallback>{iniciaisUsuario(usuario?.nome)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{usuario?.nome}</span>
                <span className="truncate text-xs text-muted-foreground">{usuario?.email}</span>
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
            {usuario?.role === "admin" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onAbrirAdmin}>
                  <ShieldUser />
                  Área administrativa
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSuporteAberto(true)}>
              <MessageCircle />
              Falar com o suporte
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <SuporteModal open={suporteAberto} onOpenChange={setSuporteAberto} />
      </div>
    </header>
  );
}
