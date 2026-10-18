// Localisation: all on-screen text lives in src/data/i18n/*.json. Device language decides; unsupported -> English.
import KO from '../data/i18n/ko.json';
import EN from '../data/i18n/en.json';

const TABLES = { ko: KO, en: EN };
export const i18n = { lang: 'en' };

export function detectLang() {
  const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']);
  for (const l of list) {
    const base = String(l).toLowerCase().split('-')[0];
    if (TABLES[base]) return base;
  }
  return 'en';
}

export function setLang(pref) {
  i18n.lang = pref && pref !== 'auto' && TABLES[pref] ? pref : detectLang();
  document.documentElement.lang = i18n.lang;
}

// Korean particle by final consonant: {name:을/를}
function hasBatchim(word) {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  return /[136780lmnr]$/i.test(ch);
}

export function t(key, vars) {
  let s = TABLES[i18n.lang][key];
  if (s === undefined) s = EN[key];
  if (s === undefined) return key;
  if (vars) {
    s = s.replace(/\{(\w+)(?::([^/}]+)\/([^}]+))?\}/g, (m, k, a, b) => {
      const v = vars[k];
      if (v === undefined) return m;
      if (a !== undefined) return String(v) + (hasBatchim(String(v)) ? a : b);
      return String(v);
    });
  }
  return s;
}

export function itemCount(type, n) {
  return t('item_count', { n, name: t((n === 1 ? 'mat1.' : 'matN.') + type) });
}

export function joinItems(parts) {
  if (parts.length <= 1) return parts[0] || '';
  if (parts.length === 2) return t('items_join', { a: parts[0], b: parts[1] });
  return parts.slice(0, -1).join(', ') + (i18n.lang === 'ko' ? ', ' : ', ') + parts[parts.length - 1];
}

export function allStrings() { return [KO, EN]; }
