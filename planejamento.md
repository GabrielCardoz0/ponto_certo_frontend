Planejamento — Frontend (Vite + shadcn)
18 de set. de 2026
Documento de planejamento técnico do frontend, para o Claude Code implementar os componentes que consomem a API do backend (Node/Express/Prisma, projeto Ponto Certo).
Stack e setup
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install

npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npx shadcn@latest init

npm install maplibre-gl pmtiles
• Vite + React + TypeScript: base do projeto.
• shadcn/ui: componentes de UI (botões, dropdown, input de busca).
• MapLibre GL JS + PMTiles: renderiza o mapa a partir do setores_br.pmtiles (arquivo estático, servido separado da API — não passa pelo Express).
CORS: a API (Express, porta 3000) precisa liberar http://localhost:5173 (porta padrão do Vite) via cors() — sem isso as chamadas do front são bloqueadas pelo navegador. Confirmar que isso já está configurado no backend antes de testar a integração.
Variável de ambiente e cliente HTTP
frontend/.env (não vai pro Git) e frontend/.env.example (vai pro Git, mesmo conteúdo):
VITE_API_URL=http://localhost:3000
src/lib/api.ts:
const API_URL = import.meta.env.VITE_API_URL;

export interface Setor {
  cdSetor: string;
  nmMunicipio: string;
  uf: string;
  regiao: string;
  situacao: string | null;
  areaKm2: number;
  populacao: number | null;
  rendaMedia: number | null;
  rendaMediana: number | null;
  densidadeHabKm2: number | null;
  tamanhoMedioFamilia: number | null;
  desvioPadraoRenda: number | null;
  coefVariacaoRenda: number | null;
}

export interface Poi {
  id: number;
  categoria: string;
  subcategoria: string;
  nome: string;
  fonte: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Erro na API: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function buscarSetores(query: string) {
  return apiFetch<Setor[]>(`/setores/busca?q=${encodeURIComponent(query)}`);
}

export function getSetor(cdSetor: string) {
  return apiFetch<Setor>(`/setores/${cdSetor}`);
}

export function getPois(cdSetor: string, raio: number, categoria?: string) {
  const params = new URLSearchParams({ raio: String(raio) });
  if (categoria) params.set('categoria', categoria);
  return apiFetch<Poi[]>(`/setores/${cdSetor}/pois?${params}`);
}

export function getRelatorio(cdSetor: string, raio: number) {
  return apiFetch<unknown>(`/setores/${cdSetor}/relatorio?raio=${raio}`);
}

export function compararSetores(a: string, b: string) {
  return apiFetch<unknown>(`/setores/comparar?a=${a}&b=${b}`);
}

export function getSimilares(cdSetor: string, limit = 10, raioExclusaoKm = 50) {
  return apiFetch<Setor[]>(
    `/setores/${cdSetor}/similares?limit=${limit}&raioExclusaoKm=${raioExclusaoKm}`
  );
}
Atenção: getRelatorio e compararSetores estão tipados como unknown de propósito — o formato exato de retorno desses dois endpoints ainda não foi inspecionado (ver seção de Pendências). O Claude Code deve rodar esses dois endpoints contra um cdSetor real e ajustar as interfaces antes de usar os dados no DetailPanel.
Estrutura de pastas
frontend/src/
├── components/
│   ├── ui/              # componentes do shadcn (gerados automaticamente)
│   ├── Map.tsx           # mapa MapLibre + PMTiles
│   ├── TopBar.tsx        # busca + avatar
│   ├── SidebarIcons.tsx  # coluna estreita de ícones (filtros, camadas, comparar, relatório)
│   └── DetailPanel.tsx   # painel de 1 ponto / comparação / relatório
├── lib/
│   └── api.ts             # cliente HTTP centralizado (ver seção anterior)
├── types/
│   └── setor.ts            # tipos TS compartilhados (ou reexportados de lib/api.ts)
├── App.tsx
└── main.tsx
Componentes
Map.tsx
• Ocupa 100% do fundo da tela (mapa é a página, não um elemento dela).
• Registra o protocolo pmtiles:// (via new pmtiles.Protocol()), fonte vetorial apontando pro setores_br.pmtiles, camada fill com choropleth por faixa de renda_media (usar case/interpolate do MapLibre).
• Centro/zoom inicial: Brasil inteiro ([-51.9253, -14.2350], zoom 4).
• Ao clicar num polígono: extrai cd_setor da feature clicada, dispara getSetor(cdSetor) via lib/api.ts, e comunica a seleção pro componente pai (via prop/callback ou estado global) para atualizar o DetailPanel.
• Legenda do choropleth e atribuição de fonte ("Fonte: IBGE, Censo 2022") sempre visíveis no canto inferior.
TopBar.tsx
• Fixa no topo, altura fina.
• Logo/nome do produto ("Ponto Certo") à esquerda.
• Campo de busca centralizado/ao lado do logo, chama buscarSetores(query); ao selecionar um resultado, mesmo fluxo de seleção do Map.tsx (atualiza o DetailPanel, centraliza o mapa no setor).
• Avatar do usuário à direita com dropdown (perfil/configurações/logout) — pode ser placeholder estático no MVP, sem autenticação real ainda.
SidebarIcons.tsx
• Coluna estreita à esquerda, ícones apenas (expande ao clicar).
• Ícones do MVP: filtros (toggle renda média/mediana), camadas, comparar, relatório.
• Deliberadamente minimalista — mantém o mapa como protagonista; cada ícone abre um painel/modal próprio ao ser clicado, não ocupa espaço fixo permanente.
DetailPanel.tsx
Painel de contexto à direita, com três estados:
1. Vazio (nada selecionado): oculto ou mensagem tipo "Clique em um ponto do mapa para ver detalhes" — dá mais espaço ao mapa.
2. 1 ponto selecionado: mostra dados do setor (renda média/mediana, densidade, população etc., via getSetor), botão "Gerar relatório" sempre visível (chama getRelatorio), e botão "Comparar com outro ponto" que leva ao estado 3.
3. 2 pontos selecionados (comparação): os dois setores lado a lado (via compararSetores), com um "×" para remover o Ponto B e voltar ao estado 2. Botão de relatório nesse estado gera o comparativo dos dois.
O relatório é sempre uma ação disponível a partir de 1 ponto selecionado — não é exclusivo do modo comparação (decisão já validada com o Gabriel).
Pendências e avisos antes de implementar
• Formato de /setores/:cdSetor/relatorio e /setores/comparar ainda não inspecionado. Antes de tipar o DetailPanel, rodar os dois endpoints contra um cdSetor real (ex: via curl ou Thunder Client) e ajustar as interfaces em lib/api.ts (hoje como unknown).
• CORS: confirmar que o Express libera http://localhost:5173 antes de testar qualquer chamada do front — sem isso, toda requisição falha silenciosamente no navegador (erro só aparece no console, não na resposta).
• setores_br.pmtiles deve estar acessível pelo Vite dev server (ex: pasta public/ do frontend, ou servido por um servidor estático à parte) — não é servido pela API Express.
• Autenticação ainda não existe — o avatar/dropdown do TopBar é placeholder visual no MVP, sem lógica de login real.