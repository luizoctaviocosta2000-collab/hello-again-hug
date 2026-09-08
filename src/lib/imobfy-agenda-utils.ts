import type { AgendaEvent } from "./imobfy-agenda";

export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isAgendaToday(date: string) {
  return date === localDateKey();
}

export function agendaDateTime(event: AgendaEvent) {
  return new Date(`${event.date}T${event.startTime}:00`);
}

export function sortAgenda(events: AgendaEvent[]) {
  return [...events].sort((a, b) => agendaDateTime(a).getTime() - agendaDateTime(b).getTime());
}

export function agendaDays(events: AgendaEvent[], date: string) {
  return sortAgenda(events.filter(event => event.date === date));
}

export function openCalendarEvent(event: AgendaEvent) {
  const start = event.date.replace(/-/g, "") + "T" + event.startTime.replace(":", "") + "00";
  const endTime = event.endTime ?? event.startTime;
  const end = event.date.replace(/-/g, "") + "T" + endTime.replace(":", "") + "00";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details: event.notes ?? "Agendado pelo Imobfy",
  });
  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank", "noopener,noreferrer");
}
