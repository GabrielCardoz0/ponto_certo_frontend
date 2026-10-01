// O worker do MapLibre (maplibre-gl-worker.mjs) importa maplibre-gl-shared.mjs por um caminho
// relativo (`./maplibre-gl-shared.mjs`) — os dois precisam ficar lado a lado, com esses nomes
// exatos, em algum lugar servido pela própria aplicação. Nem `?url` do Vite nem o jeito padrão
// de importar um worker resolvem isso (ver comentário em src/components/Map.tsx), porque o
// Rollup nunca enxerga esse import de dentro de um arquivo copiado como asset opaco.
//
// Em vez de depender de bundling, copiamos os dois arquivos do jeito que o maplibre-gl publica
// (sem reescrever nada) pra public/maplibre/ — o Vite serve esse diretório do jeito que está,
// sem hash e sem transformação, idêntico em dev e build. Roda automático no `npm install`
// (postinstall) pra nunca ficar dessincronizado da versão instalada da lib.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raizProjeto = dirname(dirname(fileURLToPath(import.meta.url)));
const origem = join(raizProjeto, "node_modules/maplibre-gl/dist");
const destino = join(raizProjeto, "public/maplibre");

mkdirSync(destino, { recursive: true });
for (const arquivo of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(origem, arquivo), join(destino, arquivo));
}

console.log("maplibre-gl: worker + shared copiados para public/maplibre/");
