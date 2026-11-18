import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import AdsIntelligenceDashboard from "../components/AdsIntelligenceDashboard";
import { restoreSession } from "../lib/imobfy-session";

export const Route = createFileRoute("/ads")({ component: AdsRoute });

function AdsRoute() {
 const navigate=useNavigate();
 const [userId,setUserId]=useState<string|null>(null);
 useEffect(()=>{
  let alive=true;
  void restoreSession().then(user=>{
   if(!alive)return;
   if(!user){void navigate({to:"/login",replace:true});return;}
   setUserId(user.id);
  });
  return()=>{alive=false};
 },[navigate]);
 return userId?<AdsIntelligenceDashboard userId={userId}/>:<div className="empty" role="status">Verificando sua sessão...</div>;
}
