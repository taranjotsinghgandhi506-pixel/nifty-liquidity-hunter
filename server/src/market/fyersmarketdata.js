import { createRequire } from 'node:module';
const NIFTY_SYMBOL = 'NSE:NIFTY50-INDEX';
const require = createRequire(import.meta.url);
const { fyersDataSocket } = require('fyers-api-v3');

export function createFyersMarketData({
  appId,
  getAccessToken,
  onTick = () => {},
  onStatus = () => {}
}) {
  let socket = null;
  let started = false;

  function start() {
    if (started) return;

    const token = getAccessToken();

    if (!appId || !token) {
      onStatus({ connected: false, error: 'FYERS token unavailable' });
      return;
    }

   const DataSocket = fyersDataSocket;

    if (!DataSocket) {
      onStatus({ connected: false, error: 'FYERS DataSocket unavailable' });
      return;
    }

    socket = DataSocket.getInstance(`${appId}:${token}`, '');

    socket.on('connect', () => {
      onStatus({ connected: true, message: 'Socket connected' });
      socket.subscribe([NIFTY_SYMBOL], false);
    });

    socket.on('message', (message) => {
      if (message?.symbol === NIFTY_SYMBOL && Number.isFinite(Number(message.ltp))) {
        onTick({
          symbol: NIFTY_SYMBOL,
          ltp: Number(message.ltp),
          timestamp: message.exch_feed_time || message.last_traded_time || Date.now() / 1000,
          raw: message
        });
      }
    });

    socket.on('error', (error) => {
      onStatus({ connected: false, error: String(error) });
    });

    socket.on('close', () => {
      onStatus({ connected: false, message: 'Socket closed' });
    });

   socket.autoReconnect(10);
    socket.connect();
    started = true;
  }

  return { start };
}
