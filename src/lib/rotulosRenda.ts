/**
 * Rótulos da renda num lugar só. O dado do IBGE é o rendimento do RESPONSÁVEL pelo domicílio
 * (não a renda somada do domicílio), e o valor exibido já vem corrigido pelo IPCA — os dois
 * pontos precisam estar claros em toda tela que mostra renda.
 */
export const ROTULO_RENDA_MEDIA = "Renda média do responsável";
export const ROTULO_RENDA_MEDIANA = "Renda mediana do responsável";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-08-01" → "ago/2026". */
function mesAno(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-");
  return `${MESES[Number(mes) - 1] ?? mes}/${ano}`;
}

/** "Censo 2022, corrigida pelo IPCA até ago/2026" — ou só "Censo 2022" se o fator não carregou. */
export function fonteRenda(mesReferencia: string | null): string {
  return mesReferencia ? `Censo 2022, corrigida pelo IPCA até ${mesAno(mesReferencia)}` : "Censo 2022";
}

export const INFO_RENDA_MEDIA =
  "Rendimento nominal médio mensal da pessoa responsável pelo domicílio (não é a renda somada de todos os moradores), segundo o Censo 2022 do IBGE, corrigido até hoje pelo IPCA acumulado.";
export const INFO_RENDA_MEDIANA =
  "Valor que divide os responsáveis pelos domicílios do setor ao meio: metade ganha mais, metade ganha menos. Menos sensível a valores extremos do que a média. Também corrigida pelo IPCA acumulado.";
