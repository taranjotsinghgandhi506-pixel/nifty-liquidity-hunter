import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemoSnapshot } from './market/demoFeed.js';
import { buildSignals } from './strategy/liquidityEngine.js';
import { createAngelOneAdapter } from './broker/angelOneAdapter.js';
dotenv.config();
const app=express(); app.use(cors()); app.use(express.json());
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));
let latest;
async function refresh(){
  if(process.env.DATA_MODE==='angelone'){
    const adapter=createAngelOneAdapter(process.env);
    latest=await adapter.getSnapshot();
  } else {
    const raw=buildDemoSnapshot();
    const result=buildSignals(raw.candles1,raw.candles5);
    latest={...raw,...result,mode:'demo',connected:false,marketStatus:'SIMULATED'};
  }
}
app.get('/api/health',(_req,res)=>res.json({ok:true,mode:process.env.DATA_MODE||'demo',orderExecution:false}));
app.get('/api/market/snapshot',async(_req,res)=>{try{if(!latest)await refresh();res.json(latest)}catch(e){res.status(503).json({error:e.message})}});
app.get('*',(req,res)=>{ if(req.path.startsWith('/api/')) return res.status(404).json({error:'Not found'}); res.sendFile(path.join(distPath,'index.html')); });
app.listen(Number(process.env.PORT||8000),()=>{console.log(`Liquidity Hunter API on :${process.env.PORT||8000}`);refresh().catch(e=>console.error('Initial feed error:',e.message));setInterval(()=>refresh().catch(e=>console.error('Feed refresh error:',e.message)),5000);});
