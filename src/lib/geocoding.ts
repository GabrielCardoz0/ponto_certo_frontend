const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const MAPBOX_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export interface SugestaoEndereco {
  id: string;
  texto: string;
  localizacao: { lng: number; lat: number };
}

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number];
}

/**
 * `proximidade`: ordena as sugestões pelo que está perto dela (último ponto escolhido).
 * Sem ela, usa a localização aproximada do IP do usuário — sem nenhum viés, "Faria Lima 3000"
 * trazia Guarulhos antes de São Paulo.
 */
export async function buscarEnderecos(
  query: string,
  proximidade?: { lng: number; lat: number }
): Promise<SugestaoEndereco[]> {
  if (!MAPBOX_TOKEN) {
    throw new Error("VITE_MAPBOX_TOKEN não configurado.");
  }

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    country: "br",
    language: "pt",
    types: "address,place,neighborhood,locality",
    limit: "6",
    proximity: proximidade ? `${proximidade.lng},${proximidade.lat}` : "ip",
  });

  const res = await fetch(`${MAPBOX_GEOCODING_URL}/${encodeURIComponent(query)}.json?${params}`);
  if (!res.ok) {
    throw new Error(`Erro no geocoding: ${res.status} ${res.statusText}`);
  }

  const data: { features?: MapboxFeature[] } = await res.json();

  return (data.features ?? []).map((feature) => ({
    id: feature.id,
    texto: feature.place_name,
    localizacao: { lng: feature.center[0], lat: feature.center[1] },
  }));
}
