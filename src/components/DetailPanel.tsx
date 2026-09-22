import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { X, MapPinOff, GitCompareArrows, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getRelatorio, compararSetores } from "@/lib/api";
import { formatMoeda, formatNumero } from "@/lib/format";
import type { Setor, Relatorio, Comparacao } from "@/types/setor";

const RAIO_PADRAO_METROS = 1000;

interface DetailPanelProps {
  setorA: Setor | null;
  setorB: Setor | null;
  onIniciarComparacao: () => void;
  onRemoverB: () => void;
}

export interface DetailPanelHandle {
  abrirRelatorio: () => void;
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

export const DetailPanel = forwardRef<DetailPanelHandle, DetailPanelProps>(function DetailPanel(
  { setorA, setorB, onIniciarComparacao, onRemoverB },
  ref
) {
  const [raio, setRaio] = useState(RAIO_PADRAO_METROS);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [relatorioLoading, setRelatorioLoading] = useState(false);
  const [relatorioErro, setRelatorioErro] = useState<string | null>(null);

  const [comparacao, setComparacao] = useState<Comparacao | null>(null);
  const [comparacaoLoading, setComparacaoLoading] = useState(false);
  const [comparacaoErro, setComparacaoErro] = useState<string | null>(null);

  useEffect(() => {
    if (!setorA || !setorB) return;
    // Fetch acionado pela mudança de A/B: liga loading antes de chamar a API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComparacaoLoading(true);
    setComparacaoErro(null);
    compararSetores(setorA.cdSetor, setorB.cdSetor)
      .then(setComparacao)
      .catch(() => setComparacaoErro("Erro ao comparar os setores."))
      .finally(() => setComparacaoLoading(false));
  }, [setorA, setorB]);

  async function gerarRelatorio() {
    if (!setorA) return;
    setRelatorioLoading(true);
    setRelatorioErro(null);
    try {
      const data = await getRelatorio(setorA.cdSetor, raio);
      setRelatorio(data);
    } catch {
      setRelatorioErro("Erro ao gerar relatório.");
    } finally {
      setRelatorioLoading(false);
    }
  }

  useImperativeHandle(ref, () => ({
    abrirRelatorio: () => {
      void gerarRelatorio();
    },
  }));

  if (!setorA) {
    return (
      <aside className="flex w-38 shrink-0 flex-col items-center justify-center gap-2 border-l border-border bg-background p-4 text-center">
        <MapPinOff className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Clique em um ponto do mapa para ver detalhes.
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-background">
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-4 p-4">
          <div>
            <h2 className="text-sm font-semibold">{setorA.nmMunicipio}</h2>
            <p className="text-xs text-muted-foreground">
              {setorA.uf} · {setorA.regiao} · Setor {setorA.cdSetor}
            </p>
          </div>

          <SetorDados setor={setorA} />

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

              <Separator />
              <div>
                <h3 className="mb-1 text-sm font-semibold">Diferença (A − B)</h3>
                {comparacaoLoading && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Comparando...
                  </p>
                )}
                {comparacaoErro && <p className="text-sm text-destructive">{comparacaoErro}</p>}
                {comparacao && !comparacaoLoading && (
                  <div>
                    <CampoDado label="Renda média" valor={formatMoeda(comparacao.diferenca.rendaMedia)} />
                    <CampoDado
                      label="Renda mediana"
                      valor={formatMoeda(comparacao.diferenca.rendaMediana)}
                    />
                    <CampoDado label="População" valor={formatNumero(comparacao.diferenca.populacao)} />
                    <CampoDado
                      label="Densidade (hab/km²)"
                      valor={formatNumero(comparacao.diferenca.densidadeHabKm2, 1)}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {!setorB && (
            <Button variant="outline" onClick={onIniciarComparacao}>
              <GitCompareArrows />
              Comparar com outro ponto
            </Button>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="raio-relatorio">Raio do relatório (metros)</Label>
            <Input
              id="raio-relatorio"
              type="number"
              min={100}
              step={100}
              value={raio}
              onChange={(e) => setRaio(Number(e.target.value) || RAIO_PADRAO_METROS)}
            />
            <Button onClick={gerarRelatorio} disabled={relatorioLoading}>
              {relatorioLoading ? <Loader2 className="animate-spin" /> : <FileText />}
              Gerar relatório
            </Button>
          </div>

          {relatorioErro && <p className="text-sm text-destructive">{relatorioErro}</p>}

          {relatorio && (
            <div>
              <Separator className="mb-3" />
              <h3 className="mb-1 text-sm font-semibold">
                Relatório · raio de {formatNumero(relatorio.raioMetros)}m
              </h3>
              {relatorio.poisPorCategoria.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum ponto de interesse encontrado neste raio.
                </p>
              ) : (
                <div>
                  {relatorio.poisPorCategoria.map((item) => (
                    <CampoDado
                      key={item.categoria}
                      label={item.categoria}
                      valor={formatNumero(item.quantidade)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
});
