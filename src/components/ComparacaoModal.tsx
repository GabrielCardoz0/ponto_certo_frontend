import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { compararSetores } from "@/lib/api";
import { formatMoeda, formatNumero } from "@/lib/format";
import type { Comparacao, Setor } from "@/types/setor";

function CampoDado({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}

function ColunaSetor({ setor }: { setor: Setor }) {
  return (
    <div className="min-w-0 flex-1">
      <h3 className="truncate text-sm font-semibold">{setor.nmMunicipio}</h3>
      <p className="mb-2 truncate text-xs text-muted-foreground">
        {setor.uf} · {setor.regiao} · Setor {setor.cdSetor}
      </p>
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

interface ComparacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setorA: Setor;
  setorB: Setor | null;
}

export function ComparacaoModal({ open, onOpenChange, setorA, setorB }: ComparacaoModalProps) {
  const [comparacao, setComparacao] = useState<Comparacao | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !setorB) return;
    // Fetch acionado pela abertura do modal: liga loading antes de chamar a API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setErro(null);
    compararSetores(setorA.cdSetor, setorB.cdSetor)
      .then(setComparacao)
      .catch(() => setErro("Erro ao comparar os setores."))
      .finally(() => setLoading(false));
  }, [open, setorA, setorB]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[95vw] max-w-6xl flex-col">
        <DialogHeader>
          <DialogTitle>{setorB ? "Comparação de setores" : "Detalhes do setor"}</DialogTitle>
          <DialogDescription>
            {setorB ? `${setorA.nmMunicipio} × ${setorB.nmMunicipio}` : setorA.nmMunicipio}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto sm:flex-row sm:gap-6">
          <ColunaSetor setor={setorA} />
          {setorB && (
            <>
              <Separator orientation="vertical" className="hidden sm:block" />
              <ColunaSetor setor={setorB} />
            </>
          )}
        </div>

        {setorB && (
          <>
            <Separator />
            <div>
              <h3 className="mb-1 text-sm font-semibold">Diferença (A − B)</h3>
              {loading && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Comparando...
                </p>
              )}
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              {comparacao && !loading && (
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
      </DialogContent>
    </Dialog>
  );
}
