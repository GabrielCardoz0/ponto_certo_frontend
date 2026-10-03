import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Ícone "i" com explicação de um campo/cartão/linha — reaproveitado no relatório de 1 ponto e
 * na tabela comparativa. Popover (clique/toque), não Tooltip (hover): num tablet não existe
 * hover, então um tooltip hover-only nunca abre no toque.
 */
export function InfoIcone({ texto }: { texto: string }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="cursor-pointer text-muted-foreground/60 hover:text-foreground"
            aria-label="O que significa este dado"
          />
        }
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 text-sm text-left">
        {texto}
      </PopoverContent>
    </Popover>
  );
}
