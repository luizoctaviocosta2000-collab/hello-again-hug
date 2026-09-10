import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ImobfyFinanceCore from "../components/ImobfyFinanceCore";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-negocios-core.css";

export const Route = createFileRoute("/comissoes")({ component: ComissoesRoute });

function ComissoesRoute(){
 const [user,setUser]=useState<ImobfyUser|null>(null);
 useEffect(()=>{void restoreSession().then(setUser)},[]);
 if(!user)return <div className="empty"><span>Carregando sessão...</span></div>;
 return <ImobfyFinanceCore user={user}/>;
}
