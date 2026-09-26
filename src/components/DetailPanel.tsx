import { useState } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BadgePonto } from "@/components/BadgePonto";
import { ComparacaoModal } from "@/components/ComparacaoModal";
import { formatMoeda } from "@/lib/format";
import type { PontoSelecionado } from "@/types/setor";

interface DetailPanelProps {
  pontos: PontoSelecionado[];
  maxPontos: number;
  carregando: boolean;
  modoAdicionar: boolean;
  onAdicionarRegiao: () => void;
  onCancelarAdicao: () => void;
  onRemover: (cdSetor: string) => void;
  onLimpar: () => void;
}

export function DetailPanel({
  pontos,
  maxPontos,
  carregando,
  modoAdicionar,
  onAdicionarRegiao,
  onCancelarAdicao,
  onRemover,
  onLimpar,
}: DetailPanelProps) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  if (pontos.length === 0 && !carregando) {
    return null;
  }

  const limiteAtingido = pontos.length >= maxPontos;

  return (
    <aside className="animate-in slide-in-from-right-8 fade-in flex w-70 shrink-0 flex-col border-l border-border bg-background duration-200">
      {pontos.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando dados do setor...</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">
                {pontos.length} {pontos.length === 1 ? "região selecionada" : "regiões selecionadas"}
              </h2>
              <p className="text-xs text-muted-foreground">Máximo de {maxPontos}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onLimpar} title="Limpar seleção">
              <X />
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <ul className="flex flex-col gap-1 p-2">
              {pontos.map((ponto, indice) => (
                <li
                  key={ponto.setor.cdSetor}
                  className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-muted/60"
                >
                  <BadgePonto numero={indice + 1} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm leading-snug font-medium">{ponto.rotulo}</p>
                    <p className="text-xs text-muted-foreground">
                      Renda média {formatMoeda(ponto.setor.rendaMedia)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRemover(ponto.setor.cdSetor)}
                    title={`Remover ponto ${indice + 1}`}
                  >
                    <X />
                  </Button>
                </li>
              ))}
              {carregando && (
                <li className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Carregando ponto...
                </li>
              )}
            </ul>
          </ScrollArea>

          <div className="flex shrink-0 flex-col gap-2 border-t border-border p-4">
            {modoAdicionar ? (
              <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Clique no mapa (ou busque um endereço) para escolher a próxima região.
                </p>
                <Button variant="ghost" size="sm" onClick={onCancelarAdicao}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={onAdicionarRegiao}
                disabled={limiteAtingido}
                title={limiteAtingido ? `Máximo de ${maxPontos} pontos` : undefined}
              >
                <Plus />
                Adicionar região
              </Button>
            )}
            <Button onClick={() => setDetalhesAbertos(true)} disabled={modoAdicionar}>
              Ver detalhes
            </Button>
          </div>

          <ComparacaoModal open={detalhesAbertos} onOpenChange={setDetalhesAbertos} pontos={pontos} />
        </>
      )}
    </aside>
  );
}
