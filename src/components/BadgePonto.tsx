import { CLASSE_BADGE_PONTO } from "@/lib/badge";

export function BadgePonto({ numero }: { numero: number }) {
  return <span className={CLASSE_BADGE_PONTO}>{numero}</span>;
}
