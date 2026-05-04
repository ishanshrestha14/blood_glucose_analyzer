import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Upload,
  PenTool,
  BarChart3,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Shield,
  Brain,
  Scan,
  Sparkles,
  Zap,
  Heart,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Disclaimer from '../components/Disclaimer';
import { getHealthCheck } from '../services/api';
import type { HealthCheckResponse } from '../types';

const Home = () => {
  const { t } = useTranslation();
  const [healthStatus, setHealthStatus] = useState<HealthCheckResponse | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      setIsCheckingHealth(true);
      const response = await getHealthCheck();
      if (response.success && response.data) {
        setHealthStatus(response.data);
      }
      setIsCheckingHealth(false);
    };
    checkHealth();
  }, []);

  const TESTS = [
    { name: 'Fasting Blood Sugar (FBS)', range: '70-99 mg/dL', icon: '🌅' },
    { name: 'Post-Prandial (PPBS)', range: '< 140 mg/dL', icon: '🍽️' },
    { name: 'Random Blood Sugar (RBS)', range: '< 140 mg/dL', icon: '🕐' },
    { name: 'OGTT (2-hour)', range: '< 140 mg/dL', icon: '⏱️' },
    { name: 'HbA1c', range: '4.0-5.6%', icon: '📊' },
  ];

  return (
    <div className="flex-1">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
        {/* Animated Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-full blur-3xl"></div>
        </div>

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBtLTEgMGExIDEgMCAxIDAgMiAwIDEgMSAwIDEgMCAwLTIgMCIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvZz48L3N2Zz4=')] opacity-50"></div>

        <div className="container mx-auto px-4 py-24 lg:py-32 relative">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-full mb-8 border border-white/10 animate-fade-in-up">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-blue-100">{t('home.hero.badge')}</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-display-xl md:text-6xl lg:text-7xl mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              {t('home.hero.heading1')}
              <span className="block bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                {t('home.hero.heading2')}
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-blue-100/80 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              {t('home.hero.subtitle')}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Link
                to="/analyze"
                className="group inline-flex items-center gap-3 bg-white text-slate-900 font-semibold px-8 py-4 rounded-2xl hover:bg-blue-50 transition-all shadow-2xl shadow-black/20 hover:shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="w-5 h-5 text-blue-600" />
                {t('home.hero.ctaStart')}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md text-white font-semibold px-8 py-4 rounded-2xl hover:bg-white/20 transition-all border border-white/20"
              >
                {t('home.hero.ctaLearnMore')}
              </Link>
            </div>

            {/* Health Status Badges */}
            <div className="flex items-center justify-center gap-4 flex-wrap animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              {isCheckingHealth ? (
                <div className="flex items-center gap-3 px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-300" />
                  <span className="text-sm text-blue-200">{t('home.hero.checkingServices')}...</span>
                </div>
              ) : healthStatus ? (
                <>
                  <StatusBadge
                    label={t('home.hero.ocrEngine')}
                    icon={<Scan className="w-4 h-4" />}
                    ready={healthStatus.services.ocr.initialized}
                  />
                  <StatusBadge
                    label={t('home.hero.mlModel')}
                    icon={<Brain className="w-4 h-4" />}
                    ready={healthStatus.services.ml_model.initialized}
                  />
                </>
              ) : (
                <div className="flex items-center gap-3 px-5 py-2.5 bg-rose-500/20 backdrop-blur-md rounded-full border border-rose-400/20">
                  <XCircle className="w-4 h-4 text-rose-300" />
                  <span className="text-sm text-rose-200">{t('home.hero.backendOffline')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="#F8FAFC"/>
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Zap className="w-4 h-4" />
              {t('home.howItWorks.badge')}
            </div>
            <h2 className="text-display-md text-slate-900 mb-4">
              {t('home.howItWorks.heading')}
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {t('home.howItWorks.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <FeatureCard
              icon={<Upload className="w-7 h-7" />}
              title={t('home.howItWorks.upload.title')}
              description={t('home.howItWorks.upload.description')}
              step={1}
              gradient="from-blue-500 to-indigo-600"
            />
            <FeatureCard
              icon={<PenTool className="w-7 h-7" />}
              title={t('home.howItWorks.manual.title')}
              description={t('home.howItWorks.manual.description')}
              step={2}
              gradient="from-emerald-500 to-teal-600"
            />
            <FeatureCard
              icon={<BarChart3 className="w-7 h-7" />}
              title={t('home.howItWorks.insights.title')}
              description={t('home.howItWorks.insights.description')}
              step={3}
              gradient="from-violet-500 to-purple-600"
            />
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                  <Brain className="w-4 h-4" />
                  {t('home.capabilities.badge')}
                </div>
                <h2 className="text-display-md text-slate-900 mb-6">
                  {t('home.capabilities.heading')}
                </h2>
                <p className="text-lg text-slate-600 mb-10">
                  {t('home.capabilities.subtitle')}
                </p>
                <div className="space-y-5">
                  <CapabilityItem
                    icon={<Scan className="w-5 h-5" />}
                    title={t('home.capabilities.ocr.title')}
                    description={t('home.capabilities.ocr.description')}
                    gradient="from-blue-500 to-indigo-600"
                  />
                  <CapabilityItem
                    icon={<Shield className="w-5 h-5" />}
                    title={t('home.capabilities.ada.title')}
                    description={t('home.capabilities.ada.description')}
                    gradient="from-emerald-500 to-teal-600"
                  />
                  <CapabilityItem
                    icon={<Brain className="w-5 h-5" />}
                    title={t('home.capabilities.ml.title')}
                    description={t('home.capabilities.ml.description')}
                    gradient="from-violet-500 to-purple-600"
                  />
                  <CapabilityItem
                    icon={<Heart className="w-5 h-5" />}
                    title={t('home.capabilities.tests.title')}
                    description={t('home.capabilities.tests.description')}
                    gradient="from-rose-500 to-pink-600"
                  />
                </div>
              </div>

              {/* Test Types Card */}
              <div className="card-elevated p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{t('home.supportedTests.heading')}</h3>
                    <p className="text-sm text-slate-500">{t('home.supportedTests.subtitle')}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {TESTS.map((test, index) => (
                    <div
                      key={test.name}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 hover:shadow-md transition-shadow animate-fade-in-up"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{test.icon}</span>
                        <span className="text-sm font-medium text-slate-700">{test.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg">
                        {test.range}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 text-center relative">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            <span className="text-sm font-medium text-white">{t('home.cta.badge')}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {t('home.cta.heading')}
          </h2>
          <p className="text-blue-100 mb-10 max-w-xl mx-auto text-lg">
            {t('home.cta.subtitle')}
          </p>
          <Link
            to="/analyze"
            className="group inline-flex items-center gap-3 bg-white text-indigo-700 font-semibold px-10 py-5 rounded-2xl hover:bg-blue-50 transition-all shadow-2xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Activity className="w-5 h-5" />
            {t('home.cta.button')}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Disclaimer Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4 max-w-3xl">
          <Disclaimer />
        </div>
      </section>
    </div>
  );
};

// Status Badge Component
interface StatusBadgeProps {
  label: string;
  icon: React.ReactNode;
  ready: boolean;
}

const StatusBadge = ({ label, icon, ready }: StatusBadgeProps) => (
  <div
    className={`flex items-center gap-3 px-5 py-2.5 rounded-full backdrop-blur-md border transition-all ${
      ready
        ? 'bg-emerald-500/20 border-emerald-400/20'
        : 'bg-rose-500/20 border-rose-400/20'
    }`}
  >
    <div className={ready ? 'text-emerald-300' : 'text-rose-300'}>{icon}</div>
    <span className="text-sm font-medium text-white">{label}</span>
    {ready ? (
      <CheckCircle className="w-4 h-4 text-emerald-400" />
    ) : (
      <XCircle className="w-4 h-4 text-rose-400" />
    )}
  </div>
);

// Feature Card Component
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  step: number;
  gradient: string;
}

const FeatureCard = ({ icon, title, description, step, gradient }: FeatureCardProps) => (
  <div className="card-elevated p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
    <div className="relative mb-6">
      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg`}>
        {icon}
      </div>
      <div className="absolute -top-2 -right-2 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-md">
        {step}
      </div>
    </div>
    <h3 className="text-xl font-semibold text-slate-800 mb-3">{title}</h3>
    <p className="text-slate-600 leading-relaxed">{description}</p>
  </div>
);

// Capability Item Component
interface CapabilityItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

const CapabilityItem = ({ icon, title, description, gradient }: CapabilityItemProps) => (
  <div className="flex gap-4 group">
    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 text-white shadow-md group-hover:shadow-lg transition-shadow`}>
      {icon}
    </div>
    <div>
      <h4 className="font-semibold text-slate-800 mb-1">{title}</h4>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </div>
  </div>
);

export default Home;
