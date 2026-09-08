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

export function localAgendaDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isToday(date: string) {
  return date === localAgendaDateKey();
}
