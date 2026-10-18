// Analytics placeholder. Every call site uses track(); swap `provider.send` for a real SDK
// (e.g. Firebase Analytics logEvent / GameAnalytics addDesignEvent) without touching gameplay code.
// Event catalogue (name -> params) is documented in release/plan.md "지표" section.
export const EVENTS = {
  first_open: ['install_id', 'lang', 'screen'],
  session_start: ['day_index', 'streak', 'cleared'],
  session_end: ['seconds', 'runs', 'last_screen'],
  tutorial_step: ['step'],
  tutorial_complete: ['seconds_since_install'],
  run_start: ['level', 'attempt', 'assist', 'bag_lv', 'board_lv'],
  run_end: ['level', 'result', 'seconds', 'tide_pct', 'items', 'weight', 'furthest', 'close_call', 'cause'],
  level_complete: ['level', 'stars', 'attempts'],
  level_fail: ['level', 'cause', 'attempt', 'greedy_items'],
  level_reach: ['level'],
  resource_earn: ['currency', 'amount', 'source'],
  resource_spend: ['currency', 'amount', 'sink'],
  building_built: ['building', 'level', 'cleared'],
  decor_built: ['decor', 'count'],
  daily_gift: ['streak', 'items'],
  daily_tide_complete: ['day'],
  request_complete: ['request', 'reward'],
  assist_offered: ['level', 'fails'],
  assist_used: ['level'],
  bell_rung: ['level', 'slack'],
  settings_change: ['key', 'value'],
  perf_downgrade: ['fps'],
  screen_view: ['screen'],
};

const QUEUE_KEY = 'lowtide.analytics.queue';
const MAX_QUEUE = 300;

const provider = {
  // Replace with SDK call. Kept local so nothing is sent anywhere before a real backend exists.
  send(evt) {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      q.push(evt);
      while (q.length > MAX_QUEUE) q.shift();
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    } catch (_) { /* storage full or blocked: drop */ }
  },
};

const recent = [];
export const analytics = { recent, debug: false };

export function track(name, params = {}) {
  if (!EVENTS[name] && analytics.debug) console.warn('[analytics] unknown event', name);
  const evt = { e: name, t: Date.now(), p: params };
  recent.push(evt);
  if (recent.length > 60) recent.shift();
  if (analytics.debug) console.log('[analytics]', name, params);
  provider.send(evt);
}

export function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (_) { return []; }
}
