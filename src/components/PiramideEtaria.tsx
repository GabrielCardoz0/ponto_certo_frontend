import type { FaixaPiramide } from "@/utils/tabelaComparativa";
import { formatNumero } from "@/lib/format";

/** Altura de cada faixa em px — os rótulos na primeira coluna da tabela usam a mesma. */
export const ALTURA_FAIXA_PIRAMIDE = 12;

interface PiramideEtariaProps {
  faixas: FaixaPiramide[];
  /** Maior fatia (%) entre todos os pontos, pra as barras serem comparáveis entre colunas. */
  maximo: number;
}

/** Mini-gráfico de barras horizontais: uma barra por faixa etária, da mais jovem à mais velha. */
export function PiramideEtaria({ faixas, maximo }: PiramideEtariaProps) {
  return (
    <div className="flex flex-col" role="img" aria-label="Pirâmide etária">
      {faixas.map((faixa) => {
        const percentual = faixa.percentual ?? 0;
        return (
          <div
            key={faixa.faixa}
            className="flex items-center"
            style={{ height: ALTURA_FAIXA_PIRAMIDE }}
            title={`${faixa.faixa} anos: ${formatNumero(faixa.total)} (${formatNumero(percentual, 1)}%)`}
          >
            <div
              className="h-2 rounded-r-sm bg-primary/70"
              style={{ width: `${maximo > 0 ? (percentual / maximo) * 100 : 0}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
