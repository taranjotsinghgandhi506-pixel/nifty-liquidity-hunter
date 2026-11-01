import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bell, CandlestickChart, CircleDot, Clock3, Radio, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { createChart, CandlestickSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';

const fmt = n => Number(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
function ChartPanel({title, candles, signals=[], height=310}) {
  const ref = React.useRef(null);
  useEffect(()=>{
    if(!ref.current || !candles?.length) return;
    const chart=createChart(ref.current,{height,layout:{background:{color:'#0c1422'},textColor:'#9aa9bd'},grid:{vertLines:{color:'#172235'},horzLines:{color:'#172235'}},rightPriceScale:{borderColor:'#26364d'},timeScale:{borderColor:'#26364d',timeVisible:true,secondsVisible:false},crosshair:{mode:1}});
    const series=chart.addSeries(CandlestickSeries,{upColor:'#20c997',downColor:'#f05b6b',borderUpColor:'#20c997',borderDownColor:'#f05b6b',wickUpColor:'#20c997',wickDownColor:'#f05b6b'});
    series.setData(candles.map(c=>({time:c.time,open:c.open,high:c.high,low:c.low,close:c.close})));
    const markers=signals.map(s=>({time:s.time,position:s.side==='bullish'?'belowBar':'aboveBar',color:s.side==='bullish'?'#20c997':'#f05b6b',shape:s.side==='bullish'?'arrowUp':'arrowDown',text:s.side==='bullish'?'BUY CE':'BUY PE'}));
    if(markers.length) createSeriesMarkers(series,markers);
    chart.timeScale().fitContent();
    const resize=()=>chart.applyOptions({width:ref.current?.clientWidth||800});
    const ro=new ResizeObserver(resize); ro.observe(ref.current);
    return ()=>{ro.disconnect();chart.remove();};
  },[candles,signals,height]);
  return <section className="chart-card"><div className="chart-heading"><span>{title}</span><span className="muted">NIFTY 50 · SPOT</span></div><div ref={ref} style={{height}} /></section>;
}
export default function App(){
 const [data,setData]=useState(null),[mode,setMode]=useState('demo'),[error,setError]=useState('');
 useEffect(()=>{let alive=true; const load=async()=>{try{const r=await fetch('/api/market/snapshot');if(!r.ok)throw new Error('Backend unavailable');const j=await r.json();if(alive){setData(j);setMode(j.mode||'demo');setError('')}}catch(e){if(alive)setError(e.message)}};load();const id=setInterval(load,5000);return()=>{alive=false;clearInterval(id)}},[]);
 const signals=data?.signals||[], latest=signals.at(-1), candles1=data?.candles1||[], candles5=data?.candles5||[];
 const active=data?.activeTrade;
 return <main className="app-shell">
  <header className="topbar"><div className="brand"><div className="brand-icon"><CandlestickChart size={22}/></div><div><div className="brand-name">NIFTY <b>LIQUIDITY HUNTER</b></div><div className="brand-sub">PRECISION SCALPING SIGNALS · V1.0</div></div></div><div className="top-status"><span className={`dot ${mode==='angelone'?'live':'demo'}`}></span>{mode==='angelone'?'ANGEL ONE FEED':'DEMO FEED'}<span className="divider-v"></span><span className="muted">SIGNALS ONLY</span></div></header>
  <div className="notice"><ShieldCheck size={15}/> No order execution is enabled. Demo data is synthetic. Signals are research tools, not trading advice.</div>
  {error&&<div className="error-banner">{error} — start the backend with <code>npm run server</code>.</div>}
  <section className="hero-grid">
   <div className="price-card"><div className="eyebrow">NIFTY 50 · SPOT REFERENCE</div><div className="big-price">{data?fmt(data.lastPrice):'—'}</div><div className="price-foot"><span className="muted">Last completed 1m candle</span><span className="pill neutral">{data?.marketStatus||'CONNECTING'}</span></div></div>
   <div className="metric-card"><div className="eyebrow">5M TREND FILTER</div><div className={`metric-value ${data?.trend==='BULLISH'?'green':data?.trend==='BEARISH'?'red':''}`}>{data?.trend||'—'}</div><div className="metric-note">EMA 20 / EMA 50 · context only</div></div>
   <div className="metric-card"><div className="eyebrow">LIQUIDITY STATE</div><div className="metric-value">{data?.liquidityState||'SCANNING'}</div><div className="metric-note">Swing + equal highs/lows</div></div>
   <div className="metric-card"><div className="eyebrow">DATA CONNECTION</div><div className="metric-value small">{mode==='angelone'?'ANGEL ONE':'DEMO'}</div><div className="metric-note"><span className="status-dot"></span>{data?.connected?'Connected':'Development feed'}</div></div>
  </section>
  <section className="signal-layout">
   <div className="signal-main">
    <div className="section-title"><div><Activity size={17}/> LIVE SIGNAL ENGINE</div><span className="muted">1M ENTRY · 5M CONTEXT</span></div>
    {latest?<div className={`signal-ticket ${latest.side}`}><div className="ticket-top"><span className="signal-tag">{latest.side==='bullish'?'BUY CE':'BUY PE'}</span><span className="ticket-time">{new Date(latest.time*1000).toLocaleTimeString('en-IN')}</span></div><div className="ticket-price">{fmt(latest.entry)}</div><div className="ticket-label">NIFTY SPOT ENTRY REFERENCE</div><div className="ticket-levels"><div><small>STOP LOSS</small><b>{fmt(latest.stop)}</b></div><div><small>TARGET 1 · 1.5R</small><b>{fmt(latest.target1)}</b></div><div><small>TARGET 2 · 2R</small><b>{fmt(latest.target2)}</b></div></div><div className="ticket-reason">{latest.reason}</div></div>:<div className="empty-state"><CircleDot size={28}/><b>Waiting for a confirmed setup</b><span>Signal appears only after the 1-minute candle closes and confirms sweep + reclaim + displacement + MSS.</span></div>}
   </div>
   <aside className="side-panel"><div className="section-title"><div><Bell size={16}/> POSITION STATUS</div></div>{active?<><div className="active-label">{active.side==='bullish'?'CE':'PE'} SIGNAL ACTIVE</div><div className="position-row"><span>Entry reference</span><b>{fmt(active.entry)}</b></div><div className="position-row"><span>Stop reference</span><b>{fmt(active.stop)}</b></div><div className="position-row"><span>Target 2</span><b>{fmt(active.target2)}</b></div><div className="muted tiny">Reference levels only; no broker position is opened.</div></>:<div className="empty-small">No active signal</div>}
    <div className="section-title history-title"><div><Clock3 size={16}/> RECENT SIGNALS</div></div>{signals.slice(-5).reverse().map((s,i)=><div className="history-row" key={s.id||i}><span className={s.side==='bullish'?'green':'red'}>{s.side==='bullish'?'BUY CE':'BUY PE'}</span><b>{fmt(s.entry)}</b><small>{new Date(s.time*1000).toLocaleTimeString('en-IN')}</small></div>)}
   </aside>
  </section>
  <div className="charts-grid"><ChartPanel title="01 · EXECUTION CHART — 1 MINUTE" candles={candles1} signals={signals}/><ChartPanel title="02 · LIQUIDITY MAP — 5 MINUTE" candles={candles5} height={260}/></div>
  <section className="rules-card"><div className="section-title"><div><ShieldCheck size={17}/> STRATEGY CHECKLIST</div><span className="muted">CLOSED-CANDLE LOGIC</span></div><div className="rule-grid">{['5m confirmed swing / equal-high-low liquidity','1m wick sweep and close reclaim','Displacement body ≥ 1.0 × ATR(14)','Close breaks confirmed opposing micro-pivot (MSS)','Entry at signal candle close','SL beyond sweep extreme + 0.10 × ATR buffer'].map((x,i)=><div className="rule" key={i}><span className="rule-number">{String(i+1).padStart(2,'0')}</span>{x}</div>)}</div></section>
  <footer><span>NIFTY LIQUIDITY HUNTER V1.0</span><span>Market-data only · No order endpoints · Verify all signals independently</span></footer>
 </main>
}