import { SlidersHorizontal, Layers, GitCompareArrows, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import type { RendaCampo } from "@/components/Map";

interface SidebarIconsProps {
  rendaCampo: RendaCampo;
  onChangeRendaCampo: (campo: RendaCampo) => void;
  camadaVisivel: boolean;
  onToggleCamada: () => void;
  rendaOpacidade: number;
  onChangeRendaOpacidade: (opacidade: number) => void;
  podeComparar: boolean;
  onIniciarComparacao: () => void;
  podeGerarRelatorio: boolean;
  onAbrirRelatorio: () => void;
}

export function SidebarIcons({
  rendaCampo,
  onChangeRendaCampo,
  camadaVisivel,
  onToggleCamada,
  rendaOpacidade,
  onChangeRendaOpacidade,
  podeComparar,
  onIniciarComparacao,
  podeGerarRelatorio,
  onAbrirRelatorio,
}: SidebarIconsProps) {
  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-background py-3">
      <Popover>
        <PopoverTrigger render={<Button variant="ghost" size="icon" title="Filtros" />}>
          <SlidersHorizontal />
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-56">
          <div className="text-sm font-medium">Filtros do mapa</div>
          <div className="flex flex-col gap-1">
            <Button
              variant={rendaCampo === "rendaMedia" ? "secondary" : "ghost"}
              size="sm"
              className="justify-start"
              onClick={() => onChangeRendaCampo("rendaMedia")}
            >
              Renda média
            </Button>
            <Button
              variant={rendaCampo === "rendaMediana" ? "secondary" : "ghost"}
              size="sm"
              className="justify-start"
              onClick={() => onChangeRendaCampo("rendaMediana")}
            >
              Renda mediana
            </Button>
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Transparência</span>
              <span>{Math.round(rendaOpacidade * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={rendaOpacidade}
              onValueChange={(value) => onChangeRendaOpacidade(value as number)}
            />
          </div>
        </PopoverContent>
      </Popover>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant={camadaVisivel ? "secondary" : "ghost"} size="icon" onClick={onToggleCamada} />
          }
        >
          <Layers />
        </TooltipTrigger>
        <TooltipContent side="right">
          {camadaVisivel ? "Ocultar setores" : "Mostrar setores"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="icon" disabled={!podeComparar} onClick={onIniciarComparacao} />
          }
        >
          <GitCompareArrows />
        </TooltipTrigger>
        <TooltipContent side="right">
          {podeComparar ? "Comparar com outro ponto" : "Selecione um setor no mapa primeiro"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              disabled={!podeGerarRelatorio}
              onClick={onAbrirRelatorio}
            />
          }
        >
          <FileText />
        </TooltipTrigger>
        <TooltipContent side="right">
          {podeGerarRelatorio ? "Gerar relatório" : "Selecione um setor no mapa primeiro"}
        </TooltipContent>
      </Tooltip>
    </nav>
  );
}
