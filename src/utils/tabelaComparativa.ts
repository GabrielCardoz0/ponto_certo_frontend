import { classeEconomica } from "@/lib/abep";
import { formatMoeda, formatNumero } from "@/lib/format";
import { rotuloCategoria, rotuloSubcategoria } from "@/utils/nomePoi";
import type { Comparacao, PontoSelecionado, SetorComPois } from "@/types/setor";

/**
 * Modelo único do relatório de comparação: colunas = pontos (mesmo número do mapa e da barra
 * lateral), seções = tabelas independentes, linhas = variáveis. O modal renderiza este objeto
 * e a exportação futura (PDF) deve consumir exatamente o mesmo — sem remontar nada.
 */

export interface ColunaTabela {
  numero: number;
  cdSetor: string;
  rotulo: string;
}

export interface FaixaPiramide {
  faixa: string;
  total: number | null;
  /** Fatia da população do ponto nessa faixa, em % (0–100). */
  percentual: number | null;
}

export type CelulaTabela =
  | { tipo: "texto"; texto: string; atenuado?: boolean; cor?: string }
  | { tipo: "piramide"; faixas: FaixaPiramide[] | null };

export type LinhaTabela =
  | { tipo: "dados"; rotulo: string; info?: string; celulas: CelulaTabela[] }
  | { tipo: "piramide"; rotulo: string; info?: string; faixasRotulos: string[]; celulas: CelulaTabela[] }
  | { tipo: "grupo"; titulo: string; info?: string };

export interface SecaoTabela {
  id: string;
  titulo: string;
  info?: string;
  linhas: LinhaTabela[];
  nota?: string;
}

export interface TabelaComparativa {
  raioMetros: number;
  colunas: ColunaTabela[];
  secoes: SecaoTabela[];
}

const ORDEM_CATEGORIAS = ["transporte", "comercio", "educacao", "saude", "lazer"];

const SEM_DADO: CelulaTabela = { tipo: "texto", texto: "—", atenuado: true };

function texto(valor: string): CelulaTabela {
  return { tipo: "texto", texto: valor };
}

/** Percentual com 1 casa abaixo de 10% (pra "1%" não esconder 0,6%), 0 casas acima; zero exato é "0%". */
export function formatPercentual(valor: number): string {
  if (valor === 0) return "0%";
  return `${formatNumero(valor, valor < 10 ? 1 : 0)}%`;
}

export function pct(parte: number | null, total: number | null): number | null {
  if (parte === null || total === null || total === 0) return null;
  return (parte / total) * 100;
}

function celulaPct(parte: number | null, total: number | null): CelulaTabela {
  const valor = pct(parte, total);
  return valor === null ? SEM_DADO : texto(formatPercentual(valor));
}

/** "1.234 (48%)" — contagem bruta seguida do percentual sobre o total. */
function celulaContagemPct(parte: number | null, total: number | null): CelulaTabela {
  const valor = pct(parte, total);
  if (parte === null || valor === null) return SEM_DADO;
  return texto(`${formatNumero(parte)} (${formatPercentual(valor)})`);
}

export function formatDistancia(metros: number): string {
  if (metros === 0) return "Dentro do setor";
  if (metros < 1000) return `${formatNumero(metros)} m`;
  return `${formatNumero(metros / 1000, 1)} km`;
}

export function ordenarCategorias(categorias: string[]): string[] {
  const posicao = (categoria: string) => {
    const indice = ORDEM_CATEGORIAS.indexOf(categoria);
    return indice === -1 ? ORDEM_CATEGORIAS.length : indice;
  };
  return [...categorias].sort(
    (a, b) => posicao(a) - posicao(b) || rotuloCategoria(a).localeCompare(rotuloCategoria(b), "pt-BR")
  );
}

type Setores = Array<SetorComPois | undefined>;

/** Linha "dados" a partir de uma função que devolve a célula de cada setor (—, se o setor não veio). */
function linha(
  rotulo: string,
  setores: Setores,
  celula: (s: SetorComPois) => CelulaTabela,
  info?: string
): LinhaTabela {
  return { tipo: "dados", rotulo, info, celulas: setores.map((s) => (s ? celula(s) : SEM_DADO)) };
}

function secaoLocalizacao(pontos: PontoSelecionado[], setores: Setores, raioMetros: number): SecaoTabela {
  const categorias = ordenarCategorias([
    ...new Set(
      setores.flatMap((s) => [
        ...(s?.poisPorCategoria.map((p) => p.categoria) ?? []),
        ...(s?.poiMaisProximo.map((p) => p.categoria) ?? []),
      ])
    ),
  ]);
  const km = formatNumero(raioMetros / 1000, raioMetros % 1000 === 0 ? 0 : 1);

  const linhas: LinhaTabela[] = [
    {
      tipo: "dados",
      rotulo: "Endereço / ponto",
      celulas: pontos.map((p) => texto(p.rotulo)),
    },
    {
      tipo: "dados",
      rotulo: "Coordenada",
      info: "Latitude e longitude do ponto clicado no mapa (ou do endereço buscado), não do centro do setor.",
      celulas: pontos.map((p) => texto(`${p.localizacao.lat.toFixed(5)}, ${p.localizacao.lng.toFixed(5)}`)),
    },
    linha("Município", setores, (s) => texto(s.nmMunicipio)),
    linha("UF", setores, (s) => texto(s.uf)),
    linha("Região", setores, (s) => texto(s.regiao)),
  ];

  if (categorias.length > 0) {
    linhas.push({
      tipo: "grupo",
      titulo: `Pontos de interesse num raio de ${km} km`,
      info: "Contagem de pontos de interesse cadastrados dentro do raio a partir do setor, por categoria.",
    });
    for (const categoria of categorias) {
      linhas.push(
        linha(rotuloCategoria(categoria), setores, (s) =>
          texto(
            formatNumero(
              s.poisPorCategoria.filter((p) => p.categoria === categoria).reduce((soma, p) => soma + p.total, 0)
            )
          )
        )
      );
    }

    linhas.push({
      tipo: "grupo",
      titulo: "Distância até o POI mais próximo",
      info: "Distância em linha reta do polígono do setor até o POI mais próximo de cada categoria, mesmo que ele esteja fora do raio de comparação.",
    });
    for (const categoria of categorias) {
      linhas.push(
        linha(rotuloCategoria(categoria), setores, (s) => {
          const proximo = s.poiMaisProximo.find((p) => p.categoria === categoria);
          return proximo
            ? texto(`${formatDistancia(proximo.distanciaM)} · ${rotuloSubcategoria(proximo.subcategoria)}`)
            : SEM_DADO;
        })
      );
    }
  }

  return { id: "localizacao", titulo: "Localização e entorno", linhas };
}

function secaoSocioeconomico(setores: Setores): SecaoTabela {
  return {
    id: "socioeconomico",
    titulo: "Perfil socioeconômico",
    linhas: [
      linha(
        "Renda média",
        setores,
        (s) => texto(formatMoeda(s.rendaMedia)),
        "Renda média dos domicílios do setor censitário, em valores do Censo 2022 — ainda sem correção pela inflação até a data de hoje."
      ),
      linha(
        "Renda mediana",
        setores,
        (s) => texto(formatMoeda(s.rendaMediana)),
        "Valor que divide os domicílios do setor ao meio: metade tem renda maior, metade tem renda menor. Menos sensível a valores extremos do que a média."
      ),
      linha(
        "Classe econômica",
        setores,
        (s) => {
          const classe = classeEconomica(s.rendaMedia);
          return classe ? { tipo: "texto", texto: classe.label, cor: classe.cor } : SEM_DADO;
        },
        "Classificação econômica ABEP (A1 a DE), calculada a partir da faixa de renda média do setor."
      ),
      linha(
        "Coeficiente de variação da renda",
        setores,
        (s) => (s.coefVariacaoRenda === null ? SEM_DADO : texto(formatNumero(s.coefVariacaoRenda, 2))),
        "Quanto menor, mais parecida é a renda entre os domicílios do setor; quanto maior, mais desigual."
      ),
    ],
    nota: "Coeficiente de variação: quanto menor, mais homogênea a renda dentro do setor. Índice de Potencial de Consumo: em breve.",
  };
}

function secaoDemografico(setores: Setores): SecaoTabela {
  const faixasRotulos = setores.find((s) => s?.demografia)?.demografia?.piramideEtaria.map((f) => f.faixa) ?? [];

  const contagem = (
    rotulo: string,
    valor: (s: SetorComPois) => number | null | undefined,
    total: (s: SetorComPois) => number | null,
    info?: string
  ): LinhaTabela =>
    linha(
      rotulo,
      setores,
      (s) => (s.demografia ? celulaContagemPct(valor(s) ?? null, total(s)) : SEM_DADO),
      info
    );

  const totalAlfabetizacao = (s: SetorComPois) => {
    const a = s.demografia?.alfabetizacao;
    return a && a.alfabetizados !== null && a.naoAlfabetizados !== null
      ? a.alfabetizados + a.naoAlfabetizados
      : null;
  };

  const linhas: LinhaTabela[] = [
    linha(
      "População total",
      setores,
      (s) => texto(formatNumero(s.populacao)),
      "Total de pessoas residentes no setor censitário, segundo o Censo."
    ),
    linha(
      "Domicílios ocupados",
      setores,
      (s) => texto(formatNumero(s.domiciliosOcupados)),
      "Domicílios particulares que tinham morador(es) no dia da coleta do Censo."
    ),
    linha(
      "Domicílios de uso ocasional",
      setores,
      (s) => texto(formatNumero(s.domiciliosUsoOcasional)),
      "Domicílios usados só em temporada (ex.: casa de praia ou campo), sem morador fixo."
    ),
    linha(
      "Domicílios vagos",
      setores,
      (s) => texto(formatNumero(s.domiciliosVagos)),
      "Domicílios sem morador e sem uso ocasional no dia da coleta do Censo."
    ),
    linha(
      "Densidade (hab/km²)",
      setores,
      (s) => texto(formatNumero(s.densidadeHabKm2, 1)),
      "População do setor dividida pela sua área, em habitantes por km²."
    ),
    linha("Área (km²)", setores, (s) => texto(formatNumero(s.areaKm2, 2)), "Área territorial do setor censitário, em km²."),
    linha(
      "Tamanho médio da família",
      setores,
      (s) => texto(formatNumero(s.tamanhoMedioFamilia, 2)),
      "Número médio de moradores por domicílio ocupado no setor."
    ),
    linha("Situação", setores, (s) => texto(s.situacao ?? "—"), "Classificação do setor pelo IBGE: urbano ou rural."),

    { tipo: "grupo", titulo: "Sexo", info: "Distribuição da população do setor por sexo declarado ao Censo." },
    contagem("Masculina", (s) => s.demografia?.sexo.masculina, (s) => s.populacao),
    contagem("Feminina", (s) => s.demografia?.sexo.feminina, (s) => s.populacao),

    {
      tipo: "piramide",
      rotulo: "Pirâmide etária",
      info: "Distribuição da população por faixa etária. O cruzamento sexo × idade não é publicado pelo IBGE nessas tabelas, então cada barra é só o total da faixa (não separado por sexo).",
      faixasRotulos,
      celulas: setores.map((s) => {
        const faixas = s?.demografia?.piramideEtaria;
        if (!faixas) return { tipo: "piramide", faixas: null } as CelulaTabela;
        const soma = faixas.reduce((acc, f) => acc + (f.total ?? 0), 0);
        return {
          tipo: "piramide",
          faixas: faixas.map((f) => ({ faixa: f.faixa, total: f.total, percentual: pct(f.total, soma) })),
        } as CelulaTabela;
      }),
    },

    {
      tipo: "grupo",
      titulo: "Raça / cor",
      info: "Distribuição da população do setor por raça/cor autodeclarada ao Censo.",
    },
    contagem("Branca", (s) => s.demografia?.raca.branca, (s) => s.populacao),
    contagem("Preta", (s) => s.demografia?.raca.preta, (s) => s.populacao),
    contagem("Amarela", (s) => s.demografia?.raca.amarela, (s) => s.populacao),
    contagem("Parda", (s) => s.demografia?.raca.parda, (s) => s.populacao),
    contagem("Indígena", (s) => s.demografia?.raca.indigena, (s) => s.populacao),

    {
      tipo: "grupo",
      titulo: "Alfabetização (15 anos ou mais)",
      info: "% de pessoas de 15 anos ou mais que sabem ler e escrever, entre as que tiveram esse dado declarado.",
    },
    contagem("Alfabetizados", (s) => s.demografia?.alfabetizacao.alfabetizados, totalAlfabetizacao),
    contagem("Não alfabetizados", (s) => s.demografia?.alfabetizacao.naoAlfabetizados, totalAlfabetizacao),
  ];

  return { id: "demografico", titulo: "Perfil demográfico", linhas };
}

function secaoVulnerabilidade(pontos: PontoSelecionado[], setores: Setores): SecaoTabela {
  const percentualOcupados = (
    rotulo: string,
    valor: (s: SetorComPois) => number | null | undefined,
    info?: string
  ) =>
    linha(
      rotulo,
      setores,
      (s) => (s.vulnerabilidade ? celulaPct(valor(s) ?? null, s.domiciliosOcupados) : SEM_DADO),
      info
    );
  const contagemOcupados = (rotulo: string, valor: (s: SetorComPois) => number | null | undefined) =>
    linha(rotulo, setores, (s) =>
      s.vulnerabilidade ? celulaContagemPct(valor(s) ?? null, s.domiciliosOcupados) : SEM_DADO
    );

  const linhas: LinhaTabela[] = [
    {
      tipo: "grupo",
      titulo: "Saneamento (% dos domicílios ocupados)",
      info: "% calculado sobre os domicílios ocupados do setor (com morador no dia do Censo).",
    },
    percentualOcupados(
      "Água da rede geral",
      (s) => s.vulnerabilidade?.saneamento.aguaRede,
      "% dos domicílios ocupados abastecidos pela rede geral de distribuição de água."
    ),
    percentualOcupados(
      "Esgoto na rede",
      (s) => s.vulnerabilidade?.saneamento.esgotoRede,
      "% dos domicílios ocupados com esgotamento sanitário ligado à rede coletora."
    ),
    percentualOcupados(
      "Lixo coletado",
      (s) => s.vulnerabilidade?.saneamento.lixoColetado,
      "% dos domicílios ocupados com coleta de lixo direta ou indireta."
    ),

    { tipo: "grupo", titulo: "Tipo de domicílio" },
    contagemOcupados("Casa", (s) => s.vulnerabilidade?.tipoDomicilio.casa),
    contagemOcupados("Casa em condomínio", (s) => s.vulnerabilidade?.tipoDomicilio.casaCondominio),
    contagemOcupados("Apartamento", (s) => s.vulnerabilidade?.tipoDomicilio.apartamento),
    contagemOcupados("Precário", (s) => s.vulnerabilidade?.tipoDomicilio.precario),

    { tipo: "grupo", titulo: "Banheiro" },
    percentualOcupados(
      "Com banheiro exclusivo",
      (s) => s.vulnerabilidade?.banheiro.com,
      "% dos domicílios ocupados com banheiro de uso exclusivo do próprio domicílio."
    ),
  ];

  // Entorno urbano: só setor urbano tem dado de face de quadra — deixar isso explícito.
  // Avisos ficam na `nota` da seção (fora da área rolável), nunca numa linha da tabela.
  const temEntorno = setores.some((s) => s?.vulnerabilidade?.entorno);

  let nota: string | undefined;
  if (!temEntorno) {
    nota =
      "Entorno urbano (pavimentação, iluminação, calçadas etc.): só existe para setores urbanos — nenhum dos pontos selecionados tem esse dado.";
  } else {
    linhas.push({
      tipo: "grupo",
      titulo: "Entorno urbano (% das faces de quadra)",
      info: "% calculado sobre as faces de quadra do setor — só é publicado pelo IBGE para setores urbanos.",
    });
    const face = (
      rotulo: string,
      valor: (e: NonNullable<NonNullable<SetorComPois["vulnerabilidade"]>["entorno"]>) => number | null,
      info?: string
    ) =>
      linha(
        rotulo,
        setores,
        (s) => {
          const entorno = s.vulnerabilidade?.entorno;
          if (entorno) return celulaPct(valor(entorno), entorno.facesTotal);
          return s.vulnerabilidade
            ? { tipo: "texto", texto: "Não se aplica", atenuado: true }
            : SEM_DADO;
        },
        info
      );

    linhas.push(
      face("Pavimentação", (e) => e.comPavimentacao, "% das faces de quadra do setor com rua pavimentada."),
      face(
        "Bueiro / boca de lobo",
        (e) => e.comBueiro,
        "% das faces de quadra do setor com sistema de escoamento de águas pluviais."
      ),
      face(
        "Iluminação pública",
        (e) => e.comIluminacao,
        "% das faces de quadra do setor com iluminação pública."
      ),
      face(
        "Ponto de ônibus",
        (e) => e.comPontoOnibus,
        "% das faces de quadra do setor com ponto de ônibus nas proximidades."
      ),
      face(
        "Via sinalizada para bicicleta",
        (e) => e.comViaBicicleta,
        "% das faces de quadra do setor com sinalização para ciclistas (ciclovia ou ciclofaixa)."
      ),
      face("Calçada", (e) => e.comCalcada, "% das faces de quadra do setor com calçada."),
      face(
        "Obstáculo na calçada",
        (e) => e.comObstaculo,
        "% das faces de quadra do setor cuja calçada tem algum obstáculo à circulação de pedestres."
      ),
      face(
        "Rampa para cadeirante",
        (e) => e.comRampa,
        "% das faces de quadra do setor com rampa de acessibilidade para cadeirantes."
      ),
      face("Sem arborização", (e) => e.semArvores, "% das faces de quadra do setor sem nenhuma árvore.")
    );

    const semEntorno = pontos
      .map((_, i) => i)
      .filter((i) => setores[i] && !setores[i]!.vulnerabilidade?.entorno)
      .map((i) => i + 1);
    if (semEntorno.length > 0) {
      nota = `Entorno urbano não se aplica a setor rural: ponto${semEntorno.length > 1 ? "s" : ""} ${semEntorno.join(", ")}.`;
    }
  }

  return { id: "vulnerabilidade", titulo: "Vulnerabilidade e infraestrutura", linhas, nota };
}

export function montarTabelaComparativa(
  pontos: PontoSelecionado[],
  comparacao: Comparacao
): TabelaComparativa {
  const porSetor = new Map(comparacao.setores.map((s) => [s.cdSetor, s]));
  const setores: Setores = pontos.map((p) => porSetor.get(p.setor.cdSetor));

  return {
    raioMetros: comparacao.raioMetros,
    colunas: pontos.map((p, i) => ({ numero: i + 1, cdSetor: p.setor.cdSetor, rotulo: p.rotulo })),
    secoes: [
      secaoLocalizacao(pontos, setores, comparacao.raioMetros),
      secaoSocioeconomico(setores),
      secaoDemografico(setores),
      secaoVulnerabilidade(pontos, setores),
    ],
  };
}
