import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDemoSnapshot } from './market/demoFeed.js';
import { buildSignals } from './strategy/liquidityEngine.js';
import { createFyersMarketData } from './market/fyersMarketData.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../../dist');
let latest;
let fyersAccessToken = null;
let fyersTokenCreatedAt = null;
let pendingFyersState = null;
let pendingFyersStateAt = 0;
let fyersMarketData = null;
let latestFyersTick = null;
const FYERS_AUTH_BASE = 'https://api-t1.fyers.in/api/v3';

function fyersConfigReady() {
  return Boolean(process.env.FYERS_APP_ID && process.env.FYERS_SECRET_ID && process.env.FYERS_REDIRECT_URI);
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

// FYERS redirects to the exact URL registered in the app (currently the site root).
// Handle the callback before static hosting so auth_code stays server-side.
app.get('/api/fyers/callback', async (req, res, next) => {
  const { auth_code, state, s } = req.query;
  if (!auth_code && !state && !s && !req.query.error) return next();
  if (s === 'error' || req.query.error) {
    return res.status(400).send('<h2>FYERS login was not completed</h2><p>Return to Nifty Liquidity Hunter and try Connect FYERS again.</p>');
  }
  if (!auth_code || !state) {
    return res.status(400).send('<h2>FYERS callback is incomplete</h2><p>Missing authorization code or state. Start login again from the app.</p>');
  }
  if (!pendingFyersState || Date.now() - pendingFyersStateAt > 10 * 60 * 1000 || !safeEqual(state, pendingFyersState)) {
    pendingFyersState = null;
    return res.status(400).send('<h2>FYERS login state check failed</h2><p>For security, this login was rejected. Return to the app and start again.</p>');
  }
  pendingFyersState = null;
  try {
    if (!fyersConfigReady()) throw new Error('FYERS server environment variables are not configured.');
    const appIdHash = crypto.createHash('sha256')
      .update(`${process.env.FYERS_APP_ID}:${process.env.FYERS_SECRET_ID}`)
      .digest('hex');
    const tokenResponse = await fetch(`${FYERS_AUTH_BASE}/validate-authcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code', appIdHash, code: String(auth_code) })
    });
    const payload = await tokenResponse.json();
    if (!tokenResponse.ok || payload.s !== 'ok' || !payload.access_token) {
      console.error('FYERS token exchange failed:', payload.message || tokenResponse.status);
      return res.status(502).send('<h2>FYERS token exchange failed</h2><p>Check app settings and try connecting again. No token was saved.</p>');
    }
    // Token remains server-side only. Render restarts clear it; login can be repeated.
    fyersAccessToken = payload.access_token;
    fyersTokenCreatedAt = new Date().toISOString();
    if (fyersMarketData) {
  try {
    fyersMarketData.close?.();
  } catch {}
}

fyersMarketData = createFyersMarketData({
  appId: process.env.FYERS_APP_ID,
  getAccessToken: () => fyersAccessToken,
  onTick: (tick) => {
    latestFyersTick = tick;
    console.log('FYERS NIFTY LIVE:', tick.ltp);
  },
  onStatus: (status) => {
    console.log('FYERS SOCKET STATUS:', status);
  }
});

fyersMarketData.start();
    res.send('<main style="font-family:system-ui;max-width:620px;margin:12vh auto;padding:24px"><h2>FYERS connected successfully</h2><p>Your access token is stored on the server only. Close this tab and return to Nifty Liquidity Hunter.</p><p>Order placement remains disabled.</p></main>');
  } catch (err) {
    console.error('FYERS callback error:', err.message);
    res.status(500).send('<h2>FYERS connection error</h2><p>Check Render logs, then try again.</p>');
  }
});

app.get('/api/fyers/login', (_req, res) => {
  if (!fyersConfigReady()) {
    return res.status(503).json({ ok: false, error: 'Set FYERS_APP_ID, FYERS_SECRET_ID and FYERS_REDIRECT_URI in Render environment variables first.' });
  }
  pendingFyersState = crypto.randomBytes(24).toString('hex');
  pendingFyersStateAt = Date.now();
  const url = new URL(`${FYERS_AUTH_BASE}/generate-authcode`);
  url.searchParams.set('client_id', process.env.FYERS_APP_ID);
  url.searchParams.set('redirect_uri', process.env.FYERS_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', pendingFyersState);
  res.redirect(url.toString());
});
app.get('/api/fyers/status', (_req, res) => {
  res.json({ configured: fyersConfigReady(), connected: Boolean(fyersAccessToken), tokenCreatedAt: fyersTokenCreatedAt, tokenStorage: 'server-memory', orderExecution: false });
});
app.get('/api/health', (_req, res) => res.json({ ok: true, mode: process.env.DATA_MODE || 'demo', orderExecution: false }));
app.use(express.static(distPath));
app.get('/api/market/snapshot', async (_req, res) => {
  try { if (!latest) await refresh(); res.json(latest); }
  catch (e) { res.status(503).json({ error: e.message }); }
});
async function refresh() {
  if (process.env.DATA_MODE === 'angelone') {
    const adapter = createAngelOneAdapter(process.env);
    latest = await adapter.getSnapshot();
  } else {
    const raw = buildDemoSnapshot();
    const result = buildSignals(raw.candles1, raw.candles5);
    latest = { ...raw, ...result, mode: 'demo', connected: false, marketStatus: 'SIMULATED' };
  }
}
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(distPath, 'index.html'));
});
app.listen(Number(process.env.PORT || 8000), () => {
  console.log(`Liquidity Hunter API on :${process.env.PORT || 8000}`);
  refresh().catch(e => console.error('Initial feed error:', e.message));
  setInterval(() => refresh().catch(e => console.error('Feed refresh error:', e.message)), 5000);
});
