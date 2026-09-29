import { formatMoeda } from "@/lib/format";

/**
 * Classes econômicas por renda domiciliar, replicando os cortes em R$ e as cores
 * do projeto de referência (arrays `incomeRange.default` para os cortes e
 * `incomeRange.homeIncome` para as cores efetivamente pintadas no mapa deles).
 * `min` é o piso da classe; a classe DE não tem piso. Em ordem crescente de renda.
 */
export const ABEP_CLASSES: Array<{ label: string; min: number | null; cor: string }> = [
  { min: null, label: "DE", cor: "#666666" },
  { min: 1546.93, label: "C2", cor: "#FF0000" },
  { min: 2908.33, label: "C1", cor: "#FF9900" },
  { min: 5467.86, label: "B2", cor: "#99CC99" },
  { min: 10279.95, label: "B1", cor: "#009900" },
  { min: 19327.04, label: "A2", cor: "#0000CC" },
  { min: 36336.21, label: "A1", cor: "#000066" },
];

/** Cor para setores sem dado de renda (propriedade ausente no tile). */
export const SEM_DADOS_COR = "#cccccc";

/** Índices de ABEP_CLASSES em ordem decrescente de renda (A1 primeiro, DE por último). */
export const ABEP_CLASSES_INDICES_DESC = ABEP_CLASSES.map((_, index) => index).reverse();

/**
 * Só o limite superior da faixa (não a faixa inteira): "até R$ X" pra quem tem teto,
 * "acima de R$ X" pra A1, que não tem.
 */
export function faixaRendaTooltip(index: number): string {
  const atual = ABEP_CLASSES[index];
  const proxima = ABEP_CLASSES[index + 1];
  if (!proxima) {
    return `acima de ${formatMoeda(atual.min)}`;
  }
  return `até ${formatMoeda(proxima.min)}`;
}

/** Classe econômica de uma renda média (mesmos cortes do choropleth); null sem renda. */
export function classeEconomica(renda: number | null): { label: string; cor: string } | null {
  if (renda === null) return null;
  let atual = ABEP_CLASSES[0];
  for (const classe of ABEP_CLASSES) {
    if (classe.min !== null && renda >= classe.min) atual = classe;
  }
  return { label: atual.label, cor: atual.cor };
}
