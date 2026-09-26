import { useMemo, useRef, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapView, type FitTarget } from "@/components/Map";
import { TabelaSecao } from "@/components/TabelaSecao";
import { compararSetores, getPois } from "@/lib/api";
import { BOUNDS_BRASIL, boundsDoRaio, enquadramentoDosPontos } from "@/lib/geo";
import { montarTabelaComparativa } from "@/utils/tabelaComparativa";
import type { Comparacao, PontoSelecionado, Poi } from "@/types/setor";

const MINIMO_RECOMENDADO = 3;
const RAIO_PADRAO_METROS = 1000;
const SEM_POIS: Poi[] = [];

interface ComparacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pontos: PontoSelecionado[];
}

export function ComparacaoModal({ open, onOpenChange, pontos }: ComparacaoModalProps) {
  const total = pontos.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[96vw] max-w-[110rem] flex-col">
        <DialogHeader>
          <DialogTitle>{total === 1 ? "Detalhes do ponto" : "Comparação de pontos"}</DialogTitle>
        </DialogHeader>

        {/* Monta só com o modal aberto: cada abertura começa do zero (mapa, ponto ativo, cache). */}
        <ConteudoComparacao pontos={pontos} />

        <DialogFooter className="items-center sm:justify-between">
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {total < MINIMO_RECOMENDADO && (
              <p>Amostra abaixo do mínimo recomendado de {MINIMO_RECOMENDADO} pontos para comparação.</p>
            )}
            <p>Dados: IBGE e outras fontes públicas, com modelagem própria auditável.</p>
          </div>
          <Button variant="outline" disabled title="Em breve">
            Exportar relatório
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConteudoComparacao({ pontos }: { pontos: PontoSelecionado[] }) {
  const [comparacao, setComparacao] = useState<Comparacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [pontoAtivo, setPontoAtivo] = useState<string | null>(null);
  const [poisPorSetor, setPoisPorSetor] = useState<Record<string, Poi[]>>({});
  const [carregandoPois, setCarregandoPois] = useState(false);
  const [fitTarget, setFitTarget] = useState<FitTarget | null>(null);
  const fitNonce = useRef(0);

  // Enquadramento com todos os pontos, calculado uma vez ao abrir. Pontos muito espalhados
  // (> ~150 km) caem na visão geral do Brasil em vez de um fitBounds que perde o sentido.
  const [enquadramento] = useState(() => enquadramentoDosPontos(pontos.map((p) => p.localizacao)));
  const boundsGeral = enquadramento.tipo === "bounds" ? enquadramento.bounds : BOUNDS_BRASIL;

  const idsKey = pontos.map((p) => p.setor.cdSetor).join(",");
  const raioMetros = comparacao?.raioMetros ?? RAIO_PADRAO_METROS;

  useEffect(() => {
    let cancelado = false;
    compararSetores(idsKey.split(","))
      .then((data) => {
        if (!cancelado) setComparacao(data);
      })
      .catch(() => {
        if (!cancelado) setErro("Erro ao carregar os detalhes dos pontos.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [idsKey]);

  const tabela = useMemo(
    () => (comparacao ? montarTabelaComparativa(pontos, comparacao) : null),
    [pontos, comparacao]
  );

  function pedirEnquadramento(bounds: FitTarget["bounds"]) {
    fitNonce.current += 1;
    setFitTarget({ bounds, nonce: fitNonce.current });
  }

  /** Clique no número (pino ou cabeçalho): zoom no ponto + POIs do raio + destaque na tabela. */
  function selecionarPonto(cdSetor: string) {
    if (cdSetor === pontoAtivo) {
      setPontoAtivo(null);
      pedirEnquadramento(boundsGeral);
      return;
    }

    const ponto = pontos.find((p) => p.setor.cdSetor === cdSetor);
    if (!ponto) return;
    setPontoAtivo(cdSetor);
    pedirEnquadramento(boundsDoRaio(ponto.localizacao, raioMetros));

    if (poisPorSetor[cdSetor]) return;
    setCarregandoPois(true);
    getPois(cdSetor, raioMetros)
      .then((pois) => setPoisPorSetor((atual) => ({ ...atual, [cdSetor]: pois })))
      .catch(() => setPoisPorSetor((atual) => ({ ...atual, [cdSetor]: SEM_POIS })))
      .finally(() => setCarregandoPois(false));
  }

  const numeroAtivo = pontoAtivo ? pontos.findIndex((p) => p.setor.cdSetor === pontoAtivo) + 1 : null;
  const poisAtivos = useMemo(
    () => (pontoAtivo ? (poisPorSetor[pontoAtivo] ?? SEM_POIS) : SEM_POIS),
    [pontoAtivo, poisPorSetor]
  );
  const pontosNoMapa = useMemo(
    () => pontos.map((p, i) => ({ cdSetor: p.setor.cdSetor, numero: i + 1, localizacao: p.localizacao })),
    [pontos]
  );
  const setoresSelecionados = useMemo(() => pontos.map((p) => p.setor.cdSetor), [pontos]);

  return (
    // Mapa e tabelas rolam juntos; só o rodapé do modal (Exportar relatório) fica fixo.
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* Acima do mapa e rolando com ele: sem mapa à vista, a instrução não faz sentido. */}
      <DialogDescription className="mb-2">
        {pontos.length} {pontos.length === 1 ? "ponto selecionado" : "pontos selecionados"} · clique no
        número de um ponto para ver o entorno no mapa.
      </DialogDescription>
      <div className="relative mb-6 h-72 overflow-hidden rounded-md border border-border">
        <MapView
          rendaCampo="rendaMedia"
          onSelectSetor={() => {}}
          flyTarget={null}
          camadaVisivel
          rendaOpacidade={0.6}
          setoresSelecionados={setoresSelecionados}
          pontos={pontosNoMapa}
          pois={poisAtivos}
          fitTarget={fitTarget}
          vistaInicial={enquadramento}
          onPontoClick={(numero) => selecionarPonto(pontos[numero - 1].setor.cdSetor)}
          pontoAtivo={numeroAtivo}
          permitirSelecao={false}
          mostrarLegenda={false}
          gestosCooperativos
        />
        {carregandoPois && (
          <p className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5 rounded-md border border-border bg-background/90 px-2.5 py-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Carregando POIs...
          </p>
        )}
      </div>

      <div>
        {loading && (
          <p className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando detalhes...
          </p>
        )}
        {erro && <p className="p-2 text-sm text-destructive">{erro}</p>}

        {tabela && (
          <div className="flex flex-col gap-6 pb-2">
            {tabela.secoes.map((secao) => (
              <TabelaSecao
                key={secao.id}
                secao={secao}
                colunas={tabela.colunas}
                pontoAtivo={pontoAtivo}
                onSelecionarPonto={selecionarPonto}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
