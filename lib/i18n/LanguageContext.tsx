'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { translate, type DictKey, type Lang } from './index';

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: DictKey, vars?: Record<string, string | number>) => string };

const LanguageContext = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (k) => k as string });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('linka_lang') as Lang | null;
      if (saved === 'en' || saved === 'fr' || saved === 'sw' || saved === 'pt') setLangState(saved);
    } catch { /* private mode */ }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('linka_lang', l) } catch { /* private mode */ }
    try { document.documentElement.lang = l } catch { /* ssr */ }
  }, []);

  useEffect(() => {
    try { document.documentElement.lang = lang } catch { /* ssr */ }
  }, [lang]);

  const t = useCallback((k: DictKey, vars?: Record<string, string | number>) => translate(lang, k, vars), [lang]);

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): Ctx {
  return useContext(LanguageContext);
}
