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

/** Chamado quando qualquer request autenticado leva 401 — o AuthContext se inscreve pra deslogar. */
let ouvinteSessaoPerdida: (() => void) | null = null;
export function aoPerderSessao(cb: (() => void) | null) {
  ouvinteSessaoPerdida = cb;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // credentials:"include" manda o cookie httpOnly da sessão — sem isso, toda rota (protegida
  // por login) responderia 401 mesmo com o usuário logado.
  const res = await fetch(`${API_URL}${path}`, { credentials: "include", ...init });
  if (res.status === 401) {
    ouvinteSessaoPerdida?.();
  }
  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    throw new Error(corpo?.erro ?? `Erro na API: ${res.status} ${res.statusText}`);
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

/** Fator de correção monetária acumulado (ex: IPCA) desde a data-base do Censo até `mesReferencia`. */
export interface FatorCorrecao {
  fatorAcumulado: number;
  mesReferencia: string;
}

export function getFatorCorrecao(indice = "IPCA") {
  return apiFetch<FatorCorrecao>(`/config/fator-correcao?indice=${encodeURIComponent(indice)}`);
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  role: string;
  isFirstAccess: boolean;
}

/**
 * Login e logout usam `fetch` direto (não `apiFetch`): um 401 de senha errada não é "sessão
 * perdida" — não faz sentido disparar o mesmo aviso global que usamos quando uma sessão já
 * ativa expira no meio do uso.
 */
export async function login(email: string, senha: string): Promise<Usuario> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  const corpo = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(corpo?.erro ?? "Não foi possível entrar.");
  }
  return corpo.usuario;
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
}

export async function getUsuarioLogado(): Promise<Usuario> {
  const { usuario } = await apiFetch<{ usuario: Usuario }>("/auth/me");
  return usuario;
}

/** Área administrativa — tudo aqui exige role "admin" no backend (403 pros demais). */
export interface UsuarioAdmin {
  id: number;
  nome: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export function listarUsuariosAdmin() {
  return apiFetch<UsuarioAdmin[]>("/admin/usuarios");
}

export function criarUsuarioAdmin(nome: string, email: string, senha: string) {
  return apiFetch<UsuarioAdmin>("/admin/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, email, senha }),
  });
}

export function alternarAtivoUsuarioAdmin(id: number, isActive: boolean) {
  return apiFetch<UsuarioAdmin>(`/admin/usuarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  });
}

export interface MetricasAdmin {
  usuariosAtivosSemana: number;
  eventosPorAcao: Array<{ acao: string; total: number }>;
  ultimosEventos: Array<{ id: number; acao: string; usuario: string | null; criadoEm: string }>;
}

export function getMetricasAdmin() {
  return apiFetch<MetricasAdmin>("/admin/metricas");
}
