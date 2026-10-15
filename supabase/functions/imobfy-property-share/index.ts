import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return respond({ error: "Serviço indisponível." }, 503);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  if (req.method === "GET") {
    const token = url.searchParams.get("token")?.trim();
    if (!token || token.length < 20 || token.length > 120) return respond({ error: "Link inválido ou expirado." }, 404);
    const { data: link, error: linkError } = await admin
      .from("property_share_links").select("property_id").eq("token", token).eq("is_active", true).maybeSingle();
    if (linkError || !link) return respond({ error: "Este link não está disponível." }, 404);

    const { data: property, error: propertyError } = await admin.from("properties")
      .select("id,title,property_type,bedrooms,bathrooms,parking_spaces,area_m2,asking_price,sale_value,status,neighborhood,city,state")
      .eq("id", link.property_id).maybeSingle();
    if (propertyError || !property || !["ativo", "active", "reservado", "reserved"].includes(String(property.status).toLowerCase())) {
      return respond({ error: "Este imóvel não está disponível no momento." }, 404);
    }

    const { data: photos } = await admin.from("property_photos")
      .select("storage_path,category,sort_order,is_cover")
      .eq("property_id", property.id).order("sort_order", { ascending: true }).limit(40);
    const gallery = await Promise.all((photos || []).map(async (photo: any) => {
      const { data } = await admin.storage.from("property-photos").createSignedUrl(photo.storage_path, 3600);
      return data?.signedUrl ? { url: data.signedUrl, category: photo.category, order: photo.sort_order, cover: photo.is_cover } : null;
    }));
    const publicProperty = {
      title: property.title,
      propertyType: property.property_type,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      parkingSpaces: property.parking_spaces,
      areaM2: property.area_m2,
      price: property.asking_price ?? property.sale_value,
      neighborhood: property.neighborhood,
      city: property.city,
      state: property.state,
      photos: gallery.filter(Boolean),
    };
    return respond({ property: publicProperty });
  }

  if (req.method !== "POST") return respond({ error: "Método não permitido." }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return respond({ error: "Faça login novamente para gerenciar o link." }, 401);
  const sessionClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) return respond({ error: "Sessão inválida. Entre novamente." }, 401);

  let body: any;
  try { body = await req.json(); } catch { return respond({ error: "Requisição inválida." }, 400); }
  const propertyId = typeof body.propertyId === "string" ? body.propertyId : "";
  const action = body.action === "deactivate" ? "deactivate" : "create";
  if (!propertyId) return respond({ error: "Imóvel não informado." }, 400);

  const { data: property, error: propertyError } = await admin.from("properties")
    .select("id").eq("id", propertyId).eq("user_id", authData.user.id).maybeSingle();
  if (propertyError || !property) return respond({ error: "Imóvel não encontrado ou sem permissão." }, 404);

  if (action === "deactivate") {
    const { error } = await admin.from("property_share_links")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("property_id", propertyId).eq("user_id", authData.user.id);
    if (error) return respond({ error: "Não consegui desativar o link." }, 500);
    return respond({ ok: true, active: false });
  }

  const { data: existing, error: existingError } = await admin.from("property_share_links")
    .select("token,is_active").eq("property_id", propertyId).eq("user_id", authData.user.id).maybeSingle();
  if (existingError) return respond({ error: "Não consegui consultar o link." }, 500);
  if (existing) {
    if (!existing.is_active) {
      const { error } = await admin.from("property_share_links")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("property_id", propertyId).eq("user_id", authData.user.id);
      if (error) return respond({ error: "Não consegui reativar o link." }, 500);
    }
    return respond({ ok: true, active: true, token: existing.token });
  }

  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(tokenBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const { error: insertError } = await admin.from("property_share_links")
    .insert({ property_id: propertyId, user_id: authData.user.id, token, is_active: true });
  if (insertError) {
    // Two clicks can race to create the same property's link. If the other request won,
    // return that link instead of leaving the UI with a silent failure.
    const { data: raced } = await admin.from("property_share_links")
      .select("token,is_active").eq("property_id", propertyId).eq("user_id", authData.user.id).maybeSingle();
    if (raced?.token) {
      if (!raced.is_active) {
        const { error: reactivateError } = await admin.from("property_share_links")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq("property_id", propertyId).eq("user_id", authData.user.id);
        if (reactivateError) return respond({ error: "Não consegui reativar o link." }, 500);
      }
      return respond({ ok: true, active: true, token: raced.token });
    }
    console.error("property share insert failed", insertError.message);
    return respond({ error: "Não consegui gerar o link. Tente novamente." }, 500);
  }
  return respond({ ok: true, active: true, token });
});