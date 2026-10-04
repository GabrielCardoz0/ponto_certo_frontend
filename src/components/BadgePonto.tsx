import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { classeBadgePonto } from "@/lib/badge";

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
 * lá o marcador é DOM puro do MapLibre e usa a mesma classeBadgePonto).
 */
export function BadgePonto({ numero, ativo = false, onClick, titulo }: BadgePontoProps) {
  const classe = classeBadgePonto(ativo);

  if (!onClick) return <Badge className={`${classe} h-6 px-0`}>{numero}</Badge>;

  return (
    <Button size="icon-xs" onClick={onClick} title={titulo} className={`${classe} hover:opacity-80`}>
      {numero}
    </Button>
  );
}
