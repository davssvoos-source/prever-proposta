// O ícone de cada etapa do ciclo comercial.
//
// Mora FORA de `etapas.ts` de propósito: aquele arquivo é lógica pura, e o
// verificador o carrega de verdade (`carregar()` transpila o .ts na hora).
// Um import de `lucide-react` ali dentro faria as asserções das etapas
// dependerem de uma biblioteca de ícones para rodar.
//
// Status nunca é só cor (design system §2.4) — daí existir esta tabela: quem
// não distingue as cores lê a forma.

import { Clock, FileClock, FileText, Send, XCircle, type LucideIcon } from "lucide-react";
import type { EtapaComercial } from "./etapas";

export const ETAPA_ICONE: Record<EtapaComercial, LucideIcon> = {
  visita_pendente: Clock,
  aguardando_aprovacao: FileClock,
  falta_proposta: FileText,
  enviada: Send,
  cancelada: XCircle,
};
