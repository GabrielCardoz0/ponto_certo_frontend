import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BadgePonto } from "@/components/BadgePonto";
import { compararSetores } from "@/lib/api";
import { montarTabelaComparativa } from "@/utils/tabelaComparativa";
import type { Comparacao, PontoSelecionado } from "@/types/setor";

const MINIMO_RECOMENDADO = 3;

interface ComparacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pontos: PontoSelecionado[];
}

export function ComparacaoModal({ open, onOpenChange, pontos }: ComparacaoModalProps) {
  const [comparacao, setComparacao] = useState<Comparacao | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const idsKey = pontos.map((p) => p.setor.cdSetor).join(",");

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    // Fetch acionado pela abertura do modal / mudança dos pontos: liga o loading antes de chamar a API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setErro(null);
    compararSetores(idsKey.split(","))
      .then((data) => {
        if (!cancelado) setComparacao(data);
      })
      .catch(() => {
        if (!cancelado) setErro("Erro ao carregar os detalhes dos pontos.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [open, idsKey]);

  const tabela = useMemo(
    () => (comparacao ? montarTabelaComparativa(pontos, comparacao) : null),
    [pontos, comparacao]
  );

  const colunasCount = pontos.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[96vw] max-w-[110rem] flex-col">
        <DialogHeader>
          <DialogTitle>{colunasCount === 1 ? "Detalhes do ponto" : "Comparação de pontos"}</DialogTitle>
          <DialogDescription>
            {colunasCount} {colunasCount === 1 ? "ponto selecionado" : "pontos selecionados"}
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-border">
          {loading && !tabela && (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando detalhes...
            </p>
          )}
          {erro && <p className="p-4 text-sm text-destructive">{erro}</p>}

          {tabela && (
            <>
              <div className="h-full overflow-auto">
                <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky top-0 left-0 z-30 min-w-52 border-b border-border bg-popover px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Variável
                      </th>
                      {tabela.colunas.map((coluna) => (
                        <th
                          key={coluna.numero}
                          className="sticky top-0 z-20 w-44 min-w-44 border-b border-border bg-popover px-3 py-2 text-left align-top"
                        >
                          <div className="flex items-start gap-2">
                            <BadgePonto numero={coluna.numero} />
                            <span className="line-clamp-2 text-xs leading-snug font-medium">
                              {coluna.rotulo}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tabela.secoes.map((secao) => (
                      <SecaoLinhas key={secao.titulo} secao={secao} colunas={tabela.colunas.length} />
                    ))}
                  </tbody>
                </table>
              </div>

            </>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {colunasCount < MINIMO_RECOMENDADO
              ? `Amostra abaixo do mínimo recomendado de ${MINIMO_RECOMENDADO} pontos para comparação.`
              : "Dados: IBGE e outras fontes públicas, com modelagem própria auditável."}
          </p>
          <Button variant="outline" disabled title="Em breve">
            Exportar relatório
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SecaoLinhas({
  secao,
  colunas,
}: {
  secao: { titulo: string; linhas: { rotulo: string; valores: string[] }[] };
  colunas: number;
}) {
  return (
    <>
      <tr>
        <th className="sticky left-0 z-10 min-w-52 border-b border-border bg-muted px-3 py-1.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {secao.titulo}
        </th>
        <td colSpan={colunas} className="border-b border-border bg-muted" />
      </tr>
      {secao.linhas.map((linha) => (
        <tr key={linha.rotulo} className="hover:bg-muted/40">
          <td className="sticky left-0 z-10 min-w-52 border-b border-border bg-popover px-3 py-2 text-muted-foreground">
            {linha.rotulo}
          </td>
          {linha.valores.map((valor, i) => (
            <td key={i} className="w-44 min-w-44 border-b border-border px-3 py-2 tabular-nums">
              {valor}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
