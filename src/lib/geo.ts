import type { Localizacao } from "@/types/setor";

/** [[oeste, sul], [leste, norte]] — formato aceito por map.fitBounds. */
export type BoundsLngLat = [[number, number], [number, number]];

const RAIO_TERRA_KM = 6371;
const METROS_POR_GRAU_LAT = 111_320;

/** Acima disso o fitBounds afastaria tanto o zoom que o choropleth perde o sentido. */
export const LIMITE_ENQUADRAMENTO_KM = 150;

/** Visão geral do Brasil — usada quando os pontos estão espalhados demais. */
export const VISAO_BRASIL = { center: [-52, -14] as [number, number], zoom: 3.3 };

/** Raio (m) em volta de cada ponto ao calcular o enquadramento, pra pontos próximos não estourarem o zoom. */
const MARGEM_PONTO_METROS = 500;

export function distanciaKm(a: Localizacao, b: Localizacao): number {
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h));
}

/** Retângulo de ±raio em volta do ponto (aproximação plana, suficiente pra raios de poucos km). */
export function boundsDoRaio(centro: Localizacao, raioMetros: number): BoundsLngLat {
  const dLat = raioMetros / METROS_POR_GRAU_LAT;
  const dLng = raioMetros / (METROS_POR_GRAU_LAT * Math.cos((centro.lat * Math.PI) / 180));
  return [
    [centro.lng - dLng, centro.lat - dLat],
    [centro.lng + dLng, centro.lat + dLat],
  ];
}

/**
 * Raio (m) de um círculo com a mesma área do setor, com uma margem — usado só pra estimar um
 * enquadramento (não temos o polígono real do setor no front, só a área). `margem` > 1 evita que
 * o setor fique colado na borda do enquadramento.
 */
export function raioDoSetor(areaKm2: number | null, margem = 1.4): number {
  const area = areaKm2 && areaKm2 > 0 ? areaKm2 : 0.01; // fallback pra setor sem área conhecida
  return Math.sqrt((area * 1_000_000) / Math.PI) * margem;
}

export function unirBounds(lista: BoundsLngLat[]): BoundsLngLat {
  return [
    [Math.min(...lista.map((b) => b[0][0])), Math.min(...lista.map((b) => b[0][1]))],
    [Math.max(...lista.map((b) => b[1][0])), Math.max(...lista.map((b) => b[1][1]))],
  ];
}

export type Enquadramento = { tipo: "bounds"; bounds: BoundsLngLat } | { tipo: "brasil" };

/**
 * Enquadramento inicial do mini-mapa com todos os pontos. Se os extremos passarem de
 * ~150 km (ex: resultado de Market Twins em outro estado), cai na visão geral do Brasil.
 */
export function enquadramentoDosPontos(pontos: Localizacao[]): Enquadramento {
  if (pontos.length === 0) return { tipo: "brasil" };
  const bounds = unirBounds(pontos.map((p) => boundsDoRaio(p, MARGEM_PONTO_METROS)));
  const extensaoKm = distanciaKm(
    { lng: bounds[0][0], lat: bounds[0][1] },
    { lng: bounds[1][0], lat: bounds[1][1] }
  );
  return extensaoKm > LIMITE_ENQUADRAMENTO_KM ? { tipo: "brasil" } : { tipo: "bounds", bounds };
}

/** Limites aproximados do Brasil, pra voltar à visão geral com fitBounds. */
export const BOUNDS_BRASIL: BoundsLngLat = [
  [-74, -34],
  [-34, 5.5],
];
