import { formatMoeda, formatNumero } from "@/lib/format";
import { rotuloCategoria, rotuloSubcategoria } from "@/utils/nomePoi";
import type { Comparacao, PontoSelecionado, SetorComPois } from "@/types/setor";

export interface ColunaTabela {
  numero: number;
  rotulo: string;
}

export interface LinhaTabela {
  rotulo: string;
  valores: string[];
}

export interface SecaoTabela {
  titulo: string;
  linhas: LinhaTabela[];
}

export interface TabelaComparativa {
  colunas: ColunaTabela[];
  secoes: SecaoTabela[];
}

const VARIAVEIS_PERFIL: Array<{ rotulo: string; valor: (s: SetorComPois) => string }> = [
  { rotulo: "Renda média", valor: (s) => formatMoeda(s.rendaMedia) },
  { rotulo: "Renda mediana", valor: (s) => formatMoeda(s.rendaMediana) },
  { rotulo: "População", valor: (s) => formatNumero(s.populacao) },
  { rotulo: "Densidade (hab/km²)", valor: (s) => formatNumero(s.densidadeHabKm2, 1) },
  { rotulo: "Área (km²)", valor: (s) => formatNumero(s.areaKm2, 2) },
  { rotulo: "Tamanho médio da família", valor: (s) => formatNumero(s.tamanhoMedioFamilia, 2) },
  { rotulo: "Situação", valor: (s) => s.situacao ?? "—" },
];

/**
 * Fonte única da tabela de detalhes: colunas = pontos na ordem da lista (mesmo número
 * do mapa e da barra lateral), linhas = variáveis. O modal renderiza este objeto — e a
 * exportação futura deve consumir exatamente o mesmo, sem remontar nada.
 */
export function montarTabelaComparativa(
  pontos: PontoSelecionado[],
  comparacao: Comparacao
): TabelaComparativa {
  const porSetor = new Map(comparacao.setores.map((s) => [s.cdSetor, s]));
  const setores = pontos.map((p) => porSetor.get(p.setor.cdSetor));

  const colunas = pontos.map((p, i) => ({ numero: i + 1, rotulo: p.rotulo }));

  const perfil: SecaoTabela = {
    titulo: "Perfil socioeconômico",
    linhas: VARIAVEIS_PERFIL.map((v) => ({
      rotulo: v.rotulo,
      valores: setores.map((s) => (s ? v.valor(s) : "—")),
    })),
  };

  const subcategorias = new Map<string, string>();
  for (const s of setores) {
    for (const poi of s?.poisPorCategoria ?? []) subcategorias.set(poi.subcategoria, poi.categoria);
  }
  const ordenadas = [...subcategorias.entries()].sort(
    ([subA, catA], [subB, catB]) =>
      rotuloCategoria(catA).localeCompare(rotuloCategoria(catB), "pt-BR") ||
      rotuloSubcategoria(subA).localeCompare(rotuloSubcategoria(subB), "pt-BR")
  );

  const km = formatNumero(comparacao.raioMetros / 1000, comparacao.raioMetros % 1000 === 0 ? 0 : 1);
  const pois: SecaoTabela = {
    titulo: `Pontos de interesse num raio de ${km} km`,
    linhas: ordenadas.map(([sub, cat]) => ({
      rotulo: `${rotuloCategoria(cat)} · ${rotuloSubcategoria(sub)}`,
      valores: setores.map((s) => {
        const total = s?.poisPorCategoria.find((p) => p.subcategoria === sub)?.total ?? 0;
        return formatNumero(total);
      }),
    })),
  };

  return { colunas, secoes: pois.linhas.length > 0 ? [perfil, pois] : [perfil] };
}
