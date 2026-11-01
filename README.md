# NIFTY LIQUIDITY HUNTER V1.0

A signal-only web application for NIFTY 50 liquidity-sweep scalping.

## Features
- 1-minute execution chart and 5-minute context chart
- Confirmed swing highs/lows and equal-high/equal-low liquidity pools
- Sweep + reclaim + displacement + micro-structure-shift signal engine
- BUY CE / BUY PE signal labels, entry reference, stop, targets and exit alerts
- Signal history and live-data status
- Angel One SmartAPI market-data adapter architecture
- **No order placement, no order modification, no order cancellation**

## Important status
This is a runnable development scaffold. It starts in **DEMO mode** with synthetic candles so the UI and signal engine can be tested without broker credentials. Angel One live data requires valid SmartAPI credentials, an authorized static IP where applicable, and verification against the current SmartAPI documentation and account permissions. Do not treat demo signals as trading recommendations.

## Requirements
- Node.js 20+
- npm 10+

## Run locally
```bash
npm install
cp .env.example .env
npm run dev
```
Open http://localhost:5173

The Vite development server proxies `/api` to the backend at `http://localhost:8000`. Start it in a second terminal:
```bash
npm run server
```

## Angel One setup
1. Create/verify SmartAPI access with Angel One.
2. Configure credentials in `.env` on the backend only. Never put API keys, client codes, PINs, TOTP secrets, or JWTs in frontend code.
3. Set `DATA_MODE=angelone`.
4. Complete the `server/src/broker/angelOneAdapter.js` implementation against the current official SmartAPI SDK/API contract. The adapter is deliberately isolated because broker SDK versions and WebSocket payloads can change.
5. Test with market data only. This project intentionally has no order API code.

## Strategy V1.0 (closed-candle / non-repainting)
- 5m context: confirmed 2-left / 2-right pivots, equal highs/lows within 0.10 × ATR(14), previous completed day high/low, and session extremes.
- 1m trigger: wick crosses an active liquidity level, candle closes back across it, body >= 1.0 × ATR(14), close in outer 25% of candle range, and close breaks a previously confirmed opposing micro-pivot (MSS).
- Bullish sequence => BUY CE signal. Bearish sequence => BUY PE signal.
- Entry reference = signal candle close. Stop = sweep extreme +/- 0.10 × ATR(14) buffer. Targets = 1.5R and 2R.
- Exit: stop, target 2, opposite confirmed MSS, or time exit after 8 completed 1m bars if target 1 (1R) has not been reached. Target 1 is informational/partial-exit reference at 1.5R in this scaffold.
- 5m trend is contextual, not a hard veto; countertrend signals are labelled.
- No signal is emitted from an unfinished candle. Pivots are only available after their right-side confirmation bars close.

## Data and risk caveats
- Demo candles are synthetic and must not be used for trading.
- Spot-index levels are reference levels. They are not option-premium entry/SL/targets. Real option premium analytics require a separate options-chain/contract selection and historical premium data feed.
- Backtests must model timestamp alignment, option contract selection, bid/ask spread, slippage, brokerage, STT, GST, exchange charges and rejected/missing data.
- The current demo signal engine is deterministic and intended for engineering validation, not evidence of profitability.

## FYERS login connection (signal-only)

This build adds the server-side FYERS individual-app OAuth login flow:
- Start login at `https://YOUR-RENDER-SERVICE.onrender.com/api/fyers/login`.
- The callback is handled at the exact redirect URL registered in FYERS.
- The server verifies the random `state`, exchanges `auth_code` for an access token, and keeps the token in server memory only.
- Check status at `/api/fyers/status`.
- Order placement is not implemented or enabled.

Set these in Render → service → Environment:
- `FYERS_APP_ID` = App ID from FYERS API Dashboard
- `FYERS_SECRET_ID` = Secret ID from FYERS API Dashboard
- `FYERS_REDIRECT_URI` = exact Redirect URL registered in FYERS. The app was created with `https://nifty-liquidity-hunter.onrender.com`; preserve that exact value unless changed in both places.

Never put the FYERS Secret ID or access token in frontend code or GitHub. Render restarts clear the in-memory access token and require a fresh login. This is only the authentication foundation: live quotes, historical candle preload, WebSocket streaming and live strategy signals are not connected yet. The dashboard remains DEMO until those are implemented and tested. FYERS access tokens expire daily at 6:30 AM.

Official docs:
- https://fyers.in/api-docs/v3/api/authentication/individual-app/authentication-flow/
- https://fyers.in/api-docs/v3/api/authentication/individual-app/generate-auth-code/
- https://fyers.in/api-docs/v3/api/authentication/individual-app/validate-auth-code/
