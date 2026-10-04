import type { CSSProperties, ReactNode } from "react";
import { Bus, CircleAlert, GraduationCap, HeartPulse, MapPin, ShoppingBag, Trees } from "lucide-react";
import { InfoIcone } from "@/components/InfoIcone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { classeEconomica } from "@/lib/abep";
import { corrigirRenda, useFatorCorrecao } from "@/lib/correcaoMonetaria";
import { formatMoeda, formatNumero } from "@/lib/format";
import {
  fonteRenda,
  INFO_RENDA_MEDIA,
  INFO_RENDA_MEDIANA,
  ROTULO_RENDA_MEDIA,
} from "@/lib/rotulosRenda";
import { explicacaoSemDado, motivoSemDado } from "@/lib/semDado";
import { formatDistancia, formatPercentual, ordenarCategorias, pct } from "@/utils/tabelaComparativa";
import {
  domicilioPredominante,
  faixaEtariaPredominante,
  homogeneidadeRenda,
} from "@/utils/resumoSetor";
import { rotuloCategoria, rotuloSubcategoria } from "@/utils/nomePoi";
import type { PontoSelecionado, SetorComPois } from "@/types/setor";

interface RelatorioPontoUnicoProps {
  ponto: PontoSelecionado;
  setor: SetorComPois;
  raioMetros: number;
  /** Corrige a renda bruta do Censo pra valores de hoje. Padrão: 1 (sem correção). */
  fatorCorrecao?: number;
}

const COR_MASCULINA = "#2563eb";
const COR_FEMININA = "#db2777";

// Raça/cor fora da tela por enquanto (ver comentário no corpo do componente).
// const CORES_RACA: Record<string, string> = {
//   branca: "#94a3b8",
//   preta: "#1f2937",
//   amarela: "#eab308",
//   parda: "#c2703d",
//   indigena: "#16a34a",
// };

const ICONE_POR_CATEGORIA: Record<string, typeof Bus> = {
  transporte: Bus,
  lazer: Trees,
  comercio: ShoppingBag,
  educacao: GraduationCap,
  saude: HeartPulse,
};

/** Faixa de cor de uma barra de progresso, seguindo o padrão do relatório: verde/amarelo/vermelho. */
function corFaixa(percentual: number): string {
  if (percentual >= 80) return "#16a34a";
  if (percentual >= 50) return "#d97706";
  return "#dc2626";
}

/** Cor de barra no padrão do relatório (verde/amarelo/vermelho), via variável CSS pro Progress do shadcn. */
function estiloCorBarra(cor: string, alturaTrilho = "0.5rem"): CSSProperties {
  return { "--cor-barra": cor, "--altura-trilho": alturaTrilho } as CSSProperties;
}
/** Aplica `--cor-barra`/`--altura-trilho` ao trilho e ao preenchimento internos do <Progress>. */
const CLASSE_BARRA =
  "**:data-[slot=progress-track]:h-(--altura-trilho) **:data-[slot=progress-indicator]:bg-(--cor-barra)";

/**
 * Indicador do resumo (Card do shadcn): rótulo + "i" EM CIMA, valor no meio, detalhe embaixo.
 * Mesmo formato pra todos, pra hierarquia ficar previsível.
 */
function Indicador({
  rotulo,
  info,
  valor,
  detalhe,
  infoDetalhe,
  corValor,
}: {
  rotulo: string;
  info: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  infoDetalhe?: string;
  corValor?: string;
}) {
  return (
    // Sem borda (ring-0): o fundo levemente cinza separa o card do restante.
    <Card size="sm" className="bg-muted/40 ring-0">
      <CardHeader className="gap-1">
        <CardDescription className="flex items-center gap-1 text-xs font-medium">
          {rotulo}
          <InfoIcone texto={info} />
        </CardDescription>
        <CardTitle
          className={`font-semibold tabular-nums`}
          style={corValor ? { color: corValor } : undefined}
        >
          {valor}
        </CardTitle>
        {detalhe && (
          <CardDescription className="flex items-center gap-1 text-xs">
            {detalhe}
            {infoDetalhe && <InfoIcone texto={infoDetalhe} />}
          </CardDescription>
        )}
      </CardHeader>
    </Card>
  );
}

function Cartao({
  titulo,
  info,
  children,
  nota,
}: {
  titulo: string;
  info?: string;
  children: ReactNode;
  nota?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 font-semibold">
          {titulo}
          {info && <InfoIcone texto={info} />}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {children}
        {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
      </CardContent>
    </Card>
  );
}

function Estatistica({ rotulo, valor, info }: { rotulo: string; valor: string; info?: string }) {
  // "—" (dado nulo) vira "Não divulgado": um traço solto parece erro, a frase explica.
  const naoDivulgado = valor === "—";
  return (
    <Card size="sm" className="bg-muted/40">
      <CardHeader className="gap-0.5">
        <CardDescription className="flex items-center gap-1 text-xs">
          {rotulo}
          {info && <InfoIcone texto={info} />}
        </CardDescription>
        <CardTitle className={naoDivulgado ? "text-sm font-normal text-muted-foreground" : "font-semibold"}>
          {naoDivulgado ? "Não divulgado" : valor}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function BarraProgresso({
  rotulo,
  info,
  percentual,
  inverso = false,
}: {
  rotulo: string;
  info?: string;
  percentual: number | null;
  /** Indicador em que MAIS é PIOR (obstáculo, sem árvore): a cor segue o inverso do valor. */
  inverso?: boolean;
}) {
  if (percentual === null) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          {rotulo}
          {info && <InfoIcone texto={info} />}
        </span>
        <span className="text-xs">—</span>
      </div>
    );
  }
  return (
    <Progress
      value={Math.min(100, Math.max(0, percentual))}
      className={`gap-1.5 ${CLASSE_BARRA}`}
      style={estiloCorBarra(corFaixa(inverso ? 100 - percentual : percentual))}
    >
      <ProgressLabel className="flex items-center gap-1 font-normal">
        {rotulo}
        {info && <InfoIcone texto={info} />}
      </ProgressLabel>
      <ProgressValue className="font-medium text-foreground">{() => formatPercentual(percentual)}</ProgressValue>
    </Progress>
  );
}

export function RelatorioPontoUnico({ ponto, setor, raioMetros, fatorCorrecao = 1 }: RelatorioPontoUnicoProps) {
  const { mesReferencia } = useFatorCorrecao();
  const semDado = motivoSemDado(setor);
  const rendaMedia = corrigirRenda(setor.rendaMedia, fatorCorrecao);
  const rendaMediana = corrigirRenda(setor.rendaMediana, fatorCorrecao);
  const classe = classeEconomica(rendaMedia);
  const cv = setor.coefVariacaoRenda;
  const homogeneidade = homogeneidadeRenda(cv);

  const totalSexo = (setor.demografia?.sexo.masculina ?? 0) + (setor.demografia?.sexo.feminina ?? 0);
  const pctMasculina = pct(setor.demografia?.sexo.masculina ?? null, totalSexo || null);
  const pctFeminina = pct(setor.demografia?.sexo.feminina ?? null, totalSexo || null);

  // Raça/cor: fora da tela por enquanto (decisão de produto — o Gabriel vai dar outro uso pra
  // esse dado depois). A API continua devolvendo `setor.demografia.raca`; pra reativar, é só
  // descomentar este cálculo, CORES_RACA lá em cima e o cartão "Raça / cor" mais abaixo.
  // const raca = setor.demografia?.raca;
  // const totalRaca = raca
  //   ? (raca.branca ?? 0) + (raca.preta ?? 0) + (raca.amarela ?? 0) + (raca.parda ?? 0) + (raca.indigena ?? 0)
  //   : 0;
  // const fatiasRaca = raca
  //   ? (
  //       [
  //         ["Branca", raca.branca, CORES_RACA.branca],
  //         ["Preta", raca.preta, CORES_RACA.preta],
  //         ["Parda", raca.parda, CORES_RACA.parda],
  //         ["Amarela", raca.amarela, CORES_RACA.amarela],
  //         ["Indígena", raca.indigena, CORES_RACA.indigena],
  //       ] as const
  //     ).map(([rotulo, valor, cor]) => ({ rotulo, cor, percentual: pct(valor, totalRaca || null) }))
  //   : [];

  const alfabetizacao = setor.demografia?.alfabetizacao;
  const totalAlfabetizacao =
    alfabetizacao && alfabetizacao.alfabetizados !== null && alfabetizacao.naoAlfabetizados !== null
      ? alfabetizacao.alfabetizados + alfabetizacao.naoAlfabetizados
      : null;
  const pctAlfabetizados = pct(alfabetizacao?.alfabetizados ?? null, totalAlfabetizacao);

  const maiorFatiaPiramide = Math.max(
    0,
    ...(setor.demografia?.piramideEtaria.map((f) => pct(f.total, setor.populacao) ?? 0) ?? [])
  );

  // Respostas rápidas (mesma lógica do resumo da comparação, em utils/resumoSetor.ts).
  const faixaPredominante = faixaEtariaPredominante(setor);
  const domicilio = domicilioPredominante(setor);
  const transporteMaisProximo = setor.poiMaisProximo.find((p) => p.categoria === "transporte");

  const categorias = ordenarCategorias([
    ...new Set([...setor.poisPorCategoria.map((p) => p.categoria), ...setor.poiMaisProximo.map((p) => p.categoria)]),
  ]);
  const km = formatNumero(raioMetros / 1000, raioMetros % 1000 === 0 ? 0 : 1);

  const entorno = setor.vulnerabilidade?.entorno ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">{ponto.rotulo}</p>
        <p className="text-xs text-muted-foreground">
          {setor.nmMunicipio} · {setor.uf} · {setor.regiao}
          <span className="text-muted-foreground/60"> · setor {setor.cdSetor}</span>
        </p>
      </div>

      {semDado && (
        // Setor sem renda/população publicadas: explica em vez de mostrar uma parede de "—".
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <CircleAlert className="text-amber-600" />
          <AlertTitle>{explicacaoSemDado(semDado, setor.domiciliosOcupados).titulo}</AlertTitle>
          <AlertDescription>{explicacaoSemDado(semDado, setor.domiciliosOcupados).texto}</AlertDescription>
        </Alert>
      )}

      {/* Resumo: as perguntas que o corretor faz primeiro, respondidas antes de qualquer detalhe.
          Todos os indicadores no mesmo formato (rótulo + "i" em cima, valor, detalhe embaixo). */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Resumo do setor</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {!semDado && (
            <Indicador
              rotulo={ROTULO_RENDA_MEDIA}
              info={INFO_RENDA_MEDIA}
              valor={formatMoeda(rendaMedia)}
              detalhe={`Mediana ${formatMoeda(rendaMediana)}`}
              infoDetalhe={INFO_RENDA_MEDIANA}
            />
          )}
          {!semDado && (
            <Indicador
              rotulo="Classe econômica"
              info="Classe ABEP (A1 a DE) pela renda média corrigida."
              valor={
                classe ? (
                  <Badge className="h-6 px-2.5 text-sm text-white" style={{ backgroundColor: classe.cor }}>
                    {classe.label}
                  </Badge>
                ) : (
                  "—"
                )
              }
            />
          )}
          {!semDado && (
            <Indicador
              rotulo="Homogeneidade da renda"
              info="Se a renda é parecida entre os domicílios do setor. Coeficiente de variação abaixo de 0,5 = homogênea."
              valor={homogeneidade ? homogeneidade.texto.replace("Renda ", "") : "—"}
              corValor={homogeneidade?.cor}
              detalhe={cv !== null ? `Coef. de variação ${formatNumero(cv, 2)}` : undefined}
            />
          )}
          {!semDado && (
            <Indicador
              rotulo="Faixa etária predominante"
              info="Faixa de idade com mais moradores."
              valor={faixaPredominante ? `${faixaPredominante.faixa} anos` : "—"}
              detalhe={
                faixaPredominante?.percentual != null
                  ? `${formatPercentual(faixaPredominante.percentual)} dos moradores`
                  : undefined
              }
            />
          )}
          {!semDado && (
            <Indicador
              rotulo="População"
              info="Moradores do setor no Censo 2022."
              valor={formatNumero(setor.populacao)}
              detalhe="moradores"
            />
          )}
          {!semDado && (
            <Indicador
              rotulo="Tamanho médio da família"
              info="Média de moradores por domicílio ocupado."
              valor={
                setor.tamanhoMedioFamilia === null ? "—" : `${formatNumero(setor.tamanhoMedioFamilia, 1)} pessoas`
              }
              detalhe="por domicílio"
            />
          )}
          {!semDado && (
            <Indicador
              rotulo="Moradia predominante"
              info="Tipo de domicílio mais comum: casa, condomínio, apartamento ou precária."
              valor={domicilio?.rotulo ?? "—"}
              detalhe={
                domicilio?.percentual != null ? `${formatPercentual(domicilio.percentual)} dos domicílios` : undefined
              }
            />
          )}
          <Indicador
            rotulo="Transporte mais próximo"
            info="Distância do setor até o ponto de transporte público mais próximo (ônibus, metrô ou trem)."
            valor={transporteMaisProximo ? formatDistancia(transporteMaisProximo.distanciaM) : "—"}
            detalhe={transporteMaisProximo ? rotuloSubcategoria(transporteMaisProximo.subcategoria) : undefined}
          />
          <Indicador
            rotulo="Domicílios ocupados"
            info="Com morador no Censo. Uso ocasional = só temporada."
            valor={formatNumero(setor.domiciliosOcupados)}
            detalhe={`${formatNumero(setor.domiciliosVagos)} vagos · ${formatNumero(setor.domiciliosUsoOcasional)} ocasionais`}
          />
        </div>
        {!semDado && <p className="text-xs text-muted-foreground">Renda: IBGE, {fonteRenda(mesReferencia)}.</p>}
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {!semDado && (
          <Estatistica
           
            rotulo="Densidade (hab/km²)"
            valor={formatNumero(setor.densidadeHabKm2, 0)}
            info="Moradores por km² de área do setor."
          />
        )}
        <Estatistica
         
          rotulo="Área (km²)"
          valor={formatNumero(setor.areaKm2, 2)}
          info="Área do setor censitário."
        />
        <Estatistica
         
          rotulo="Situação"
          valor={setor.situacao ?? "—"}
          info="Classificação do IBGE: urbano ou rural."
        />
        <Estatistica
         
          rotulo="Alfabetização (15+)"
          valor={pctAlfabetizados === null ? "—" : formatPercentual(pctAlfabetizados)}
          info="% de 15 anos ou mais que leem e escrevem. 'Não divulgado' = sigilo do IBGE."
        />
      </div>

      {/* Setor sem dado: o aviso do topo já explica; os blocos de moradores e saneamento
          sairiam todos vazios, então não aparecem (entorno e POIs continuam válidos). */}
      {semDado ? null : !setor.demografia || totalSexo === 0 ? (
        <Cartao titulo="Perfil demográfico">
          <p className="text-sm text-muted-foreground">
            O IBGE não publicou o perfil demográfico (sexo e idade) deste setor.
          </p>
        </Cartao>
      ) : (
        <>
          <Cartao titulo="Sexo" info="Distribuição da população do setor por sexo declarado ao Censo.">
            {/* Progress do shadcn: preenchimento = masculino, trilho = feminino. */}
            <Progress
              value={pctMasculina ?? 0}
              className="**:data-[slot=progress-indicator]:bg-(--cor-m) **:data-[slot=progress-track]:h-3 **:data-[slot=progress-track]:bg-(--cor-f)"
              style={{ "--cor-m": COR_MASCULINA, "--cor-f": COR_FEMININA } as CSSProperties}
            />
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: COR_MASCULINA }} />
                Masculino <strong className="font-semibold tabular-nums">{pctMasculina === null ? "—" : formatPercentual(pctMasculina)}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                Feminino <strong className="font-semibold tabular-nums">{pctFeminina === null ? "—" : formatPercentual(pctFeminina)}</strong>
                <span className="size-2 rounded-full" style={{ backgroundColor: COR_FEMININA }} />
              </span>
            </div>
          </Cartao>

          <Cartao
            titulo="Pirâmide etária"
            info="Distribuição da população por faixa etária. O cruzamento sexo × idade não é publicado pelo IBGE nessas tabelas, então cada barra é só o total da faixa (não separado por sexo)."
          >
            {faixaPredominante && (
              <p className="text-sm">
                Faixa predominante: <strong className="font-semibold">{faixaPredominante.faixa} anos</strong>
                {faixaPredominante.percentual !== null && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatPercentual(faixaPredominante.percentual)} da população
                  </span>
                )}
              </p>
            )}
            <div className="flex flex-col gap-1">
              {setor.demografia.piramideEtaria.map((faixa) => {
                const percentual = pct(faixa.total, setor.populacao) ?? 0;
                const largura = maiorFatiaPiramide > 0 ? (percentual / maiorFatiaPiramide) * 100 : 0;
                const predominante = faixa.faixa === faixaPredominante?.faixa;
                return (
                  <div key={faixa.faixa} className="grid grid-cols-[3.5rem_1fr_6rem] items-center gap-2 text-xs">
                    <span className={predominante ? "font-semibold" : "text-muted-foreground"}>{faixa.faixa}</span>
                    <Progress
                      value={largura}
                      className={`${CLASSE_BARRA} ${predominante ? "" : "**:data-[slot=progress-indicator]:opacity-50"}`}
                      style={estiloCorBarra("var(--primary)", "0.75rem")}
                    />
                    <span className={`text-right tabular-nums ${predominante ? "font-semibold" : ""}`}>
                      {formatNumero(faixa.total)} ({formatPercentual(percentual)})
                    </span>
                  </div>
                );
              })}
            </div>
          </Cartao>

          {/* Raça/cor fora da tela por enquanto (ver comentário no topo do componente).
          <Cartao titulo="Raça / cor" info="Distribuição da população do setor por raça/cor autodeclarada ao Censo.">
            (ao reativar, importar Table/TableBody/TableRow/TableCell de "@/components/ui/table")
            <Table>
              <TableBody>
                {fatiasRaca.map((fatia) => (
                  <TableRow key={fatia.rotulo}>
                    <TableCell className="text-muted-foreground">{fatia.rotulo}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fatia.percentual === null ? "—" : formatPercentual(fatia.percentual)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Cartao>
          */}
        </>
      )}

      {!setor.vulnerabilidade ? (
        <Cartao titulo="Vulnerabilidade e infraestrutura">
          <p className="text-sm text-muted-foreground">
            O IBGE não publicou saneamento nem entorno urbano para este setor.
          </p>
        </Cartao>
      ) : (
        <>
          {!semDado && (
            <Cartao
              titulo="Saneamento"
              info="% calculado sobre os domicílios ocupados do setor (com morador no dia do Censo)."
            >
              <BarraProgresso
                rotulo="Água da rede geral"
                info="% dos domicílios ocupados abastecidos pela rede geral de distribuição de água."
                percentual={pct(setor.vulnerabilidade.saneamento.aguaRede, setor.domiciliosOcupados)}
              />
              <BarraProgresso
                rotulo="Esgoto na rede"
                info="% dos domicílios ocupados com esgotamento sanitário ligado à rede coletora."
                percentual={pct(setor.vulnerabilidade.saneamento.esgotoRede, setor.domiciliosOcupados)}
              />
              <BarraProgresso
                rotulo="Lixo coletado"
                info="% dos domicílios ocupados com coleta de lixo direta ou indireta."
                percentual={pct(setor.vulnerabilidade.saneamento.lixoColetado, setor.domiciliosOcupados)}
              />
            </Cartao>
          )}

          <Cartao
            titulo="Entorno urbano"
            info="% calculado sobre as faces de quadra do setor — o IBGE só faz esse levantamento em setores urbanos."
          >
            {entorno ? (
              <>
                <BarraProgresso
                  rotulo="Pavimentação"
                  info="% das faces de quadra do setor com rua pavimentada."
                  percentual={pct(entorno.comPavimentacao, entorno.facesTotal)}
                />
                <BarraProgresso
                  rotulo="Bueiro / boca de lobo"
                  info="% das faces de quadra do setor com sistema de escoamento de águas pluviais."
                  percentual={pct(entorno.comBueiro, entorno.facesTotal)}
                />
                <BarraProgresso
                  rotulo="Iluminação pública"
                  info="% das faces de quadra do setor com iluminação pública."
                  percentual={pct(entorno.comIluminacao, entorno.facesTotal)}
                />
                <BarraProgresso
                  rotulo="Ponto de ônibus"
                  info="% das faces de quadra do setor com ponto de ônibus nas proximidades."
                  percentual={pct(entorno.comPontoOnibus, entorno.facesTotal)}
                />
                <BarraProgresso
                  rotulo="Via sinalizada para bicicleta"
                  info="% das faces de quadra do setor com sinalização para ciclistas (ciclovia ou ciclofaixa)."
                  percentual={pct(entorno.comViaBicicleta, entorno.facesTotal)}
                />
                <BarraProgresso
                  rotulo="Calçada"
                  info="% das faces de quadra do setor com calçada."
                  percentual={pct(entorno.comCalcada, entorno.facesTotal)}
                />
                <BarraProgresso
                  rotulo="Obstáculo na calçada"
                  info="% das faces de quadra do setor cuja calçada tem algum obstáculo à circulação de pedestres. Aqui, quanto MENOR, melhor."
                  percentual={pct(entorno.comObstaculo, entorno.facesTotal)}
                  inverso
                />
                <BarraProgresso
                  rotulo="Rampa para cadeirante"
                  info="% das faces de quadra do setor com rampa de acessibilidade para cadeirantes."
                  percentual={pct(entorno.comRampa, entorno.facesTotal)}
                />
                <BarraProgresso
                  rotulo="Sem arborização"
                  info="% das faces de quadra do setor sem nenhuma árvore. Aqui, quanto MENOR, melhor."
                  percentual={pct(entorno.semArvores, entorno.facesTotal)}
                  inverso
                />
              </>
            ) : (
              // Sem entorno não quer dizer rural: setor urbano em sigilo também vem sem.
              <p className="text-sm text-muted-foreground">
                {setor.situacao?.toLowerCase().startsWith("rural")
                  ? "Não se aplica: o IBGE só levanta o entorno (faces de quadra) em setores urbanos, e este é rural."
                  : "O IBGE não publicou o levantamento de entorno (faces de quadra) para este setor."}
              </p>
            )}
          </Cartao>
        </>
      )}

      <Cartao
        titulo={`Pontos de interesse num raio de ${km} km`}
        info="Contagem de pontos de interesse cadastrados dentro do raio a partir do setor, por categoria, e a distância até o mais próximo de cada categoria (medida a partir do polígono do setor)."
      >
        {categorias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum POI cadastrado nesse raio.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categorias.map((categoria) => {
              const Icone = ICONE_POR_CATEGORIA[categoria] ?? MapPin;
              const total = setor.poisPorCategoria
                .filter((p) => p.categoria === categoria)
                .reduce((soma, p) => soma + p.total, 0);
              const proximo = setor.poiMaisProximo.find((p) => p.categoria === categoria);
              return (
                <Badge key={categoria} variant="outline" className="h-7 gap-2 px-3 font-normal">
                  <Icone className="text-muted-foreground" />
                  <span className="font-medium">{rotuloCategoria(categoria)}</span>
                  <span className="tabular-nums">{formatNumero(total)}</span>
                  {proximo && (
                    <span className="text-muted-foreground">
                      · mais próximo {formatDistancia(proximo.distanciaM)} ({rotuloSubcategoria(proximo.subcategoria)})
                    </span>
                  )}
                </Badge>
              );
            })}
          </div>
        )}
      </Cartao>
    </div>
  );
}
