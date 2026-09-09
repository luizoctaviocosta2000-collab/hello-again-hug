export type BrazilState = { uf: string; name: string };

export const BRAZIL_STATES: BrazilState[] = [
  { uf: "AC", name: "Acre" }, { uf: "AL", name: "Alagoas" }, { uf: "AP", name: "Amapá" }, { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" }, { uf: "CE", name: "Ceará" }, { uf: "DF", name: "Distrito Federal" }, { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" }, { uf: "MA", name: "Maranhão" }, { uf: "MT", name: "Mato Grosso" }, { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" }, { uf: "PA", name: "Pará" }, { uf: "PB", name: "Paraíba" }, { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" }, { uf: "PI", name: "Piauí" }, { uf: "RJ", name: "Rio de Janeiro" }, { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" }, { uf: "RO", name: "Rondônia" }, { uf: "RR", name: "Roraima" }, { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" }, { uf: "SE", name: "Sergipe" }, { uf: "TO", name: "Tocantins" },
];

// Principais bairros usados no dia a dia da operação do Imobfy na região da Pampulha,
// cobrindo os dois lados da Lagoa da Pampulha e áreas imediatamente próximas.
export const BELO_HORIZONTE_NEIGHBORHOODS = [
  "Bandeirantes", "Braúnas", "Castelo", "Confisco", "Copacabana", "Dona Clara", "Engenho Nogueira",
  "Garças", "Indaiá", "Itapoã", "Jardim Alvorada", "Jardim Atlântico", "Jaraguá", "Liberdade",
  "Ouro Preto", "Paquetá", "Pampulha", "Santa Amélia", "Santa Rosa", "Santa Terezinha", "São José",
  "São Luiz", "Serrano", "Trevo", "Urca", "Universitário", "Vila Clóris", "Vila Paquetá",
];

const cityCache = new Map<string, string[]>();

export async function getCitiesByState(uf: string): Promise<string[]> {
  if (!uf) return [];
  const cached = cityCache.get(uf);
  if (cached) return cached;
  const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
  if (!response.ok) throw new Error("Não foi possível carregar as cidades deste estado.");
  const data = await response.json() as Array<{ nome: string }>;
  const cities = data.map(city => city.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
  cityCache.set(uf, cities);
  return cities;
}
