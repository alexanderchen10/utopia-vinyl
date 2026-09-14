'use client';

import { useEffect, useState } from 'react';
import { Languages } from 'lucide-react';

import type { SiteLanguage } from '@/lib/site-copy';

const STORAGE_KEY = 'utopia-vinyl-language';

export function useSiteLanguage() {
  const [language, setLanguage] = useState<SiteLanguage>('zh-Hant');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh-Hant') {
      const frame = window.requestAnimationFrame(() => setLanguage(stored));
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-Hant';
  }, [language]);

  return [language, setLanguage] as const;
}

export function LanguageSwitcher({
  language,
  onChange,
}: {
  language: SiteLanguage;
  onChange: (language: SiteLanguage) => void;
}) {
  return (
    <label className="language-switcher">
      <Languages aria-hidden="true" />
      <span className="sr-only">Language / 語言</span>
      <select
        aria-label="Language / 語言"
        onChange={(event) => onChange(event.target.value as SiteLanguage)}
        value={language}
      >
        <option value="zh-Hant">繁體中文</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
