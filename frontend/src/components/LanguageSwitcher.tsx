import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'ne', flag: '🇳🇵', label: 'नेपाली' },
  { code: 'hi', flag: '🇮🇳', label: 'हिंदी' },
];

interface LanguageSwitcherProps {
  variant?: 'header' | 'mobile';
}

const LanguageSwitcher = ({ variant = 'header' }: LanguageSwitcherProps) => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  if (variant === 'mobile') {
    return (
      <div className="px-2 pb-2">
        <div className="flex gap-1">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                i18n.language === lang.code
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{lang.flag}</span>
              <span className="text-xs">{lang.code.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{currentLang.flag}</span>
        <span className="hidden sm:inline">{i18n.language.toUpperCase()}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-50"
        >
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              role="option"
              aria-selected={i18n.language === lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                i18n.language === lang.code
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
