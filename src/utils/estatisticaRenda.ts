/**
 * Estatística da renda do setor, só leitura do que a API já devolve (média, mediana, coeficiente
 * de variação, saneamento) — nenhum dado novo. A renda é modelada como LOG-NORMAL, a escolha
 * clássica para renda (assimétrica à direita, nunca negativa). O IBGE só publica média, mediana e
 * desvio-padrão por setor; a forma da curva é uma ESTIMATIVA a partir deles, não o dado bruto
 * dos domicílios.
 */

/** Φ(x): distribuição normal padrão acumulada (Abramowitz-Stegun 7.1.26, erro < 1,5e-7). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(x * x) / 2);
  return 0.5 * (1 + (x >= 0 ? erf : -erf));
}

/** Φ⁻¹(p): quantil da normal padrão (algoritmo de Acklam, erro relativo ~1e-9). */
export function normalInv(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pBaixo = 0.02425;
  if (p <= 0 || p >= 1) return p <= 0 ? -Infinity : Infinity;
  if (p < pBaixo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pBaixo) return -normalInv(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export interface Lognormal {
  /** Parâmetros da normal por baixo: ln(renda) ~ N(mu, sigma²). */
  mu: number;
  sigma: number;
  /** Mediana teórica do modelo (= e^mu). Comparar com a mediana real mostra o quão "log-normal" é o setor. */
  medianaTeorica: number;
}

/**
 * Ajusta a log-normal pela média e pelo coeficiente de variação (CV = desvio/média):
 *   σ² = ln(1 + CV²)   e   μ = ln(média) − σ²/2
 * Devolve null sem média/CV válidos (setor em sigilo).
 */
export function ajustarLognormal(media: number | null, cv: number | null): Lognormal | null {
  if (media === null || cv === null || media <= 0 || cv <= 0) return null;
  const sigma2 = Math.log(1 + cv * cv);
  const mu = Math.log(media) - sigma2 / 2;
  return { mu, sigma: Math.sqrt(sigma2), medianaTeorica: Math.exp(mu) };
}

/** Renda no percentil p (0–1) do modelo: e^(μ + σ·Φ⁻¹(p)). */
export function percentil(m: Lognormal, p: number): number {
  return Math.exp(m.mu + m.sigma * normalInv(p));
}

/** Densidade de probabilidade da log-normal em x. */
export function densidade(m: Lognormal, x: number): number {
  if (x <= 0) return 0;
  const z = (Math.log(x) - m.mu) / m.sigma;
  return Math.exp(-(z * z) / 2) / (x * m.sigma * Math.sqrt(2 * Math.PI));
}

/** Fração de responsáveis com renda abaixo de x (CDF do modelo). */
export function fracaoAbaixo(m: Lognormal, x: number): number {
  return x <= 0 ? 0 : normalCdf((Math.log(x) - m.mu) / m.sigma);
}

/** Gini do modelo log-normal: 2·Φ(σ/√2) − 1. 0 = todos iguais, 1 = um só tem tudo. */
export function giniEstimado(m: Lognormal): number {
  return 2 * normalCdf(m.sigma / Math.SQRT2) - 1;
}

/**
 * Fatia da renda total do setor que fica com os `topo` (0–1) mais ricos. Vem da curva de Lorenz
 * da log-normal: L(p) = Φ(Φ⁻¹(p) − σ), então o topo de fração q concentra 1 − L(1 − q).
 */
export function participacaoDoTopo(m: Lognormal, topo = 0.1): number {
  return 1 - normalCdf(normalInv(1 - topo) - m.sigma);
}

/**
 * Quanto do setor (0–1) cai em cada faixa [min, próximo min) — pensado pros cortes da ABEP,
 * em ordem crescente, com `min: null` na primeira (sem piso). Soma 1.
 */
export function distribuicaoPorFaixa(
  m: Lognormal,
  faixas: Array<{ min: number | null }>
): number[] {
  return faixas.map((faixa, i) => {
    const piso = faixa.min === null ? 0 : fracaoAbaixo(m, faixa.min);
    const proximo = faixas[i + 1]?.min;
    const teto = proximo == null ? 1 : fracaoAbaixo(m, proximo);
    return Math.max(0, teto - piso);
  });
}

/** Pontos da curva de densidade entre dois percentis extremos, pra desenhar o gráfico. */
export function curvaDensidade(m: Lognormal, pontos = 90): Array<{ renda: number; densidade: number }> {
  const min = percentil(m, 0.005);
  const max = percentil(m, 0.995);
  return Array.from({ length: pontos }, (_, i) => {
    const renda = min + ((max - min) * i) / (pontos - 1);
    return { renda, densidade: densidade(m, renda) };
  });
}

/* ------------------------------------------------------------------------------------------ */
/* Índice de vulnerabilidade                                                                   */
/* ------------------------------------------------------------------------------------------ */

export type FaixaVulnerabilidade = "Baixa" | "Moderada" | "Alta" | "Muito alta";

export interface IndiceVulnerabilidade {
  /** 0 (menos vulnerável) a 100 (mais vulnerável). */
  indice: number;
  faixa: FaixaVulnerabilidade;
  /** Cada componente também em 0–100, pra mostrar de onde vem o número. */
  componentes: { desigualdadeRenda: number; deficitSaneamento: number };
}

/** CV a partir do qual a desigualdade de renda conta como máxima no índice. */
const CV_MAXIMO = 1.5;
/** Pesos do índice (somam 1). Proposta inicial, sem calibração externa — ajustar com o tempo. */
const PESO_SANEAMENTO = 0.6;
const PESO_DESIGUALDADE = 0.4;

/**
 * Índice composto de vulnerabilidade (proposta):
 *  - déficit de saneamento = 100 − média(% água, % esgoto, % lixo coletado) → 60% do índice
 *  - desigualdade de renda = CV normalizado (0 em CV=0, 100 em CV ≥ 1,5)      → 40% do índice
 * Saneamento pesa mais porque é carência material direta; o CV entra como sinal de desigualdade
 * interna (setor com ricos e pobres juntos esconde bolsões vulneráveis atrás da média).
 */
export function indiceVulnerabilidade(entrada: {
  cv: number | null;
  agua: number | null;
  esgoto: number | null;
  lixo: number | null;
}): IndiceVulnerabilidade | null {
  const { cv, agua, esgoto, lixo } = entrada;
  if (cv === null || agua === null || esgoto === null || lixo === null) return null;

  const deficitSaneamento = 100 - (agua + esgoto + lixo) / 3;
  const desigualdadeRenda = Math.min(100, Math.max(0, (cv / CV_MAXIMO) * 100));
  const indice = PESO_SANEAMENTO * deficitSaneamento + PESO_DESIGUALDADE * desigualdadeRenda;

  const faixa: FaixaVulnerabilidade =
    indice < 25 ? "Baixa" : indice < 45 ? "Moderada" : indice < 65 ? "Alta" : "Muito alta";
  return { indice, faixa, componentes: { desigualdadeRenda, deficitSaneamento } };
}
