import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ImobfyDashboardCore from "../components/ImobfyDashboardCore";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";

export const Route = createFileRoute("/")({ component: DashboardRoute });

function DashboardRoute(){
 const [user,setUser]=useState<ImobfyUser|null>(null);
 useEffect(()=>{void restoreSession().then(setUser)},[]);
 if(!user)return <div className="empty"><span>Carregando sessão...</span></div>;
 return <ImobfyDashboardCore user={user}/>;
}
