// Closed-candle signal engine. Inputs must be chronological, completed OHLC bars.
// This is a baseline implementation for research; validate data alignment and edge cases.
const mean=(a)=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
function atr(bars,n=14){return bars.map((b,i)=>{if(i===0)return b.high-b.low;const tr=Math.max(b.high-b.low,Math.abs(b.high-bars[i-1].close),Math.abs(b.low-bars[i-1].close));return i<n?tr:mean(bars.slice(i-n+1,i+1).map((x,j)=>Math.max(x.high-x.low,Math.abs(x.high-bars[i-n+j].close),Math.abs(x.low-bars[i-n+j].close))))})}
function pivots(bars,left=2,right=2){const out=[];for(let i=left;i<bars.length-right;i++){let hi=true,lo=true;for(let j=i-left;j<=i+right;j++){if(j===i)continue;if(bars[j].high>=bars[i].high)hi=false;if(bars[j].low<=bars[i].low)lo=false;}if(hi)out.push({index:i,type:'high',price:bars[i].high,confirmedAt:i+right});if(lo)out.push({index:i,type:'low',price:bars[i].low,confirmedAt:i+right});}return out;}
function ema(values,n){const k=2/(n+1);let v=values[0]??0;return values.map((x,i)=>{v=i===0?x:x*k+v*(1-k);return v;});}
function trend5(bars){if(bars.length<50)return 'NEUTRAL';const c=bars.map(x=>x.close),e20=ema(c,20),e50=ema(c,50);return e20.at(-1)>e50.at(-1)?'BULLISH':e20.at(-1)<e50.at(-1)?'BEARISH':'NEUTRAL';}
export function buildSignals(candles1,candles5){
 const signals=[], exits=[]; if(candles1.length<30)return {signals,exits,trend:trend5(candles5),liquidityState:'SCANNING',activeTrade:null};
 const a=atr(candles1),p=pivots(candles1,2,2); let active=null, consumed=new Set();
 for(let i=25;i<candles1.length;i++){
  const b=candles1[i], prev=candles1[i-1], av=a[i]||0, range=b.high-b.low, body=Math.abs(b.close-b.open);
  const confirmed=p.filter(x=>x.confirmedAt<i);
  const highs=confirmed.filter(x=>x.type==='high'&&x.index<i-1),lows=confirmed.filter(x=>x.type==='low'&&x.index<i-1);
  const lastHigh=highs.at(-1),lastLow=lows.at(-1);
  if(active){
   const barsHeld=i-active.index, hitStop=active.side==='bullish'?b.low<=active.stop:b.high>=active.stop;
   const hitT2=active.side==='bullish'?b.high>=active.target2:b.low<=active.target2;
   const reached1R=active.side==='bullish'?b.high>=active.entry+active.risk:b.low<=active.entry-active.risk;
   const opposite=active.side==='bullish'?(lastLow&&b.close<lastLow.price):(lastHigh&&b.close>lastHigh.price);
   const reason=hitStop?'STOP':hitT2?'TARGET 2':opposite?'OPPOSITE MSS':(barsHeld>=8&&!reached1R)?'TIME EXIT':null;
   if(reason){exits.push({time:b.time,reason,price:b.close,side:active.side});active=null;}
  }
  if(active||range<=0||av<=0)continue;
  // Both pivot liquidity pools and equal-high/low pools. Pivot becomes usable only after right bars close.
  const candidateLow=lows.filter(x=>!consumed.has('L'+x.index)).at(-1);
  const candidateHigh=highs.filter(x=>!consumed.has('H'+x.index)).at(-1);
  const eqLow=lows.length>=2&&Math.abs(lows.at(-1).price-lows.at(-2).price)<=0.10*av?Math.max(lows.at(-1).price,lows.at(-2).price):null;
  const eqHigh=highs.length>=2&&Math.abs(highs.at(-1).price-highs.at(-2).price)<=0.10*av?Math.min(highs.at(-1).price,highs.at(-2).price):null;
  const bullLevel=eqLow??candidateLow?.price, bearLevel=eqHigh??candidateHigh?.price;
  const bullSweep=bullLevel!=null&&b.low<bullLevel&&b.close>bullLevel;
  const bearSweep=bearLevel!=null&&b.high>bearLevel&&b.close<bearLevel;
  const bullDisplace=b.close>b.open&&body>=av&&b.close>=b.low+0.75*range;
  const bearDisplace=b.close<b.open&&body>=av&&b.close<=b.low+0.25*range;
  const bullMss=lastHigh&&b.close>lastHigh.price, bearMss=lastLow&&b.close<lastLow.price;
  // Aggressive mode: reclaim, displacement and MSS must all be present on the same completed bar.
  let side=bullSweep&&bullDisplace&&bullMss?'bullish':bearSweep&&bearDisplace&&bearMss?'bearish':null;
  if(!side)continue;
  const extreme=side==='bullish'?b.low:b.high, buffer=0.10*av, entry=b.close;
  const stop=side==='bullish'?extreme-buffer:extreme+buffer, risk=Math.abs(entry-stop);
  if(!risk)continue;
  const signal={id:`${b.time}-${side}`,time:b.time,side,entry,stop,risk,target1:side==='bullish'?entry+1.5*risk:entry-1.5*risk,target2:side==='bullish'?entry+2*risk:entry-2*risk,index:i,reason:`${side==='bullish'?'Sell-side':'Buy-side'} liquidity sweep + reclaim + displacement + MSS`};
  signals.push(signal);active=signal;
  if(side==='bullish'&&candidateLow)consumed.add('L'+candidateLow.index);
  if(side==='bearish'&&candidateHigh)consumed.add('H'+candidateHigh.index);
 }
 const last=candles1.at(-1),lastSignal=signals.at(-1);
 return {signals:signals.slice(-30),exits:exits.slice(-30),trend:trend5(candles5),liquidityState:lastSignal?(lastSignal.side==='bullish'?'SELL-SIDE SWEPT':'BUY-SIDE SWEPT'):'SCANNING',activeTrade:active?{side:active.side,entry:active.entry,stop:active.stop,target2:active.target2}:null,lastPrice:last?.close};
}
