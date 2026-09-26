import * as maplibregl from "maplibre-gl";
import type { MapLayerMouseEvent } from "maplibre-gl";
import type { Poi } from "@/lib/api";
import {
  COR_POR_CATEGORIA,
  POI_COR_PADRAO,
  nomeExibicao,
  rotuloCategoria,
  rotuloSubcategoria,
} from "@/utils/nomePoi";

/**
 * Camadas de POI do mapa: ícone por subcategoria, cor por categoria, contorno (shape) quando
 * existir, tooltip leve no hover e popup completo no clique. Não busca dado nenhum — quem
 * chama passa a lista de POIs (hoje: os POIs do raio do ponto ativo no modal de comparação).
 */

const POI_SOURCE_ID = "pois";
const POI_LAYER_ID = "pois-icones";
const POI_SHAPES_SOURCE_ID = "pois-shapes";
const POI_SHAPE_FILL_LAYER_ID = "pois-shape-fill";
const POI_SHAPE_OUTLINE_LAYER_ID = "pois-shape-outline";

type IconePoiTipo = "bus" | "trem" | "parque";

/** Subcategoria → tipo de ícone. Ajustar aqui quando novas subcategorias entrarem. */
const SUBCATEGORIA_ICONE: Record<string, IconePoiTipo> = {
  ponto_onibus: "bus",
  estacao_onibus: "bus",
  estacao_metro: "trem",
  estacao_trem_urbano: "trem",
  parque: "parque",
  jardim: "parque",
  reserva_natural: "parque",
};

/**
 * Cor por SUBcategoria, não por categoria — metrô e trem são "transporte" junto com
 * ônibus, mas precisam de cor própria pra não ficar tudo azul igual.
 */
const COR_POR_SUBCATEGORIA: Record<string, string> = {
  ponto_onibus: COR_POR_CATEGORIA.transporte,
  estacao_onibus: COR_POR_CATEGORIA.transporte,
  estacao_metro: "#C62828",
  estacao_trem_urbano: "#00838F",
  parque: COR_POR_CATEGORIA.lazer,
  jardim: COR_POR_CATEGORIA.lazer,
  reserva_natural: COR_POR_CATEGORIA.lazer,
};

const ICONE_PADRAO_ID = "icon-generico";

function glifoIconePoi(tipo: IconePoiTipo, cor: string): string {
  switch (tipo) {
    case "bus":
      return `
        <rect x="9" y="10" width="10" height="7" rx="1.5" fill="#fff"/>
        <rect x="10.5" y="11.3" width="3" height="2" rx="0.4" fill="${cor}"/>
        <rect x="14.5" y="11.3" width="3" height="2" rx="0.4" fill="${cor}"/>
        <circle cx="11" cy="17.5" r="1.2" fill="#fff"/>
        <circle cx="17" cy="17.5" r="1.2" fill="#fff"/>
      `;
    case "trem":
      return `
        <rect x="9" y="9" width="10" height="9" rx="3" fill="#fff"/>
        <rect x="10.5" y="11" width="7" height="3" rx="0.6" fill="${cor}"/>
        <circle cx="11" cy="18.3" r="1.2" fill="#fff"/>
        <circle cx="17" cy="18.3" r="1.2" fill="#fff"/>
      `;
    case "parque":
      return `
        <circle cx="14" cy="11.5" r="4.5" fill="#fff"/>
        <rect x="13.1" y="15.5" width="1.8" height="4.5" fill="#fff"/>
      `;
  }
}

/** Selo circular colorido com o glifo branco da subcategoria dentro. */
function svgIconePoi(tipo: IconePoiTipo, cor: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="${cor}" stroke="#ffffff" stroke-width="2"/>
    ${glifoIconePoi(tipo, cor)}
  </svg>`;
}

/** Fallback pra subcategoria sem ícone específico mapeado: bolinha cinza sem glifo. */
function svgIconeGenerico(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" fill="${POI_COR_PADRAO}" stroke="#ffffff" stroke-width="2"/>
  </svg>`;
}

function corPorCategoriaExpression(): maplibregl.ExpressionSpecification {
  const stops = Object.entries(COR_POR_CATEGORIA).flatMap(([categoria, cor]) => [categoria, cor]);
  return ["match", ["get", "categoria"], ...stops, POI_COR_PADRAO] as maplibregl.ExpressionSpecification;
}

function iconePorSubcategoriaExpression(): maplibregl.ExpressionSpecification {
  const pares = Object.keys(SUBCATEGORIA_ICONE).flatMap((sub) => [sub, `icon-${sub}`]);
  return ["match", ["get", "subcategoria"], ...pares, ICONE_PADRAO_ID] as maplibregl.ExpressionSpecification;
}

/** Carrega um SVG como imagem registrada no estilo do mapa, pra usar em icon-image. */
function carregarImagemSvg(map: maplibregl.Map, id: string, svg: string): Promise<void> {
  return new Promise((resolve) => {
    if (map.hasImage(id)) {
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (!map.hasImage(id)) map.addImage(id, img);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

async function carregarIcones(map: maplibregl.Map): Promise<void> {
  const porSubcategoria = Object.entries(SUBCATEGORIA_ICONE).map(([sub, tipo]) =>
    carregarImagemSvg(map, `icon-${sub}`, svgIconePoi(tipo, COR_POR_SUBCATEGORIA[sub] ?? POI_COR_PADRAO))
  );
  await Promise.all([...porSubcategoria, carregarImagemSvg(map, ICONE_PADRAO_ID, svgIconeGenerico())]);
}

// ── Popups (DOM próprio com as classes Tailwind do app: seguem o tema claro/escuro) ──────────

type LadoAncoraPopup =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

const LADOS_ANCORA_POPUP: LadoAncoraPopup[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "top",
  "bottom",
  "left",
  "right",
];

function ladoAncoraDoPopup(raiz: HTMLElement): LadoAncoraPopup {
  return LADOS_ANCORA_POPUP.find((lado) => raiz.classList.contains(`maplibregl-popup-anchor-${lado}`)) ?? "bottom";
}

/** Pequeno losango que funciona como a "ponta" do popup, posicionado conforme o lado de âncora. */
function criarPontaPopup(cor: string, lado: LadoAncoraPopup): HTMLElement {
  const ponta = document.createElement("div");
  ponta.style.position = "absolute";
  ponta.style.width = "10px";
  ponta.style.height = "10px";
  ponta.style.background = cor;
  ponta.style.transform = "rotate(45deg)";

  const centro = "calc(50% - 5px)";
  const proximoCanto = "12px";

  if (lado.startsWith("bottom")) ponta.style.bottom = "-5px";
  else if (lado.startsWith("top")) ponta.style.top = "-5px";
  else if (lado === "left") ponta.style.left = "-5px";
  else if (lado === "right") ponta.style.right = "-5px";

  if (lado === "top" || lado === "bottom") ponta.style.left = centro;
  else if (lado === "left" || lado === "right") ponta.style.top = centro;
  else if (lado.endsWith("left")) ponta.style.left = proximoCanto;
  else if (lado.endsWith("right")) ponta.style.right = proximoCanto;

  return ponta;
}

function criarBotaoFecharPopup(aoFechar: () => void): HTMLElement {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.setAttribute("aria-label", "Fechar");
  botao.className =
    "absolute right-1.5 top-1.5 flex size-5 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100";
  botao.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  botao.addEventListener("click", (evento) => {
    evento.stopPropagation();
    aoFechar();
  });
  return botao;
}

/**
 * O `.maplibregl-popup-content`/`.maplibregl-popup-tip` do MapLibre vêm com estilo fixo no CSS
 * da própria lib, frágil de sobrescrever por seletor global. Em vez disso: zeramos o wrapper e
 * escondemos a ponta/botão nativos, e desenhamos os dois como parte do nosso próprio elemento
 * (`el`, já com as classes Tailwind do app) — cor lida do computed style real do elemento.
 */
function finalizarPopupPoi(popup: maplibregl.Popup, el: HTMLElement, aoFechar?: () => void) {
  const raiz = popup.getElement();
  if (!raiz) return;

  const content = raiz.querySelector<HTMLElement>(".maplibregl-popup-content");
  if (content) {
    content.style.background = "transparent";
    content.style.boxShadow = "none";
    content.style.padding = "0";
    content.style.border = "none";
  }

  const tipNativo = raiz.querySelector<HTMLElement>(".maplibregl-popup-tip");
  if (tipNativo) tipNativo.style.display = "none";

  el.classList.add("relative");
  el.appendChild(criarPontaPopup(getComputedStyle(el).backgroundColor, ladoAncoraDoPopup(raiz)));

  if (aoFechar) el.appendChild(criarBotaoFecharPopup(aoFechar));
}

function nomeESubcategoriaDoPoi(props: Record<string, unknown>) {
  const subcategoria = String(props.subcategoria ?? "");
  const nome = nomeExibicao({
    nome: typeof props.nome === "string" ? props.nome : null,
    subcategoria,
  });
  return { nome, subcategoria: rotuloSubcategoria(subcategoria) };
}

/** Tooltip leve de hover: só nome e subcategoria — relance rápido. */
function elementoPopupHoverPoi(props: Record<string, unknown>): HTMLElement {
  const { nome, subcategoria } = nomeESubcategoriaDoPoi(props);

  const el = document.createElement("div");
  el.className = "rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md";

  const nomeEl = document.createElement("div");
  nomeEl.className = "font-semibold";
  nomeEl.textContent = nome;

  const subEl = document.createElement("div");
  subEl.className = "text-muted-foreground";
  subEl.textContent = subcategoria;

  el.append(nomeEl, subEl);
  return el;
}

/** Popup completo de clique: nome, categoria/subcategoria, coordenada e fonte (sutil). */
function elementoPopupCliquePoi(props: Record<string, unknown>, lng: number, lat: number): HTMLElement {
  const { nome, subcategoria } = nomeESubcategoriaDoPoi(props);
  const categoria = rotuloCategoria(String(props.categoria ?? ""));

  const el = document.createElement("div");
  el.className =
    "min-w-40 rounded-md border border-border bg-popover py-2 pr-7 pl-3 text-xs text-popover-foreground shadow-md";

  const nomeEl = document.createElement("div");
  nomeEl.className = "mb-0.5 font-semibold";
  nomeEl.textContent = nome;

  const categoriaEl = document.createElement("div");
  categoriaEl.className = "text-muted-foreground";
  categoriaEl.textContent = `${categoria} · ${subcategoria}`;

  const coordEl = document.createElement("div");
  coordEl.className = "text-muted-foreground tabular-nums";
  coordEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  const fonteEl = document.createElement("div");
  fonteEl.className = "mt-1 text-[11px] text-muted-foreground/70";
  fonteEl.textContent = `Fonte: ${String(props.fonte ?? "")}`;

  el.append(nomeEl, categoriaEl, coordEl, fonteEl);
  return el;
}

// ── Camadas ──────────────────────────────────────────────────────────────────────────────────

export interface PosicionamentoCamadasPoi {
  /** Contornos (shape) entram abaixo do primeiro símbolo do basemap, junto do choropleth. */
  antesDeSimbolo?: string;
  /** Ícones entram abaixo do primeiro rótulo de texto, acima das ruas. */
  antesDeTexto?: string;
}

/**
 * Adiciona fontes/camadas de POI e liga hover/clique. Devolve a função que troca os POIs
 * exibidos (lista vazia = camada limpa).
 */
export async function adicionarCamadasPoi(
  map: maplibregl.Map,
  posicionamento: PosicionamentoCamadasPoi
): Promise<(pois: Poi[]) => void> {
  map.addSource(POI_SHAPES_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer(
    {
      id: POI_SHAPE_FILL_LAYER_ID,
      type: "fill",
      source: POI_SHAPES_SOURCE_ID,
      paint: { "fill-color": corPorCategoriaExpression(), "fill-opacity": 0.2 },
    },
    posicionamento.antesDeSimbolo
  );
  map.addLayer(
    {
      id: POI_SHAPE_OUTLINE_LAYER_ID,
      type: "line",
      source: POI_SHAPES_SOURCE_ID,
      paint: { "line-color": corPorCategoriaExpression(), "line-width": 1.5 },
    },
    posicionamento.antesDeSimbolo
  );

  map.addSource(POI_SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  await carregarIcones(map);
  map.addLayer(
    {
      id: POI_LAYER_ID,
      type: "symbol",
      source: POI_SOURCE_ID,
      layout: {
        "icon-image": iconePorSubcategoriaExpression(),
        "icon-size": 0.9,
        // Sem decluttering: todo POI aparece mesmo sobrepondo outro.
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    },
    posicionamento.antesDeTexto
  );

  let popupClique: maplibregl.Popup | null = null;
  let popupHover: maplibregl.Popup | null = null;

  map.on("click", POI_LAYER_ID, (e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature?.properties) return;
    popupHover?.remove();
    popupHover = null;
    popupClique?.remove();

    const el = elementoPopupCliquePoi(feature.properties, e.lngLat.lng, e.lngLat.lat);
    popupClique = new maplibregl.Popup({ closeButton: false, maxWidth: "240px" })
      .setLngLat(e.lngLat)
      .setDOMContent(el)
      .addTo(map);
    popupClique.on("close", () => {
      popupClique = null;
    });
    finalizarPopupPoi(popupClique, el, () => popupClique?.remove());
  });

  map.on("mouseenter", POI_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mousemove", POI_LAYER_ID, (e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    // Nunca mostra o hover em cima do popup de clique — evita os dois empilhados.
    if (!feature?.properties || popupClique?.isOpen()) return;
    popupHover?.remove();
    const el = elementoPopupHoverPoi(feature.properties);
    popupHover = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
      .setLngLat(e.lngLat)
      .setDOMContent(el)
      .addTo(map);
    finalizarPopupPoi(popupHover, el);
  });
  map.on("mouseleave", POI_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
    popupHover?.remove();
    popupHover = null;
  });

  return (pois: Poi[]) => {
    popupHover?.remove();
    popupHover = null;
    popupClique?.remove();

    const pontos = map.getSource(POI_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    const shapes = map.getSource(POI_SHAPES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    pontos?.setData({
      type: "FeatureCollection",
      features: pois.map((poi) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [poi.localizacao.lng, poi.localizacao.lat] },
        properties: {
          categoria: poi.categoria,
          subcategoria: poi.subcategoria,
          nome: poi.nome,
          fonte: poi.fonte,
        },
      })),
    });
    shapes?.setData({
      type: "FeatureCollection",
      features: pois
        .filter((poi) => poi.shape !== null)
        .map((poi) => ({
          type: "Feature",
          geometry: poi.shape!,
          properties: { categoria: poi.categoria },
        })),
    });
  };
}
