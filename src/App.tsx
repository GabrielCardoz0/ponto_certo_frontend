import { useRef, useState } from "react";
import { MapView, type FlyTarget, type RendaCampo } from "@/components/Map";
import { TopBar } from "@/components/TopBar";
import { SidebarIcons } from "@/components/SidebarIcons";
import { DetailPanel } from "@/components/DetailPanel";
import { getSetor } from "@/lib/api";
import type { Localizacao, PontoSelecionado, Setor, SetorResumo } from "@/types/setor";

/** Máximo de pontos numa comparação (NBR 14653-2: amostra de 3 a 10, idealmente 6). */
const MAX_PONTOS = 10;

function rotuloPadrao(setor: Setor) {
  return `${setor.nmMunicipio} · Setor ${setor.cdSetor}`;
}

export function App() {
  const [pontos, setPontos] = useState<PontoSelecionado[]>([]);
  const [modoAdicionar, setModoAdicionar] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const [rendaCampo, setRendaCampo] = useState<RendaCampo>("rendaMedia");
  const [camadaVisivel, setCamadaVisivel] = useState(true);
  const [rendaOpacidade, setRendaOpacidade] = useState(0.6);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);

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
        setFlyTarget({ ...localizacao, nonce: flyNonce.current });
      }
    } catch {
      // Falha ao buscar o setor selecionado — mantém a seleção anterior.
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
  const pontosNoMapa = pontos.map((p, i) => ({
    cdSetor: p.setor.cdSetor,
    numero: i + 1,
    localizacao: p.localizacao,
  }));

  return (
    <div className="flex h-svh w-screen flex-col overflow-hidden">
      <TopBar onSelectResultado={handleSelectFromSearch} />
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
          />
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
        />
      </div>
    </div>
  );
}

export default App;
