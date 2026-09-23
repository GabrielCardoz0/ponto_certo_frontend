const API_URL = import.meta.env.VITE_API_URL;

export interface Localizacao {
  lng: number;
  lat: number;
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
  pctAguaRede: number | null;
  pctEsgotoRede: number | null;
  pctColetaLixo: number | null;
}

/** Resultado resumido de /setores/busca — não inclui os campos numéricos do setor. */
export type SetorResumo = Pick<
  Setor,
  "cdSetor" | "censoDate" | "cdMunicipio" | "nmMunicipio" | "uf" | "regiao" | "localizacao"
>;

export interface Poi {
  id: number;
  categoria: string;
  subcategoria: string;
  nome: string | null;
  fonte: string;
  localizacao: Localizacao;
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

export interface SetorComPois extends Setor {
  poisPorCategoria: PoiContagem[];
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

export function getPois(cdSetor: string, raio: number, categoria?: string) {
  const params = new URLSearchParams({ raio: String(raio) });
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
