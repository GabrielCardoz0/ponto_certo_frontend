import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CLASSE_BADGE_PONTO } from "@/lib/badge";

interface BadgePontoProps {
  numero: number;
  /** Ponto em destaque (contorno mais forte). */
  ativo?: boolean;
  /** Quando passado, o selo vira um botão. */
  onClick?: () => void;
  titulo?: string;
}

/**
 * Selo numerado do ponto (Badge/Button do shadcn com o mesmo visual do marcador no mapa —
 * lá o marcador é DOM puro do MapLibre e usa a mesma CLASSE_BADGE_PONTO).
 */
export function BadgePonto({ numero, ativo = false, onClick, titulo }: BadgePontoProps) {
  const classe = CLASSE_BADGE_PONTO.replace("ring-background", ativo ? "ring-foreground" : "ring-background");

  if (!onClick) return <Badge className={`${classe} h-6 px-0`}>{numero}</Badge>;

  return (
    <Button size="icon-xs" onClick={onClick} title={titulo} className={`${classe} transition-transform hover:scale-110`}>
      {numero}
    </Button>
  );
}
