const API_URL = import.meta.env.VITE_API_URL;

export interface Localizacao {
  lng: number;
  lat: number;
}

/** Contagens brutas de população — percentuais são calculados na exibição. */
export interface SetorDemografia {
  sexo: { masculina: number | null; feminina: number | null };
  /** 11 faixas, da mais jovem (0-4) à mais velha (70+). */
  piramideEtaria: Array<{ faixa: string; total: number | null }>;
  raca: {
    branca: number | null;
    preta: number | null;
    amarela: number | null;
    parda: number | null;
    indigena: number | null;
  };
  alfabetizacao: { alfabetizados: number | null; naoAlfabetizados: number | null };
}

/** Face de quadra: só setor urbano tem — `entorno` é null em setor rural. */
export interface SetorEntorno {
  facesTotal: number;
  comPavimentacao: number | null;
  comBueiro: number | null;
  comIluminacao: number | null;
  comPontoOnibus: number | null;
  comViaBicicleta: number | null;
  comCalcada: number | null;
  comObstaculo: number | null;
  comRampa: number | null;
  semArvores: number | null;
}

/** Contagens brutas de domicílios; o percentual é sobre `domiciliosOcupados` do setor. */
export interface SetorVulnerabilidade {
  saneamento: { aguaRede: number | null; esgotoRede: number | null; lixoColetado: number | null };
  tipoDomicilio: {
    casa: number | null;
    casaCondominio: number | null;
    apartamento: number | null;
    precario: number | null;
  };
  banheiro: { com: number | null; sem: number | null };
  entorno: SetorEntorno | null;
}

export interface Setor {
  cdSetor: string;
  censoDate: string;
  cdMunicipio: string;
  nmMunicipio: string;
  uf: string;
  regiao: string;
  localizacao: Localizacao;
  situacao: string | null;
  populacao: number | null;
  areaKm2: number;
  rendaMedia: number | null;
  rendaMediana: number | null;
  densidadeHabKm2: number | null;
  tamanhoMedioFamilia: number | null;
  desvioPadraoRenda: number | null;
  coefVariacaoRenda: number | null;
  domiciliosOcupados: number | null;
  domiciliosUsoOcasional: number | null;
  domiciliosVagos: number | null;
  /** null quando o setor não tem dado demográfico (~2% dos setores). */
  demografia: SetorDemografia | null;
  /** null quando o setor não tem dado de vulnerabilidade (~2% dos setores). */
  vulnerabilidade: SetorVulnerabilidade | null;
}

/** Resultado resumido de /setores/busca — não inclui os campos numéricos do setor. */
export type SetorResumo = Pick<
  Setor,
  "cdSetor" | "censoDate" | "cdMunicipio" | "nmMunicipio" | "uf" | "regiao" | "localizacao"
>;

/** Contorno do POI (ex: perímetro de um parque), quando existir. */
export interface PoiShapeGeoJson {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

export interface Poi {
  id: number;
  categoria: string;
  subcategoria: string;
  nome: string | null;
  fonte: string;
  localizacao: Localizacao;
  /** Distância até a borda do setor, em metros (0 = dentro do setor). */
  distanciaM: number;
  shape: PoiShapeGeoJson | null;
}

/** Contagem de POIs de uma subcategoria dentro do raio da comparação. */
export interface PoiContagem {
  categoria: string;
  subcategoria: string;
  total: number;
}

/** Contagem de POIs por categoria dentro do raio pedido no relatório. */
export interface PoiCategoriaCount {
  categoria: string;
  quantidade: number;
}

export interface Relatorio {
  setor: Setor;
  raioMetros: number;
  poisPorCategoria: PoiCategoriaCount[];
}

/** POI mais próximo de uma categoria, medido a partir do polígono do setor. */
export interface PoiMaisProximo {
  categoria: string;
  subcategoria: string;
  distanciaM: number;
}

export interface SetorComPois extends Setor {
  poisPorCategoria: PoiContagem[];
  poiMaisProximo: PoiMaisProximo[];
}

/** Resposta de /setores/comparar: N setores (na ordem pedida) + POIs no raio fixo. */
export interface Comparacao {
  raioMetros: number;
  setores: SetorComPois[];
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Erro na API: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function buscarSetores(query: string) {
  return apiFetch<SetorResumo[]>(`/setores/busca?q=${encodeURIComponent(query)}`);
}

export function getSetor(cdSetor: string) {
  return apiFetch<Setor>(`/setores/${cdSetor}`);
}

export function localizarSetorPorPonto(lat: number, lng: number) {
  return apiFetch<Setor>(`/setores/localizar?lat=${lat}&lng=${lng}`);
}

export function getPois(cdSetor: string, raio: number, categoria?: string, limit = 500) {
  const params = new URLSearchParams({ raio: String(raio), limit: String(limit) });
  if (categoria) params.set("categoria", categoria);
  return apiFetch<Poi[]>(`/setores/${cdSetor}/pois?${params}`);
}

export function getRelatorio(cdSetor: string, raio: number) {
  return apiFetch<Relatorio>(`/setores/${cdSetor}/relatorio?raio=${raio}`);
}

export function compararSetores(cdSetores: string[]) {
  const ids = cdSetores.map(encodeURIComponent).join(",");
  return apiFetch<Comparacao>(`/setores/comparar?ids=${ids}`);
}

export function getSimilares(cdSetor: string, limit = 10, raioExclusaoKm = 50) {
  return apiFetch<Setor[]>(
    `/setores/${cdSetor}/similares?limit=${limit}&raioExclusaoKm=${raioExclusaoKm}`
  );
}
