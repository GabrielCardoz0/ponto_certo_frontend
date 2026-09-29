import { MapPinned } from "lucide-react";

// TODO: trocar o ícone pelo SVG da logo quando o Gabriel mandar (único lugar a mexer).
interface MarcaProps {
  tamanho?: "sm" | "lg";
}

export function Marca({ tamanho = "sm" }: MarcaProps) {
  const selo = tamanho === "lg" ? "size-8" : "size-7";
  const icone = tamanho === "lg" ? "size-4.5" : "size-4";
  const texto = tamanho === "lg" ? "text-lg" : "text-base";

  return (
    <span className={`flex shrink-0 items-center gap-2 ${texto} font-semibold tracking-tight`}>
      <span className={`flex ${selo} items-center justify-center rounded-lg bg-primary text-primary-foreground`}>
        <MapPinned className={icone} />
      </span>
      Ponto Certo <span className="text-muted-foreground">[teste]</span>
    </span>
  );
}
