import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, CircleDollarSign, Flame, MessageCircle, Sparkles } from "lucide-react";

type Priority = {
  kind: string;
  score: number;
  title: string;
  reason: string;
  suggested_action: string;
};

type Props = { priorities: Priority[]; loading?: boolean; onAsk?: (text: string) => void };

const icons: Record<string, typeof Flame> = {
  stalled_deal: Flame,
  proposal_followup: MessageCircle,
  upcoming_visit: CalendarClock,
  lead_followup: AlertTriangle,
  commission: CircleDollarSign,
};

export default function ImobfyAIPriorities({ priorities, loading, onAsk }: Props) {
  return (
    <section className="clean-card ai-priority-card">
      <div className="card-title">
        <div>
          <span className="label">IMOBFY INTELLIGENCE</span>
          <h3>O que merece sua atenção</h3>
        </div>
        <span className="ai-live"><Sparkles size={13} /> Prioridade automática</span>
      </div>

      {loading && <div className="muted">Analisando sua operação...</div>}
      {!loading && !priorities.length && (
        <div className="ai-priority-empty"><CheckCircle2 size={20} /><span>Nenhuma prioridade crítica identificada agora.</span></div>
      )}
      {!loading && priorities.length > 0 && (
        <div className="ai-priority-list">
          {priorities.slice(0, 5).map((item, index) => {
            const Icon = icons[item.kind] || Sparkles;
            return (
              <button key={`${item.kind}-${index}`} className="ai-priority-item" type="button" onClick={() => onAsk?.(`Analise esta prioridade: ${item.title}. ${item.reason} O que devo fazer agora?`)}>
                <span className="ai-priority-icon"><Icon size={17} /></span>
                <span className="ai-priority-copy">
                  <strong>{index + 1}. {item.title}</strong>
                  <small>{item.reason}</small>
                  <em>{item.suggested_action}</em>
                </span>
                <span className="ai-score">{item.score}</span>
                <ArrowRight size={16} />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
