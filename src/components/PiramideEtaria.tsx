import { Progress } from "@/components/ui/progress";
import type { FaixaPiramide } from "@/utils/tabelaComparativa";
import { formatNumero } from "@/lib/format";
import { formatPercentual } from "@/utils/tabelaComparativa";

interface PiramideEtariaProps {
  faixas: FaixaPiramide[];
  /** Maior fatia (%) entre todos os pontos, pra as barras serem comparáveis entre colunas. */
  maximo: number;
}

/**
 * Distribuição etária de um ponto, autocontida (faixa + barra + % na mesma linha) — cada coluna
 * da comparação se lê sozinha, sem depender de alinhar com os rótulos da primeira coluna.
 * A faixa predominante fica em cor cheia pra saltar aos olhos. Barras = Progress do shadcn.
 */
export function PiramideEtaria({ faixas, maximo }: PiramideEtariaProps) {
  const maiorDoPonto = Math.max(0, ...faixas.map((f) => f.percentual ?? 0));

  return (
    <div className="flex flex-col gap-1" role="img" aria-label="Distribuição etária">
      {faixas.map((faixa) => {
        const percentual = faixa.percentual ?? 0;
        const predominante = percentual > 0 && percentual === maiorDoPonto;
        const destaqueTexto = predominante ? "font-semibold text-foreground" : "text-muted-foreground";
        return (
          <div
            key={faixa.faixa}
            className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-2 text-[11px]"
            title={`${faixa.faixa} anos: ${formatNumero(faixa.total)} moradores (${formatNumero(percentual, 1)}%)`}
          >
            <span className={`tabular-nums ${destaqueTexto}`}>{faixa.faixa}</span>
            <Progress
              value={maximo > 0 ? (percentual / maximo) * 100 : 0}
              className={`**:data-[slot=progress-track]:h-3.5 **:data-[slot=progress-track]:rounded-sm **:data-[slot=progress-indicator]:rounded-sm ${predominante ? "" : "**:data-[slot=progress-indicator]:opacity-45"}`}
            />
            <span className={`text-right tabular-nums ${destaqueTexto}`}>
              {faixa.percentual === null ? "—" : formatPercentual(percentual)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
