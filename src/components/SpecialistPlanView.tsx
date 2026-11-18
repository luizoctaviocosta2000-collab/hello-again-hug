import type { SpecialistPlan } from "../../supabase/functions/_shared/specialist-playbooks";

export default function SpecialistPlanView({ plan }: { plan: SpecialistPlan }) {
  return (
    <section className="specialist-plan" aria-label="Plano de trabalho do especialista">
      <h4>Plano de trabalho para sua revisão</h4>
      <p className="agent-provenance">
        {plan.basis} Versão {plan.version}.
      </p>
      {plan.tasks.map((task) => (
        <article className="specialist-task" key={task.id}>
          <span className="agent-priority">
            {task.priority === "alta" ? "Prioridade alta" : "Para avaliar"}
          </span>
          <h5>{task.title}</h5>
          <p>
            <strong>Evidência:</strong> {task.evidence}
          </p>
          <p>
            <strong>Hipótese a verificar:</strong> {task.hypothesis}
          </p>
          <details>
            <summary>Ver passos e critério de conclusão</summary>
            <ol>
              {task.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p>
              <strong>Concluir quando:</strong> {task.success}
            </p>
          </details>
          <small>Plano sugerido · Nenhuma tarefa executada ou agendada</small>
        </article>
      ))}
      <h4>Perguntas que faltam confirmar</h4>
      <ul>
        {plan.questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
      <details>
        <summary>Limites desta análise</summary>
        <ul>
          {plan.boundaries.map((boundary) => (
            <li key={boundary}>{boundary}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
