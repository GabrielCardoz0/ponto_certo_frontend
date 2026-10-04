import type { Setor, SetorComPois } from "@/types/setor";

/**
 * "Respostas rápidas" de um setor — o que o corretor quer saber logo de cara. Só leitura do que
 * a API já devolve; usado no relatório de 1 ponto e no resumo da comparação, pra os dois
 * responderem exatamente a mesma coisa.
 */

function pct(parte: number | null | undefined, total: number | null | undefined): number | null {
  if (parte == null || !total) return null;
  return (parte / total) * 100;
}

/** Abaixo disso a renda é lida como "homogênea"; é um corte de leitura, não um padrão do IBGE. */
const LIMIAR_CV_HOMOGENEO = 0.5;

export function homogeneidadeRenda(cv: number | null): { texto: string; cor: string } | null {
  if (cv === null) return null;
  return cv < LIMIAR_CV_HOMOGENEO
    ? { texto: "Renda homogênea", cor: "#16a34a" }
    : { texto: "Renda heterogênea", cor: "#d97706" };
}

export function faixaEtariaPredominante(
  setor: Setor
): { faixa: string; total: number; percentual: number | null } | null {
  let melhor: { faixa: string; total: number; percentual: number | null } | null = null;
  for (const f of setor.demografia?.piramideEtaria ?? []) {
    if (f.total === null) continue;
    if (melhor === null || f.total > melhor.total) {
      melhor = { faixa: f.faixa, total: f.total, percentual: pct(f.total, setor.populacao) };
    }
  }
  return melhor;
}

/** Tipo de domicílio com mais casos (casa, apartamento…), em % dos domicílios ocupados. */
export function domicilioPredominante(setor: Setor): { rotulo: string; percentual: number | null } | null {
  const t = setor.vulnerabilidade?.tipoDomicilio;
  if (!t) return null;
  const opcoes = [
    { rotulo: "Casa", total: t.casa },
    { rotulo: "Casa em condomínio", total: t.casaCondominio },
    { rotulo: "Apartamento", total: t.apartamento },
    { rotulo: "Moradia precária", total: t.precario },
  ].filter((o): o is { rotulo: string; total: number } => o.total !== null && o.total > 0);
  if (opcoes.length === 0) return null;
  const maior = opcoes.reduce((a, b) => (b.total > a.total ? b : a));
  return { rotulo: maior.rotulo, percentual: pct(maior.total, setor.domiciliosOcupados) };
}

/** % dos domicílios ocupados com esgoto na rede — o indicador de saneamento que mais varia. */
export function esgotoNaRede(setor: Setor): number | null {
  return pct(setor.vulnerabilidade?.saneamento.esgotoRede, setor.domiciliosOcupados);
}

export function totalPoisCategoria(setor: SetorComPois, categoria: string): number {
  return setor.poisPorCategoria.filter((p) => p.categoria === categoria).reduce((s, p) => s + p.total, 0);
}
