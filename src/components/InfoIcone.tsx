import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Ícone "!" com tooltip explicando um campo/cartão/linha — reaproveitado no relatório de 1 ponto e na tabela comparativa. */
export function InfoIcone({ texto }: { texto: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="text-muted-foreground/60 hover:text-foreground"
            aria-label="O que significa este dado"
          />
        }
      >
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-left">
        {texto}
      </TooltipContent>
    </Tooltip>
  );
}
