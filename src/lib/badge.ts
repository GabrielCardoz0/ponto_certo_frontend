const BASE = "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-2";

/**
 * Estilo do selo numerado de um ponto — o mesmo na lista, na tabela e no marcador do mapa.
 * Selecionado = cores invertidas (fundo claro, número e contorno escuros), SEM mudar de tamanho:
 * crescer o marcador dava a impressão de que ele "subia" no mapa.
 */
export function classeBadgePonto(ativo = false): string {
  return ativo
    ? `${BASE} bg-background text-foreground ring-foreground`
    : `${BASE} bg-primary text-primary-foreground ring-background`;
}
