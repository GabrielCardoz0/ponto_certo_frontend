const ROTULO_POR_SUBCATEGORIA: Record<string, string> = {
  // transporte
  ponto_onibus: "Ponto de Ônibus",
  estacao_onibus: "Estação de Ônibus",
  estacao_metro: "Estação de Metrô",
  estacao_trem_urbano: "Estação de Trem",
  // lazer
  parque: "Parque",
  jardim: "Jardim",
  reserva_natural: "Reserva Natural",
  // comercio
  agropecuaria: "Agropecuária",
  alimentacao: "Alimentação",
  automotivo: "Automotivo",
  beleza: "Beleza",
  casa_e_construcao: "Casa e Construção",
  combustivel: "Posto de Combustível",
  eletronicos: "Eletrônicos",
  farmacia: "Farmácia",
  lazer_e_cultura: "Lazer e Cultura",
  outros: "Comércio",
  papelaria: "Papelaria",
  pet: "Pet Shop",
  servicos: "Serviços",
  supermercado: "Supermercado",
  vestuario: "Vestuário",
};

export const ROTULO_POR_CATEGORIA: Record<string, string> = {
  transporte: "Transporte",
  lazer: "Lazer",
  comercio: "Comércio",
};

/** Cor por categoria-pai de POI, usada no mapa (pontos/shapes) e no filtro em árvore. */
export const COR_POR_CATEGORIA: Record<string, string> = {
  transporte: "#2563eb",
  lazer: "#1f6f5c",
  comercio: "#c2410c",
};
export const POI_COR_PADRAO = "#6b7280";

export function nomeExibicao(poi: { nome: string | null; subcategoria: string }): string {
  return poi.nome ?? ROTULO_POR_SUBCATEGORIA[poi.subcategoria] ?? "Ponto de interesse";
}

export function rotuloCategoria(categoria: string): string {
  return ROTULO_POR_CATEGORIA[categoria] ?? categoria;
}

export function rotuloSubcategoria(subcategoria: string): string {
  return ROTULO_POR_SUBCATEGORIA[subcategoria] ?? subcategoria;
}

export function corCategoria(categoria: string): string {
  return COR_POR_CATEGORIA[categoria] ?? POI_COR_PADRAO;
}
