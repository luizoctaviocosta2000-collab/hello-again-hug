export type EntityRefs = {
  clientId?: string;
  propertyId?: string;
  dealId?: string;
};

export function hasEntityRefs(value: EntityRefs) {
  return Boolean(value.clientId || value.propertyId || value.dealId);
}

export function relationLabel(value: EntityRefs) {
  const labels: string[] = [];
  if (value.clientId) labels.push("Cliente");
  if (value.propertyId) labels.push("Imóvel");
  if (value.dealId) labels.push("Negócio");
  return labels.join(" · ");
}

export function matchesRelation(value: EntityRefs, filter: EntityRefs) {
  if (filter.clientId && value.clientId !== filter.clientId) return false;
  if (filter.propertyId && value.propertyId !== filter.propertyId) return false;
  if (filter.dealId && value.dealId !== filter.dealId) return false;
  return true;
}
