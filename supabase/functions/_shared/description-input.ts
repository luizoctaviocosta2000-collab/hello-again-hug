export class DescriptionInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function descriptionInput(value: unknown): Record<string, string | number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DescriptionInputError("Informe os dados do imóvel para gerar a descrição.");
  const input = value as Record<string, unknown>;
  const property: Record<string, string | number> = {};
  const textLimits: Record<string, number> = { title: 300, property_type: 80, purpose: 40, neighborhood: 200, city: 200, habite_se: 80, description: 6000 };
  for (const [key, limit] of Object.entries(textLimits)) {
    const item = input[key];
    if (item === undefined || item === null || item === "") continue;
    if (typeof item !== "string") throw new DescriptionInputError("Revise os textos informados para o imóvel.");
    if (item.length > limit) throw new DescriptionInputError("Os dados do imóvel são muito longos. Resuma o texto antes de gerar a descrição.", 413);
    if (item.trim()) property[key] = item.trim();
  }
  for (const key of ["area_m2", "bedrooms", "suites", "bathrooms", "parking_spaces", "asking_price", "condominium_fee", "iptu_amount"]) {
    const item = input[key];
    if (item === undefined || item === null || (typeof item === "string" && !item.trim())) continue;
    if (typeof item !== "string" && typeof item !== "number") throw new DescriptionInputError("Revise os valores e as medidas informados para o imóvel.");
    const number = Number(item);
    if (!Number.isFinite(number) || number < 0 || number > 1_000_000_000) throw new DescriptionInputError("Revise os valores e as medidas informados para o imóvel.");
    property[key] = number;
  }
  if (!Object.keys(property).length) throw new DescriptionInputError("Informe os dados do imóvel para gerar a descrição.");
  return property;
}

export function preserveDescriptionLocation(description: string, property: Record<string, string | number>): string {
  const body = description.trim().slice(0, 3000);
  const location = [property.neighborhood, property.city].filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  const normalized = body.toLocaleLowerCase("pt-BR");
  if (!location.some(value => !normalized.includes(value.toLocaleLowerCase("pt-BR")))) return body;
  const suffix = `\n\nLocalização: ${location.join(", ")}.`;
  return body.slice(0, 3000 - suffix.length).trimEnd() + suffix;
}
