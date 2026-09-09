import { useEffect, useMemo, useState } from "react";
import { BRAZIL_STATES, PAMPULHA_BH_NEIGHBORHOODS } from "../lib/brazil-locations";

type City = { id: number; nome: string };

type Props = {
  state: string;
  city: string;
  neighborhood: string;
  onStateChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onNeighborhoodChange: (value: string) => void;
  className?: string;
};

export default function BrazilLocationSelector({ state, city, neighborhood, onStateChange, onCityChange, onNeighborhoodChange, className = "" }: Props) {
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  const selectedUf = useMemo(() => BRAZIL_STATES.find(s => s.name === state)?.uf ?? "", [state]);
  const isBh = selectedUf === "MG" && city === "Belo Horizonte";

  useEffect(() => {
    if (!selectedUf) { setCities([]); return; }
    let cancelled = false;
    setLoadingCities(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedUf}/municipios`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Não foi possível carregar as cidades.")))
      .then((data: City[]) => { if (!cancelled) setCities(data.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))); })
      .catch(() => { if (!cancelled) setCities([]); })
      .finally(() => { if (!cancelled) setLoadingCities(false); });
    return () => { cancelled = true; };
  }, [selectedUf]);

  function handleState(value: string) {
    onStateChange(value);
    onCityChange("");
    onNeighborhoodChange("");
  }

  function handleCity(value: string) {
    onCityChange(value);
    onNeighborhoodChange("");
  }

  return <div className={`location-selector ${className}`}>
    <label>Estado<select value={state} onChange={e => handleState(e.target.value)}><option value="">Selecione o estado</option>{BRAZIL_STATES.map(s => <option key={s.uf} value={s.name}>{s.name}</option>)}</select></label>
    <label>Cidade<select value={city} disabled={!selectedUf || loadingCities} onChange={e => handleCity(e.target.value)}><option value="">{loadingCities ? "Carregando cidades..." : selectedUf ? "Selecione a cidade" : "Selecione primeiro o estado"}</option>{cities.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></label>
    <label className="full">Bairro{isBh ? <select value={neighborhood} onChange={e => onNeighborhoodChange(e.target.value)} disabled={!city}><option value="">Selecione o bairro</option>{PAMPULHA_BH_NEIGHBORHOODS.map(b => <option key={b} value={b}>{b}</option>)}</select> : <input value={neighborhood} onChange={e => onNeighborhoodChange(e.target.value)} disabled={!city} placeholder={city ? "Digite o bairro" : "Selecione primeiro a cidade"} />}</label>
  </div>;
}
