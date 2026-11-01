// Angel One SmartAPI market-data adapter boundary.
// Implement against the current official SmartAPI docs/SDK version before enabling.
// Keep all secrets on the server. This adapter intentionally exposes NO order methods.
export function createAngelOneAdapter(env){
 return {
  async getSnapshot(){
   const required=['ANGELONE_API_KEY','ANGELONE_CLIENT_CODE','ANGELONE_PASSWORD','ANGELONE_TOTP_SECRET'];
   const missing=required.filter(k=>!env[k]);
   if(missing.length)throw new Error(`Angel One configuration missing: ${missing.join(', ')}`);
   throw new Error('Angel One adapter is a secure integration stub. Complete authentication, historical candle retrieval and market-data WebSocket handling using the current official SmartAPI documentation. No order execution is implemented.');
  }
 };
}
