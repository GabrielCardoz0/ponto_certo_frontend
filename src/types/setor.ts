import type { Localizacao, Setor } from "@/lib/api";

export type {
  Setor,
  SetorResumo,
  SetorComPois,
  Localizacao,
  Poi,
  PoiContagem,
  PoiCategoriaCount,
  Relatorio,
  Comparacao,
} from "@/lib/api";

/** Um ponto da comparação: o setor escolhido + como ele aparece na lista (endereço ou setor). */
export interface PontoSelecionado {
  setor: Setor;
  rotulo: string;
  /** Onde o marcador numerado fica no mapa (endereço buscado ou ponto clicado). */
  localizacao: Localizacao;
}
