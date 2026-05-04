import { Link, useLocation } from 'react-router-dom';
import { Activity, Menu, X, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

const Header = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLUListElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const NAV_LINKS = [
    { path: '/', label: t('common.nav.home') },
    { path: '/analyze', label: t('common.nav.analyze') },
    { path: '/history', label: t('common.nav.history') },
    { path: '/about', label: t('common.nav.about') },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useLayoutEffect(() => {
    if (!navRef.current) return;
    const activeLink = navRef.current.querySelector('[data-active="true"]') as HTMLElement;
    if (activeLink) {
      setIndicator({
        left: activeLink.offsetLeft,
        width: activeLink.offsetWidth,
        ready: true,
      });
    }
  }, [location.pathname]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-lg border-b border-slate-200/80 shadow-sm'
          : 'bg-white border-b border-slate-200'
      }`}
    >
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 group"
          >
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-shadow">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white"></div>
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                GlucoAnalyzer
              </span>
              <span className="block text-[10px] text-slate-400 font-medium tracking-wider uppercase -mt-0.5">
                Health Intelligence
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <ul ref={navRef} className="hidden md:flex items-center gap-1 bg-slate-100/80 rounded-full p-1.5 relative">
            {indicator.ready && (
              <div
                className="absolute top-1.5 bottom-1.5 bg-white/80 backdrop-blur-xl rounded-full shadow-lg shadow-blue-500/10 border border-white/70 ring-1 ring-black/[0.04] transition-all duration-300 pointer-events-none"
                style={{
                  left: indicator.left,
                  width: indicator.width,
                  transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            )}
            {NAV_LINKS.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  data-active={location.pathname === link.path}
                  className={`relative z-10 px-5 py-3 rounded-full font-medium text-sm transition-colors duration-200 ${
                    location.pathname === link.path
                      ? 'text-blue-600'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop right: language switcher + CTA */}
          <div className="hidden md:flex items-center gap-2">
            <LanguageSwitcher variant="header" />
            {location.pathname !== '/analyze' ? (
              <Link
                to="/analyze"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                {t('common.nav.startAnalysis')}
              </Link>
            ) : (
              <div className="w-[165px]" />
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-3 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-slate-700" />
            ) : (
              <Menu className="w-5 h-5 text-slate-700" />
            )}
          </button>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200 animate-fade-in-up">
            <LanguageSwitcher variant="mobile" />
            <ul className="space-y-1">
              {NAV_LINKS.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all ${
                      location.pathname === link.path
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 border border-blue-100'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {location.pathname !== '/analyze' && (
                <li className="pt-2">
                  <Link
                    to="/analyze"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-4 py-3.5 rounded-xl"
                  >
                    <Sparkles className="w-4 h-4" />
                    {t('common.nav.startAnalysis')}
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
