export type Side = "w" | "b";
export type Unit = "p" | "n" | "b" | "r" | "q" | "k";
export type ChaosPiece = { id: string; side: Side; type: Unit; at: number; readyAt: number };
export type ChaosCard = "insight" | "knight" | "panic";
export type ChaosState = {
  mode: "chaos"; revision: number; phase: "waiting" | "playing" | "ended";
  startedAt: number; endsAt: number; pieces: ChaosPiece[];
  scores: Record<Side, number>; winner: Side | "draw" | null;
  cards: Record<Side, Record<ChaosCard, number>>;
  speedUntil: number; knightUntil: Record<Side, number>; shieldUntil: Record<Side, number>;
  eventsAt: number; feed: string[];
  event?: { kind: ChaosEvent; until: number } | null; eventCount?: number;
};
export type ChaosEvent = "fury" | "inversion" | "superknight" | "meteor";
export const CHAOS_EVENT_LABELS: Record<ChaosEvent,{title:string;text:string}> = {
  fury:{title:"⚡ FÚRIA DOS PEÕES",text:"Peões recarregam em 0,75s por 8s!"},
  inversion:{title:"🌀 INVERSÃO COSMICA",text:"Os exércitos trocaram de dono! Agora você comanda o lado oposto."},
  superknight:{title:"♞ SUPER CAVALO",text:"Cavalos de ambos os lados saltam longe por 10s!"},
  meteor:{title:"☄ CHUVA DE METEOROS",text:"Meteoros destruíram uma peça de cada exército!"},
};
const EVENTS: ChaosEvent[] = ["fury","inversion","superknight","meteor"];
function hash(n:number){let h=n|0;h=Math.imul(h^(h>>>16),0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);return (h^(h>>>16))>>>0}
export const CHAOS_DURATION = 180_000;
export const CHAOS_CARD_LABELS: Record<ChaosCard,string> = { insight:"CAMINHOS SECRETOS",knight:"CAVALO INSANO",panic:"PÂNICO REAL" };
const back: Unit[] = ["r","n","b","q","k","b","n","r"];
const value:Record<Unit,number>={p:1,n:3,b:3,r:5,q:9,k:20};
const enemy=(side:Side):Side=>side==="w"?"b":"w";
const xy=(i:number)=>[i%8,Math.floor(i/8)] as const;
const square=(x:number,y:number)=>x>=0&&x<8&&y>=0&&y<8?y*8+x:-1;
export function initialChaos():ChaosState {
  const pieces:ChaosPiece[]=[];
  for(let c=0;c<8;c++){
    for(const side of ["w","b"] as Side[]){
      const y=side==="w"?7:0;
      pieces.push({id:side+"-back-"+c,side,type:back[c]!,at:y*8+c,readyAt:0});
      pieces.push({id:side+"-pawn-"+c,side,type:"p",at:(side==="w"?6:1)*8+c,readyAt:0});
    }
  }
  return {mode:"chaos",revision:0,phase:"waiting",startedAt:0,endsAt:0,pieces,scores:{w:0,b:0},
    winner:null,cards:{w:{insight:1,knight:1,panic:1},b:{insight:1,knight:1,panic:1}},
    speedUntil:0,knightUntil:{w:0,b:0},shieldUntil:{w:0,b:0},eventsAt:0,feed:["CAOS ARENA PRONTA — esperando rival"]};
}
function occupant(s:ChaosState,at:number){return s.pieces.find(p=>p.at===at)}
function pathClear(s:ChaosState,from:number,to:number):boolean{
  const [x,y]=xy(from),[tx,ty]=xy(to),dx=Math.sign(tx-x),dy=Math.sign(ty-y);
  let xx=x+dx,yy=y+dy;
  while(xx!==tx||yy!==ty){if(occupant(s,square(xx,yy)))return false;xx+=dx;yy+=dy}
  return true;
}
export function movesChaos(s:ChaosState,p:ChaosPiece,now:number):number[]{
  if(p.readyAt>now||s.phase!=="playing")return [];
  const [x,y]=xy(p.at),out:number[]=[];
  for(let to=0;to<64;to++){
    if(to===p.at)continue;
    const o=occupant(s,to);
    if(o?.side===p.side || (o?.type==="k" && s.shieldUntil[o.side]>now))continue;
    const [tx,ty]=xy(to),dx=Math.abs(tx-x),dy=Math.abs(ty-y);
    let legal=false;
    switch(p.type){
      case "p": { const step=p.side==="w"?-1:1;const diff=ty-y;
        legal=dx===0&&!o&&(diff===step||(diff===step*2&&(y===(p.side==="w"?6:1))&&!occupant(s,square(x,y+step))))
          ||dx===1&&diff===step&&!!o;break; }
      case "n": legal=(dx===1&&dy===2)||(dx===2&&dy===1)||
        (s.knightUntil[p.side]>now&&((dx===3&&dy===2)||(dx===2&&dy===3)||(dx===4&&dy===3)||(dx===3&&dy===4)));break;
      case "b": legal=dx===dy&&pathClear(s,p.at,to);break;
      case "r": legal=(dx===0||dy===0)&&pathClear(s,p.at,to);break;
      case "q": legal=(dx===dy||dx===0||dy===0)&&pathClear(s,p.at,to);break;
      case "k": legal=Math.max(dx,dy)===1;break;
    }
    if(legal)out.push(to);
  }
  return out;
}
export function tickChaos(input:ChaosState,now:number):ChaosState{
  if(input.phase!=="playing")return input;
  const s={...input,scores:{...input.scores},feed:[...input.feed]};
  if(now>=s.endsAt){s.phase="ended";s.winner=s.scores.w===s.scores.b?"draw":s.scores.w>s.scores.b?"w":"b";s.feed.unshift("TEMPO ESGOTADO");return s}
  if(now>=s.eventsAt){
    const at=s.eventsAt,count=(s.eventCount??0);
    // Deterministic from saved state so both players compute the same event.
    const kind=count===0?"fury":EVENTS[hash(at^s.startedAt)%EVENTS.length]!;
    s.eventCount=count+1;s.eventsAt=at+30000;
    s.knightUntil={...s.knightUntil};
    if(kind==="fury")s.speedUntil=at+8000;
    if(kind==="superknight"){s.knightUntil.w=at+10000;s.knightUntil.b=at+10000}
    if(kind==="inversion"){s.pieces=s.pieces.map(p=>({...p,at:63-p.at,side:enemy(p.side)}))}
    if(kind==="meteor"){
      const victims=(["w","b"] as Side[]).map(side=>{const pool=s.pieces.filter(p=>p.side===side&&p.type!=="k");return pool.length?pool[hash(at+side.charCodeAt(0))%pool.length]!.id:null});
      s.pieces=s.pieces.filter(p=>!victims.includes(p.id));
    }
    s.event={kind,until:at+(kind==="superknight"?10000:8000)};
    s.feed.unshift(CHAOS_EVENT_LABELS[kind].title);s.feed=s.feed.slice(0,12);
  }
  return s;
}
export function moveChaos(input:ChaosState,side:Side,id:string,to:number,now:number):ChaosState|null{
  let s=tickChaos(input,now);
  if(s.phase!=="playing"||!Number.isInteger(to)||to<0||to>63)return null;
  const p=s.pieces.find(piece=>piece.id===id&&piece.side===side);
  if(!p||!movesChaos(s,p,now).includes(to))return null;
  const target=occupant(s,to);
  const pieces=s.pieces.filter(q=>q!==target).map(q=>q.id===id?{...q,at:to,readyAt:now+(s.speedUntil>now&&q.type==="p"?750:q.type==="q"?2600:1500)}:q);
  const scores={...s.scores};
  if(target)scores[side]+=value[target.type];
  const next={...s,pieces,scores,revision:input.revision+1,feed:[(target?"CAPTURA! ":"")+side.toUpperCase()+" "+id+" → "+(to+1),...s.feed].slice(0,12)};
  if(target?.type==="k"){next.phase="ended";next.winner=side}
  const moved=next.pieces.find(q=>q.id===id)!;
  if(moved.type==="p"&&(Math.floor(to/8)===(side==="w"?0:7)))moved.type="q";
  return next;
}
export function cardChaos(input:ChaosState,side:Side,card:ChaosCard,now:number):ChaosState|null {
  if(input.phase!=="playing"||!input.cards[side][card])return null;
  const s={...input,revision:input.revision+1,cards:{w:{...input.cards.w},b:{...input.cards.b}},knightUntil:{...input.knightUntil},shieldUntil:{...input.shieldUntil},feed:[...input.feed]};
  s.cards[side][card]--;
  if(card==="knight")s.knightUntil[side]=now+20000;
  if(card==="panic")s.shieldUntil[side]=now+12000;
  s.feed.unshift(side.toUpperCase()+" ativou "+CHAOS_CARD_LABELS[card]);
  return s;
}
export function startChaos(input:ChaosState,now:number):ChaosState {
  if(input.phase!=="waiting")return input;
  return {...input,phase:"playing",startedAt:now,endsAt:now+CHAOS_DURATION,eventsAt:now+30000,revision:input.revision+1,feed:["COMEÇOU! MOVIMENTOS SIMULTÂNEOS",...input.feed]};
}
export function bestChaosMove(s:ChaosState,side:Side,now:number):{id:string;to:number}|null{
  let best:{id:string;to:number;score:number}|null=null;
  for(const p of s.pieces.filter(p=>p.side===side))for(const to of movesChaos(s,p,now)){
    const target=occupant(s,to);const [x,y]=xy(to);
    const score=(target?value[target.type]*10:0)+(3.5-Math.abs(x-3.5))*0.1+(3.5-Math.abs(y-3.5))*0.1;
    if(!best||score>best.score)best={id:p.id,to,score};
  }
  return best?{id:best.id,to:best.to}:null;
}
