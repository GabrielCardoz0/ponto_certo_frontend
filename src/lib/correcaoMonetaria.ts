import { useEffect, useState } from "react";
import { getFatorCorrecao } from "@/lib/api";

/** Sem correção: multiplicar por 1 não altera nada — usado até a API responder, ou se ela falhar. */
export const FATOR_CORRECAO_NEUTRO = 1;

export interface FatorCorrecaoAtual {
  fatorAcumulado: number;
  /** null enquanto não carregou, ou se a API falhou (fator fica neutro nesse caso). */
  mesReferencia: string | null;
}

const FATOR_NEUTRO: FatorCorrecaoAtual = { fatorAcumulado: FATOR_CORRECAO_NEUTRO, mesReferencia: null };

let fatorPromise: Promise<FatorCorrecaoAtual> | null = null;

/**
 * Busca o fator uma única vez por carregamento da página e cacheia em memória (nunca é
 * gravado no banco — a correção só acontece na hora de exibir, sobre o dado bruto do Censo).
 */
function buscarFatorUmaVez(): Promise<FatorCorrecaoAtual> {
  if (!fatorPromise) {
    fatorPromise = getFatorCorrecao()
      .then((r) => ({ fatorAcumulado: r.fatorAcumulado, mesReferencia: r.mesReferencia }))
      .catch((erro: unknown) => {
        console.warn(
          "Não foi possível carregar o fator de correção monetária; exibindo renda sem correção pela inflação.",
          erro
        );
        return FATOR_NEUTRO;
      });
  }
  return fatorPromise;
}

/** Fator de correção monetária atual (fator 1 / mês nulo até a API responder). */
export function useFatorCorrecao(): FatorCorrecaoAtual {
  const [fator, setFator] = useState<FatorCorrecaoAtual>(FATOR_NEUTRO);
  useEffect(() => {
    let cancelado = false;
    buscarFatorUmaVez().then((f) => {
      if (!cancelado) setFator(f);
    });
    return () => {
      cancelado = true;
    };
  }, []);
  return fator;
}

/** Aplica o fator a um valor de renda bruto do Censo; o dado armazenado nunca é alterado. */
export function corrigirRenda(valor: number | null, fator: number): number | null {
  return valor === null ? null : valor * fator;
}
