'use client';

import { LANGS, type Lang } from '@/lib/i18n';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLanguage();
  return (
    <select
      aria-label="Language / Langue"
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      style={{
        borderRadius: 20, border: '1px solid #e1e9e3', background: '#fff',
        padding: compact ? '5px 8px' : '6px 10px', fontSize: 11, color: '#70807a',
      }}
    >
      {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
    </select>
  );
}
