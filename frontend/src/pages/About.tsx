import { useTranslation } from 'react-i18next';
import { Info, Target, Shield, Heart, BookOpen } from 'lucide-react';
import Disclaimer from '../components/Disclaimer';

const About = () => {
  const { t } = useTranslation();

  const RANGES = [
    { test: 'Fasting Blood Sugar (FBS)', normal: '70-99 mg/dL', prediabetes: '100-125 mg/dL', diabetes: '126+ mg/dL' },
    { test: 'Post-Prandial (PPBS)', normal: '< 140 mg/dL', prediabetes: '140-199 mg/dL', diabetes: '200+ mg/dL' },
    { test: 'Random Blood Sugar (RBS)', normal: '< 140 mg/dL', prediabetes: '140-199 mg/dL', diabetes: '200+ mg/dL' },
    { test: 'HbA1c', normal: '< 5.7%', prediabetes: '5.7-6.4%', diabetes: '6.5%+' },
  ];

  return (
    <div className="flex-1 bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {t('about.hero.heading')}
          </h1>
          <p className="text-blue-100 max-w-2xl mx-auto">
            {t('about.hero.subtitle')}
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* What is this tool */}
        <section className="mb-12">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Info className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-3">{t('about.what.heading')}</h2>
                <p className="text-slate-600 leading-relaxed mb-4">{t('about.what.body')}</p>
                <ul className="space-y-2 text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                    <span><strong>{t('about.what.ocr.title')}:</strong> {t('about.what.ocr.description')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                    <span><strong>{t('about.what.ada.title')}:</strong> {t('about.what.ada.description')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                    <span><strong>{t('about.what.ml.title')}:</strong> {t('about.what.ml.description')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Target Ranges */}
        <section className="mb-12">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Target className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-800 mb-3">{t('about.ranges.heading')}</h2>
                <p className="text-slate-600 mb-4">{t('about.ranges.subtitle')}</p>
                <div className="grid gap-3">
                  {RANGES.map((row) => (
                    <div key={row.test} className="grid grid-cols-4 gap-2 text-sm p-3 bg-slate-50 rounded-lg">
                      <span className="font-medium text-slate-700">{row.test}</span>
                      <span className="text-emerald-600">{row.normal}</span>
                      <span className="text-amber-600">{row.prediabetes}</span>
                      <span className="text-rose-600">{row.diabetes}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-4 gap-2 text-xs text-slate-500 px-3">
                    <span></span>
                    <span>{t('about.ranges.normal')}</span>
                    <span>{t('about.ranges.prediabetes')}</span>
                    <span>{t('about.ranges.diabetes')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-12">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-3">{t('about.privacy.heading')}</h2>
                <p className="text-slate-600 leading-relaxed">{t('about.privacy.body')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Purpose */}
        <section className="mb-12">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Heart className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-3">{t('about.purpose.heading')}</h2>
                <p className="text-slate-600 leading-relaxed">{t('about.purpose.body')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Technology Stack — tech names stay in English per spec */}
        <section className="mb-12">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-3">Technology Stack</h2>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <h4 className="font-semibold text-slate-700 mb-2">Frontend</h4>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>React + TypeScript</li>
                      <li>Tailwind CSS</li>
                      <li>Recharts</li>
                      <li>Lucide Icons</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <h4 className="font-semibold text-slate-700 mb-2">Backend</h4>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>Python + Flask</li>
                      <li>PaddleOCR</li>
                      <li>Scikit-learn (Random Forest)</li>
                      <li>OpenCV</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <Disclaimer />
      </div>
    </div>
  );
};

export default About;
