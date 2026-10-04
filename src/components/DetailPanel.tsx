import { useState } from "react";
import { cn } from "cn";
import { X, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BadgePonto } from "@/components/BadgePonto";
import { ComparacaoModal } from "@/components/ComparacaoModal";
import { corrigirRenda } from "@/lib/correcaoMonetaria";
import { formatMoeda } from "@/lib/format";
import { RENDA_NAO_DIVULGADA } from "@/lib/semDado";
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
  /** Corrige a renda bruta do Censo pra valores de hoje. Padrão: 1 (sem correção). */
  fatorCorrecao?: number;
}

export function DetailPanel({
  pontos: pontosAtuais,
  maxPontos,
  carregando,
  modoAdicionar,
  onAdicionarRegiao,
  onCancelarAdicao,
  onRemover,
  onLimpar,
  fatorCorrecao = 1,
}: DetailPanelProps) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  // A barra nunca desmonta: abre/fecha animando a largura (o mapa ao lado acompanha, sem salto).
  // Ao fechar, `pontos` já está vazio — guardamos a última lista pra o conteúdo sumir com fade
  // em vez de piscar vazio durante o fechamento.
  const aberta = pontosAtuais.length > 0 || carregando;
  const [ultimosPontos, setUltimosPontos] = useState(pontosAtuais);
  if (pontosAtuais.length > 0 && pontosAtuais !== ultimosPontos) setUltimosPontos(pontosAtuais);
  const pontos = pontosAtuais.length > 0 ? pontosAtuais : ultimosPontos;

  const limiteAtingido = pontos.length >= maxPontos;

  return (
    <aside
      inert={!aberta}
      aria-hidden={!aberta}
      className={cn(
        "shrink-0 overflow-hidden bg-background transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        aberta ? "w-70 border-l border-border" : "w-0"
      )}
    >
      {/* Largura fixa por dentro: o conteúdo não se espreme enquanto o aside cresce/encolhe. */}
      <div
        className={cn(
          "flex h-full w-70 flex-col transition-opacity duration-300 ease-out",
          aberta ? "opacity-100 delay-200" : "opacity-0"
        )}
      >
        {pontosAtuais.length === 0 && carregando ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando dados do setor...</p>
          </div>
        ) : pontos.length === 0 ? null : (
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
                        {ponto.setor.rendaMedia === null
                          ? RENDA_NAO_DIVULGADA
                          : `Renda do responsável ${formatMoeda(corrigirRenda(ponto.setor.rendaMedia, fatorCorrecao))}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">Setor {ponto.setor.cdSetor}</p>
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

            <ComparacaoModal
              open={detalhesAbertos}
              onOpenChange={setDetalhesAbertos}
              pontos={pontos}
              fatorCorrecao={fatorCorrecao}
            />
          </>
        )}
      </div>
    </aside>
  );
}
