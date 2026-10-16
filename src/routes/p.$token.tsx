import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BedDouble, Bath, CarFront, MapPin, Maximize2, MessageCircle, Building2, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";

type SharedPhoto = { url: string; category: string; order: number; cover: boolean };
type SharedProperty = {
  title: string; propertyType: string | null; bedrooms: number | null; bathrooms: number | null;
  parkingSpaces: number | null; areaM2: number | null; price: number | null;
  neighborhood: string | null; city: string | null; state: string | null; whatsappPhone: string | null; photos: SharedPhoto[];
};
export const Route = createFileRoute("/p/$token")({ component: PublicPropertyPage });

function PublicPropertyPage() {
  const { token } = Route.useParams();
  const [property, setProperty] = useState<SharedProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    let alive = true;
    void supabase.functions.invoke("imobfy-property-share?token=" + encodeURIComponent(token), { method: "GET" })
      .then(({ data, error: invokeError }) => {
        if (!alive) return;
        if (invokeError || !data?.property) setError(data?.error || "Este link não está disponível no momento.");
        else setProperty(data.property as SharedProperty);
      })
      .catch(() => { if (alive) setError("Não foi possível carregar este imóvel. Tente novamente."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  const money = (value: number | null) => value == null ? "Consulte o valor" : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const location = property ? [property.neighborhood, property.city, property.state].filter(Boolean).join(" · ") : "";
  const message = property ? encodeURIComponent("Olá! Tenho interesse no imóvel " + property.title + (location ? " (" + location + ")" : "") + ". Podemos conversar?") : "";
  const whatsappDigits = property?.whatsappPhone?.replace(/\D/g, "") || "";
  const whatsappNumber = whatsappDigits.length === 10 || whatsappDigits.length === 11 ? "55" + whatsappDigits : whatsappDigits;
  const whatsappUrl = whatsappNumber.length >= 12 && whatsappNumber.length <= 13
    ? "https://wa.me/" + whatsappNumber + "?text=" + message
    : "https://wa.me/?text=" + message;
  const photos = property?.photos || [];
  const cover = photos[activePhoto]?.url || photos[0]?.url;

  if (loading) return <main className="share-state"><div className="share-loader" /><p>Preparando a apresentação do imóvel…</p></main>;
  if (error || !property) return <main className="share-state"><div className="share-state-mark"><Building2 size={26}/></div><h1>Imóvel indisponível</h1><p>{error || "Este link pode ter sido desativado pelo responsável."}</p><span>IMOBIFY · Apresentação de imóveis</span></main>;

  return <main className="public-property">
    <header className="share-topbar"><a className="share-brand" href="/" aria-label="IMOBIFY"><span className="share-brand-mark"><Building2 size={19}/></span><span>IMOBIFY<small>IMÓVEIS SELECIONADOS</small></span></a><span className="share-secure"><ShieldCheck size={15}/> Apresentação exclusiva</span></header>
    <section className="share-hero">
      <div className="share-hero-copy"><span className="share-eyebrow">UMA OPORTUNIDADE PARA VOCÊ</span><h1>{property.title}</h1><p className="share-location"><MapPin size={17}/>{location || "Localização sob consulta"}</p><strong className="share-price">{money(property.price)}</strong><p className="share-hero-note">Conheça os detalhes deste imóvel e fale com o responsável para tirar suas dúvidas ou agendar uma visita.</p><a className="share-cta" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Tenho interesse neste imóvel</a></div>
      <div className="share-gallery">{cover ? <img className="share-cover" src={cover} alt={property.title}/> : <div className="share-no-photo"><Building2 size={42}/><span>Fotos deste imóvel em breve</span></div>}
        {photos.length > 1 && <div className="share-thumbnails">{photos.slice(0,8).map((photo,index)=><button key={photo.url} className={activePhoto===index?"active":""} onClick={()=>setActivePhoto(index)} aria-label={"Ver foto "+(index+1)}><img src={photo.url} alt={photo.category || "Foto do imóvel"}/></button>)}</div>}
        {photos.length > 0 && <span className="share-photo-count">{photos.length} {photos.length===1?"foto":"fotos"} do imóvel</span>}
      </div>
    </section>
    <section className="share-details"><div className="share-section-heading"><span>DETALHES DO IMÓVEL</span><h2>Um lugar para chamar de seu.</h2><p>Informações principais para você conhecer melhor esta oportunidade.</p></div>
      <div className="share-specs">
        <div><BedDouble/><strong>{property.bedrooms ?? "—"}</strong><span>{property.bedrooms===1?"quarto":"quartos"}</span></div>
        <div><Bath/><strong>{property.bathrooms ?? "—"}</strong><span>{property.bathrooms===1?"banheiro":"banheiros"}</span></div>
        <div><CarFront/><strong>{property.parkingSpaces ?? "—"}</strong><span>{property.parkingSpaces===1?"vaga":"vagas"}</span></div>
        <div><Maximize2/><strong>{property.areaM2 ? Number(property.areaM2).toLocaleString("pt-BR") : "—"}</strong><span>m² de área</span></div>
      </div>
      <div className="share-bottom-card"><div><span className="share-eyebrow">VAMOS CONVERSAR?</span><h2>Esse imóvel combina com você?</h2><p>Entre em contato para confirmar a disponibilidade, receber mais informações e combinar uma visita.</p></div><a className="share-cta" href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Falar pelo WhatsApp</a></div>
    </section>
    <footer className="share-footer"><span>IMOBIFY</span><span>Uma apresentação feita para você.</span></footer>
  </main>;
}
