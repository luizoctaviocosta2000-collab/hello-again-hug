import { FormEvent, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-fixes.css";

type Props = { user: ImobfyUser };
type Message = { role: "user" | "assistant"; text: string };
const suggestions = ["Quais clientes devo contatar hoje?", "Quais negócios estão parados?", "Qual é meu maior VGV no pipeline?", "Quanto tenho para receber de comissão?"];

export default function ImobfyAIChat({ user }: Props) {
 const [question,setQuestion]=useState(""); const [messages,setMessages]=useState<Message[]>([]); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
 async function ask(text:string){const value=text.trim();if(!value||loading)return;setQuestion("");setError("");setMessages(c=>[...c,{role:"user",text:value}]);setLoading(true);try{const {data,error}=await supabase.functions.invoke("imobfy-ai",{body:{question:value}});if(error)throw error;if(!data?.answer)throw new Error(data?.error||"A IA não retornou uma resposta.");setMessages(c=>[...c,{role:"assistant",text:data.answer}]);}catch(e){setError(e instanceof Error?e.message:"Não foi possível falar com a IA.");}finally{setLoading(false)}}
 function submit(e:FormEvent){e.preventDefault();void ask(question)}
 return <div className="ai-page"><section className="ai-hero"><div><span className="label">IMOBFY INTELLIGENCE</span><h1>Seu assistente comercial.</h1><p>Converse com uma IA que consulta clientes, imóveis, negócios, agenda, comissões e VGV da sua operação.</p><small className="muted">Conectado à conta de {user.name}.</small></div><div className="ai-orb"><Sparkles size={25}/></div></section><section className="clean-card ai-chat-card ai-real-chat"><div className="card-title"><div><span className="label">ASSISTENTE</span><h3>Pergunte ao Imobfy</h3></div><span className="ai-live"><Bot size={13}/> IA conectada</span></div>{!messages.length&&<div className="ai-empty"><Bot size={26}/><strong>O que você quer descobrir?</strong><p>Faça uma pergunta sobre sua operação. A IA usa os dados protegidos da sua conta.</p><div className="ai-suggestions">{suggestions.map(item=><button key={item} type="button" onClick={()=>void ask(item)}>{item}</button>)}</div></div>}{messages.length>0&&<div className="ai-messages">{messages.map((m,i)=><div className={`ai-message ${m.role}`} key={`${m.role}-${i}`}><span>{m.role==="assistant"?"IMOBFY AI":"VOCÊ"}</span><p>{m.text}</p></div>)}{loading&&<div className="ai-message assistant"><span>IMOBFY AI</span><p><Loader2 className="spin" size={16}/> Analisando seus dados...</p></div>}</div>}{error&&<div className="notice"><strong>IA:</strong> {error}</div>}<form className="ai-input" onSubmit={submit}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ex.: qual cliente tem maior potencial?" disabled={loading}/><button className="clean-button primary" type="submit" disabled={loading||!question.trim()}><Send size={16}/> Perguntar</button></form></section></div>;
}
