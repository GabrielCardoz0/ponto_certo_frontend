import { useEffect, useRef } from "react";
import { BadgePonto } from "@/components/BadgePonto";
import { InfoIcone } from "@/components/InfoIcone";
import { PiramideEtaria } from "@/components/PiramideEtaria";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

/** Coluna fixa dos rótulos e largura mínima de cada ponto — iguais em todas as seções. */
const LARGURA_ROTULOS = "16rem";
const LARGURA_MIN_PONTO = "15rem";

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
  // Célula com cor = classe econômica: mesmo Badge colorido do relatório de 1 ponto.
  if (celula.cor) {
    return (
      <Badge className="text-white" style={{ backgroundColor: celula.cor }}>
        {celula.texto}
      </Badge>
    );
  }
  return <span className={celula.atenuado ? "text-muted-foreground" : undefined}>{celula.texto}</span>;
}

export function TabelaSecao({ secao, colunas, pontoAtivo, onSelecionarPonto }: TabelaSecaoProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Rola a tabela (só ela) até a coluna do ponto ativo, se estiver fora da área visível.
  // Quem rola é o contêiner interno do <Table> do shadcn (data-slot="table-container").
  useEffect(() => {
    const container = containerRef.current?.querySelector<HTMLElement>('[data-slot="table-container"]');
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

      <div ref={containerRef} className="overflow-hidden rounded-md border border-border">
        {/* table-fixed + <colgroup> iguais em TODAS as seções: sem isso cada tabela calculava a
            largura das colunas pelo próprio conteúdo (uma com texto longo, outra com a
            distribuição etária) e os pontos ficavam em posições diferentes de uma seção pra outra. */}
        <Table
          className="table-fixed border-separate border-spacing-0"
          style={{ width: `max(100%, calc(${LARGURA_ROTULOS} + ${colunas.length} * ${LARGURA_MIN_PONTO}))` }}
        >
          <colgroup>
            <col style={{ width: LARGURA_ROTULOS }} />
            {colunas.map((c) => (
              <col key={c.cdSetor} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead
                data-coluna-fixa
                className="sticky left-0 z-20 h-auto border-b border-border bg-popover px-3 py-2 text-xs text-muted-foreground"
              >
                Variável
              </TableHead>
              {/* Colunas de ponto sem largura fixa: a sobra da largura vai pros dados, não pros rótulos. */}
              {colunas.map((coluna, i) => (
                <TableHead
                  key={coluna.cdSetor}
                  data-cd-setor={coluna.cdSetor}
                  className={`h-auto border-b border-border px-3 py-2 align-top whitespace-normal ${destaque(i)}`}
                >
                  <div className="flex items-start gap-2">
                    <BadgePonto
                      numero={coluna.numero}
                      ativo={coluna.cdSetor === pontoAtivo}
                      onClick={() => onSelecionarPonto(coluna.cdSetor)}
                      titulo={`Ver o ponto ${coluna.numero} no mapa`}
                    />
                    <span className="line-clamp-2 text-xs leading-snug font-medium" title={coluna.rotulo}>
                      {coluna.rotulo}
                    </span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {secao.linhas.map((linha, indice) => (
              <Linha
                key={`${indice}-${linha.tipo === "grupo" ? linha.titulo : linha.rotulo}`}
                linha={linha}
                totalColunas={colunas.length}
                destaque={destaque}
              />
            ))}
          </TableBody>
        </Table>
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
      <TableRow className="hover:bg-transparent">
        <TableHead className="sticky left-0 z-10 h-auto border-b border-border bg-muted px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <span className="flex items-center gap-1.5">
            {linha.titulo}
            {linha.info && <InfoIcone texto={linha.info} />}
          </span>
        </TableHead>
        <TableCell colSpan={totalColunas} className="border-b border-border bg-muted p-0" />
      </TableRow>
    );
  }

  const maximo = linha.tipo === "piramide" ? maiorFatia(linha.celulas) : 0;

  return (
    <TableRow>
      <TableHead
        scope="row"
        className="sticky left-0 z-10 h-auto border-b border-border bg-popover px-3 py-2 align-top font-normal whitespace-normal text-muted-foreground"
      >
        <span className="flex items-center gap-1.5">
          {linha.rotulo}
          {linha.info && <InfoIcone texto={linha.info} />}
        </span>
      </TableHead>
      {/* A distribuição etária traz faixa, barra e % dentro da própria célula — por isso a
          coluna fica mais larga nessa linha, pras barras terem espaço de verdade. */}
      {linha.celulas.map((celula, i) => (
        <TableCell
          key={i}
          className={`${linha.tipo === "piramide" ? "py-3" : "py-2"} border-b border-border px-3 align-top whitespace-normal tabular-nums ${destaque(i)}`}
        >
          <Celula celula={celula} maximo={maximo} />
        </TableCell>
      ))}
    </TableRow>
  );
}
