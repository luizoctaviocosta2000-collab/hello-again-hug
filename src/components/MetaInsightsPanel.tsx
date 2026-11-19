import { useState } from "react";
import { supabase } from "../lib/supabase";
import { readableFunctionError } from "../lib/function-error";
import type { readMetaInsights } from "../../supabase/functions/_shared/meta-insights";

type Report = Awaited<ReturnType<typeof readMetaInsights>>;
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export default function MetaInsightsPanel() {
  const today = new Date().toISOString().slice(0, 10);
  const [since, setSince] = useState(today.slice(0, 8) + "01");
  const [until, setUntil] = useState(today);
  const [level, setLevel] = useState<"campaign" | "adset" | "ad">("campaign");
  const [report, setReport] = useState<Report | null>(null);
  const [previous, setPrevious] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    setReport(null);
    setPrevious(null);
    try {
      const duration = Date.parse(until) - Date.parse(since) + 86400000;
      if (!Number.isFinite(duration) || duration <= 0 || duration > 93 * 86400000)
        throw new Error("Selecione um período de até 93 dias.");
      const before = {
        since: new Date(Date.parse(since) - duration).toISOString().slice(0, 10),
        until: new Date(Date.parse(since) - 86400000).toISOString().slice(0, 10),
      };
      const read = async (period: { since: string; until: string }) => {
        const { data, error: failure } = await supabase.functions.invoke<
          Report & { error?: string }
        >("imobfy-meta-insights", {
          body: { ...period, level },
          signal: AbortSignal.timeout(35000),
        });
        if (failure) throw failure;
        if (!data || data.error || data.source !== "meta" || !Array.isArray(data.rows))
          throw new Error(data?.error || "Resposta Meta inválida.");
        return data;
      };
      const [current, prior] = await Promise.all([read({ since, until }), read(before)]);
      setReport(current);
      setPrevious(prior);
    } catch (cause) {
      setError(await readableFunctionError(cause));
    } finally {
      setBusy(false);
    }
  }
  const spend = report?.rows.reduce((sum, row) => sum + row.spend_brl, 0) ?? 0;
  const oldSpend = previous?.rows.reduce((sum, row) => sum + row.spend_brl, 0) ?? 0;
  return (
    <section className="intel-panel">
      <h3>Meta oficial — somente leitura</h3>
      <p>
        Consulta direta à Marketing API. Conexão inicial configurada pelo administrador para o
        titular da conta. Nenhum anúncio ou orçamento é alterado.
      </p>
      <div className="attendance-actions">
        <label>
          De{" "}
          <input
            type="date"
            value={since}
            disabled={busy}
            onChange={(e) => setSince(e.target.value)}
          />
        </label>
        <label>
          Até{" "}
          <input
            type="date"
            value={until}
            disabled={busy}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
        <label>
          Nível{" "}
          <select
            value={level}
            disabled={busy}
            onChange={(e) => setLevel(e.target.value as typeof level)}
          >
            <option value="campaign">Campanhas</option>
            <option value="adset">Conjuntos</option>
            <option value="ad">Anúncios</option>
          </select>
        </label>
        <button type="button" disabled={busy} onClick={() => void load()}>
          {busy ? "Consultando Meta…" : "Consultar e comparar períodos"}
        </button>
      </div>
      {error && (
        <p role="alert" className="intel-error">
          {error}
        </p>
      )}
      {report && (
        <>
          <p>
            Fonte: Meta · {report.period.since} a {report.period.until} · {report.timezone} ·
            Consulta: {new Date(report.fetched_at).toLocaleString("pt-BR")}
          </p>
          <p>
            Investimento: {money(spend)}. Período anterior: {money(oldSpend)}.
            {oldSpend > 0
              ? ` Variação: ${((spend / oldSpend - 1) * 100).toFixed(1)}%.`
              : " Sem base para variação percentual."}
          </p>
          <p>
            Leads abaixo são reportados pela Meta, não leads qualificados, visitas ou vendas
            confirmados pelo CRM. Alcance não é somável entre linhas. Atribuição: configuração
            unificada Meta, data de conversão.
          </p>
          {report.rows.length === 0 && <p>Sem resultados neste período.</p>}
          {report.rows.map((row) => (
            <article key={row.ad_id ?? row.adset_id ?? row.campaign_id} className="intel-panel">
              <strong>{row.ad_name || row.adset_name || row.campaign_name}</strong>
              <p>
                {money(row.spend_brl)} · {row.impressions} impressões · alcance {row.reach} ·{" "}
                {row.meta_leads} leads Meta · CPL{" "}
                {row.meta_leads > 0 ? money(row.spend_brl / row.meta_leads) : "Sem base"}
              </p>
              {row.clicks >= 50 && row.meta_leads === 0 && (
                <p>
                  Revisão sugerida: há pelo menos 50 cliques sem leads reportados. Confira
                  rastreamento e formulário antes de alterar investimento. Nenhuma ação executada.
                </p>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
