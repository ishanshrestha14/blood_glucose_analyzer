import { Info, Shield, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DisclaimerProps {
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
}

const Disclaimer = ({ variant = 'default', className = '' }: DisclaimerProps) => {
  const { t } = useTranslation();

  if (variant === 'inline') {
    return (
      <p className={`text-xs text-slate-500 flex items-start gap-1.5 ${className}`}>
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
        <span>{t('common.disclaimer.inlineShort')}</span>
      </p>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-start gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200/50 ${className}`}>
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-amber-800 mb-0.5">{t('common.disclaimer.compactTitle')}</p>
          <p className="text-xs text-amber-700">
            {t('common.disclaimer.compactBody')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-elevated overflow-hidden ${className}`}>
      <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-5 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">{t('common.disclaimer.title')}</span>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-600 leading-relaxed">{t('common.disclaimer.body')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                <AlertCircle className="w-3 h-3" />
                {t('common.disclaimer.educationalOnly')}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                {t('common.disclaimer.notMedicalAdvice')}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                {t('common.disclaimer.consultProvider')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Disclaimer;
