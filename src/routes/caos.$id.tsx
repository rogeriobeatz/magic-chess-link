import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, Copy, Flame, Sparkles, Shield, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { initialChaos, startChaos, tickChaos, moveChaos, cardChaos, movesChaos, bestChaosMove, CHAOS_CARD_LABELS, type ChaosState, type Side, type ChaosCard } from "@/lib/chaos";
import "../styles/chaos.css";

export const Route=createFileRoute("/caos/$id")({ssr:false,component:ChaosPage});
type ChaosRow={id:string;white_token:string;black_token:string|null;state:ChaosState};
const glyph:Record<string,string>={p:"♟",n:"♞",b:"♝",r:"♜",q:"♛",k:"♚"};
const name=(s:Side)=>s==="w"?"CIANO":"MAGENTA";
function ChaosPage(){
 const {id}=Route.useParams();
 const [row,setRow]=useState<ChaosRow|null>(null);
 const rowRef=useRef<ChaosRow|null>(null);
 const [side,setSide]=useState<Side|"spec">("spec");
 const [selected,setSelected]=useState<string|null>(null);
 const [now,setNow]=useState(Date.now());
 const [error,setError]=useState("");
 const [copied,setCopied]=useState(false);
 const busy=useRef(false);
 const [ready,setReady]=useState(false);
 const [pending,setPending]=useState(false);
 const [menu,setMenu]=useState(false);
 const [suggestion,setSuggestion]=useState<{id:string;to:number}|null>(null);
 const setFresh=useCallback((next:ChaosRow)=>{
   setRow(prev=>{if(prev&&prev.id===next.id&&prev.state.revision>next.state.revision)return prev;rowRef.current=next;return next});
 },[]);
 useEffect(()=>{
   let live=true;
   (async()=>{
     const {data}=await supabase.from("games").select("*").eq("id",id).maybeSingle();
     if(!live)return;
     if(!data||((data.state as unknown as ChaosState)?.mode!=="chaos")){setError("Esta sala CAOS não existe.");return}
     let current=data as unknown as ChaosRow;
     let token=localStorage.getItem("xadrez-token-"+id);
     if(token===current.white_token)setSide("w");
     else if(token&&token===current.black_token)setSide("b");
     else if(!current.black_token){
       const fresh=crypto.randomUUID();
       const {data:joined}=await supabase.from("games").update({black_token:fresh,state:startChaos(current.state,Date.now()) as never})
         .eq("id",id).is("black_token",null).select("*").maybeSingle();
       if(joined){localStorage.setItem("xadrez-token-"+id,fresh);current=joined as unknown as ChaosRow;setSide("b")}
     }
     setFresh(current);setReady(true);
   })();
   const ch=supabase.channel("chaos-"+id).on("postgres_changes",{event:"UPDATE",schema:"public",table:"games",filter:"id=eq."+id},payload=>{
      if(live&&((payload.new as unknown as ChaosRow).state?.mode==="chaos"))setFresh(payload.new as unknown as ChaosRow);
   }).subscribe();
   const poll=setInterval(async()=>{const {data}=await supabase.from("games").select("*").eq("id",id).maybeSingle();if(live&&data&&((data.state as unknown as ChaosState).mode==="chaos"))setFresh(data as unknown as ChaosRow)},2000);
   return ()=>{live=false;clearInterval(poll);void supabase.removeChannel(ch)};
 },[id,setFresh]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),120);return ()=>clearInterval(timer)},[]);
 const state=row?.state;
 const turnState=state?tickChaos(state,now):null;
 const finished=turnState?.phase==="ended";
 const share=typeof window!=="undefined"?window.location.href:"";
 async function submit(next:ChaosState){
   const current=rowRef.current;
   if(!current||busy.current)return;
   busy.current=true;setPending(true);setError("");
   try{
     const {data, error:fail}=await supabase.from("games")
       .update({state:{...next,revision:current.state.revision+1} as never,updated_at:new Date().toISOString()})
       .eq("id",id).eq("state->>revision",String(current.state.revision)).select("*").maybeSingle();
     if(fail||!data)throw new Error("conflito");
     setFresh(data as unknown as ChaosRow);
   }catch{
     const {data}=await supabase.from("games").select("*").eq("id",id).maybeSingle();
     if(data)setFresh(data as unknown as ChaosRow);
     setError("O tabuleiro mudou antes da sua ação. Tente novamente.");
   }finally{busy.current=false;setPending(false)}
 }
 function squareClick(at:number){
   if(!state||side==="spec"||state.phase!=="playing"||pending)return;
   const own=state.pieces.find(p=>p.at===at&&p.side===side);
   if(selected){
     const piece=state.pieces.find(p=>p.id===selected);
     if(piece&&movesChaos(state,piece,now).includes(at)){
       const next=moveChaos(state,side,selected,at,now);setSelected(null);setSuggestion(null);if(next)void submit(next);return;
     }
   }
   setSelected(own?.id??null);
 }
 function useCard(card:ChaosCard){
   if(!state||side==="spec"||pending)return;
   if(card==="insight"){
     const next=cardChaos(state,side,card,now);if(!next)return;
     setSuggestion(bestChaosMove(state,side,now));void submit(next);return;
   }
   const next=cardChaos(state,side,card,now);if(next)void submit(next);
 }
 const selectedPiece=state?.pieces.find(p=>p.id===selected);
 const valid=selectedPiece&&state?new Set(movesChaos(state,selectedPiece,now)):new Set<number>();
 const remain=Math.max(0,Math.ceil(((turnState?.endsAt??0)-now)/1000));
 const suggestSquare=suggestion?.to;
 const ownKing=state?.pieces.find(p=>p.type==="k"&&p.side===side);
 const shielded=side!=="spec"&&!!state&&state.shieldUntil[side]>now;
 return <main className="chaos">
 <header className="chaos-bar"><Link to="/" className="chaos-back"><ArrowLeft size={18}/> HALL</Link><div className="chaos-word"><Flame size={21}/> CHESS LEAGUE <b>CAOS</b></div><button type="button" className="chaos-outline" onClick={async()=>{try{await navigator.clipboard.writeText(share);setCopied(true)}catch{setError("Copie o endereço na barra do navegador.")}}}><Copy size={15}/> {copied?"COPIADO":"CONVIDAR AMIGO"}</button></header>
 <div className="chaos-layout"><section className="chaos-main">
  <div className="chaos-heading"><div><small>ARENA FRENÉTICA // MOVIMENTAÇÃO SIMULTÂNEA</small><h1>{finished?"FIM DE PARTIDA":state?.phase==="waiting"?"AGUARDANDO RIVAL":"O CAOS COMEÇOU!"}</h1></div><div className="chaos-clock">{state?.phase==="waiting"?"--:--":String(Math.floor(remain/60)).padStart(2,"0")+":"+String(remain%60).padStart(2,"0")}</div></div>
  <div className="chaos-score"><span>CIANO <b>{state?.scores.w??0}</b></span><span>{side==="spec"?"ESPECTADOR":"VOCÊ JOGA: "+name(side)}</span><span>MAGENTA <b>{state?.scores.b??0}</b></span></div>
  <div className="chaos-board" role="grid" aria-label="Tabuleiro CAOS 8 por 8">
   {Array.from({length:64},(_,i)=>{
      const p=turnState?.pieces.find(piece=>piece.at===i);
      const active=selected===p?.id;
      const legal=valid.has(i);
      const cooldown=p?Math.max(0,(p.readyAt-now)/1000):0;
      const isKingProtected=p?.type==="k"&&!!turnState&&turnState.shieldUntil[p.side]>now;
      return <button type="button" key={i} role="gridcell" className={"chaos-cell "+((Math.floor(i/8)+i%8)%2?"dark":"light")+(active?" chosen":"")+(legal?" legal":"")+(suggestSquare===i?" advised":"")} onClick={()=>squareClick(i)} aria-label={String.fromCharCode(97+i%8)+(8-Math.floor(i/8))+(p?" "+p.type+" "+name(p.side):" vazia")} disabled={pending||!state||side==="spec"}>
       {p&&<span className={"chaos-piece "+p.side+(cooldown>0?" cooling":"")}>{glyph[p.type]}</span>}
       {cooldown>0&&<span className="chaos-cool">{cooldown.toFixed(1)}s</span>}
       {isKingProtected&&<span className="chaos-protect">✦</span>}
      </button>
   })}
  </div>
  <div className="chaos-explainer"><Zap size={16}/>{state?.phase==="waiting"?"Compartilhe o convite. A batalha inicia quando o rival entrar.":finished?("VENCEDOR: "+(turnState?.winner==="draw"?"EMPATE":name(turnState!.winner as Side))):"Movimente qualquer peça disponível. Não existem turnos; cada peça tem sua própria recarga."}</div>
  {state?.phase==="waiting"&&<div className="chaos-wait"><span>ESPERANDO O SEGUNDO JOGADOR...</span><input readOnly value={share} onFocus={e=>e.currentTarget.select()}/><button className="chaos-primary" onClick={()=>void navigator.clipboard.writeText(share)}>COPIAR CONVITE</button></div>}
 </section>
 <aside className="chaos-panel">
  <div className="chaos-panel-head"><Sparkles size={20}/><div><small>SEU ARSENAL</small><h2>CARTAS MÁGICAS</h2></div></div>
  <p>Uma utilização por carta. Ative no momento certo, enquanto a partida continua.</p>
  <div className="chaos-cards">
   {(["insight","knight","panic"] as ChaosCard[]).map((card,i)=><button key={card} className={"chaos-card card-"+card} type="button" disabled={!state||side==="spec"||state.phase!=="playing"||pending||state.cards[side][card]===0} onClick={()=>useCard(card)}>
      <span className="chaos-card-icon">{["◈","♞","♚"][i]}</span><span><b>{CHAOS_CARD_LABELS[card]}</b><small>{["IA indica uma jogada possível","Cavalo salta mais longe por 20s","Protege seu Rei por 12s"][i]}</small></span><span className="chaos-count">× {state&&side!=="spec"?state.cards[side][card]:0}</span>
   </button>)}
  </div>
  {suggestion&&<div className="chaos-tip"><Bot size={18}/><span>CAMINHOS SECRETOS: siga o destaque dourado para testar a sugestão da IA.</span></div>}
  {shielded&&ownKing&&<div className="chaos-tip"><Shield size={18}/> SEU REI ESTÁ PROTEGIDO</div>}
  <div className="chaos-event"><strong>⚡ FÚRIA DOS PEÕES</strong><p>{(turnState?.speedUntil??0)>now?"ATIVA! Peões com recarga de 0,75s.":"A cada 30s, os peões aceleram por 8 segundos."}</p></div>
  <div className="chaos-log"><h3>ÚLTIMAS AÇÕES</h3>{state?.feed.slice(0,6).map((entry,i)=><div key={i}>{entry}</div>)}</div>
 </aside></div>
 {error&&<div className="chaos-error" role="alert">{error}</div>}
 </main>;
}
