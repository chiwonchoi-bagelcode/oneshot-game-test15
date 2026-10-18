// Indirection so UI code can play feedback without importing the whole audio stack.
let handler = null;
export function setUiSound(fn) { handler = fn; }
export function audioUi(kind) { if (handler) handler(kind); }
