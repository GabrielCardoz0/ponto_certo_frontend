import type { Setor } from "@/types/setor";

/**
 * Por que um setor não tem renda/população publicadas. Só leitura do que a API já devolve —
 * nenhuma regra de dado nova, é para a tela explicar em vez de mostrar uma parede de "—".
 *  - "sem_moradores": nenhum domicílio ocupado (área comercial, industrial, parque…).
 *  - "sigilo": poucos domicílios; o IBGE omite os números para não identificar ninguém.
 */
export type MotivoSemDado = "sem_moradores" | "sigilo";

export function motivoSemDado(setor: Setor): MotivoSemDado | null {
  if (setor.rendaMedia !== null || setor.populacao !== null) return null;
  return !setor.domiciliosOcupados ? "sem_moradores" : "sigilo";
}

export function explicacaoSemDado(motivo: MotivoSemDado, domiciliosOcupados: number | null): {
  titulo: string;
  texto: string;
} {
  if (motivo === "sem_moradores") {
    return {
      titulo: "Setor sem moradores",
      texto:
        "Este setor não tinha domicílios ocupados no Censo 2022 (área comercial, industrial, parque ou similar). Por isso não há renda nem perfil de moradores. O entorno e os pontos de interesse abaixo continuam válidos.",
    };
  }
  return {
    titulo: "Dados não divulgados pelo IBGE",
    texto: `Este setor tem poucos domicílios (${domiciliosOcupados ?? "?"}) e, por sigilo estatístico, o IBGE não publica a renda nem a maior parte do perfil dos moradores. Para ler a região, selecione também um setor vizinho.`,
  };
}

/** Texto curto para a lista lateral e células de tabela. */
export const RENDA_NAO_DIVULGADA = "Renda não divulgada";
