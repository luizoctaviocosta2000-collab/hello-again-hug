export type FinancialCommission = { id: string; user_amount: number; status?: string };
export type FinancialReceipt = { commission_id: string; amount: number; received_at?: string | null };
export type Period = "current" | "6m" | "12m" | "all";
const cents = (value: number) => Math.round(Number(value || 0) * 100);

export function localDateKey(value: Date | string = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function isInPeriod(value: string | null | undefined, period: Period, now = new Date()): boolean {
  if (!value) return false;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  if (period === "all") return true;
  const months = period === "current" ? 1 : period === "6m" ? 6 : 12;
  return date >= new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    && date < new Date(now.getFullYear(), now.getMonth() + 1, 1);
}
export function financialSummary(commissions: FinancialCommission[], receipts: FinancialReceipt[], period: Period = "all", now = new Date()) {
  const byId = new Map(commissions.map(c => [c.id, c]));
  const sums = new Map<string, number>();
  let cash = 0;
  for (const receipt of receipts) {
    if (!byId.has(receipt.commission_id)) continue;
    const amount = cents(receipt.amount);
    sums.set(receipt.commission_id, (sums.get(receipt.commission_id) || 0) + amount);
    if (period === "all" || isInPeriod(receipt.received_at, period, now)) cash += amount;
  }
  let pending = 0, total = 0, inconsistent = 0;
  for (const commission of commissions) {
    const amount = cents(commission.user_amount);
    const received = sums.get(commission.id) || 0;
    total += amount;
    pending += Math.max(0, amount - received);
    if (["received", "recebida"].includes(commission.status || "") && received < amount) inconsistent++;
  }
  return { received: cash / 100, receivable: pending / 100, commission: total / 100, inconsistent,
    receivedBy: new Map([...sums].map(([id, value]) => [id, value / 100])) };
}
