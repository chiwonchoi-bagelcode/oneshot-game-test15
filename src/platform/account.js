// Login and cloud save placeholders. Nothing here ever shows a popup or blocks play.
// Connect points:
//   auth.signIn()   -> Google Play Games Services / Game Center sign-in (silent sign-in on start)
//   cloud.push(s)   -> upload save JSON (e.g. Play Games Saved Games / iCloud KVS / own backend)
//   cloud.pull()    -> fetch remote save; caller keeps whichever has the higher `progressScore`

export const auth = {
  playerId: null,
  provider: 'guest',
  async signIn(localId) {
    this.playerId = localId; // guest id until a platform account is linked
    return { id: this.playerId, provider: this.provider };
  },
};

export const cloud = {
  enabled: false,
  lastPush: 0,
  async push(save) {
    if (!this.enabled) return false;
    this.lastPush = Date.now();
    return true;
  },
  async pull() {
    if (!this.enabled) return null;
    return null;
  },
};
