import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initialState, type GameState } from "@/lib/chess";
import logoUrl from "../../img-refs/Logo 3D Chess League Neon Dourado.png";
const Board3D = lazy(() => import("@/components/Board3D"));
import { ArrowLeft, Bot, Copy, Flame, Sparkles, Shield, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { initialChaos, startChaos, tickChaos, moveChaos, cardChaos, movesChaos, bestChaosMove, CHAOS_CARD_LABELS, CHAOS_EVENT_LABELS, type ChaosState, type Side, type ChaosCard } from "@/lib/chaos";
import "../styles/chaos.css";
import ArenaEmblem from "@/components/ArenaEmblem";

export const Route=createFileRoute("/caos/$id")({ssr:false,component:ChaosPage});
type ChaosRow={id:string;white_token:string;black_token:string|null;state:ChaosState};
const glyph:Record<string,string>={p:"♟",n:"♞",b:"♝",r:"♜",q:"♛",k:"♚"};
const name=(s:Side)=>s==="w"?"CIANO":"MAGENTA";
function ChaosPage(){
 const {id}=Route.useParams();
 const solo=id==="ia";
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
   if(solo){const state=startChaos(initialChaos(),Date.now());const localRow={id,white_token:"local",black_token:"bot",state};setFresh(localRow);setSide("w");setReady(true);return;}
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
 },[id,setFresh,solo]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),120);return ()=>clearInterval(timer)},[]);
 const rawState=row?.state;
  const state=rawState?tickChaos(rawState,now):undefined;
 const boardState=useMemo<GameState|null>(()=>{
   if(!state)return null;
   const base=initialState({roulette:false,clockMs:0});
   base.board=Array(64).fill(null);
   for(const p of state.pieces)base.board[p.at]={t:p.type,c:p.side,id:p.id};
   base.turn="w";base.winner=null;delete base.result;base.move=0;
   delete base.fx;delete (base as {last?:unknown}).last;
   return base;
 },[state]);
 useEffect(()=>{
   if(!solo||!state||state.phase!=="playing"||busy.current)return;
   const timer=setTimeout(()=>{
     const latest=rowRef.current;
     if(!latest||latest.state.phase!=="playing")return;
     const clock=Date.now();
     const action=bestChaosMove(latest.state,"b",clock);
     if(action){
       const next=moveChaos(latest.state,"b",action.id,action.to,clock);
       if(next)setFresh({...latest,state:next});
     }else{
       const next=tickChaos(latest.state,clock);
       if(next.phase!=="playing")setFresh({...latest,state:{...next,revision:latest.state.revision+1}});
     }
   },1050);
   return ()=>clearTimeout(timer);
 },[solo,state?.revision,state?.phase,setFresh]);
 const turnState=state??null;
 const finished=turnState?.phase==="ended";
 const share=typeof window!=="undefined"?window.location.href:"";
 async function submit(next:ChaosState){
   const current=rowRef.current;
   if(!current||busy.current)return;
   if(solo){setFresh({...current,state:{...next,revision:current.state.revision+1}});return;}
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
 const eventCount=state?.eventCount??0;
 const eventKind=state?.event?.kind;
 const [banner,setBanner]=useState<{kind:NonNullable<typeof eventKind>;key:number}|null>(null);
 const seenEvents=useRef<number|null>(null);
 useEffect(()=>{
   if(seenEvents.current===null){seenEvents.current=eventCount;return}
   if(eventCount>seenEvents.current&&eventKind){seenEvents.current=eventCount;setBanner({kind:eventKind,key:eventCount});
     try{navigator.vibrate?.([60,30,90])}catch{/* ignore */}
     const t=setTimeout(()=>setBanner(null),2600);return ()=>clearTimeout(t)}
 },[eventCount,eventKind]);
 const emblemFor={fury:"power",inversion:"turn",superknight:"promote",meteor:"mate"} as const;
 return <main className="game-shell arena-ui chaos chaos-reuse">
 <header className="arena-topbar chaos-arena-topbar"><div className="arena-identity"><Link to="/" className="arena-brand"><img src={logoUrl} alt="Chess League"/></Link><span className="arena-mode"><Flame size={16}/> CAOS // TEMPO REAL</span></div><button type="button" className="chaos-outline" onClick={async()=>{try{await navigator.clipboard.writeText(share);setCopied(true)}catch{setError("Copie o endereço na barra do navegador.")}}}><Copy size={15}/> {copied?"COPIADO":"CONVIDAR AMIGO"}</button></header>
 <div className="arena-workspace chaos-layout"><section className="arena-stage chaos-main">
  <div className="chaos-heading"><div><small>ARENA FRENÉTICA // MOVIMENTAÇÃO SIMULTÂNEA</small><h1>{finished?"FIM DE PARTIDA":state?.phase==="waiting"?"AGUARDANDO RIVAL":"O CAOS COMEÇOU!"}</h1></div><div className="chaos-clock">{state?.phase==="waiting"?"--:--":String(Math.floor(remain/60)).padStart(2,"0")+":"+String(remain%60).padStart(2,"0")}</div></div>
  <div className="chaos-score"><span>CIANO <b>{state?.scores.w??0}</b></span><span>{solo?"VOCÊ VS IA":side==="spec"?"ESPECTADOR":"VOCÊ JOGA: "+name(side)}</span><span>MAGENTA <b>{state?.scores.b??0}</b></span></div>
  <div className="arena-canvas chaos-3d">
    {boardState&&<Suspense fallback={<div className="arena-loading">Carregando tabuleiro 3D…</div>}>
      <Board3D state={boardState} flip={side==="b"} highlights={valid} selected={selectedPiece?.at??null}
        onSquare={squareClick} effects={true}/>
    </Suspense>}
    {state&&state.pieces.filter(p=>p.readyAt>now).map(p=><span key={p.id} className="chaos-cooldown-marker" style={{display:"none"}}>{p.id}</span>)}
  </div>
  <div className="chaos-explainer"><Zap size={16}/>{state?.phase==="waiting"?"Compartilhe o convite. A batalha inicia quando o rival entrar.":finished?("VENCEDOR: "+(turnState?.winner==="draw"?"EMPATE":name(turnState!.winner as Side))):"Movimente qualquer peça disponível. Não existem turnos; cada peça tem sua própria recarga."}</div>
  {!solo&&state?.phase==="waiting"&&<div className="chaos-wait"><span>ESPERANDO O SEGUNDO JOGADOR...</span><input readOnly value={share} onFocus={e=>e.currentTarget.select()}/><button className="chaos-primary" onClick={()=>void navigator.clipboard.writeText(share)}>COPIAR CONVITE</button></div>}
 </section>
 <aside className="arena-console chaos-panel">
  <div className="chaos-panel-head"><Sparkles size={20}/><div><small>SEU ARSENAL</small><h2>CARTAS MÁGICAS</h2></div></div>
  <p>Uma utilização por carta. Ative no momento certo, enquanto a partida continua.</p>
  <div className="chaos-cards">
   {(["insight","knight","panic"] as ChaosCard[]).map((card,i)=><button key={card} className={"chaos-card card-"+card} type="button" disabled={!state||side==="spec"||state.phase!=="playing"||pending||state.cards[side][card]===0} onClick={()=>useCard(card)}>
      <span className="chaos-card-icon">{["◈","♞","♚"][i]}</span><span><b>{CHAOS_CARD_LABELS[card]}</b><small>{["IA indica uma jogada possível","Cavalo salta mais longe por 20s","Protege seu Rei por 12s"][i]}</small></span><span className="chaos-count">× {state&&side!=="spec"?state.cards[side][card]:0}</span>
   </button>)}
  </div>
  {suggestion&&<div className="chaos-tip"><Bot size={18}/><span>CAMINHOS SECRETOS: siga o destaque dourado para testar a sugestão da IA.</span></div>}
  {shielded&&ownKing&&<div className="chaos-tip"><Shield size={18}/> SEU REI ESTÁ PROTEGIDO</div>}
  <div className="chaos-event" role="status" aria-live="polite">{turnState?.event&&turnState.event.until>now?<><strong>{CHAOS_EVENT_LABELS[turnState.event.kind].title}</strong><p>{CHAOS_EVENT_LABELS[turnState.event.kind].text}</p></>:<><strong>🎰 ROLETA DO CAOS</strong><p>Próximo evento em {Math.max(0,Math.ceil(((turnState?.eventsAt??0)-now)/1000))}s: fúria, inversão, super cavalo ou meteoros.</p></>}</div>
  <div className="chaos-log"><h3>ÚLTIMAS AÇÕES</h3>{state?.feed.slice(0,6).map((entry,i)=><div key={i}>{entry}</div>)}</div>
 </aside></div>
 {banner&&<div key={banner.key} className={"chaos-banner chaos-banner-"+banner.kind} role="status" aria-live="assertive">
   <ArenaEmblem kind={emblemFor[banner.kind]}/>
   <div className="chaos-banner-ribbon"><small>ROLETA DO CAOS</small><strong>{CHAOS_EVENT_LABELS[banner.kind].title}</strong><p>{CHAOS_EVENT_LABELS[banner.kind].text}</p></div>
 </div>}
 {finished&&turnState&&<div className="chaos-banner chaos-final" role="status">
   <ArenaEmblem kind={turnState.winner==="draw"?"draw":turnState.winner===side?"win":"lose"}/>
   <div className="chaos-banner-ribbon"><small>FIM DO CAOS</small><strong>{turnState.winner==="draw"?"EMPATE!":turnState.winner===side?"VITÓRIA!":side==="spec"?name(turnState.winner as Side)+" VENCE":"DERROTA"}</strong><p>CIANO {turnState.scores.w} × {turnState.scores.b} MAGENTA</p><Link to="/" className="chaos-primary chaos-banner-btn">VOLTAR AO LOBBY</Link></div>
 </div>}
 {error&&<div className="chaos-error" role="alert">{error}</div>}
 </main>;
}
