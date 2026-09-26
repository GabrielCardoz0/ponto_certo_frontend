import { CLASSE_BADGE_PONTO } from "@/lib/badge";

interface BadgePontoProps {
  numero: number;
  /** Ponto em destaque (contorno mais forte). */
  ativo?: boolean;
  /** Quando passado, o selo vira um botão. */
  onClick?: () => void;
  titulo?: string;
}

export function BadgePonto({ numero, ativo = false, onClick, titulo }: BadgePontoProps) {
  const classe = CLASSE_BADGE_PONTO.replace("ring-background", ativo ? "ring-foreground" : "ring-background");

  if (!onClick) return <span className={classe}>{numero}</span>;

  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      className={`${classe} cursor-pointer transition-transform hover:scale-110`}
    >
      {numero}
    </button>
  );
}
