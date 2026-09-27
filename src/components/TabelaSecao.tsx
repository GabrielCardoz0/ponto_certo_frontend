import { useEffect, useRef } from "react";
import { BadgePonto } from "@/components/BadgePonto";
import { InfoIcone } from "@/components/InfoIcone";
import { ALTURA_FAIXA_PIRAMIDE, PiramideEtaria } from "@/components/PiramideEtaria";
import type {
  CelulaTabela,
  ColunaTabela,
  LinhaTabela,
  SecaoTabela,
} from "@/utils/tabelaComparativa";

interface TabelaSecaoProps {
  secao: SecaoTabela;
  colunas: ColunaTabela[];
  /** cdSetor do ponto em destaque: a coluna ganha fundo sutil e a tabela rola até ela. */
  pontoAtivo: string | null;
  onSelecionarPonto: (cdSetor: string) => void;
}

const DESTAQUE_COLUNA = "bg-accent/60";

/** Maior fatia (%) de qualquer faixa etária entre todos os pontos da linha. */
function maiorFatia(celulas: CelulaTabela[]): number {
  return Math.max(
    0,
    ...celulas.flatMap((c) => (c.tipo === "piramide" && c.faixas ? c.faixas.map((f) => f.percentual ?? 0) : []))
  );
}

function Celula({ celula, maximo }: { celula: CelulaTabela; maximo: number }) {
  if (celula.tipo === "piramide") {
    return celula.faixas ? (
      <PiramideEtaria faixas={celula.faixas} maximo={maximo} />
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }
  return (
    <span className={celula.atenuado ? "text-muted-foreground" : undefined}>
      {celula.cor && (
        <span
          className="mr-1.5 inline-block size-2.5 rounded-sm align-middle"
          style={{ backgroundColor: celula.cor }}
        />
      )}
      {celula.texto}
    </span>
  );
}

export function TabelaSecao({ secao, colunas, pontoAtivo, onSelecionarPonto }: TabelaSecaoProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Rola a tabela (só ela) até a coluna do ponto ativo, se estiver fora da área visível.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pontoAtivo) return;
    const cabecalho = container.querySelector<HTMLElement>(`th[data-cd-setor="${pontoAtivo}"]`);
    const colunaFixa = container.querySelector<HTMLElement>("th[data-coluna-fixa]");
    if (!cabecalho || !colunaFixa) return;

    const caixa = container.getBoundingClientRect();
    const alvo = cabecalho.getBoundingClientRect();
    const esquerda = alvo.left - caixa.left + container.scrollLeft;
    const direita = esquerda + alvo.width;
    const inicioVisivel = container.scrollLeft + colunaFixa.offsetWidth;
    const fimVisivel = container.scrollLeft + container.clientWidth;

    if (esquerda < inicioVisivel) {
      container.scrollTo({ left: esquerda - colunaFixa.offsetWidth, behavior: "smooth" });
    } else if (direita > fimVisivel) {
      container.scrollTo({ left: direita - container.clientWidth, behavior: "smooth" });
    }
  }, [pontoAtivo]);

  const destaque = (indice: number) => (colunas[indice]?.cdSetor === pontoAtivo ? DESTAQUE_COLUNA : "");

  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        {secao.titulo}
        {secao.info && <InfoIcone texto={secao.info} />}
      </h3>

      <div ref={containerRef} className="relative overflow-x-auto rounded-md border border-border">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                data-coluna-fixa
                className="sticky left-0 z-20 min-w-52 border-b border-border bg-popover px-3 py-2 text-left text-xs font-medium text-muted-foreground"
              >
                Variável
              </th>
              {colunas.map((coluna, i) => (
                <th
                  key={coluna.cdSetor}
                  data-cd-setor={coluna.cdSetor}
                  className={`w-44 min-w-44 border-b border-border px-3 py-2 text-left align-top ${destaque(i)}`}
                >
                  <div className="flex items-start gap-2">
                    <BadgePonto
                      numero={coluna.numero}
                      ativo={coluna.cdSetor === pontoAtivo}
                      onClick={() => onSelecionarPonto(coluna.cdSetor)}
                      titulo={`Ver o ponto ${coluna.numero} no mapa`}
                    />
                    <span className="line-clamp-2 text-xs leading-snug font-medium">{coluna.rotulo}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {secao.linhas.map((linha, indice) => (
              <Linha
                key={`${indice}-${linha.tipo === "grupo" ? linha.titulo : linha.rotulo}`}
                linha={linha}
                totalColunas={colunas.length}
                destaque={destaque}
              />
            ))}
          </tbody>
        </table>
      </div>

      {secao.nota && <p className="text-xs text-muted-foreground">{secao.nota}</p>}
    </section>
  );
}

function Linha({
  linha,
  totalColunas,
  destaque,
}: {
  linha: LinhaTabela;
  totalColunas: number;
  destaque: (indice: number) => string;
}) {
  if (linha.tipo === "grupo") {
    return (
      <tr>
        <th className="sticky left-0 z-10 min-w-52 border-b border-border bg-muted px-3 py-1.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <span className="flex items-center gap-1.5">
            {linha.titulo}
            {linha.info && <InfoIcone texto={linha.info} />}
          </span>
        </th>
        <td colSpan={totalColunas} className="border-b border-border bg-muted" />
      </tr>
    );
  }

  const maximo = linha.tipo === "piramide" ? maiorFatia(linha.celulas) : 0;

  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 min-w-52 border-b border-border bg-popover px-3 py-2 text-left align-top text-sm font-normal text-muted-foreground"
      >
        <span className="flex items-center gap-1.5">
          {linha.rotulo}
          {linha.info && <InfoIcone texto={linha.info} />}
        </span>
        {linha.tipo === "piramide" && (
          <div className="mt-1 text-[10px] text-muted-foreground/80" aria-hidden>
            {linha.faixasRotulos.map((faixa) => (
              <div key={faixa} style={{ height: ALTURA_FAIXA_PIRAMIDE, lineHeight: `${ALTURA_FAIXA_PIRAMIDE}px` }}>
                {faixa}
              </div>
            ))}
          </div>
        )}
      </th>
      {linha.celulas.map((celula, i) => (
        <td
          key={i}
          className={`w-44 min-w-44 border-b border-border px-3 py-2 align-top tabular-nums ${destaque(i)}`}
        >
          <Celula celula={celula} maximo={maximo} />
        </td>
      ))}
    </tr>
  );
}
