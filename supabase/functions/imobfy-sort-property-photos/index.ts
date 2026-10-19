import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return out({error:"Método não permitido."},405);
 const authorization=req.headers.get("Authorization");
 if(!authorization) return out({error:"Não autenticado."},401);
 const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authorization}}});
 const {data:{user},error}=await sb.auth.getUser();
 if(error||!user) return out({error:"Sessão inválida."},401);
 const key=Deno.env.get("GEMINI_API_KEY")?.trim();
 if(!key) return out({error:"A chave Gemini não está configurada no servidor."},503);
 let body:any; try{body=await req.json()}catch{return out({error:"Requisição inválida."},400)}
 const images=Array.isArray(body.images)?body.images:[];
 if(!images.length||images.length>40) return out({error:"Envie de 1 a 40 fotos por vez."},400);
 let totalImageChars=0;
 const parts:any[]=[{text:"Classifique as fotos de um imóvel residencial para um anúncio imobiliário. Para cada imagem, retorne seu índice original (index), uma categoria curta em português e uma posição sugerida. Não invente atributos do imóvel; classifique apenas o ambiente visual. Categorias permitidas: fachada, sala, cozinha, area_servico, quarto, banheiro, varanda, area_externa, garagem, condominio, planta, outros. Ordem padrão: fachada, sala, cozinha, area_servico, quarto, banheiro, varanda, area_externa, garagem, condominio, planta, outros. Se não tiver certeza, use outros. Retorne SOMENTE JSON válido no formato {\"photos\":[{\"index\":0,\"category\":\"sala\",\"order\":1}]}. Cada índice deve aparecer exatamente uma vez."}];
 for(let i=0;i<images.length;i++){
   const im=images[i]; if(typeof im.data!=="string"||typeof im.mimeType!=="string"||!/^image\/(jpeg|png|webp|avif)$/.test(im.mimeType))return out({error:"Formato de imagem não permitido."},400);
   const raw=im.data.replace(/^data:image\/[^;]+;base64,/,"");
   if(raw.length>8_000_000)return out({error:"Uma das imagens está muito grande para análise. Reduza o tamanho e tente novamente."},413);
   totalImageChars+=raw.length; if(totalImageChars>20_000_000)return out({error:"O conjunto de fotos está muito grande. Envie menos fotos por vez."},413);
   parts.push({text:"Índice original: "+i});
   parts.push({inlineData:{mimeType:im.mimeType,data:raw}});
 }
 const {data:quotaAllowed,error:quotaError}=await sb.rpc("consume_ai_quota",{p_feature:"photos"});
 if(quotaError){console.error("AI photo quota check failed:",quotaError.message);return out({error:"Não foi possível validar seu limite diário de IA. Tente novamente em instantes."},503)}
 if(quotaAllowed!==true)return out({error:"Você atingiu o limite diário de 20 análises de fotos. Tente novamente amanhã."},429);
 const model=Deno.env.get("GEMINI_VISION_MODEL")?.trim()||"gemini-2.5-flash";
 try{
   const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:{temperature:0,responseMimeType:"application/json"}})});
   const result:any=await response.json();
   if(!response.ok)return out({error:"A IA não conseguiu analisar as fotos agora. Tente novamente."},502);
   const text=(result.candidates?.[0]?.content?.parts||[]).map((p:any)=>p.text||"").join("");
   const parsed=JSON.parse(text); if(!Array.isArray(parsed.photos))throw new Error("Resposta inesperada");
   const allowed=new Set(["fachada","sala","cozinha","area_servico","quarto","banheiro","varanda","area_externa","garagem","condominio","planta","outros"]);
   const photos=parsed.photos.filter((p:any)=>Number.isInteger(p.index)&&p.index>=0&&p.index<images.length).map((p:any)=>({index:p.index,category:allowed.has(p.category)?p.category:"outros",order:Number(p.order)||p.index+1}));
   if(photos.length!==images.length)throw new Error("Classificação incompleta");
   return out({photos});
 }catch(e){console.error(e);return out({error:"Não consegui organizar as fotos. Você pode ordená-las manualmente."},502)}
});