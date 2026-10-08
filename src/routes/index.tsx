import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ImobfyDashboardCore from "../components/ImobfyDashboardCore";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-negocios-core.css";
import "../imobfy-dashboard-core.css";

export const Route = createFileRoute("/")({ component: DashboardRoute });

function DashboardRoute(){
 const navigate = useNavigate();
 const [user,setUser]=useState<ImobfyUser|null>(null);
 const [checking,setChecking]=useState(true);

 useEffect(()=>{
   let active = true;
   void restoreSession().then((session)=>{
     if (!active) return;
     if (session) {
       setUser(session);
       setChecking(false);
     } else {
       void navigate({ to: "/login", replace: true });
     }
   });
   return ()=>{ active = false; };
 },[navigate]);

 if(checking)return <div className="empty"><span>Carregando sessão...</span></div>;
 if(!user)return null;
 return <ImobfyDashboardCore user={user}/>;
}
