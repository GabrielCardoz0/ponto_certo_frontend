import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { adicionarCamadasPoi } from "@/components/mapa/poi";
import {
  ABEP_CLASSES,
  ABEP_CLASSES_INDICES_DESC,
  SEM_DADOS_COR,
  faixaRendaTooltip,
} from "@/lib/abep";
import { classeBadgePonto } from "@/lib/badge";
import { useFatorCorrecao } from "@/lib/correcaoMonetaria";
import { VISAO_BRASIL, type BoundsLngLat, type Enquadramento } from "@/lib/geo";
import { fonteRenda } from "@/lib/rotulosRenda";
import type { Localizacao, Poi } from "@/types/setor";

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

/** Folga entre os setores enquadrados e a borda do mapa, em px. */
const PADDING_ENQUADRAMENTO = 60;

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const MAPBOX_STYLE_URL = `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${MAPBOX_TOKEN}`;

/**
 * O MapLibre calcula a URL do worker em runtime (`new URL(`./${nome}`, import.meta.url)`,
 * nome montado por template string) — o Rollup não detecta esse padrão (só literais estáticos),
 * então `maplibre-gl-worker.mjs` nunca ia pro build de produção (funcionava em dev só porque o
 * Vite serve node_modules direto do disco). Pior: esse worker por sua vez importa
 * `./maplibre-gl-shared.mjs` (90% da lib) por um import relativo de verdade — um `?url` do Vite
 * copia o arquivo como blob opaco e não resolve esse import de dentro dele.
 *
 * Em vez de lutar com bundling, os dois arquivos (do jeito que a lib publica, sem reescrever
 * nada) ficam em `public/maplibre/` — copiados do node_modules no postinstall (ver
 * scripts/copiar-worker-maplibre.mjs). O Vite serve `public/` do jeito que está, sem hash, igual
 * em dev e build — o import relativo entre os dois continua resolvendo certo nos dois arquivos
 * lado a lado, e setWorkerUrl() substitui a detecção automática frágil da lib.
 */
const WORKER_MAPLIBRE_URL = "/maplibre/maplibre-gl-worker.mjs";

/**
 * Setup global do MapLibre, feito uma vez só e nunca desfeito: o protocolo `pmtiles://` e a
 * URL do worker. Com mais de uma instância de mapa na tela (mapa principal + mini-mapa do
 * modal), um `removeProtocol` no cleanup de uma delas quebraria o carregamento de tiles da
 * outra — por isso nunca remove, só registra uma vez.
 */
let mapLibreConfiguradoGlobalmente = false;
function configurarMapLibreGlobalmente() {
  if (mapLibreConfiguradoGlobalmente) return;
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  maplibregl.setWorkerUrl(WORKER_MAPLIBRE_URL);
  mapLibreConfiguradoGlobalmente = true;
}

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

export type RendaCampo = "rendaMedia" | "rendaMediana";

export interface FlyTarget {
  lng: number;
  lat: number;
  /** Limites aproximados do setor (raio equivalente à área) — só pra calcular o zoom do flyTo. */
  bounds?: BoundsLngLat;
  nonce: number;
}

/** Zoom nunca sai desse intervalo no flyTo por setor: piso = o que já funcionava bem pra setor
 * grande antes desse ajuste; teto = zoom máximo dos tiles de setores (gerados até z16). */
const ZOOM_FLY_MIN = 14;
const ZOOM_FLY_MAX = 16;

/** Pedido de enquadramento animado; `nonce` novo = novo pedido (mesmo com os mesmos limites). */
export interface FitTarget {
  bounds: BoundsLngLat;
  nonce: number;
}

/** Ponto selecionado que ganha um marcador numerado no mapa. */
export interface PontoNoMapa {
  cdSetor: string;
  numero: number;
  localizacao: Localizacao;
}

interface MapViewProps {
  rendaCampo: RendaCampo;
  onSelectSetor: (cdSetor: string, localizacao: Localizacao) => void;
  flyTarget: FlyTarget | null;
  camadaVisivel: boolean;
  rendaOpacidade: number;
  setoresSelecionados: string[];
  pontos: PontoNoMapa[];
  /** POIs exibidos (ícone por subcategoria + contorno). Vazio/ausente = sem camada de POI. */
  pois?: Poi[];
  /** Enquadra o mapa nesses limites (animado). */
  fitTarget?: FitTarget | null;
  /** Vista ao criar o mapa: limites a enquadrar ou visão geral do Brasil. Padrão: São Paulo. */
  vistaInicial?: Enquadramento;
  /** Torna os marcadores numerados clicáveis. */
  onPontoClick?: (numero: number) => void;
  /** Número do marcador em destaque. */
  pontoAtivo?: number | null;
  /** false desliga o clique-para-selecionar setor (ex: mini-mapa do modal). Padrão: true. */
  permitirSelecao?: boolean;
  /** false esconde a legenda de classes econômicas. Padrão: true. */
  mostrarLegenda?: boolean;
  /** Corrige a renda bruta do Censo pra valores de hoje antes de colorir o choropleth. Padrão: 1 (sem correção). */
  fatorCorrecao?: number;
  /**
   * Ctrl + rolagem dá zoom; rolagem simples passa pra página. Pro mapa que fica dentro de
   * uma área rolável (mini-mapa do modal), senão a roda do mouse sobre ele "prende" a rolagem.
   */
  gestosCooperativos?: boolean;
}

function rendaPropFor(campo: RendaCampo) {
  return campo === "rendaMedia" ? PROP_RENDA_MEDIA : PROP_RENDA_MEDIANA;
}

/**
 * `fator` corrige a renda bruta do Censo (2022) pra valores de hoje antes de comparar com os
 * cortes ABEP — os cortes (`ABEP_CLASSES`) já são valores atuais, então é a renda que precisa
 * subir, não os cortes descer. O dado bruto no tile nunca é alterado, só o cálculo da cor.
 */
function fillColorExpression(campo: RendaCampo, fator: number): maplibregl.ExpressionSpecification {
  const prop = rendaPropFor(campo);
  const [primeira, ...resto] = ABEP_CLASSES;
  const stops = resto.flatMap(({ min, cor }) => [min as number, cor]);
  return [
    "case",
    ["!", ["has", prop]],
    SEM_DADOS_COR,
    ["step", ["*", ["to-number", ["get", prop], 0], fator], primeira.cor, ...stops],
  ] as maplibregl.ExpressionSpecification;
}

function filtroDestaque(setores: string[]): maplibregl.FilterSpecification {
  return setores.length === 0
    ? ["==", ["get", PROP_CD_SETOR], "__none__"]
    : ["in", ["get", PROP_CD_SETOR], ["literal", setores]];
}

export function MapView({
  rendaCampo,
  onSelectSetor,
  flyTarget,
  camadaVisivel,
  rendaOpacidade,
  setoresSelecionados,
  pontos,
  pois,
  fitTarget,
  vistaInicial,
  onPontoClick,
  pontoAtivo = null,
  permitirSelecao = true,
  mostrarLegenda = true,
  gestosCooperativos = false,
  fatorCorrecao = 1,
}: MapViewProps) {
  // Só pro texto da fonte na legenda; o fator em si continua vindo por prop (fatorCorrecao).
  const { mesReferencia } = useFatorCorrecao();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const carregadoRef = useRef(false);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const desenharMarkersRef = useRef<() => void>(() => {});
  const atualizarPoisRef = useRef<(lista: Poi[]) => void>(() => {});

  const onSelectSetorRef = useRef(onSelectSetor);
  const onPontoClickRef = useRef(onPontoClick);
  const pontosRef = useRef(pontos);
  const pontoAtivoRef = useRef(pontoAtivo);
  const setoresRef = useRef(setoresSelecionados);
  const poisRef = useRef<Poi[]>(pois ?? []);
  const fitPendenteRef = useRef<FitTarget | null>(null);
  // O estilo do Mapbox é buscado por fetch antes da camada de fill existir — se o fator de
  // correção chegar antes disso, o efeito abaixo mediria a camada como inexistente e desistiria
  // pra sempre (o fator só muda uma vez). Por isso a cor inicial lê a ref, não o parâmetro do
  // momento do mount: não importa quem termina primeiro, a camada nasce com o valor mais atual.
  const rendaCampoRef = useRef(rendaCampo);
  const fatorCorrecaoRef = useRef(fatorCorrecao);

  useEffect(() => {
    onSelectSetorRef.current = onSelectSetor;
  }, [onSelectSetor]);

  // O clique sempre lê o callback mais recente pelo ref — trocar só a identidade da função
  // não precisa redesenhar os marcadores; só mudar se eles são clicáveis ou não.
  const marcadoresClicaveis = Boolean(onPontoClick);
  useEffect(() => {
    onPontoClickRef.current = onPontoClick;
  }, [onPontoClick]);

  useEffect(() => {
    pontosRef.current = pontos;
    pontoAtivoRef.current = pontoAtivo;
    desenharMarkersRef.current();
  }, [pontos, pontoAtivo, marcadoresClicaveis]);

  useEffect(() => {
    poisRef.current = pois ?? [];
    atualizarPoisRef.current(poisRef.current);
  }, [pois]);

  useEffect(() => {
    if (!containerRef.current) return;

    configurarMapLibreGlobalmente();

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

      const vista: Partial<maplibregl.MapOptions> =
        vistaInicial?.tipo === "bounds"
          ? { bounds: vistaInicial.bounds, fitBoundsOptions: { padding: PADDING_ENQUADRAMENTO, maxZoom: 15 } }
          : vistaInicial?.tipo === "brasil"
            ? { center: VISAO_BRASIL.center, zoom: VISAO_BRASIL.zoom }
            : { center: MAPA_CENTER, zoom: MAPA_ZOOM };

      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        transformRequest,
        ...vista,
        ...(gestosCooperativos && {
          cooperativeGestures: true,
          locale: {
            "CooperativeGesturesHandler.WindowsHelpText": "Use Ctrl + rolagem para dar zoom no mapa",
            "CooperativeGesturesHandler.MacHelpText": "Use ⌘ + rolagem para dar zoom no mapa",
            "CooperativeGesturesHandler.MobileHelpText": "Use dois dedos para mover o mapa",
          },
        }),
      });
      mapRef.current = map;

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      // Cursor padrão do MapLibre é a mãozinha aberta (grab) parado — aqui é o contrário do
      // Google Maps de propósito: pointer parado (mapa "sem fazer nada"), mãozinha fechada
      // (grabbing) só enquanto o usuário está realmente arrastando/navegando.
      map.getCanvas().style.cursor = "pointer";
      map.on("dragstart", () => {
        map!.getCanvas().style.cursor = "grabbing";
      });
      map.on("dragend", () => {
        map!.getCanvas().style.cursor = "pointer";
      });

      map.on("load", () => {
        void carregarLayers();
      });

      async function carregarLayers() {
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
              "fill-color": fillColorExpression(rendaCampoRef.current, fatorCorrecaoRef.current),
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
            filter: filtroDestaque(setoresRef.current),
          },
          firstTextLabelId
        );

        // O carregamento dos ícones é assíncrono: se o mapa foi removido enquanto isso
        // (ex: modal fechado logo após abrir), adicionar a camada falha — nada a fazer.
        try {
          atualizarPoisRef.current = await adicionarCamadasPoi(map, {
            antesDeSimbolo: firstSymbolId,
            antesDeTexto: firstTextLabelId,
          });
        } catch {
          return;
        }
        if (cancelled) return;
        atualizarPoisRef.current(poisRef.current);

        // Marcadores numerados dos pontos selecionados (N <= 10, então DOM markers bastam).
        desenharMarkersRef.current = () => {
          const atual = mapRef.current;
          if (!atual) return;
          markersRef.current.forEach((marker) => marker.remove());
          markersRef.current = pontosRef.current.map((ponto) => {
            const ativo = pontoAtivoRef.current === ponto.numero;
            const el = document.createElement("div");
            el.className = classeBadgePonto(ativo);
            el.textContent = String(ponto.numero);
            if (onPontoClickRef.current) {
              el.classList.add("cursor-pointer");
              el.addEventListener("click", (evento) => {
                evento.stopPropagation();
                onPontoClickRef.current?.(ponto.numero);
              });
            }
            return new maplibregl.Marker({ element: el })
              .setLngLat([ponto.localizacao.lng, ponto.localizacao.lat])
              .addTo(atual);
          });
        };
        desenharMarkersRef.current();

        if (permitirSelecao) {
          map.on("click", FILL_LAYER_ID, (e: MapLayerMouseEvent) => {
            const feature = e.features?.[0];
            const cdSetorRaw = feature?.properties?.[PROP_CD_SETOR];
            if (cdSetorRaw === undefined || cdSetorRaw === null) return;
            const cdSetor = String(cdSetorRaw);

            const { lng, lat } = e.lngLat;
            onSelectSetorRef.current(cdSetor, { lng, lat });
          });

          // Sem cursor "pointer" no hover do setor: como os setores cobrem quase toda a área
          // visível, isso sobrescrevia o grab/grabbing nativo do MapLibre (a mãozinha do
          // Google Maps) o mapa inteiro, quase sempre. Deixa o padrão do próprio mapa agir.
        }

        carregadoRef.current = true;
        const pendente = fitPendenteRef.current;
        if (pendente) {
          fitPendenteRef.current = null;
          map.fitBounds(pendente.bounds, { padding: PADDING_ENQUADRAMENTO, maxZoom: 16, duration: 700 });
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      carregadoRef.current = false;
      markersRef.current = [];
      desenharMarkersRef.current = () => {};
      atualizarPoisRef.current = () => {};
    };
    // Efeito de montagem única: rendaCampo/rendaOpacidade/vistaInicial iniciais são lidos apenas
    // na criação do mapa; atualizações posteriores são tratadas pelos efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendaCampoRef.current = rendaCampo;
    fatorCorrecaoRef.current = fatorCorrecao;
    const map = mapRef.current;
    if (!map || !map.getLayer(FILL_LAYER_ID)) return;
    map.setPaintProperty(FILL_LAYER_ID, "fill-color", fillColorExpression(rendaCampo, fatorCorrecao));
  }, [rendaCampo, fatorCorrecao]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(FILL_LAYER_ID)) return;
    map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", rendaOpacidade);
  }, [rendaOpacidade]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;

    // Zoom fixo deixava setor pequeno "longe" e setor grande estourando o enquadramento.
    // cameraForBounds calcula o zoom certo pro tamanho real do setor (raio vindo da área);
    // o clamp garante que nunca fica pior que o zoom fixo de antes (piso) nem passa do zoom
    // máximo dos tiles (teto) pra setor minúsculo.
    let zoom = ZOOM_FLY_MIN;
    if (flyTarget.bounds) {
      const camera = map.cameraForBounds(flyTarget.bounds, { padding: PADDING_ENQUADRAMENTO });
      if (camera?.zoom !== undefined) {
        zoom = Math.min(ZOOM_FLY_MAX, Math.max(camera.zoom, ZOOM_FLY_MIN));
      }
    }
    map.flyTo({ center: [flyTarget.lng, flyTarget.lat], zoom, essential: true });
  }, [flyTarget]);

  useEffect(() => {
    if (!fitTarget) return;
    const map = mapRef.current;
    if (!map || !carregadoRef.current) {
      fitPendenteRef.current = fitTarget;
      return;
    }
    map.fitBounds(fitTarget.bounds, { padding: PADDING_ENQUADRAMENTO, maxZoom: 16, duration: 700 });
  }, [fitTarget]);

  useEffect(() => {
    setoresRef.current = setoresSelecionados;
    const map = mapRef.current;
    if (!map || !map.getLayer(HIGHLIGHT_LAYER_ID)) return;
    map.setFilter(HIGHLIGHT_LAYER_ID, filtroDestaque(setoresSelecionados));
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

      {mostrarLegenda && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-border bg-background/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
          <div className="mb-1.5 flex items-center gap-1 font-medium">
            Classe econômica · renda {rendaCampo === "rendaMedia" ? "média" : "mediana"} do responsável
            {/* Popover (clique/toque), não Tooltip (hover): num tablet não existe hover, então
                um tooltip hover-only nunca abre no toque — popover abre com o mesmo gesto de
                clique em qualquer dispositivo. */}
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="pointer-events-auto size-4 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  />
                }
              >
                <AlertCircle className="size-3.5" />
                <span className="sr-only">Ver recortes de renda por classe</span>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-60 gap-1 p-3">
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
                      <span className="text-muted-foreground">{faixaRendaTooltip(index)}</span>
                    </div>
                  );
                })}
              </PopoverContent>
            </Popover>
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
            Fonte: IBGE ({fonteRenda(mesReferencia)}) e metodologia proprietária auditável
          </div>
        </div>
      )}
    </div>
  );
}
