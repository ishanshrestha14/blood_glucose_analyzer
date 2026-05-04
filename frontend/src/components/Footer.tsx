import { Activity, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white">{t('common.footer.brand')}</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {t('common.footer.tagline')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">{t('common.footer.quickLinks')}</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-sm hover:text-white transition-colors">
                  {t('common.nav.home')}
                </Link>
              </li>
              <li>
                <Link to="/analyze" className="text-sm hover:text-white transition-colors">
                  {t('common.nav.analyze')}
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-sm hover:text-white transition-colors">
                  {t('common.nav.about')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-white mb-4">{t('common.footer.resources')}</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://diabetes.org/about-diabetes/diagnosis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-white transition-colors"
                >
                  {t('common.footer.adaGuidelines')}
                </a>
              </li>
              <li>
                <a
                  href="https://www.cdc.gov/diabetes/basics/index.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-white transition-colors"
                >
                  {t('common.footer.cdcInfo')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              &copy; {currentYear} {t('common.footer.copyright')}
            </p>
            <p className="text-sm text-slate-500 flex items-center gap-1">
              {t('common.footer.madeWith')} <Heart className="w-4 h-4 text-rose-500 mx-1" /> for better health
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
