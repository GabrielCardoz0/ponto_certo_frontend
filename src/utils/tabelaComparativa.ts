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
  | { tipo: "dados"; rotulo: string; celulas: CelulaTabela[] }
  | { tipo: "piramide"; rotulo: string; faixasRotulos: string[]; celulas: CelulaTabela[] }
  | { tipo: "grupo"; titulo: string };

export interface SecaoTabela {
  id: string;
  titulo: string;
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
function formatPercentual(valor: number): string {
  if (valor === 0) return "0%";
  return `${formatNumero(valor, valor < 10 ? 1 : 0)}%`;
}

function pct(parte: number | null, total: number | null): number | null {
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

function formatDistancia(metros: number): string {
  if (metros === 0) return "Dentro do setor";
  if (metros < 1000) return `${formatNumero(metros)} m`;
  return `${formatNumero(metros / 1000, 1)} km`;
}

function ordenarCategorias(categorias: string[]): string[] {
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
function linha(rotulo: string, setores: Setores, celula: (s: SetorComPois) => CelulaTabela): LinhaTabela {
  return { tipo: "dados", rotulo, celulas: setores.map((s) => (s ? celula(s) : SEM_DADO)) };
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
      celulas: pontos.map((p) => texto(`${p.localizacao.lat.toFixed(5)}, ${p.localizacao.lng.toFixed(5)}`)),
    },
    linha("Município", setores, (s) => texto(s.nmMunicipio)),
    linha("UF", setores, (s) => texto(s.uf)),
    linha("Região", setores, (s) => texto(s.regiao)),
  ];

  if (categorias.length > 0) {
    linhas.push({ tipo: "grupo", titulo: `Pontos de interesse num raio de ${km} km` });
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

    linhas.push({ tipo: "grupo", titulo: "Distância até o POI mais próximo" });
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
      linha("Renda média", setores, (s) => texto(formatMoeda(s.rendaMedia))),
      linha("Renda mediana", setores, (s) => texto(formatMoeda(s.rendaMediana))),
      linha("Classe econômica", setores, (s) => {
        const classe = classeEconomica(s.rendaMedia);
        return classe ? { tipo: "texto", texto: classe.label, cor: classe.cor } : SEM_DADO;
      }),
      linha("Coeficiente de variação da renda", setores, (s) =>
        s.coefVariacaoRenda === null ? SEM_DADO : texto(formatNumero(s.coefVariacaoRenda, 2))
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
    total: (s: SetorComPois) => number | null
  ): LinhaTabela =>
    linha(rotulo, setores, (s) =>
      s.demografia ? celulaContagemPct(valor(s) ?? null, total(s)) : SEM_DADO
    );

  const totalAlfabetizacao = (s: SetorComPois) => {
    const a = s.demografia?.alfabetizacao;
    return a && a.alfabetizados !== null && a.naoAlfabetizados !== null
      ? a.alfabetizados + a.naoAlfabetizados
      : null;
  };

  const linhas: LinhaTabela[] = [
    linha("População total", setores, (s) => texto(formatNumero(s.populacao))),
    linha("Domicílios ocupados", setores, (s) => texto(formatNumero(s.domiciliosOcupados))),
    linha("Domicílios de uso ocasional", setores, (s) => texto(formatNumero(s.domiciliosUsoOcasional))),
    linha("Domicílios vagos", setores, (s) => texto(formatNumero(s.domiciliosVagos))),
    linha("Densidade (hab/km²)", setores, (s) => texto(formatNumero(s.densidadeHabKm2, 1))),
    linha("Área (km²)", setores, (s) => texto(formatNumero(s.areaKm2, 2))),
    linha("Tamanho médio da família", setores, (s) => texto(formatNumero(s.tamanhoMedioFamilia, 2))),
    linha("Situação", setores, (s) => texto(s.situacao ?? "—")),

    { tipo: "grupo", titulo: "Sexo" },
    contagem("Masculina", (s) => s.demografia?.sexo.masculina, (s) => s.populacao),
    contagem("Feminina", (s) => s.demografia?.sexo.feminina, (s) => s.populacao),

    {
      tipo: "piramide",
      rotulo: "Pirâmide etária",
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

    { tipo: "grupo", titulo: "Raça / cor" },
    contagem("Branca", (s) => s.demografia?.raca.branca, (s) => s.populacao),
    contagem("Preta", (s) => s.demografia?.raca.preta, (s) => s.populacao),
    contagem("Amarela", (s) => s.demografia?.raca.amarela, (s) => s.populacao),
    contagem("Parda", (s) => s.demografia?.raca.parda, (s) => s.populacao),
    contagem("Indígena", (s) => s.demografia?.raca.indigena, (s) => s.populacao),

    { tipo: "grupo", titulo: "Alfabetização (15 anos ou mais)" },
    contagem("Alfabetizados", (s) => s.demografia?.alfabetizacao.alfabetizados, totalAlfabetizacao),
    contagem("Não alfabetizados", (s) => s.demografia?.alfabetizacao.naoAlfabetizados, totalAlfabetizacao),
  ];

  return { id: "demografico", titulo: "Perfil demográfico", linhas };
}

function secaoVulnerabilidade(pontos: PontoSelecionado[], setores: Setores): SecaoTabela {
  const percentualOcupados = (rotulo: string, valor: (s: SetorComPois) => number | null | undefined) =>
    linha(rotulo, setores, (s) =>
      s.vulnerabilidade ? celulaPct(valor(s) ?? null, s.domiciliosOcupados) : SEM_DADO
    );
  const contagemOcupados = (rotulo: string, valor: (s: SetorComPois) => number | null | undefined) =>
    linha(rotulo, setores, (s) =>
      s.vulnerabilidade ? celulaContagemPct(valor(s) ?? null, s.domiciliosOcupados) : SEM_DADO
    );

  const linhas: LinhaTabela[] = [
    { tipo: "grupo", titulo: "Saneamento (% dos domicílios ocupados)" },
    percentualOcupados("Água da rede geral", (s) => s.vulnerabilidade?.saneamento.aguaRede),
    percentualOcupados("Esgoto na rede", (s) => s.vulnerabilidade?.saneamento.esgotoRede),
    percentualOcupados("Lixo coletado", (s) => s.vulnerabilidade?.saneamento.lixoColetado),

    { tipo: "grupo", titulo: "Tipo de domicílio" },
    contagemOcupados("Casa", (s) => s.vulnerabilidade?.tipoDomicilio.casa),
    contagemOcupados("Casa em condomínio", (s) => s.vulnerabilidade?.tipoDomicilio.casaCondominio),
    contagemOcupados("Apartamento", (s) => s.vulnerabilidade?.tipoDomicilio.apartamento),
    contagemOcupados("Precário", (s) => s.vulnerabilidade?.tipoDomicilio.precario),

    { tipo: "grupo", titulo: "Banheiro" },
    percentualOcupados("Com banheiro exclusivo", (s) => s.vulnerabilidade?.banheiro.com),
  ];

  // Entorno urbano: só setor urbano tem dado de face de quadra — deixar isso explícito.
  // Avisos ficam na `nota` da seção (fora da área rolável), nunca numa linha da tabela.
  const temEntorno = setores.some((s) => s?.vulnerabilidade?.entorno);

  let nota: string | undefined;
  if (!temEntorno) {
    nota =
      "Entorno urbano (pavimentação, iluminação, calçadas etc.): só existe para setores urbanos — nenhum dos pontos selecionados tem esse dado.";
  } else {
    linhas.push({ tipo: "grupo", titulo: "Entorno urbano (% das faces de quadra)" });
    const face = (rotulo: string, valor: (e: NonNullable<NonNullable<SetorComPois["vulnerabilidade"]>["entorno"]>) => number | null) =>
      linha(rotulo, setores, (s) => {
        const entorno = s.vulnerabilidade?.entorno;
        if (entorno) return celulaPct(valor(entorno), entorno.facesTotal);
        return s.vulnerabilidade
          ? { tipo: "texto", texto: "Não se aplica", atenuado: true }
          : SEM_DADO;
      });

    linhas.push(
      face("Pavimentação", (e) => e.comPavimentacao),
      face("Bueiro / boca de lobo", (e) => e.comBueiro),
      face("Iluminação pública", (e) => e.comIluminacao),
      face("Ponto de ônibus", (e) => e.comPontoOnibus),
      face("Via sinalizada para bicicleta", (e) => e.comViaBicicleta),
      face("Calçada", (e) => e.comCalcada),
      face("Obstáculo na calçada", (e) => e.comObstaculo),
      face("Rampa para cadeirante", (e) => e.comRampa),
      face("Sem arborização", (e) => e.semArvores)
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
