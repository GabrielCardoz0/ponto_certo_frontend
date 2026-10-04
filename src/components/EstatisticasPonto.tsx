import { Area, AreaChart, ReferenceLine, XAxis } from "recharts";
import { CircleAlert } from "lucide-react";
import { InfoIcone } from "@/components/InfoIcone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ABEP_CLASSES, ABEP_CLASSES_INDICES_DESC } from "@/lib/abep";
import { corrigirRenda } from "@/lib/correcaoMonetaria";
import { formatMoeda, formatNumero } from "@/lib/format";
import {
  ajustarLognormal,
  curvaDensidade,
  distribuicaoPorFaixa,
  giniEstimado,
  indiceVulnerabilidade,
  participacaoDoTopo,
  percentil,
} from "@/utils/estatisticaRenda";
import { formatPercentual, pct } from "@/utils/tabelaComparativa";
import type { SetorComPois } from "@/types/setor";

const PERCENTIS = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99];

const configGrafico = {
  densidade: { label: "Densidade", color: "var(--primary)" },
} satisfies ChartConfig;

/** O que cada percentil quer dizer, em linguagem de corretor. */
function significadoPercentil(p: number): string {
  const abaixo = Math.round(p * 100);
  const acima = 100 - abaixo;
  if (abaixo === 50) return "Metade ganha menos que isso, metade ganha mais";
  if (abaixo >= 99) return `Só ${acima}% ganha mais que isso — o topo do setor`;
  if (abaixo >= 90) return `${abaixo}% ganha até esse valor; só ${acima}% ganha mais — rendas altas`;
  if (abaixo <= 10) return `Só ${abaixo}% ganha menos que isso — rendas mais baixas`;
  return `${abaixo}% ganha até esse valor; ${acima}% ganha mais`;
}

/** R$ 12,9 mil — eixo do gráfico, curto pra caber. */
function moedaCurta(valor: number): string {
  return valor >= 1000 ? `R$ ${formatNumero(valor / 1000, 0)} mil` : `R$ ${formatNumero(valor, 0)}`;
}

function Metrica({ rotulo, info, valor, detalhe }: { rotulo: string; info: string; valor: string; detalhe?: string }) {
  return (
    <Card size="sm" className="bg-muted/40 ring-0">
      <CardHeader className="gap-1">
        <CardDescription className="flex items-center gap-1 text-xs font-medium">
          {rotulo}
          <InfoIcone texto={info} />
        </CardDescription>
        <CardTitle className="font-semibold tabular-nums">{valor}</CardTitle>
        {detalhe && <CardDescription className="text-xs">{detalhe}</CardDescription>}
      </CardHeader>
    </Card>
  );
}

const COR_FAIXA_VULNERABILIDADE = {
  Baixa: "#16a34a",
  Moderada: "#d97706",
  Alta: "#ea580c",
  "Muito alta": "#dc2626",
} as const;

/**
 * Aba "Ver estatísticas" (só admin): modelagem estatística da renda do setor, em cima dos
 * números que a API já devolve. Tudo aqui é ESTIMATIVA (log-normal ajustada por média e CV) —
 * o IBGE não publica a renda de cada domicílio, e a nota no topo deixa isso explícito.
 */
export function EstatisticasPonto({ setor, fatorCorrecao }: { setor: SetorComPois; fatorCorrecao: number }) {
  const media = corrigirRenda(setor.rendaMedia, fatorCorrecao);
  const mediana = corrigirRenda(setor.rendaMediana, fatorCorrecao);
  const cv = setor.coefVariacaoRenda;
  const modelo = ajustarLognormal(media, cv);

  if (!modelo || media === null) {
    return (
      <Alert>
        <CircleAlert />
        <AlertTitle>Sem dados suficientes para estimar a distribuição</AlertTitle>
        <AlertDescription>
          Este setor não tem renda média e coeficiente de variação publicados (sigilo estatístico ou setor sem
          moradores), então a curva não pode ser calculada.
        </AlertDescription>
      </Alert>
    );
  }

  const curva = curvaDensidade(modelo);
  const gini = giniEstimado(modelo);
  const topo10 = participacaoDoTopo(modelo, 0.1);
  const fracaoPorClasse = distribuicaoPorFaixa(modelo, ABEP_CLASSES);
  const diferencaMediana = mediana !== null ? (modelo.medianaTeorica / mediana - 1) * 100 : null;

  const san = setor.vulnerabilidade?.saneamento;
  const vulnerabilidade = indiceVulnerabilidade({
    cv,
    agua: pct(san?.aguaRede ?? null, setor.domiciliosOcupados),
    esgoto: pct(san?.esgotoRede ?? null, setor.domiciliosOcupados),
    lixo: pct(san?.lixoColetado ?? null, setor.domiciliosOcupados),
  });

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <CircleAlert />
        <AlertTitle>Estimativa estatística</AlertTitle>
        <AlertDescription>
          O IBGE publica só média, mediana e variação da renda por setor. A curva abaixo é uma distribuição
          log-normal ajustada a esses números — serve para ler a dispersão, não é a renda de cada domicílio.
        </AlertDescription>
      </Alert>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 font-semibold">
            Distribuição estimada da renda do responsável
            <InfoIcone texto="Curva log-normal: σ² = ln(1 + CV²) e μ = ln(média) − σ²/2. A altura mostra onde se concentram os responsáveis; a cauda à direita são as rendas altas." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={configGrafico} className="aspect-auto h-64 w-full">
            <AreaChart data={curva} margin={{ top: 22, right: 12, left: 12, bottom: 0 }}>
              <XAxis
                dataKey="renda"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={moedaCurta}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={40}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel={false}
                    labelFormatter={(_, itens) => formatMoeda(itens?.[0]?.payload?.renda)}
                    formatter={() => null}
                  />
                }
              />
              <Area
                dataKey="densidade"
                type="monotone"
                stroke="var(--color-densidade)"
                fill="var(--color-densidade)"
                fillOpacity={0.18}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <ReferenceLine
                x={media}
                stroke="var(--color-densidade)"
                strokeDasharray="4 3"
                label={{ value: `Média ${moedaCurta(media)}`, position: "top", fontSize: 11 }}
              />
              {mediana !== null && (
                <ReferenceLine
                  x={mediana}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 3"
                  label={{ value: `Mediana ${moedaCurta(mediana)}`, position: "insideTopLeft", fontSize: 11 }}
                />
              )}
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Metrica rotulo="Média" info="Renda média do responsável (Censo 2022, corrigida pelo IPCA)." valor={formatMoeda(media)} />
        <Metrica
          rotulo="Mediana"
          info="Mediana publicada pelo IBGE (corrigida pelo IPCA): metade dos responsáveis ganha menos que isso."
          valor={formatMoeda(mediana)}
        />
        <Metrica
          rotulo="Mediana do modelo"
          info="Mediana que a curva log-normal prevê (e^μ). Perto da mediana real = o setor se comporta como uma log-normal; longe = a curva é só aproximada."
          valor={formatMoeda(modelo.medianaTeorica)}
          detalhe={
            diferencaMediana !== null
              ? `${diferencaMediana > 0 ? "+" : ""}${formatNumero(diferencaMediana, 1)}% vs. real`
              : undefined
          }
        />
        <Metrica
          rotulo="Coef. de variação"
          info="Desvio-padrão ÷ média da renda no setor. Quanto maior, mais desigual a renda dentro do setor."
          valor={formatNumero(cv, 2)}
        />
        <Metrica
          rotulo="σ (log-renda)"
          info="Dispersão da renda na escala logarítmica, calculada do CV: σ = √ln(1 + CV²). É o parâmetro que dá o formato da curva."
          valor={formatNumero(modelo.sigma, 3)}
        />
        <Metrica
          rotulo="Gini estimado"
          info="Desigualdade de renda do modelo: 0 = todos ganham igual, 1 = um só ganha tudo. Calculado por 2·Φ(σ/√2) − 1."
          valor={formatNumero(gini, 2)}
        />
        <Metrica
          rotulo="Renda do topo 10%"
          info="Quanto da renda total do setor fica com os 10% de responsáveis mais ricos, segundo o modelo. Se todos ganhassem igual seria 10%; quanto maior, mais concentrada."
          valor={formatPercentual(topo10 * 100)}
          detalhe="da renda do setor"
        />
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 font-semibold">
            Distribuição estimada por classe econômica
            <InfoIcone texto="Quantos % dos responsáveis do setor cairiam em cada classe ABEP, aplicando os cortes de renda da classe à curva do modelo. Cada responsável equivale a um domicílio ocupado, então ao lado vai a quantidade estimada de domicílios (% × domicílios ocupados do setor). É estimativa, não contagem." />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {setor.domiciliosOcupados !== null && (
            <p className="text-xs text-muted-foreground">
              Total: {formatNumero(setor.domiciliosOcupados)} domicílios ocupados (um responsável por domicílio).
            </p>
          )}
          {ABEP_CLASSES_INDICES_DESC.map((i) => {
            const classe = ABEP_CLASSES[i];
            const fracao = fracaoPorClasse[i] * 100;
            return (
              <div key={classe.label} className="grid grid-cols-[3rem_1fr_3rem_7rem] items-center gap-3 text-sm">
                <Badge className="h-5 justify-center text-white" style={{ backgroundColor: classe.cor }}>
                  {classe.label}
                </Badge>
                <Progress
                  value={fracao}
                  className="**:data-[slot=progress-indicator]:bg-(--cor) **:data-[slot=progress-track]:h-2.5"
                  style={{ "--cor": classe.cor } as React.CSSProperties}
                />
                <span className="text-right font-medium tabular-nums">{formatPercentual(fracao)}</span>
                <span className="text-right text-xs text-muted-foreground tabular-nums">
                  {setor.domiciliosOcupados === null
                    ? "—"
                    : `≈ ${formatNumero((fracao / 100) * setor.domiciliosOcupados, 0)} dom.`}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 font-semibold">
              Renda por percentil
              <InfoIcone texto="Renda abaixo da qual fica X% dos responsáveis do setor, segundo o modelo. P99 = só 1% ganha mais que isso." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-2">Percentil</TableHead>
                  <TableHead className="px-2 text-right">Renda estimada</TableHead>
                  <TableHead className="px-2">O que significa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PERCENTIS.map((p) => (
                  <TableRow key={p}>
                    <TableCell className="text-muted-foreground">P{Math.round(p * 100)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoeda(percentil(modelo, p))}
                    </TableCell>
                    <TableCell className="text-xs whitespace-normal text-muted-foreground">
                      {significadoPercentil(p)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40">
                  <TableCell className="flex items-center gap-1 text-muted-foreground">
                    Faixa estimada (P1 – P99)
                    <InfoIcone texto="A log-normal não tem mínimo nem máximo; por isso a menor e a maior renda estimadas são o P1 e o P99 — onde ficam 98% dos responsáveis. Valores fora disso são casos raros." />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {moedaCurta(percentil(modelo, 0.01))} – {moedaCurta(percentil(modelo, 0.99))}
                  </TableCell>
                  <TableCell className="text-xs whitespace-normal text-muted-foreground">
                    98% dos responsáveis ficam nessa faixa
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 font-semibold">
              Grau de vulnerabilidade
              <InfoIcone texto="Índice 0–100 (proposta): 60% déficit de saneamento (100 − média de água, esgoto e lixo coletado) + 40% desigualdade de renda (CV, com teto em 1,5). Não é um índice oficial." />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {vulnerabilidade ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-semibold tabular-nums">{formatNumero(vulnerabilidade.indice, 0)}</span>
                  <Badge
                    className="h-6 text-white"
                    style={{ backgroundColor: COR_FAIXA_VULNERABILIDADE[vulnerabilidade.faixa] }}
                  >
                    {vulnerabilidade.faixa}
                  </Badge>
                </div>
                <Progress
                  value={vulnerabilidade.indice}
                  className="**:data-[slot=progress-indicator]:bg-(--cor) **:data-[slot=progress-track]:h-2"
                  style={{ "--cor": COR_FAIXA_VULNERABILIDADE[vulnerabilidade.faixa] } as React.CSSProperties}
                />
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span>
                    Déficit de saneamento:{" "}
                    <strong className="text-foreground">
                      {formatPercentual(vulnerabilidade.componentes.deficitSaneamento)}
                    </strong>{" "}
                    (peso 60%)
                  </span>
                  <span>
                    Desigualdade de renda:{" "}
                    <strong className="text-foreground">
                      {formatPercentual(vulnerabilidade.componentes.desigualdadeRenda)}
                    </strong>{" "}
                    (peso 40%)
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem dados de saneamento publicados para este setor — o índice precisa de água, esgoto e lixo.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
