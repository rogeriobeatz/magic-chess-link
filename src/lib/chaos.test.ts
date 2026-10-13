import { describe,expect,it } from "vitest";
import { initialChaos,startChaos,moveChaos,cardChaos,movesChaos,bestChaosMove,tickChaos } from "./chaos";
describe("Chaos PvP simultaneous rules",()=>{
 it("starts with two full armies and waits for opponent",()=>{
  const s=initialChaos();expect(s.pieces).toHaveLength(32);expect(s.phase).toBe("waiting");
  expect(startChaos(s,1000).phase).toBe("playing");
 });
 it("lets both sides move without taking turns, respecting per-piece cooldown",()=>{
  const s=startChaos(initialChaos(),1000);
  const a=moveChaos(s,"w","w-pawn-3",43,1100)!;
  expect(a).not.toBeNull();
  const b=moveChaos(a,"b","b-pawn-4",28,1200)!;
  expect(b).not.toBeNull();
  expect(moveChaos(b,"w","w-pawn-3",35,1300)).toBeNull();
  expect(movesChaos(b,b.pieces.find(p=>p.id==="w-pawn-3")!,2800).length).toBeGreaterThan(0);
 });
 it("rejects moving opponent pieces and impossible jumps",()=>{
  const s=startChaos(initialChaos(),1000);
  expect(moveChaos(s,"w","b-pawn-0",16,1001)).toBeNull();
  expect(moveChaos(s,"w","w-back-0",32,1001)).toBeNull();
 });
 it("consumes special cards once and gives bounded buffs",()=>{
  const s=startChaos(initialChaos(),1000);
  const boosted=cardChaos(s,"w","knight",1500)!;
  expect(boosted.knightUntil.w).toBe(21500);
  expect(cardChaos(boosted,"w","knight",1600)).toBeNull();
  const shield=cardChaos(boosted,"w","panic",1600)!;
  expect(shield.shieldUntil.w).toBe(13600);
 });
 it("suggests only a legal move",()=>{
  const s=startChaos(initialChaos(),1000);
  const advice=bestChaosMove(s,"w",1001)!;
  expect(movesChaos(s,s.pieces.find(p=>p.id===advice.id)!,1001)).toContain(advice.to);
 });
 it("settles timeout by score",()=>{
  const s=startChaos(initialChaos(),1000);
  s.scores.w=5;s.scores.b=1;
  const ended=tickChaos(s,181001);
  expect(ended.phase).toBe("ended");expect(ended.winner).toBe("w");
 });
});