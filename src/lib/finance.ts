export type OperationType = "capture" | "capture_split" | "sale" | "sale_split";

export type FinanceRules = {
  commissionPercent: number;
  taxPercent: number;
  participationPercent: number;
};

export type CommissionBreakdown = {
  operationValue: number;
  grossCommission: number;
  tax: number;
  netCommission: number;
  participation: number;
  userCommission: number;
};

export const DEFAULT_FINANCE_RULES: FinanceRules = {
  commissionPercent: 6,
  taxPercent: 9,
  participationPercent: 20,
};

export const OPERATION_PARTICIPATION: Record<OperationType, number | null> = {
  capture: null,
  capture_split: 10,
  sale: null,
  sale_split: 10,
};

/**
 * Calculates the commission chain used by Imobfy:
 * VGV -> gross commission -> 9% tax -> net -> participation -> user's share.
 * Percentages are configurable, while the operation's participation rule can
 * override the configurable participation only for split operations.
 */
export function calculateCommission(
  operationValue: number,
  rules: FinanceRules = DEFAULT_FINANCE_RULES,
  operationType: OperationType = "sale",
): CommissionBreakdown {
  const value = Math.max(0, Number(operationValue) || 0);
  const grossCommission = value * (rules.commissionPercent / 100);
  const tax = grossCommission * (rules.taxPercent / 100);
  const netCommission = grossCommission - tax;
  const participationPercent = OPERATION_PARTICIPATION[operationType] ?? rules.participationPercent;
  const participation = netCommission * (participationPercent / 100);
  const userCommission = participation;

  return {
    operationValue: value,
    grossCommission,
    tax,
    netCommission,
    participation,
    userCommission,
  };
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}
