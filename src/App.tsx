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

  const [rendaCampo, setRendaCampo] = useState<RendaCampo>("rendaMedia");
  const [camadaVisivel, setCamadaVisivel] = useState(true);
  const [rendaOpacidade, setRendaOpacidade] = useState(0.6);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);

  const detailPanelRef = useRef<DetailPanelHandle>(null);
  const flyNonce = useRef(0);

  async function selecionarSetor(cdSetor: string, localizacao?: Localizacao) {
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

  function handleRemoverB() {
    setSetorB(null);
    setSelecionando("a");
  }

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
          />
          {selecionando === "b" && (
            <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-sm">
              Clique no mapa (ou busque) para escolher o ponto B
            </div>
          )}
        </main>
        <DetailPanel
          key={setorA?.cdSetor ?? "empty"}
          ref={detailPanelRef}
          setorA={setorA}
          setorB={setorB}
          onIniciarComparacao={handleIniciarComparacao}
          onRemoverB={handleRemoverB}
        />
      </div>
    </div>
  );
}

export default App;
