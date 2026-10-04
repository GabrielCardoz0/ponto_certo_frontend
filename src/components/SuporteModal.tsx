import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// TODO: trocar pelo número real do suporte quando o Gabriel passar (formato E.164, só dígitos).
export const WHATSAPP_SUPORTE = "5511994703386";
export const WHATSAPP_SUPORTE_FORMATADO = "(11) 99470-3386";

interface SuporteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo?: string;
  descricao?: string;
}

/** Modal de contato com suporte — reaproveitado no "Esqueceu a senha?" do login e no menu de usuário. */
export function SuporteModal({
  open,
  onOpenChange,
  titulo = "Fale com o suporte",
  descricao = "Dúvidas, problemas ou pedidos de acesso — fale com o suporte pelo WhatsApp.",
}: SuporteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <Button render={<a href={`https://wa.me/${WHATSAPP_SUPORTE}`} target="_blank" rel="noreferrer" />}>
          <MessageCircle />
          WhatsApp · {WHATSAPP_SUPORTE_FORMATADO}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
