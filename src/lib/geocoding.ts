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

export async function buscarEnderecos(query: string): Promise<SugestaoEndereco[]> {
  if (!MAPBOX_TOKEN) {
    throw new Error("VITE_MAPBOX_TOKEN não configurado.");
  }

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    country: "br",
    language: "pt",
    types: "address,place,neighborhood,locality",
    limit: "6",
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
