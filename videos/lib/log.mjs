const t0 = Date.now();
export const sec = () => ((Date.now() - t0) / 1000).toFixed(2);
export function log(msg) { console.log(`[${new Date().toISOString()} +${sec()}s] ${msg}`); }
export class Fail extends Error {}
