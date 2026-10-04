import { useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, MapPin, X } from "lucide-react";
import { MapView, type FlyTarget, type RendaCampo } from "@/components/Map";
import { TopBar } from "@/components/TopBar";
import { SidebarIcons } from "@/components/SidebarIcons";
import { DetailPanel } from "@/components/DetailPanel";
import { AdminArea } from "@/components/AdminArea";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSetor } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useFatorCorrecao } from "@/lib/correcaoMonetaria";
import { boundsDoRaio, raioDoSetor } from "@/lib/geo";
import type { Localizacao, PontoSelecionado, Setor, SetorResumo } from "@/types/setor";

/** Máximo de pontos numa comparação (NBR 14653-2: amostra de 3 a 10, idealmente 6). */
const MAX_PONTOS = 10;

function rotuloPadrao(setor: Setor) {
  // Sem o código do setor no título: pouco útil pro corretor (ele aparece como detalhe miúdo).
  return `Ponto no mapa · ${setor.nmMunicipio}`;
}

export function App() {
  const { usuario } = useAuth();
  const [area, setArea] = useState<"mapa" | "admin">("mapa");
  const [pontos, setPontos] = useState<PontoSelecionado[]>([]);
  const [modoAdicionar, setModoAdicionar] = useState(false);
  const [carregando, setCarregando] = useState(false);
  // Falha ao carregar um setor clicado/buscado: antes era engolida em silêncio (o clique
  // simplesmente "não fazia nada"). Some sozinha depois de alguns segundos.
  const [erroPonto, setErroPonto] = useState<string | null>(null);
  useEffect(() => {
    if (!erroPonto) return;
    const timer = setTimeout(() => setErroPonto(null), 6000);
    return () => clearTimeout(timer);
  }, [erroPonto]);

  const [rendaCampo, setRendaCampo] = useState<RendaCampo>("rendaMedia");
  const [camadaVisivel, setCamadaVisivel] = useState(true);
  const [rendaOpacidade, setRendaOpacidade] = useState(0.45);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const fatorCorrecao = useFatorCorrecao();

  const flyNonce = useRef(0);

  // Clicar no mapa sempre seleciona: com pontos e sem "Adicionar região" ativo,
  // o clique troca o último ponto; em modo adicionar (ou lista vazia), acrescenta.
  const substituindo = pontos.length > 0 && !modoAdicionar;

  async function adicionarPonto(
    cdSetor: string,
    localizacao: Localizacao,
    rotulo: string | undefined,
    voar: boolean,
    substituir = false
  ) {
    if (!substituir && pontos.length >= MAX_PONTOS) return;
    if (pontos.some((p) => p.setor.cdSetor === cdSetor)) {
      setModoAdicionar(false);
      return;
    }

    setCarregando(true);
    setErroPonto(null);
    try {
      const setor = await getSetor(cdSetor);
      const novo = { setor, rotulo: rotulo ?? rotuloPadrao(setor), localizacao };
      setPontos((atual) =>
        substituir && atual.length > 0
          ? [...atual.slice(0, -1), novo]
          : atual.length >= MAX_PONTOS || atual.some((p) => p.setor.cdSetor === setor.cdSetor)
          ? atual
          : [...atual, novo]
      );
      setModoAdicionar(false);
      if (voar) {
        flyNonce.current += 1;
        setFlyTarget({
          ...localizacao,
          bounds: boundsDoRaio(localizacao, raioDoSetor(setor.areaKm2)),
          nonce: flyNonce.current,
        });
      }
    } catch {
      // Mantém a seleção anterior, mas avisa — o usuário precisa saber que o clique não pegou.
      setErroPonto("Não foi possível carregar essa região agora. Tente clicar de novo.");
    } finally {
      setCarregando(false);
    }
  }

  function handleSelectFromMap(cdSetor: string, localizacao: Localizacao) {
    void adicionarPonto(cdSetor, localizacao, undefined, true, substituindo);
  }

  function handleSelectFromSearch(setor: SetorResumo, rotulo: string) {
    void adicionarPonto(setor.cdSetor, setor.localizacao, rotulo, true);
  }

  function handleRemover(cdSetor: string) {
    setPontos((atual) => atual.filter((p) => p.setor.cdSetor !== cdSetor));
    setModoAdicionar(false);
  }

  function handleLimpar() {
    setPontos([]);
    setModoAdicionar(false);
  }

  const podeAdicionar = pontos.length > 0 && pontos.length < MAX_PONTOS && !modoAdicionar;
  const motivoNaoPodeAdicionar =
    pontos.length === 0
      ? "Selecione um setor no mapa primeiro"
      : pontos.length >= MAX_PONTOS
        ? `Máximo de ${MAX_PONTOS} pontos`
        : "Escolha a região no mapa";

  const setoresSelecionados = pontos.map((p) => p.setor.cdSetor);
  const pontosNoMapa = useMemo(
    () => pontos.map((p, i) => ({ cdSetor: p.setor.cdSetor, numero: i + 1, localizacao: p.localizacao })),
    [pontos]
  );

  // Guarda no client além do 403 do backend: se o papel não for admin (ex: trocado no
  // meio da sessão), nunca fica preso na área administrativa.
  if (area === "admin" && usuario?.role === "admin") {
    return <AdminArea onVoltar={() => setArea("mapa")} />;
  }

  return (
    <div className="flex h-svh w-screen flex-col overflow-hidden">
      <TopBar
        onSelectResultado={handleSelectFromSearch}
        onAbrirAdmin={() => setArea("admin")}
        proximidade={pontos.at(-1)?.localizacao}
      />
      <div className="flex min-h-0 flex-1">
        <SidebarIcons
          rendaCampo={rendaCampo}
          onChangeRendaCampo={setRendaCampo}
          camadaVisivel={camadaVisivel}
          onToggleCamada={() => setCamadaVisivel((v) => !v)}
          rendaOpacidade={rendaOpacidade}
          onChangeRendaOpacidade={setRendaOpacidade}
          podeAdicionar={podeAdicionar}
          motivoNaoPodeAdicionar={motivoNaoPodeAdicionar}
          onAdicionarRegiao={() => setModoAdicionar(true)}
        />
        <main className="relative min-w-0 flex-1">
          <MapView
            rendaCampo={rendaCampo}
            onSelectSetor={handleSelectFromMap}
            flyTarget={flyTarget}
            camadaVisivel={camadaVisivel}
            rendaOpacidade={rendaOpacidade}
            setoresSelecionados={setoresSelecionados}
            pontos={pontosNoMapa}
            fatorCorrecao={fatorCorrecao.fatorAcumulado}
          />

          {/* Quem nunca viu a plataforma não tinha nenhuma pista do que fazer no mapa vazio. */}
          {pontos.length === 0 && !carregando && !erroPonto && (
            <Alert className="pointer-events-none absolute top-3 left-1/2 z-10 w-max max-w-[calc(100%-6rem)] -translate-x-1/2 shadow-sm">
              <MapPin />
              <AlertTitle>Busque um endereço acima ou clique numa região do mapa para começar.</AlertTitle>
              <AlertDescription>Depois, adicione até {MAX_PONTOS} regiões para comparar lado a lado.</AlertDescription>
            </Alert>
          )}

          {erroPonto && (
            <Alert
              variant="destructive"
              className="absolute top-3 left-1/2 z-10 w-max max-w-[calc(100%-6rem)] -translate-x-1/2 shadow-sm"
            >
              <CircleAlert />
              <AlertTitle>{erroPonto}</AlertTitle>
              <AlertAction>
                <Button variant="ghost" size="icon-xs" onClick={() => setErroPonto(null)} aria-label="Fechar aviso">
                  <X />
                </Button>
              </AlertAction>
            </Alert>
          )}
        </main>
        <DetailPanel
          pontos={pontos}
          maxPontos={MAX_PONTOS}
          carregando={carregando}
          modoAdicionar={modoAdicionar}
          onAdicionarRegiao={() => setModoAdicionar(true)}
          onCancelarAdicao={() => setModoAdicionar(false)}
          onRemover={handleRemover}
          onLimpar={handleLimpar}
          fatorCorrecao={fatorCorrecao.fatorAcumulado}
        />
      </div>
    </div>
  );
}

export default App;
