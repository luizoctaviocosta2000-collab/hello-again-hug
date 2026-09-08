export type AgendaEventType = "visit" | "meeting" | "call" | "follow_up" | "capture" | "presentation" | "signature" | "other";

export type AgendaEvent = {
  id: string;
  title: string;
  type: AgendaEventType;
  date: string;
  startTime: string;
  endTime?: string;
  clientId?: string;
  propertyId?: string;
  dealId?: string;
  notes?: string;
  completed?: boolean;
};

export const AGENDA_TYPES: { value: AgendaEventType; label: string }[] = [
  { value: "visit", label: "Visita ao imóvel" },
  { value: "meeting", label: "Reunião" },
  { value: "call", label: "Ligação" },
  { value: "follow_up", label: "Follow-up" },
  { value: "capture", label: "Captação" },
  { value: "presentation", label: "Apresentação" },
  { value: "signature", label: "Assinatura" },
  { value: "other", label: "Outro" },
];

export function agendaTypeLabel(type: AgendaEventType) {
  return AGENDA_TYPES.find(item => item.value === type)?.label ?? "Outro";
}

export function isToday(date: string) {
  return date === new Date().toISOString().slice(0, 10);
}
