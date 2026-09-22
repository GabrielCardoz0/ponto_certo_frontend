import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMoeda } from "@/lib/format";
import type { Localizacao } from "@/types/setor";

/**
 * URL do setores_br.pmtiles, servido fora da API Express (ver VITE_PMTILES_URL no .env).
 * Ajustar SOURCE_LAYER/PROP_* abaixo se o schema real do tileset for diferente.
 */
const PMTILES_URL = import.meta.env.VITE_PMTILES_URL;
const SOURCE_ID = "setores";
const SOURCE_LAYER = "setores";
const PROP_CD_SETOR = "CD_SETOR";
const PROP_RENDA_MEDIA = "renda_media";
const PROP_RENDA_MEDIANA = "renda_mediana";

const FILL_LAYER_ID = "setores-fill";
const OUTLINE_LAYER_ID = "setores-outline";
const HIGHLIGHT_LAYER_ID = "setores-highlight";

const MAPA_CENTER: [number, number] = [-46.6333, -23.5505]; // São Paulo (SP)
const MAPA_ZOOM = 11;

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const MAPBOX_STYLE_URL = `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${MAPBOX_TOKEN}`;

/**
 * MapLibre não resolve o esquema proprietário `mapbox://` (fontes, glyphs e sprite
 * do estilo vêm assim). Reescrevemos essas URLs para os endpoints REST reais da
 * Mapbox, anexando o token — mesmo padrão usado por quem consome estilos Mapbox
 * fora do mapbox-gl oficial.
 */
const transformRequest: maplibregl.RequestTransformFunction = (url) => {
  if (!url.startsWith("mapbox://")) return { url };

  if (url.includes("/fonts/")) {
    return { url: `${url.replace("mapbox://fonts", "https://api.mapbox.com/fonts/v1")}?access_token=${MAPBOX_TOKEN}` };
  }
  if (url.includes("/sprites/")) {
    // mapbox://sprites/mapbox/streets-v12[@2x].{json,png}
    // -> https://api.mapbox.com/styles/v1/mapbox/streets-v12/sprite[@2x].{json,png}
    const match = url.match(/^mapbox:\/\/sprites\/(.+?)(@\d+x)?\.(json|png)$/);
    if (match) {
      const [, path, retina = "", ext] = match;
      return {
        url: `https://api.mapbox.com/styles/v1/${path}/sprite${retina}.${ext}?access_token=${MAPBOX_TOKEN}`,
      };
    }
  }
  if (url.startsWith("mapbox://styles/")) {
    return { url: `${url.replace("mapbox://styles/", "https://api.mapbox.com/styles/v1/")}?access_token=${MAPBOX_TOKEN}` };
  }
  // Fonte vetorial composta, ex.: mapbox://mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2
  const tilesetIds = url.replace("mapbox://", "");
  return { url: `https://api.mapbox.com/v4/${tilesetIds}.json?secure&access_token=${MAPBOX_TOKEN}` };
};

/**
 * Classes econômicas por renda domiciliar, replicando os cortes em R$ e as cores
 * do projeto de referência (arrays `incomeRange.default` para os cortes e
 * `incomeRange.homeIncome` para as cores efetivamente pintadas no mapa deles).
 */
const ABEP_CLASSES: Array<{ label: string; min: number | null; cor: string }> = [
  { min: null, label: "DE", cor: "#666666" },
  { min: 1546.93, label: "C2", cor: "#FF0000" },
  { min: 2908.33, label: "C1", cor: "#FF9900" },
  { min: 5467.86, label: "B2", cor: "#99CC99" },
  { min: 10279.95, label: "B1", cor: "#009900" },
  { min: 19327.04, label: "A2", cor: "#0000CC" },
  { min: 36336.21, label: "A1", cor: "#000066" },
];

/** Cor para setores sem dado de renda (propriedade ausente no tile). */
const SEM_DADOS_COR = "#cccccc";

/** Índices de ABEP_CLASSES em ordem decrescente de renda (A1 primeiro, DE por último). */
const ABEP_CLASSES_INDICES_DESC = ABEP_CLASSES.map((_, index) => index).reverse();

/** Recorte de renda completo de uma classe, para exibir no painel de recortes da legenda. */
function faixaRendaTooltip(index: number): string {
  const atual = ABEP_CLASSES[index];
  const proxima = ABEP_CLASSES[index + 1];
  if (atual.min === null) {
    return `até ${formatMoeda(proxima.min)}`;
  }
  if (!proxima) {
    return `a partir de ${formatMoeda(atual.min)}`;
  }
  return `${formatMoeda(atual.min)} até ${formatMoeda(proxima.min)}`;
}

export type RendaCampo = "rendaMedia" | "rendaMediana";

export interface FlyTarget {
  lng: number;
  lat: number;
  nonce: number;
}

interface MapViewProps {
  rendaCampo: RendaCampo;
  onSelectSetor: (cdSetor: string, localizacao: Localizacao) => void;
  flyTarget: FlyTarget | null;
  camadaVisivel: boolean;
  rendaOpacidade: number;
  setoresSelecionados: string[];
}

function rendaPropFor(campo: RendaCampo) {
  return campo === "rendaMedia" ? PROP_RENDA_MEDIA : PROP_RENDA_MEDIANA;
}

function fillColorExpression(campo: RendaCampo): maplibregl.ExpressionSpecification {
  const prop = rendaPropFor(campo);
  const [primeira, ...resto] = ABEP_CLASSES;
  const stops = resto.flatMap(({ min, cor }) => [min as number, cor]);
  return [
    "case",
    ["!", ["has", prop]],
    SEM_DADOS_COR,
    ["step", ["to-number", ["get", prop], 0], primeira.cor, ...stops],
  ] as maplibregl.ExpressionSpecification;
}

export function MapView({
  rendaCampo,
  onSelectSetor,
  flyTarget,
  camadaVisivel,
  rendaOpacidade,
  setoresSelecionados,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onSelectSetorRef = useRef(onSelectSetor);
  useEffect(() => {
    onSelectSetorRef.current = onSelectSetor;
  }, [onSelectSetor]);

  useEffect(() => {
    if (!containerRef.current) return;

    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    let cancelled = false;
    let map: maplibregl.Map | null = null;

    async function init() {
      const res = await fetch(MAPBOX_STYLE_URL);
      const style = await res.json();
      if (cancelled || !containerRef.current) return;

      // O estilo da Mapbox vem com "projection: { name: 'globe' }" e "fog" para o
      // globo 3D — o MapLibre usa outro formato para projeção e rejeita essas
      // chaves na validação. Removemos para cair no mercator 2D padrão.
      delete style.projection;
      delete style.fog;

      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: MAPA_CENTER,
        zoom: MAPA_ZOOM,
        transformRequest,
      });
      mapRef.current = map;

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (!map) return;

        // Fill/contorno entram logo abaixo do primeiro símbolo (ícone ou texto) —
        // assim as ruas do basemap continuam desenhadas por cima, visíveis e
        // "limpas" (só tingidas pela opacidade do fill, não escondidas).
        const firstSymbolId = style.layers?.find(
          (layer: { type: string; id: string }) => layer.type === "symbol"
        )?.id;

        // Já o destaque de seleção precisa ficar acima de TUDO que não seja texto
        // (senão a borda some sob o asfalto/casing das ruas quando um setor é
        // clicado), então entra só abaixo do primeiro rótulo de TEXTO de verdade.
        const firstTextLabelId = style.layers?.find(
          (layer: { type: string; id: string; layout?: { "text-field"?: unknown } }) =>
            layer.type === "symbol" && layer.layout?.["text-field"]
        )?.id;

        map.addSource(SOURCE_ID, {
          type: "vector",
          url: `pmtiles://${PMTILES_URL}`,
        });

        map.addLayer(
          {
            id: FILL_LAYER_ID,
            type: "fill",
            source: SOURCE_ID,
            "source-layer": SOURCE_LAYER,
            paint: {
              "fill-color": fillColorExpression(rendaCampo),
              "fill-opacity": rendaOpacidade,
            },
          },
          firstSymbolId
        );

        map.addLayer(
          {
            id: OUTLINE_LAYER_ID,
            type: "line",
            source: SOURCE_ID,
            "source-layer": SOURCE_LAYER,
            paint: {
              "line-color": "#00000033",
              "line-width": 0.5,
            },
          },
          firstSymbolId
        );

        map.addLayer(
          {
            id: HIGHLIGHT_LAYER_ID,
            type: "line",
            source: SOURCE_ID,
            "source-layer": SOURCE_LAYER,
            paint: {
              "line-color": "#111827",
              "line-width": 2.5,
            },
            filter: ["==", ["get", PROP_CD_SETOR], "__none__"],
          },
          firstTextLabelId
        );

        map.on("click", FILL_LAYER_ID, (e: MapLayerMouseEvent) => {
          const feature = e.features?.[0];
          const cdSetorRaw = feature?.properties?.[PROP_CD_SETOR];
          if (cdSetorRaw === undefined || cdSetorRaw === null) return;
          const cdSetor = String(cdSetorRaw);

          const { lng, lat } = e.lngLat;
          onSelectSetorRef.current(cdSetor, { lng, lat });
        });

        map.on("mouseenter", FILL_LAYER_ID, () => {
          if (map) map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", FILL_LAYER_ID, () => {
          if (map) map.getCanvas().style.cursor = "";
        });
      });
    }

    void init();

    return () => {
      cancelled = true;
      map?.remove();
      maplibregl.removeProtocol("pmtiles");
      mapRef.current = null;
    };
    // Efeito de montagem única: rendaCampo/rendaOpacidade iniciais são lidos apenas na
    // criação da layer; atualizações posteriores são tratadas pelos efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(FILL_LAYER_ID)) return;
    map.setPaintProperty(FILL_LAYER_ID, "fill-color", fillColorExpression(rendaCampo));
  }, [rendaCampo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(FILL_LAYER_ID)) return;
    map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", rendaOpacidade);
  }, [rendaOpacidade]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    map.flyTo({ center: [flyTarget.lng, flyTarget.lat], zoom: 14, essential: true });
  }, [flyTarget]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(HIGHLIGHT_LAYER_ID)) return;
    map.setFilter(
      HIGHLIGHT_LAYER_ID,
      setoresSelecionados.length === 0
        ? ["==", ["get", PROP_CD_SETOR], "__none__"]
        : ["in", ["get", PROP_CD_SETOR], ["literal", setoresSelecionados]]
    );
  }, [setoresSelecionados]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(FILL_LAYER_ID)) return;
    const visibility = camadaVisivel ? "visible" : "none";
    map.setLayoutProperty(FILL_LAYER_ID, "visibility", visibility);
    map.setLayoutProperty(OUTLINE_LAYER_ID, "visibility", visibility);
    map.setLayoutProperty(HIGHLIGHT_LAYER_ID, "visibility", visibility);
  }, [camadaVisivel]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-border bg-background/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
        <div className="mb-1.5 flex items-center gap-1 font-medium">
          Classe econômica · renda {rendaCampo === "rendaMedia" ? "média" : "mediana"}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="pointer-events-auto inline-flex cursor-pointer text-muted-foreground hover:text-foreground"
                />
              }
            >
              <AlertCircle className="size-3.5" />
              <span className="sr-only">Ver recortes de renda por classe</span>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="w-60 flex-col items-stretch gap-1 p-3">
              <div className="mb-0.5 font-medium">Recortes de renda por classe</div>
              {ABEP_CLASSES_INDICES_DESC.map((index) => {
                const classe = ABEP_CLASSES[index];
                return (
                  <div key={classe.label} className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: classe.cor }}
                    />
                    <span className="w-6 shrink-0 font-medium">{classe.label}</span>
                    <span className="text-background/70">{faixaRendaTooltip(index)}</span>
                  </div>
                );
              })}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          {ABEP_CLASSES_INDICES_DESC.map((index) => {
            const classe = ABEP_CLASSES[index];
            return (
              <div key={classe.label} className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: classe.cor }} />
                <span className="text-muted-foreground">{classe.label}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: SEM_DADOS_COR }} />
            <span className="text-muted-foreground">Sem dados</span>
          </div>
        </div>
        <div className="mt-1.5 text-muted-foreground">
          Fonte: dados públicos IBGE, enriquecidos com modelagem própria auditável
        </div>
      </div>
    </div>
  );
}
