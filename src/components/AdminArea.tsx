import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, Plus } from "lucide-react";
import { Marca } from "@/components/Marca";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  alternarAtivoUsuarioAdmin,
  criarUsuarioAdmin,
  getMetricasAdmin,
  listarUsuariosAdmin,
  type MetricasAdmin,
  type UsuarioAdmin,
} from "@/lib/api";

/** Rótulo em PT-BR pra cada `acao` gravada em eventos_uso. */
const ROTULO_ACAO: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  erro: "Erro",
  setor_selecionado: "Setor selecionado",
  comparacao_criada: "Comparação criada",
  pois_visualizados: "POIs visualizados",
};

function rotuloAcao(acao: string): string {
  return ROTULO_ACAO[acao] ?? acao;
}

function formatData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function CardMetrica({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-(--card-spacing)">
        <span className="text-2xl font-semibold tabular-nums">{valor}</span>
        <span className="text-xs text-muted-foreground">{rotulo}</span>
      </CardContent>
    </Card>
  );
}

interface NovoUsuarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriado: (usuario: UsuarioAdmin) => void;
}

function NovoUsuarioModal({ open, onOpenChange, onCriado }: NovoUsuarioModalProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function limpar() {
    setNome("");
    setEmail("");
    setSenha("");
    setMostrarSenha(false);
    setErro(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const usuario = await criarUsuarioAdmin(nome.trim(), email.trim(), senha);
      onCriado(usuario);
      onOpenChange(false);
      limpar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o usuário.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) limpar();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            A conta nasce ativa, com papel "usuario". Sem confirmação por e-mail — passe a senha por
            fora.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-nome">Nome</Label>
            <Input id="admin-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-email">E-mail</Label>
            <Input
              id="admin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-senha">Senha</Label>
            <div className="relative">
              <Input
                id="admin-senha"
                type={mostrarSenha ? "text" : "password"}
                required
                minLength={8}
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
            <p className="text-xs text-muted-foreground">Pelo menos 8 caracteres.</p>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="submit" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" />}
              Criar usuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminArea({ onVoltar }: { onVoltar: () => void }) {
  const { usuario: usuarioLogado } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[] | null>(null);
  const [metricas, setMetricas] = useState<MetricasAdmin | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [alternando, setAlternando] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    Promise.all([listarUsuariosAdmin(), getMetricasAdmin()])
      .then(([u, m]) => {
        if (cancelado) return;
        setUsuarios(u);
        setMetricas(m);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar a área administrativa.");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function handleAlternarAtivo(alvo: UsuarioAdmin) {
    setAlternando(alvo.id);
    try {
      const atualizado = await alternarAtivoUsuarioAdmin(alvo.id, !alvo.isActive);
      setUsuarios((atual) => atual?.map((u) => (u.id === atualizado.id ? atualizado : u)) ?? atual);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar o usuário.");
    } finally {
      setAlternando(null);
    }
  }

  return (
    <div className="flex h-svh w-screen flex-col overflow-hidden bg-muted/30">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background px-4">
        <Marca />
        <span className="text-sm text-muted-foreground">Área administrativa</span>
        <Button variant="ghost" size="sm" onClick={onVoltar} className="ml-auto">
          <ArrowLeft />
          Voltar ao mapa
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Métricas da semana</h2>
            {!metricas ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Carregando métricas...
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <CardMetrica rotulo="Usuários ativos" valor={metricas.usuariosAtivosSemana} />
                {metricas.eventosPorAcao.map((m) => (
                  <CardMetrica key={m.acao} rotulo={rotuloAcao(m.acao)} valor={m.total} />
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Últimos eventos</h2>
            <Card size="sm">
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Usuário</TableHead>
                      <TableHead className="px-4">Ação</TableHead>
                      <TableHead className="px-4">Data/hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!metricas && (
                      <TableRow>
                        <TableCell colSpan={3} className="px-4 text-muted-foreground">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    )}
                    {metricas?.ultimosEventos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="px-4 text-muted-foreground">
                          Nenhum evento registrado ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {metricas?.ultimosEventos.map((evento) => (
                      <TableRow key={evento.id}>
                        <TableCell className="px-4">{evento.usuario ?? "—"}</TableCell>
                        <TableCell className="px-4">{rotuloAcao(evento.acao)}</TableCell>
                        <TableCell className="px-4 text-muted-foreground tabular-nums">
                          {formatData(evento.criadoEm)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Usuários</h2>
              <Button size="sm" onClick={() => setModalAberto(true)}>
                <Plus />
                Novo usuário
              </Button>
            </div>
            <Card size="sm">
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Nome</TableHead>
                      <TableHead className="px-4">E-mail</TableHead>
                      <TableHead className="px-4">Papel</TableHead>
                      <TableHead className="px-4">Status</TableHead>
                      <TableHead className="px-4">Criado em</TableHead>
                      <TableHead className="px-4" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!usuarios && (
                      <TableRow>
                        <TableCell colSpan={6} className="px-4 text-muted-foreground">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    )}
                    {usuarios?.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="px-4 font-medium">{u.nome}</TableCell>
                        <TableCell className="px-4 text-muted-foreground">{u.email}</TableCell>
                        <TableCell className="px-4">
                          <Badge variant="outline">{u.role}</Badge>
                        </TableCell>
                        <TableCell className="px-4">
                          <Badge variant={u.isActive ? "default" : "secondary"}>
                            {u.isActive ? "Ativo" : "Desativado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 text-muted-foreground tabular-nums">
                          {formatData(u.createdAt)}
                        </TableCell>
                        <TableCell className="px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={alternando === u.id || u.id === usuarioLogado?.id}
                            title={u.id === usuarioLogado?.id ? "Você não pode desativar a própria conta" : undefined}
                            onClick={() => void handleAlternarAtivo(u)}
                          >
                            {alternando === u.id && <Loader2 className="animate-spin" />}
                            {u.isActive ? "Desativar" : "Ativar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <NovoUsuarioModal
        open={modalAberto}
        onOpenChange={setModalAberto}
        onCriado={(novo) => setUsuarios((atual) => [novo, ...(atual ?? [])])}
      />
    </div>
  );
}
