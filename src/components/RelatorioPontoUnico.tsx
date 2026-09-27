import type { ReactNode } from "react";
import { Bus, GraduationCap, HeartPulse, MapPin, ShoppingBag, Trees } from "lucide-react";
import { InfoIcone } from "@/components/InfoIcone";
import { classeEconomica } from "@/lib/abep";
import { formatMoeda, formatNumero } from "@/lib/format";
import {
  formatDistancia,
  formatPercentual,
  ordenarCategorias,
  pct,
} from "@/utils/tabelaComparativa";
import { rotuloCategoria, rotuloSubcategoria } from "@/utils/nomePoi";
import type { PontoSelecionado, SetorComPois } from "@/types/setor";

interface RelatorioPontoUnicoProps {
  ponto: PontoSelecionado;
  setor: SetorComPois;
  raioMetros: number;
}

const COR_MASCULINA = "#2563eb";
const COR_FEMININA = "#db2777";

const CORES_RACA: Record<string, string> = {
  branca: "#94a3b8",
  preta: "#1f2937",
  amarela: "#eab308",
  parda: "#c2703d",
  indigena: "#16a34a",
};

const ICONE_POR_CATEGORIA: Record<string, typeof Bus> = {
  transporte: Bus,
  lazer: Trees,
  comercio: ShoppingBag,
  educacao: GraduationCap,
  saude: HeartPulse,
};

/** Acima disso a renda é lida como "homogênea"; é um corte de leitura, não um padrão do IBGE. */
const LIMIAR_CV_HOMOGENEO = 0.5;

/** Faixa de cor de uma barra de progresso, seguindo o padrão do relatório: verde/amarelo/vermelho. */
function corFaixa(percentual: number): string {
  if (percentual >= 80) return "#16a34a";
  if (percentual >= 50) return "#d97706";
  return "#dc2626";
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
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        {titulo}
        {info && <InfoIcone texto={info} />}
      </h3>
      {children}
      {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
    </section>
  );
}

function Estatistica({
  rotulo,
  valor,
  info,
  tamanho = "grande",
}: {
  rotulo: string;
  valor: string;
  info?: string;
  tamanho?: "grande" | "pequeno";
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted/60 px-3 py-2.5">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {rotulo}
        {info && <InfoIcone texto={info} />}
      </span>
      <span className={tamanho === "grande" ? "text-2xl font-semibold" : "text-base font-semibold"}>{valor}</span>
    </div>
  );
}

function BarraProgresso({
  rotulo,
  info,
  percentual,
}: {
  rotulo: string;
  info?: string;
  percentual: number | null;
}) {
  const rotuloComInfo = (
    <span className="flex items-center gap-1">
      {rotulo}
      {info && <InfoIcone texto={info} />}
    </span>
  );

  if (percentual === null) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{rotuloComInfo}</span>
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        {rotuloComInfo}
        <span className="font-medium tabular-nums">{formatPercentual(percentual)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, percentual))}%`, backgroundColor: corFaixa(percentual) }}
        />
      </div>
    </div>
  );
}

export function RelatorioPontoUnico({ ponto, setor, raioMetros }: RelatorioPontoUnicoProps) {
  const classe = classeEconomica(setor.rendaMedia);
  const cv = setor.coefVariacaoRenda;
  const homogeneidade =
    cv === null
      ? null
      : cv < LIMIAR_CV_HOMOGENEO
        ? { texto: "Renda homogênea", cor: "#16a34a" }
        : { texto: "Renda heterogênea", cor: "#d97706" };

  const totalSexo = (setor.demografia?.sexo.masculina ?? 0) + (setor.demografia?.sexo.feminina ?? 0);
  const pctMasculina = pct(setor.demografia?.sexo.masculina ?? null, totalSexo || null);
  const pctFeminina = pct(setor.demografia?.sexo.feminina ?? null, totalSexo || null);

  const raca = setor.demografia?.raca;
  const totalRaca = raca
    ? (raca.branca ?? 0) + (raca.preta ?? 0) + (raca.amarela ?? 0) + (raca.parda ?? 0) + (raca.indigena ?? 0)
    : 0;
  const fatiasRaca = raca
    ? (
        [
          ["Branca", raca.branca, CORES_RACA.branca],
          ["Preta", raca.preta, CORES_RACA.preta],
          ["Parda", raca.parda, CORES_RACA.parda],
          ["Amarela", raca.amarela, CORES_RACA.amarela],
          ["Indígena", raca.indigena, CORES_RACA.indigena],
        ] as const
      ).map(([rotulo, valor, cor]) => ({ rotulo, cor, percentual: pct(valor, totalRaca || null) }))
    : [];

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

  // Faixa etária com mais gente no setor — a mesma base usada nas barras da pirâmide.
  const faixaPredominante = (setor.demografia?.piramideEtaria ?? []).reduce<{
    faixa: string;
    total: number;
    percentual: number | null;
  } | null>((melhor, f) => {
    if (f.total === null) return melhor;
    if (melhor === null || f.total > melhor.total) {
      return { faixa: f.faixa, total: f.total, percentual: pct(f.total, setor.populacao) };
    }
    return melhor;
  }, null);

  const categorias = ordenarCategorias([
    ...new Set([
      ...setor.poisPorCategoria.map((p) => p.categoria),
      ...setor.poiMaisProximo.map((p) => p.categoria),
    ]),
  ]);
  const km = formatNumero(raioMetros / 1000, raioMetros % 1000 === 0 ? 0 : 1);

  const entorno = setor.vulnerabilidade?.entorno ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">{ponto.rotulo}</p>
        <p className="text-xs text-muted-foreground">
          {setor.nmMunicipio} · {setor.uf} · {setor.regiao}
        </p>
      </div>

      {/* Cartão de destaque: a renda é a primeira coisa lida, não uma linha entre outras. */}
      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <p className="text-3xl font-bold tabular-nums">{formatMoeda(setor.rendaMedia)}</p>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Renda média domiciliar
            <InfoIcone texto="Renda média dos domicílios do setor censitário, em valores do Censo 2022 — ainda sem correção pela inflação até a data de hoje." />
          </span>
        </div>
        <div>
          <p className="text-xl font-semibold tabular-nums">{formatMoeda(setor.rendaMediana)}</p>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Renda mediana
            <InfoIcone texto="Valor que divide os domicílios do setor ao meio: metade tem renda maior, metade tem renda menor. Menos sensível a valores extremos do que a média." />
          </span>
        </div>
        {classe && (
          <span className="flex items-center gap-1">
            <span
              className="rounded-full px-3 py-1 text-sm font-semibold text-white"
              style={{ backgroundColor: classe.cor }}
            >
              Classe {classe.label}
            </span>
            <InfoIcone texto="Classificação econômica ABEP (A1 a DE), calculada a partir da faixa de renda média do setor." />
          </span>
        )}
        {homogeneidade && (
          <span className="flex flex-col">
            <span className="flex items-center gap-1 text-sm font-medium" style={{ color: homogeneidade.cor }}>
              {homogeneidade.texto}
              <InfoIcone texto="Leitura do coeficiente de variação da renda dentro do setor: quanto menor o coeficiente, mais parecida é a renda entre os domicílios. Aqui, abaixo de 0,5 é lido como homogênea." />
            </span>
            <span className="text-xs text-muted-foreground">
              Coeficiente de variação: {formatNumero(cv, 2)}
            </span>
          </span>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Estatistica
          rotulo="População total"
          valor={formatNumero(setor.populacao)}
          info="Total de pessoas residentes no setor censitário, segundo o Censo."
        />
        <Estatistica
          rotulo="Densidade (hab/km²)"
          valor={formatNumero(setor.densidadeHabKm2, 1)}
          info="População do setor dividida pela sua área, em habitantes por km²."
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Estatistica
          tamanho="pequeno"
          rotulo="Domicílios ocupados"
          valor={formatNumero(setor.domiciliosOcupados)}
          info="Domicílios particulares que tinham morador(es) no dia da coleta do Censo."
        />
        <Estatistica
          tamanho="pequeno"
          rotulo="Uso ocasional"
          valor={formatNumero(setor.domiciliosUsoOcasional)}
          info="Domicílios usados só em temporada (ex.: casa de praia ou campo), sem morador fixo."
        />
        <Estatistica
          tamanho="pequeno"
          rotulo="Vagos"
          valor={formatNumero(setor.domiciliosVagos)}
          info="Domicílios sem morador e sem uso ocasional no dia da coleta do Censo."
        />
        <Estatistica
          tamanho="pequeno"
          rotulo="Área (km²)"
          valor={formatNumero(setor.areaKm2, 2)}
          info="Área territorial do setor censitário, em km²."
        />
        <Estatistica
          tamanho="pequeno"
          rotulo="Tamanho médio da família"
          valor={formatNumero(setor.tamanhoMedioFamilia, 2)}
          info="Número médio de moradores por domicílio ocupado no setor."
        />
        <Estatistica
          tamanho="pequeno"
          rotulo="Situação"
          valor={setor.situacao ?? "—"}
          info="Classificação do setor pelo IBGE: urbano ou rural."
        />
        <Estatistica
          tamanho="pequeno"
          rotulo="Alfabetização (15+)"
          valor={pctAlfabetizados === null ? "—" : formatPercentual(pctAlfabetizados)}
          info="% de pessoas de 15 anos ou mais que sabem ler e escrever, entre as que tiveram esse dado declarado."
        />
      </div>

      {!setor.demografia ? (
        <Cartao titulo="Perfil demográfico">
          <p className="text-sm text-muted-foreground">Sem dados demográficos publicados para este setor.</p>
        </Cartao>
      ) : (
        <>
          <Cartao titulo="Sexo" info="Distribuição da população do setor por sexo declarado ao Censo.">
            <div className="flex h-6 overflow-hidden rounded-full bg-muted text-xs font-medium text-white">
              {pctMasculina !== null && (
                <div
                  className="flex items-center justify-start pl-2"
                  style={{ width: `${pctMasculina}%`, backgroundColor: COR_MASCULINA }}
                >
                  {pctMasculina >= 12 && formatPercentual(pctMasculina)}
                </div>
              )}
              {pctFeminina !== null && (
                <div
                  className="flex items-center justify-end pr-2"
                  style={{ width: `${pctFeminina}%`, backgroundColor: COR_FEMININA }}
                >
                  {pctFeminina >= 12 && formatPercentual(pctFeminina)}
                </div>
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Masculino</span>
              <span>Feminino</span>
            </div>
          </Cartao>

          <Cartao
            titulo="Pirâmide etária"
            info="Distribuição da população por faixa etária. O cruzamento sexo × idade não é publicado pelo IBGE nessas tabelas, então cada barra é só o total da faixa (não separado por sexo)."
          >
            {faixaPredominante && (
              <p className="text-sm">
                Faixa predominante:{" "}
                <strong className="font-semibold">{faixaPredominante.faixa} anos</strong>
                {faixaPredominante.percentual !== null && (
                  <span className="text-muted-foreground"> · {formatPercentual(faixaPredominante.percentual)} da população</span>
                )}
              </p>
            )}
            <div className="flex flex-col">
              {setor.demografia.piramideEtaria.map((faixa) => {
                const percentual = pct(faixa.total, setor.populacao) ?? 0;
                const largura = maiorFatiaPiramide > 0 ? (percentual / maiorFatiaPiramide) * 100 : 0;
                return (
                  <div key={faixa.faixa} className="flex items-center gap-2 py-0.5 text-xs">
                    <span className="w-14 shrink-0 text-muted-foreground">{faixa.faixa}</span>
                    <div className="h-3 flex-1 rounded-sm bg-muted">
                      <div className="h-full rounded-sm bg-primary/70" style={{ width: `${largura}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right tabular-nums">
                      {formatNumero(faixa.total)} ({formatPercentual(percentual)})
                    </span>
                  </div>
                );
              })}
            </div>
          </Cartao>

          <Cartao titulo="Raça / cor" info="Distribuição da população do setor por raça/cor autodeclarada ao Censo.">
            <table className="w-full text-sm">
              <tbody>
                {fatiasRaca.map((fatia) => (
                  <tr key={fatia.rotulo} className="border-b border-border last:border-0">
                    <td className="py-1.5 text-muted-foreground">{fatia.rotulo}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {fatia.percentual === null ? "—" : formatPercentual(fatia.percentual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>
        </>
      )}

      {!setor.vulnerabilidade ? (
        <Cartao titulo="Vulnerabilidade e infraestrutura">
          <p className="text-sm text-muted-foreground">Sem dados de saneamento/entorno publicados para este setor.</p>
        </Cartao>
      ) : (
        <>
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
            <BarraProgresso
              rotulo="Banheiro exclusivo"
              info="% dos domicílios ocupados com banheiro de uso exclusivo do próprio domicílio."
              percentual={pct(setor.vulnerabilidade.banheiro.com, setor.domiciliosOcupados)}
            />
          </Cartao>

          <Cartao
            titulo="Entorno urbano"
            info="% calculado sobre as faces de quadra do setor — só é publicado pelo IBGE para setores urbanos."
            nota={
              entorno
                ? undefined
                : "Não se aplica: entorno urbano só é publicado para setores urbanos, e este é rural."
            }
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
                  info="% das faces de quadra do setor cuja calçada tem algum obstáculo à circulação de pedestres."
                  percentual={pct(entorno.comObstaculo, entorno.facesTotal)}
                />
                <BarraProgresso
                  rotulo="Rampa para cadeirante"
                  info="% das faces de quadra do setor com rampa de acessibilidade para cadeirantes."
                  percentual={pct(entorno.comRampa, entorno.facesTotal)}
                />
                <BarraProgresso
                  rotulo="Sem arborização"
                  info="% das faces de quadra do setor sem nenhuma árvore."
                  percentual={pct(entorno.semArvores, entorno.facesTotal)}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
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
                <span
                  key={categoria}
                  className="flex items-center gap-2 rounded-full border border-border bg-muted/60 py-1.5 pr-3 pl-2 text-xs"
                >
                  <Icone className="size-3.5 text-muted-foreground" />
                  <span className="font-medium">{rotuloCategoria(categoria)}</span>
                  <span className="tabular-nums">{formatNumero(total)}</span>
                  {proximo && (
                    <span className="text-muted-foreground">
                      · mais próximo {formatDistancia(proximo.distanciaM)} ({rotuloSubcategoria(proximo.subcategoria)})
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </Cartao>
    </div>
  );
}
