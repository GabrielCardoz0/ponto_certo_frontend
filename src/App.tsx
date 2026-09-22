import { useRef, useState } from "react";
import { MapView, type FlyTarget, type RendaCampo } from "@/components/Map";
import { TopBar } from "@/components/TopBar";
import { SidebarIcons } from "@/components/SidebarIcons";
import { DetailPanel, type DetailPanelHandle } from "@/components/DetailPanel";
import { getSetor } from "@/lib/api";
import type { Localizacao, Setor, SetorResumo } from "@/types/setor";

type Selecionando = "a" | "b";

export function App() {
  const [setorA, setSetorA] = useState<Setor | null>(null);
  const [setorB, setSetorB] = useState<Setor | null>(null);
  const [selecionando, setSelecionando] = useState<Selecionando>("a");
  const [carregando, setCarregando] = useState(false);

  const [rendaCampo, setRendaCampo] = useState<RendaCampo>("rendaMedia");
  const [camadaVisivel, setCamadaVisivel] = useState(true);
  const [rendaOpacidade, setRendaOpacidade] = useState(0.6);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);

  const detailPanelRef = useRef<DetailPanelHandle>(null);
  const flyNonce = useRef(0);

  async function selecionarSetor(cdSetor: string, localizacao?: Localizacao) {
    setCarregando(true);
    try {
      const setor = await getSetor(cdSetor);
      if (selecionando === "b" && setorA) {
        setSetorB(setor);
        setSelecionando("a");
      } else {
        setSetorA(setor);
        setSetorB(null);
      }
      if (localizacao) {
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
    void selecionarSetor(cdSetor, localizacao);
  }

  function handleSelectFromSearch(setor: SetorResumo) {
    void selecionarSetor(setor.cdSetor, setor.localizacao);
  }

  function handleIniciarComparacao() {
    if (!setorA) return;
    setSelecionando("b");
  }

  function handleCancelarComparacao() {
    setSelecionando("a");
  }

  function handleRemoverB() {
    setSetorB(null);
    setSelecionando("a");
  }

  function handleFecharPainel() {
    setSetorA(null);
    setSetorB(null);
    setSelecionando("a");
  }

  const setoresSelecionados = [setorA?.cdSetor, setorB?.cdSetor].filter(
    (cdSetor): cdSetor is string => Boolean(cdSetor)
  );

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
          podeComparar={Boolean(setorA) && !setorB}
          onIniciarComparacao={handleIniciarComparacao}
          podeGerarRelatorio={Boolean(setorA)}
          onAbrirRelatorio={() => detailPanelRef.current?.abrirRelatorio()}
        />
        <main className="relative min-w-0 flex-1">
          <MapView
            rendaCampo={rendaCampo}
            onSelectSetor={handleSelectFromMap}
            flyTarget={flyTarget}
            camadaVisivel={camadaVisivel}
            rendaOpacidade={rendaOpacidade}
            setoresSelecionados={setoresSelecionados}
          />
        </main>
        <DetailPanel
          key={setorA?.cdSetor ?? "empty"}
          ref={detailPanelRef}
          setorA={setorA}
          setorB={setorB}
          carregando={carregando}
          aguardandoPontoB={selecionando === "b" && !setorB}
          onIniciarComparacao={handleIniciarComparacao}
          onCancelarComparacao={handleCancelarComparacao}
          onRemoverB={handleRemoverB}
          onFechar={handleFecharPainel}
        />
      </div>
    </div>
  );
}

export default App;
