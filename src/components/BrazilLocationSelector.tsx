import { useEffect, useMemo, useState } from "react";
import { BRAZIL_STATES, PAMPULHA_BH_NEIGHBORHOODS } from "../lib/brazil-locations";
import "../imobfy-fixes.css";

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

const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades";
const BH_CITY: City = { id: 3106200, nome: "Belo Horizonte" };

export default function BrazilLocationSelector({
  state,
  city,
  neighborhood,
  onStateChange,
  onCityChange,
  onNeighborhoodChange,
  className = "",
}: Props) {
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [cityError, setCityError] = useState("");

  const selectedUf = useMemo(
    () => BRAZIL_STATES.find((item) => item.name === state)?.uf ?? "",
    [state],
  );
  const isMinasGerais = selectedUf === "MG";
  const isBh = isMinasGerais && city === "Belo Horizonte";

  useEffect(() => {
    if (!selectedUf) {
      setCities([]);
      setLoadingCities(false);
      setCityError("");
      return;
    }

    // Belo Horizonte é o principal fluxo do Imobfy e fica disponível
    // imediatamente, sem depender de uma chamada externa.
    if (selectedUf === "MG") {
      setCities([BH_CITY]);
      setLoadingCities(false);
      setCityError("");
      return;
    }

    const controller = new AbortController();
    setCities([]);
    setLoadingCities(true);
    setCityError("");

    fetch(`${IBGE_BASE}/estados/${selectedUf}/municipios`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Falha ao carregar cidades");
        return response.json() as Promise<City[]>;
      })
      .then((data) => {
        const ordered = Array.isArray(data)
          ? [...data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
          : [];
        setCities(ordered);
        if (!ordered.length) setCityError("Não foi possível encontrar as cidades deste estado.");
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setCities([]);
        setCityError("Não foi possível carregar as cidades agora. Tente novamente.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCities(false);
      });

    return () => controller.abort();
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

  return (
    <div className={`location-selector ${className}`}>
      <div className="location-field">
        <label htmlFor="imobfy-state">Estado</label>
        <select id="imobfy-state" value={state} onChange={(e) => handleState(e.target.value)}>
          <option value="">Selecione o estado</option>
          {BRAZIL_STATES.map((item) => (
            <option key={item.uf} value={item.name}>{item.name}</option>
          ))}
        </select>
      </div>

      <div className="location-field">
        <label htmlFor="imobfy-city">Cidade</label>
        <select
          id="imobfy-city"
          value={city}
          disabled={!selectedUf || loadingCities}
          onChange={(e) => handleCity(e.target.value)}
        >
          <option value="">
            {loadingCities ? "Carregando cidades..." : selectedUf ? "Selecione a cidade" : "Selecione primeiro o estado"}
          </option>
          {cities.map((item) => (
            <option key={item.id} value={item.nome}>{item.nome}</option>
          ))}
        </select>
        {cityError && <small className="location-error">{cityError}</small>}
      </div>

      <div className="location-field location-field-full">
        <label htmlFor="imobfy-neighborhood">Bairro</label>
        {isBh ? (
          <select
            id="imobfy-neighborhood"
            value={neighborhood}
            disabled={!city}
            onChange={(e) => onNeighborhoodChange(e.target.value)}
          >
            <option value="">Selecione o bairro</option>
            {PAMPULHA_BH_NEIGHBORHOODS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        ) : (
          <input
            id="imobfy-neighborhood"
            value={neighborhood}
            disabled={!city}
            onChange={(e) => onNeighborhoodChange(e.target.value)}
            placeholder={city ? "Digite o bairro" : "Selecione primeiro a cidade"}
          />
        )}
      </div>
    </div>
  );
}
