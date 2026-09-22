import { useState } from "react";
import { X, GitCompareArrows, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ComparacaoModal } from "@/components/ComparacaoModal";
import { formatMoeda, formatNumero } from "@/lib/format";
import type { Setor } from "@/types/setor";

interface DetailPanelProps {
  setorA: Setor | null;
  setorB: Setor | null;
  carregando: boolean;
  aguardandoPontoB: boolean;
  onIniciarComparacao: () => void;
  onCancelarComparacao: () => void;
  onRemoverB: () => void;
  onFechar: () => void;
}

function CampoDado({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}

function SetorDados({ setor }: { setor: Setor }) {
  return (
    <div>
      <CampoDado label="Renda média" valor={formatMoeda(setor.rendaMedia)} />
      <CampoDado label="Renda mediana" valor={formatMoeda(setor.rendaMediana)} />
      <CampoDado label="População" valor={formatNumero(setor.populacao)} />
      <CampoDado label="Densidade (hab/km²)" valor={formatNumero(setor.densidadeHabKm2, 1)} />
      <CampoDado label="Área (km²)" valor={formatNumero(setor.areaKm2, 2)} />
      <CampoDado label="Tamanho médio da família" valor={formatNumero(setor.tamanhoMedioFamilia, 2)} />
      <CampoDado label="Situação" valor={setor.situacao ?? "—"} />
    </div>
  );
}

export function DetailPanel({
  setorA,
  setorB,
  carregando,
  aguardandoPontoB,
  onIniciarComparacao,
  onCancelarComparacao,
  onRemoverB,
  onFechar,
}: DetailPanelProps) {
  const [comparacaoAberta, setComparacaoAberta] = useState(false);

  if (!setorA && !carregando) {
    return null;
  }

  return (
    <aside className="animate-in slide-in-from-right-8 fade-in flex w-80 shrink-0 flex-col border-l border-border bg-background duration-200">
      {!setorA && carregando && (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando dados do setor...</p>
        </div>
      )}

      {setorA && (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">{setorA.nmMunicipio}</h2>
                <p className="text-xs text-muted-foreground">
                  {setorA.uf} · {setorA.regiao} · Setor {setorA.cdSetor}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={onFechar} title="Fechar painel">
                <X />
              </Button>
            </div>

            <SetorDados setor={setorA} />

            {aguardandoPontoB && (
              <>
                <Separator />
                <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-3 text-center">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Clique em um segundo ponto do mapa para comparar.
                  </p>
                  <Button variant="ghost" size="sm" onClick={onCancelarComparacao}>
                    Cancelar
                  </Button>
                </div>
              </>
            )}

            {carregando && setorB === null && !aguardandoPontoB && (
              <>
                <Separator />
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Carregando ponto B...
                </p>
              </>
            )}

            {setorB && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold">{setorB.nmMunicipio}</h2>
                    <p className="text-xs text-muted-foreground">
                      {setorB.uf} · {setorB.regiao} · Setor {setorB.cdSetor}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={onRemoverB} title="Remover ponto B">
                    <X />
                  </Button>
                </div>
                <SetorDados setor={setorB} />
              </>
            )}

            <Separator />

            {!setorB && !aguardandoPontoB && (
              <Button variant="outline" onClick={onIniciarComparacao}>
                <GitCompareArrows />
                Comparar com outro ponto
              </Button>
            )}
          </div>
        </ScrollArea>
      )}

      {setorA && (
        <div className="shrink-0 border-t border-border p-4">
          <Button
            className="w-full"
            onClick={() => setComparacaoAberta(true)}
            disabled={aguardandoPontoB}
          >
            Ver detalhes
          </Button>
        </div>
      )}

      {setorA && (
        <ComparacaoModal
          open={comparacaoAberta}
          onOpenChange={setComparacaoAberta}
          setorA={setorA}
          setorB={setorB}
        />
      )}
    </aside>
  );
}
