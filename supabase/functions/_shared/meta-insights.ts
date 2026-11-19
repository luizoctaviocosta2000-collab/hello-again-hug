/** Official read-only connector. The trusted server resolves owner + token;
 * browser/model input never supplies credentials or account ownership. */
export type MetaReadConnection = {
  token: string;
  adAccountId: string;
  version: string;
};
export type MetaInsight = {
  account_id: string;
  campaign_id: string;
  campaign_name: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend_brl: number;
  impressions: number;
  reach: number;
  clicks: number;
  meta_leads: number;
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("META_INVALID_RESPONSE");
  return value as Record<string, unknown>;
};
const number = (value: unknown) => {
  if ((typeof value !== "string" && typeof value !== "number") || value === "")
    throw new Error("META_INVALID_METRIC");
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("META_INVALID_METRIC");
  return n;
};
const integer = (value: unknown) => {
  const n = number(value);
  if (!Number.isSafeInteger(n)) throw new Error("META_INVALID_METRIC");
  return n;
};
export function metaPeriod(since: string, until: string) {
  const valid = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  if (
    !valid(since) ||
    !valid(until) ||
    since > until ||
    (Date.parse(until) - Date.parse(since)) / 86400000 > 92
  )
    throw new Error("META_PERIOD_INVALID");
  return { since, until };
}
export async function readMetaInsights(
  connection: MetaReadConnection,
  period: { since: string; until: string },
  level: "campaign" | "adset" | "ad",
  fetcher: typeof fetch = fetch,
) {
  const account = connection.adAccountId.replace(/^act_/, "");
  if (
    !/^\d{6,25}$/.test(account) ||
    !/^v\d{1,3}\.0$/.test(connection.version) ||
    connection.token.length < 20 ||
    /[\r\n]/.test(connection.token) ||
    !["campaign", "adset", "ad"].includes(level)
  )
    throw new Error("META_CONNECTION_INVALID");
  metaPeriod(period.since, period.until);
  const root = `https://graph.facebook.com/${connection.version}/`;
  const signal = AbortSignal.timeout(25000);
  const get = async (path: string, params: URLSearchParams) => {
    const response = await fetcher(root + path + "?" + params, {
      headers: { Authorization: "Bearer " + connection.token },
      signal,
      redirect: "error",
    });
    if (!response.ok) throw new Error("META_READ_FAILED");
    const data = object(await response.json());
    if (data.error) throw new Error("META_READ_FAILED");
    return data;
  };
  const info = await get(
    "act_" + account,
    new URLSearchParams({
      fields: "id,currency,timezone_name",
    }),
  );
  if (
    info.id !== "act_" + account ||
    info.currency !== "BRL" ||
    typeof info.timezone_name !== "string" ||
    !info.timezone_name
  )
    throw new Error("META_ACCOUNT_CURRENCY_OR_ID_INVALID");
  const rows: MetaInsight[] = [];
  const seen = new Set<string>();
  const cursors = new Set<string>();
  let after = "";
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      fields:
        "account_id,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,clicks,actions",
      level,
      time_range: JSON.stringify(period),
      limit: "100",
      action_report_time: "conversion",
      use_unified_attribution_setting: "true",
      ...(after ? { after } : {}),
    });
    const data = await get("act_" + account + "/insights", params);
    if (!Array.isArray(data.data)) throw new Error("META_INVALID_RESPONSE");
    for (const raw of data.data) {
      const row = object(raw);
      const id = row[level + "_id"];
      if (
        String(row.account_id) !== account ||
        typeof id !== "string" ||
        !/^\d+$/.test(id) ||
        seen.has(id) ||
        typeof row.campaign_id !== "string" ||
        typeof row.campaign_name !== "string"
      )
        throw new Error("META_INVALID_ROW");
      seen.add(id);
      // Meta action types overlap: never sum lead + pixel-lead + grouped-lead.
      const leads = Array.isArray(row.actions)
        ? row.actions.filter((a) => object(a).action_type === "lead")
        : [];
      if (leads.length > 1) throw new Error("META_AMBIGUOUS_LEADS");
      rows.push({
        account_id: account,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        ...(typeof row.adset_id === "string"
          ? { adset_id: row.adset_id, adset_name: String(row.adset_name ?? "") }
          : {}),
        ...(typeof row.ad_id === "string"
          ? { ad_id: row.ad_id, ad_name: String(row.ad_name ?? "") }
          : {}),
        spend_brl: number(row.spend),
        impressions: integer(row.impressions),
        reach: integer(row.reach),
        clicks: integer(row.clicks),
        meta_leads: leads.length ? integer(object(leads[0]).value) : 0,
      });
    }
    const paging = data.paging ? object(data.paging) : {};
    if (!paging.next)
      return {
        source: "meta" as const,
        period,
        level,
        currency: "BRL",
        timezone: info.timezone_name,
        fetched_at: new Date().toISOString(),
        rows,
        attribution: "Meta unified attribution; conversion time. CRM visits/sales are separate.",
        reach_note: "Reach is unique within each row and period; do not sum across rows or days.",
      };
    // Never follow provider-supplied URLs: prevents token disclosure / SSRF.
    const cursor = paging.cursors ? object(paging.cursors).after : null;
    if (typeof cursor !== "string" || !cursor || cursor.length > 2000 || cursors.has(cursor))
      throw new Error("META_PAGINATION_INVALID");
    cursors.add(cursor);
    after = cursor;
  }
  throw new Error("META_DATASET_TOO_LARGE"); // no silent partial dashboard
}
