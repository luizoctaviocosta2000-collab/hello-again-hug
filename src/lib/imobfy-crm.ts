export type ClientStatus = "lead" | "qualified" | "active" | "inactive" | "converted";
export type ClientProfile = "buyer" | "seller" | "investor" | "both";

export type Client = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  profile: ClientProfile;
  status: ClientStatus;
  neighborhoods?: string[];
  propertyTypes?: string[];
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  lead: "Lead",
  qualified: "Qualificado",
  active: "Ativo",
  inactive: "Inativo",
  converted: "Convertido",
};

export const CLIENT_PROFILE_LABELS: Record<ClientProfile, string> = {
  buyer: "Comprador",
  seller: "Proprietário",
  investor: "Investidor",
  both: "Comprador e proprietário",
};

export function clientMatchesProperty(client: Client, property: {
  price?: number;
  neighborhood?: string;
  propertyType?: string;
  bedrooms?: number;
}) {
  if (client.minPrice != null && property.price != null && property.price < client.minPrice) return false;
  if (client.maxPrice != null && property.price != null && property.price > client.maxPrice) return false;
  if (client.neighborhoods?.length && property.neighborhood) {
    const wanted = client.neighborhoods.map(value => value.toLowerCase().trim());
    if (!wanted.includes(property.neighborhood.toLowerCase().trim())) return false;
  }
  if (client.propertyTypes?.length && property.propertyType) {
    const wanted = client.propertyTypes.map(value => value.toLowerCase().trim());
    if (!wanted.includes(property.propertyType.toLowerCase().trim())) return false;
  }
  if (client.bedrooms != null && property.bedrooms != null && property.bedrooms < client.bedrooms) return false;
  return true;
}

export function createClientId() {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
