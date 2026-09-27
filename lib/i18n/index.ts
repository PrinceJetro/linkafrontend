import { en, type EnKeys } from './en';
import { fr } from './fr';
import { sw } from './sw';
import { pt } from './pt';

export type Lang = 'en' | 'fr' | 'sw' | 'pt';
export type DictKey = EnKeys;

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'pt', label: 'Português' },
];

const dicts: Record<Lang, Record<string, string>> = { en, fr, sw, pt };

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const d = dicts[lang] ?? dicts.en;
  let s = d[key] ?? dicts.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}
